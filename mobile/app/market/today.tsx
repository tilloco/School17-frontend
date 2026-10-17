import React from 'react';
import { fmtTime } from '../../src/ui/format';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

/** O'qituvchining "Bugun" bosh sahifasi: bugungi darslar (Kirish tugmasi), to'lanmaganlar soni va tezkor havolalar. */
export default function TodayScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const lessons = useAsync(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const all = await market.bookings(token as string, start.toISOString(), new Date(start.getTime() + 86_400_000).toISOString());
    return all.filter((b) => b.myRole === 'teacher' && ['CONFIRMED', 'REQUESTED', 'COMPLETED'].includes(b.status));
  }, [token], (d) => d.length === 0);
  // Pul hisoboti bo'lmasa (masalan eski server) bo'lim shunchaki ko'rinmaydi
  const money = useAsync(() => market.moneySummary(token as string).catch(() => ({ unpaidLessons: 0, awaitingConfirmation: 0 })), [token]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('setup.today'), headerBackTitle: t('common.back') }} />
      <Text style={styles.h1}>{t('today.title')}</Text>
      {!!money.data?.unpaidLessons && <Text style={styles.warn}>{t('today.unpaid', { count: money.data.unpaidLessons })}</Text>}
      {!!money.data?.awaitingConfirmation && <Text style={styles.warn}>{t('today.awaiting', { count: money.data.awaitingConfirmation })}</Text>}
      {lessons.state !== 'ready' || !lessons.data ? (
        lessons.state === 'empty' ? <Text style={styles.help}>{t('today.none')}</Text> : <StateView state={lessons.state === 'ready' ? 'loading' : lessons.state} onRetry={lessons.reload} />
      ) : (
        <FlatList
          data={lessons.data}
          keyExtractor={(b) => b.id}
          renderItem={({ item: b }) => (
            <View style={styles.card}>
              <Text style={styles.when}>{fmtTime(new Date(b.startAt))} · {b.durationMin} min</Text>
              <Text>{b.student.name}</Text>
              <Text style={styles.help}>{t(`status.${b.status}`)}</Text>
              {b.canJoinNow && <PrimaryButton title={t('lessons.join')} onPress={() => router.push(`/call/${b.id}` as never)} />}
              {['CONFIRMED', 'COMPLETED'].includes(b.status) && <PrimaryButton title={t('pay.button')} variant="outline" onPress={() => router.push(`/market/pay/${b.id}` as never)} />}
            </View>
          )}
        />
      )}
      <View style={styles.links}>
        <PrimaryButton title={t('setup.requests')} variant="outline" onPress={() => router.push('/market/requests' as never)} />
        <PrimaryButton title={t('setup.profile')} variant="outline" onPress={() => router.push('/market/profile-edit' as never)} />
        <PrimaryButton title={t('setup.availability')} variant="outline" onPress={() => router.push('/market/availability' as never)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.text, marginVertical: spacing.md },
  warn: { backgroundColor: colors.warningSoft, color: colors.warningText, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.sm },
  help: { color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  when: { fontSize: 18, fontWeight: '700', color: colors.text },
  links: { gap: spacing.sm, paddingVertical: spacing.md },
});
