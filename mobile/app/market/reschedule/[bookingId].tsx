import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

const DAY = 86_400_000;

/** Ask for another time for a confirmed lesson. The other side accepts or declines on the lessons screen. */
export default function RescheduleScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [day, setDay] = useState(1);
  const lessons = useAsync(() => market.bookings(token as string, new Date().toISOString(), new Date(Date.now() + 60 * DAY).toISOString()), [token]);
  const booking = lessons.data?.find((b) => b.id === bookingId);
  const slots = useAsync(async () => {
    if (!booking) return { slots: [] as string[], timezone: '', durationMin: 60 };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = new Date(start.getTime() + day * DAY);
    return market.slots(token as string, booking.teacher.id, from.toISOString(), new Date(from.getTime() + DAY).toISOString(), booking.durationMin);
  }, [token, booking?.id, day]);

  const pick = async (iso: string) => {
    try {
      await market.requestReschedule(token as string, bookingId as string, iso);
      Alert.alert(t('resch.sent'));
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('resch.title'), headerBackTitle: t('common.back') }} />
      {lessons.state !== 'ready' || !booking ? (
        <StateView state={lessons.state === 'ready' ? 'empty' : lessons.state} onRetry={lessons.reload} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
          <Text style={styles.help}>{t('resch.help')}</Text>
          <Text style={styles.label}>{t('req.pickDay')}</Text>
          <View style={styles.slots}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable key={n} accessibilityRole="button" onPress={() => setDay(n)} style={[styles.chip, day === n && styles.chipOn]}>
                <Text style={{ color: day === n ? '#fff' : colors.text }}>{new Date(Date.now() + n * DAY).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</Text>
              </Pressable>
            ))}
          </View>
          {slots.state !== 'ready' || !slots.data ? (
            <StateView state={slots.state === 'ready' ? 'loading' : slots.state} onRetry={slots.reload} />
          ) : slots.data.slots.length === 0 ? (
            <Text style={styles.help}>{t('teacher.noSlots')}</Text>
          ) : (
            <View style={styles.slots}>
              {slots.data.slots.map((s) => (
                <Pressable key={s} accessibilityRole="button" onPress={() => pick(s)} style={styles.chip}>
                  <Text style={{ color: colors.text }}>{new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textMuted, fontSize: 13 },
  label: { fontWeight: '700', color: colors.text },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
