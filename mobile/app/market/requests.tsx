import React, { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { Booking, market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

const DAY = 86_400_000;
const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** O'qituvchi: kelgan so'rovlar. Qabul qilish / rad etish / boshqa vaqt taklif qilish (o'z bo'sh vaqtlaridan). */
export default function RequestsScreen() {
  const { token } = useAuth();
  const res = useAsync(async () => {
    const all = await market.bookings(token as string, new Date().toISOString(), new Date(Date.now() + 60 * DAY).toISOString());
    return all.filter((b) => b.myRole === 'teacher' && b.status === 'REQUESTED');
  }, [token], (d) => d.length === 0);
  const [proposeFor, setProposeFor] = useState<Booking | null>(null);
  const [day, setDay] = useState(1);

  const profile = useAsync(() => market.ownProfile(token as string), [token]);
  const slots = useAsync(async () => {
    if (!proposeFor || !profile.data) return { slots: [] as string[], timezone: '', durationMin: 60 };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = new Date(start.getTime() + day * DAY);
    return market.slots(token as string, profile.data.id, from.toISOString(), new Date(from.getTime() + DAY).toISOString(), proposeFor.durationMin);
  }, [token, proposeFor?.id, day, profile.data?.id]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setProposeFor(null);
      res.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('req.title'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
          data={res.data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item: b }) => (
            <View style={styles.card}>
              <Text style={styles.when}>{fmt(b.startAt)} · {b.durationMin} min</Text>
              <Text>{b.student.name}</Text>
              {b.reschedule && <Text style={styles.help}>{t('lessons.counter', { time: fmt(b.reschedule.proposedStartAt) })}</Text>}
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                <PrimaryButton title={t('lessons.accept')} onPress={() => act(() => market.accept(token as string, b.id))} />
                <PrimaryButton title={t('req.propose')} variant="outline" onPress={() => setProposeFor(proposeFor?.id === b.id ? null : b)} />
                <PrimaryButton title={t('lessons.decline')} variant="outline" onPress={() => act(() => market.decline(token as string, b.id))} />
              </View>
              {proposeFor?.id === b.id && (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {profile.data?.verificationStatus !== 'VERIFIED' ? <Text style={styles.help}>{t('req.verifyFirst')}</Text> : (
                    <>
                      <Text style={styles.label}>{t('req.pickDay')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => {
                          const d = new Date(new Date().setHours(0, 0, 0, 0) + n * DAY);
                          return (
                            <Pressable key={n} accessibilityRole="button" onPress={() => setDay(n)} style={[styles.chip, day === n && styles.chipOn]}>
                              <Text style={day === n ? { color: colors.white } : undefined}>{d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <View style={styles.slots}>
                        {slots.data?.slots.map((s) => (
                          <Pressable key={s} accessibilityRole="button" onPress={() => act(async () => { await market.counterOffer(token as string, b.id, s); Alert.alert(t('req.sent')); })} style={styles.chip}>
                            <Text>{new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                          </Pressable>
                        ))}
                        {slots.data && slots.data.slots.length === 0 && <Text style={styles.help}>{t('teacher.noSlots')}</Text>}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 4 },
  when: { fontSize: 16, fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  label: { fontWeight: '700', color: colors.text },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
