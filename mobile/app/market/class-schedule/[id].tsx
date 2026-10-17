import React, { useMemo, useState } from 'react';
import { fmtDateTime } from '../../../src/ui/format';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { getLocale, t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { colors, spacing } from '../../../src/theme/colors';
import { Action } from '../../../src/ui';

const DAY = 86_400_000;
const HOURS = Array.from({ length: 28 }, (_, i) => 7 * 60 + i * 30).filter((m) => m <= 22 * 60); // 07:00 .. 22:00 every 30 min
const DURATIONS = [30, 45, 60, 90];
const pad = (n: number) => String(n).padStart(2, '0');

/** Add one lesson to a class: pick a day, a start time and a length. Pupils get a notification. */
export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => { const d = new Date(Date.now() + i * DAY); d.setHours(0, 0, 0, 0); return d; }), []);
  const [day, setDay] = useState(0);
  const [minute, setMinute] = useState(18 * 60);
  const [dur, setDur] = useState(60);
  const [busy, setBusy] = useState(false);

  const when = new Date(days[day].getTime() + minute * 60_000);
  const past = when.getTime() <= Date.now();
  const save = async () => {
    setBusy(true);
    try {
      await market.addClassSession(token as string, id, { startAt: when.toISOString(), durationMin: dur });
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  const wd = (d: Date) => t(`dow.${d.getDay()}`);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: t('sched.add'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h}>{t('sched.day')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => (
            <Pressable key={i} accessibilityRole="radio" accessibilityState={{ selected: i === day }} onPress={() => setDay(i)} style={[styles.day, i === day && styles.on]}>
              <Text style={[styles.dayName, i === day && styles.onText]}>{i === 0 ? t('common.today') : wd(d)}</Text>
              <Text style={[styles.dayNum, i === day && styles.onText]}>{d.getDate()}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.h}>{t('sched.time')}</Text>
        <View style={styles.grid}>
          {HOURS.map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: m === minute }} onPress={() => setMinute(m)} style={[styles.chip, m === minute && styles.on]}>
              <Text style={[styles.chipText, m === minute && styles.onText]}>{pad(Math.floor(m / 60))}:{pad(m % 60)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.h}>{t('sched.length')}</Text>
        <View style={styles.grid}>
          {DURATIONS.map((d) => (
            <Pressable key={d} accessibilityRole="radio" accessibilityState={{ selected: d === dur }} onPress={() => setDur(d)} style={[styles.chip, d === dur && styles.on]}>
              <Text style={[styles.chipText, d === dur && styles.onText]}>{d} {t('common.min')}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.summary}>{fmtDateTime(when)}</Text>
        {past && <Text style={styles.warn}>{t('sched.past')}</Text>}
        <Action label={busy ? t('state.loading') : t('sched.add')} kind="accent" onPress={save} disabled={busy || past} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.md },
  h: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  day: { width: 62, paddingVertical: 10, borderRadius: 16, alignItems: 'center', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dayName: { fontSize: 12, color: colors.textMuted },
  dayNum: { fontSize: 20, fontWeight: '800', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { fontWeight: '600', color: colors.text },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  onText: { color: '#fff' },
  summary: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  warn: { color: colors.danger },
});
