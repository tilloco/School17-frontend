import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { AvailabilityRuleView, market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Haftalik jadval + dam olish kunlari. Vaqt zonasi: foydalanuvchi sozlamasi (standart Asia/Tashkent). */
export default function AvailabilityScreen() {
  const { token } = useAuth();
  const me = useAsync(() => market.me(token as string), [token]);
  const rules = useAsync(() => market.getAvailability(token as string), [token]);
  const prof = useAsync(() => market.ownProfile(token as string), [token]);
  const [list, setList] = useState<AvailabilityRuleView[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rules.data) setList(rules.data);
  }, [rules.data]);

  const header = <Stack.Screen options={{ headerShown: true, title: t('avail.title'), headerBackTitle: t('common.back') }} />;
  if (rules.state !== 'ready' && rules.state !== 'empty') return <Screen>{header}<StateView state={rules.state === 'loading' ? 'loading' : rules.state} onRetry={rules.reload} /></Screen>;

  const setRule = (i: number, patch: Partial<AvailabilityRuleView>) => setList((l) => l.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = async () => {
    if (list.some((r) => !HHMM.test(r.start) || !HHMM.test(r.end) || r.start >= r.end)) return Alert.alert(t('avail.invalid'));
    setBusy(true);
    try {
      await market.saveAvailability(token as string, list);
      Alert.alert(t('avail.saved'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  const addOff = async () => {
    if (!DATE.test(from) || !DATE.test(to) || from > to) return Alert.alert(t('common.error'), t('avail.invalid'));
    try {
      // Butun kunlar: [from 00:00, to+1 00:00) UTC bo'yicha (taxminiy chegara; aniq vaqt zonasi bo'yicha emas)
      const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000).toISOString();
      await market.addTimeOff(token as string, new Date(`${from}T00:00:00Z`).toISOString(), end);
      setFrom('');
      setTo('');
      prof.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>{t('avail.tz', { tz: me.data?.timezone ?? 'Asia/Tashkent' })}</Text>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <View key={d} style={styles.day}>
            <Text style={styles.dayName}>{t(`avail.weekday.${d}`)}</Text>
            {list.map((r, i) => r.weekday === d && (
              <View key={i} style={styles.range}>
                <TextInput accessibilityLabel={t('avail.from')} placeholder={t('avail.from')} value={r.start} onChangeText={(v) => setRule(i, { start: v })} style={styles.time} maxLength={5} keyboardType="numbers-and-punctuation" />
                <Text>–</Text>
                <TextInput accessibilityLabel={t('avail.to')} placeholder={t('avail.to')} value={r.end} onChangeText={(v) => setRule(i, { end: v })} style={styles.time} maxLength={5} keyboardType="numbers-and-punctuation" />
                <PrimaryButton title={t('avail.remove')} variant="outline" onPress={() => setList((l) => l.filter((_, k) => k !== i))} />
              </View>
            ))}
            <PrimaryButton title={t('avail.add')} variant="outline" onPress={() => setList((l) => [...l, { weekday: d, start: '09:00', end: '12:00' }])} />
          </View>
        ))}
        {list.length === 0 && <Text style={styles.help}>{t('avail.none')}</Text>}
        <PrimaryButton title={t('avail.save')} onPress={save} loading={busy} />

        <Text style={styles.dayName}>{t('avail.daysOff')}</Text>
        {prof.data?.timeOff.map((o) => (
          <View key={o.id} style={styles.range}>
            <Text style={{ flex: 1 }}>{o.startAt.slice(0, 10)} → {new Date(new Date(o.endAt).getTime() - 1).toISOString().slice(0, 10)}</Text>
            <PrimaryButton title={t('avail.remove')} variant="outline" onPress={() => market.removeTimeOff(token as string, o.id).then(prof.reload).catch(() => undefined)} />
          </View>
        ))}
        <TextInput accessibilityLabel={t('avail.dayOffFrom')} placeholder={t('avail.dayOffFrom')} value={from} onChangeText={setFrom} maxLength={10} style={styles.input} />
        <TextInput accessibilityLabel={t('avail.dayOffTo')} placeholder={t('avail.dayOffTo')} value={to} onChangeText={setTo} maxLength={10} style={styles.input} />
        <PrimaryButton title={t('avail.addDayOff')} variant="outline" onPress={addOff} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textMuted, fontSize: 13 },
  day: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  dayName: { fontSize: 16, fontWeight: '700', color: colors.text },
  range: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minWidth: 76, minHeight: 44, textAlign: 'center' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minHeight: 48 },
});
