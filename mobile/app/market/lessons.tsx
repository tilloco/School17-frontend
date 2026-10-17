import React from 'react';
import { fmtDateTime } from '../../src/ui/format';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Stack, useRouter } from 'expo-router';
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

export default function LessonsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const res = useAsync(() => {
    const from = new Date(Date.now() - 7 * DAY).toISOString();
    const to = new Date(Date.now() + 60 * DAY).toISOString();
    return market.bookings(token as string, from, to);
  }, [token], (d) => d.length === 0);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      res.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : String(e));
    }
  };
  const confirmCancel = (b: Booking) => {
    const hoursLeft = (new Date(b.startAt).getTime() - Date.now()) / 3_600_000;
    const late = hoursLeft < b.lateCancelPolicy.freeCancelHours && b.myRole !== 'teacher';
    Alert.alert(t('lessons.cancelConfirm'), late ? t('lessons.lateWarning', { hours: b.lateCancelPolicy.freeCancelHours }) : undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('lessons.cancel'), style: 'destructive', onPress: () => act(() => market.cancel(token as string, b.id)) },
    ]);
  };
  const openChat = (b: Booking) => act(async () => {
    const th = await market.openThread(token as string, b.id);
    router.push(`/market/thread/${th.id}` as never);
  });

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('market.lessons'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
          data={res.data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item: b }) => {
            const open = b.status === 'REQUESTED' || b.status === 'CONFIRMED';
            return (
              <View style={styles.card}>
                <Text style={styles.when}>{fmtDateTime(new Date(b.startAt))} · {b.durationMin} min</Text>
                <Text style={styles.who}>{b.myRole === 'teacher' ? b.student.name : b.teacher.name}</Text>
                <Text style={styles.status}>{t(`status.${b.status}`)}</Text>
                {b.reschedule && !b.reschedule.byMe && (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={styles.status}>{t('lessons.counter', { time: fmtDateTime(new Date(b.reschedule.proposedStartAt)) })}</Text>
                    <PrimaryButton title={t('lessons.acceptTime')} onPress={() => act(() => market.acceptTime(token as string, b.id))} />
                    <PrimaryButton title={t('lessons.declineTime')} variant="outline" onPress={() => act(() => market.rejectTime(token as string, b.id))} />
                  </View>
                )}
                <View style={styles.actions}>
                  {b.canJoinNow && <PrimaryButton title={t('lessons.join')} onPress={() => router.push(`/call/${b.id}` as never)} />}
                  {b.myRole === 'teacher' && b.status === 'REQUESTED' && (
                    <>
                      <PrimaryButton title={t('lessons.accept')} onPress={() => act(() => market.accept(token as string, b.id))} />
                      <PrimaryButton title={t('lessons.decline')} variant="outline" onPress={() => act(() => market.decline(token as string, b.id))} />
                    </>
                  )}
                  {['CONFIRMED', 'COMPLETED', 'NO_SHOW_STUDENT'].includes(b.status) && !b.isTrial && (
                    <PrimaryButton title={t('pay.button')} variant="outline" onPress={() => router.push(`/market/pay/${b.id}` as never)} />
                  )}
                  {b.status === 'CONFIRMED' && !b.reschedule && <PrimaryButton title={t('resch.button')} variant="outline" onPress={() => router.push(`/market/reschedule/${b.id}` as never)} />}
                  {b.status === 'COMPLETED' && b.myRole !== 'teacher' && <PrimaryButton title={t('rev.write')} variant="outline" onPress={() => router.push('/market/reviews' as never)} />}
                  {open && <PrimaryButton title={t('lessons.chat')} variant="outline" onPress={() => openChat(b)} />}
                  {open && <PrimaryButton title={t('lessons.cancel')} variant="outline" onPress={() => confirmCancel(b)} />}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  when: { fontSize: 16, fontWeight: '700', color: colors.text },
  who: { color: colors.text },
  status: { color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
