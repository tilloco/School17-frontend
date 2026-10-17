import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { fmtDayShort } from '../../../src/ui/format';
import { colors, radius, spacing } from '../../../src/theme/colors';

const som = (minor: number) => Math.round(minor / 100).toLocaleString();

/** Teacher: class money board. One row per pupil for the chosen period; bulk confirm / not received / waive; remind all unpaid; CSV. Marks only: the app holds no money. */
export default function ClassMoneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [period, setPeriod] = useState<string | undefined>();
  const [sel, setSel] = useState<string[]>([]);
  const b = useAsync(() => market.classBoard(token as string, id, period), [token, id, period]);
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'REMIND_LIMIT' ? t('money.remindLimit') : e instanceof ApiError ? e.message : t('state.error'));
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setSel([]);
      b.reload();
    } catch (e) {
      fail(e);
    }
  };
  const toggle = (pid: string) => setSel((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  const exportCsv = async () => {
    try {
      const res = await fetch(`${API_URL}/classes/${id}/money/export.csv${period ? `?period=${encodeURIComponent(period)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('x');
      await Share.share({ message: await res.text() });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('cmoney.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <Text style={styles.help}>{t('money.note')}</Text>
        {b.state !== 'ready' || !b.data ? (
          <StateView state={b.state === 'ready' ? 'loading' : b.state} onRetry={b.reload} />
        ) : (
          <>
            <View style={styles.row}>
              {b.data.periods.map((p) => (
                <Pressable key={p.key} accessibilityRole="button" onPress={() => { setPeriod(p.key); setSel([]); }} style={[styles.chip, b.data!.period === p.key && styles.chipOn]}>
                  <Text style={{ color: b.data!.period === p.key ? '#fff' : colors.text }}>{p.label.length > 10 ? fmtDayShort(new Date(p.label)) : p.label}</Text>
                </Pressable>
              ))}
            </View>
            {b.data.rows.length === 0 && <Text style={styles.help}>{t('cmoney.none')}</Text>}
            {b.data.rows.map((r) => (
              <Pressable key={r.id} accessibilityRole="checkbox" accessibilityState={{ checked: sel.includes(r.id) }} onPress={() => toggle(r.id)} style={[styles.card, sel.includes(r.id) && styles.cardOn]}>
                <Text style={styles.strong}>{sel.includes(r.id) ? '☑ ' : '☐ '}{r.name}</Text>
                <Text>{t(`cmoney.status.${r.status}`)} · {som(r.amountMinor)}</Text>
              </Pressable>
            ))}
            <View style={styles.row}>
              <PrimaryButton title={t('cmoney.received')} disabled={!sel.length} onPress={() => run(() => market.classMark(token as string, id, 'received', sel))} />
              <PrimaryButton title={t('cmoney.notReceived')} variant="outline" disabled={!sel.length} onPress={() => run(() => market.classMark(token as string, id, 'not_received', sel))} />
              <PrimaryButton title={t('cmoney.waive')} variant="outline" disabled={!sel.length} onPress={() => run(() => market.classMark(token as string, id, 'waive', sel))} />
            </View>
            <PrimaryButton title={t('cmoney.remindAll')} variant="outline" onPress={() => run(async () => { const r = await market.classRemind(token as string, id, b.data!.period); Alert.alert(t('money.reminded'), String(r.reminded)); })} />
            <PrimaryButton title={t('money.export')} variant="outline" onPress={exportCsv} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 2 },
  cardOn: { borderColor: colors.primary },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
