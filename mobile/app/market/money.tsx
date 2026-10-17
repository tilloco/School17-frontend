import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../src/ui/Text';
import { Stack } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { Action, Avatar, Card, Empty, Group, Page, SectionTitle } from '../../src/ui';

const som = (minor: number) => Math.round(minor / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Teacher's own notebook: who owes, reminders, monthly total, CSV. These are only the teacher's marks; the platform holds no money. */
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
  const i = income.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('money.title'), headerBackTitle: t('common.back') }} />
      <Page edges={[]} onRefresh={() => { owed.reload(); classOwed.reload(); income.reload(); }}>
        <Text style={styles.note}>{t('money.note')}</Text>

        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('money.prev')} onPress={() => shift(-1)} hitSlop={10} style={styles.arrow}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
          <Text style={styles.month}>{month}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('money.next')} onPress={() => shift(1)} hitSlop={10} style={styles.arrow}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></Pressable>
        </View>

        {income.state !== 'ready' || !i ? <StateView state={income.state === 'ready' ? 'loading' : income.state} onRetry={income.reload} /> : (
          <Card style={{ gap: spacing.md }}>
            <View>
              <Text style={styles.big}>{som(i.confirmedMinor)} <Text style={styles.cur}>{t('common.currency')}</Text></Text>
              <Text style={styles.sub}>{t('money.confirmedShort', { n: i.confirmedCount })}</Text>
            </View>
            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: colors.warningSoft }]}><Text style={[styles.statN, { color: colors.warningText }]}>{i.awaitingConfirmation}</Text><Text style={[styles.statL, { color: colors.warningText }]}>{t('money.awaitingShort')}</Text></View>
              <View style={[styles.stat, { backgroundColor: colors.dangerSoft }]}><Text style={[styles.statN, { color: colors.danger }]}>{i.unpaidLessons}</Text><Text style={[styles.statL, { color: colors.danger }]}>{t('money.unpaidShort')}</Text></View>
            </View>
          </Card>
        )}
        <Action label={t('money.export')} icon="download" kind="outline" onPress={exportCsv} />

        <SectionTitle title={t('money.owed')} />
        {owed.state !== 'ready' || !owed.data ? (
          <StateView state={owed.state === 'ready' ? 'loading' : owed.state} onRetry={owed.reload} />
        ) : owed.data.length === 0 ? (
          <Empty icon="checkmark-circle" title={t('money.none')} />
        ) : (
          <Group>
            {owed.data.map((g) => (
              <View key={g.remindBookingId} style={styles.owe}>
                <Avatar name={g.pupilName} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{g.pupilName}</Text>
                  <Text style={styles.sub}>{t('money.lessons', { n: g.count })} · {som(g.totalMinor)} {t('common.currency')}</Text>
                </View>
                <Pressable accessibilityRole="button" disabled={!g.canRemind} onPress={() => remind(g.remindBookingId)} style={[styles.remind, !g.canRemind && { opacity: 0.4 }]}><Text style={styles.remindText}>{t('money.remind')}</Text></Pressable>
              </View>
            ))}
          </Group>
        )}
        {(classOwed.data?.length ?? 0) > 0 && (
          <>
            <SectionTitle title={t('cmoney.title')} />
            <Group>
              {classOwed.data!.map((g) => (
                <View key={g.classId + g.pupilName} style={styles.owe}>
                  <Avatar name={g.pupilName} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{g.pupilName}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{g.classTitle} · {t('money.lessons', { n: g.count })} · {som(g.totalMinor)} {t('common.currency')}</Text>
                  </View>
                </View>
              ))}
            </Group>
          </>
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 22, fontWeight: '800', color: colors.text },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  cur: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  sub: { fontSize: 13, color: colors.textMuted },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderRadius: 16, padding: spacing.md, gap: 2 },
  statN: { fontSize: 24, fontWeight: '800' },
  statL: { fontSize: 12, fontWeight: '600' },
  owe: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  remind: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  remindText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
