import React, { useMemo, useState } from 'react';
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

export default function TeacherScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dayOffset, setDayOffset] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teacher = useAsync(() => market.teacher(token as string, id), [token, id]);
  const reviews = useAsync(() => market.reviews(token as string, id), [token, id]);
  const day = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return new Date(start.getTime() + dayOffset * DAY);
  }, [dayOffset]);
  const slots = useAsync(() => market.slots(token as string, id, day.toISOString(), new Date(day.getTime() + DAY).toISOString(), 60), [token, id, day]);

  const book = async () => {
    if (!picked || !token) return;
    setBusy(true);
    try {
      const b = await market.book(token, { teacherId: id, startAt: picked, durationMin: 60 });
      Alert.alert(t('teacher.book'), t('teacher.booked', { status: t(`status.${b.status}`) }));
      router.push('/market/lessons' as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const block = async () => {
    try {
      await market.blockTeacher(token as string, id);
      router.back();
    } catch {
      /* ko'rsatilmaydi */
    }
  };

  const header = <Stack.Screen options={{ headerShown: true, title: teacher.data?.name ?? t('market.find'), headerBackTitle: t('common.back') }} />;
  if (teacher.state !== 'ready' || !teacher.data) return <Screen>{header}<StateView state={teacher.state === 'ready' ? 'loading' : teacher.state} onRetry={teacher.reload} /></Screen>;
  const p = teacher.data;
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.md }}>
        <Text style={styles.h1}>{p.name} ✓ <Text style={styles.verified}>{t('teacher.verified')}</Text></Text>
        <Text style={styles.headline}>{p.headline}</Text>
        <Text style={styles.bio}>{p.bio}</Text>
        <Text style={styles.price}>{t('teacher.perHour', { price: Math.round(p.priceMinor / 100).toLocaleString('en-US').replace(/,/g, ' ') })}</Text>
        <Text style={styles.meta}>
          {p.rating.count ? t('teacher.rating', { avg: (p.rating.average ?? 0).toFixed(1), count: p.rating.count }) : t('teacher.noReviews')}
        </Text>
        {reviews.data?.items.map((r) => (
          <View key={r.id} style={styles.review}>
            <Text style={styles.reviewHead}>{'★'.repeat(r.rating)} · {r.author}</Text>
            {!!r.text && <Text>{r.text}</Text>}
            {r.reply && <Text style={styles.reply}>↳ {r.reply.text}</Text>}
          </View>
        ))}

        <Text style={styles.h2}>{t('teacher.chooseTime')}</Text>
        <Text style={styles.meta}>{t('teacher.timezone', { tz: slots.data?.timezone ?? p.timezone })}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => {
            const d = new Date(new Date().setHours(0, 0, 0, 0) + n * DAY);
            return (
              <Pressable key={n} accessibilityRole="button" onPress={() => { setDayOffset(n); setPicked(null); }} style={[styles.chip, dayOffset === n && styles.chipOn]}>
                <Text style={dayOffset === n ? { color: colors.white } : undefined}>{d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {slots.state === 'loading' ? <StateView state="loading" /> : slots.state === 'offline' || slots.state === 'error' ? <StateView state={slots.state} onRetry={slots.reload} /> : (
          <View style={styles.slots}>
            {slots.data && slots.data.slots.length === 0 && <Text style={styles.meta}>{t('teacher.noSlots')}</Text>}
            {slots.data?.slots.map((s) => (
              <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: picked === s }} onPress={() => setPicked(s)} style={[styles.chip, picked === s && styles.chipOn]}>
                <Text style={picked === s ? { color: colors.white } : undefined}>{fmt(s)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.meta}>{t(`pay.timing.${p.paymentTiming}`)}</Text>
        <Text style={styles.meta}>{t('teacher.guardianNeeded')}</Text>
        <Text style={styles.meta}>{t('free.notice')}</Text>
        <PrimaryButton title={t('teacher.book')} onPress={book} disabled={!picked} loading={busy} />
        <PrimaryButton title={t('teacher.block')} variant="outline" onPress={block} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  verified: { fontSize: 13, color: colors.success, fontWeight: '600' },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  headline: { fontSize: 16, color: colors.text, fontWeight: '600' },
  bio: { color: colors.text },
  price: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.textMuted, fontSize: 13 },
  review: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  reviewHead: { fontWeight: '600', color: colors.text },
  reply: { color: colors.textMuted, marginTop: 4 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
