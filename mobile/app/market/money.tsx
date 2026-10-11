import React, { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

const som = (minor: number) => Math.round(minor / 100).toLocaleString();
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Teacher: who owes, reminders, monthly income, CSV. Only the teacher's own marks; the platform holds no money. */
export default function MoneyScreen() {
  const { token } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const month = ym(cursor);
  const owed = useAsync(() => market.owed(token as string), [token]);
  const classOwed = useAsync(() => market.classOwed(token as string), [token]);
  const income = useAsync(() => market.income(token as string, month), [token, month]);
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  const remind = async (bookingId: string) => {
    try {
      await market.remind(token as string, bookingId);
      Alert.alert(t('money.reminded'));
      owed.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'REMIND_LIMIT' ? t('money.remindLimit') : e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  const exportCsv = async () => {
    try {
      const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
      const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();
      await Share.share({ message: await market.exportCsv(token as string, from, to) });
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('money.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <Text style={styles.help}>{t('money.note')}</Text>
        <Text style={styles.h2}>{t('money.income')} · {month}</Text>
        {income.state !== 'ready' || !income.data ? (
          <StateView state={income.state === 'ready' ? 'loading' : income.state} onRetry={income.reload} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.strong}>{t('money.confirmed', { n: income.data.confirmedCount, sum: som(income.data.confirmedMinor) })}</Text>
            <Text>{t('money.awaiting', { n: income.data.awaitingConfirmation })}</Text>
            <Text>{t('money.unpaid', { n: income.data.unpaidLessons })}</Text>
          </View>
        )}
        <View style={styles.row}>
          <PrimaryButton title={t('money.prev')} variant="outline" onPress={() => shift(-1)} />
          <PrimaryButton title={t('money.next')} variant="outline" onPress={() => shift(1)} />
        </View>
        <PrimaryButton title={t('money.export')} variant="outline" onPress={exportCsv} />
        <Text style={styles.h2}>{t('money.owed')}</Text>
        {owed.state !== 'ready' || !owed.data ? (
          <StateView state={owed.state === 'ready' ? 'loading' : owed.state} onRetry={owed.reload} />
        ) : owed.data.length === 0 ? (
          <Text style={styles.help}>{t('money.none')}</Text>
        ) : (
          owed.data.map((g) => (
            <View key={g.remindBookingId} style={styles.card}>
              <Text style={styles.strong}>{g.pupilName}</Text>
              <Text>{t('money.lessons', { n: g.count })} · {som(g.totalMinor)}</Text>
              <PrimaryButton title={t('money.remind')} variant="outline" disabled={!g.canRemind} onPress={() => remind(g.remindBookingId)} />
            </View>
          ))
        )}
        {(classOwed.data?.length ?? 0) > 0 && (
          <>
            <Text style={styles.h2}>{t('cmoney.title')}</Text>
            {classOwed.data!.map((g) => (
              <View key={g.classId + g.pupilName} style={styles.card}>
                <Text style={styles.strong}>{g.pupilName} · {g.classTitle}</Text>
                <Text>{t('money.lessons', { n: g.count })} · {som(g.totalMinor)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.sm },
});
