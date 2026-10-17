import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { API_URL, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { fmtDay, fmtDayTime, fmtMoney } from '../../src/ui/format';
import { Avatar, Card, Empty, Page, Pill, SectionTitle } from '../../src/ui';

/** Teacher: every pupil in one list with what needs attention (unpaid marks, work to mark, no activity). Tap for the full picture. */
export default function StudentsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const res = useAsync(() => market.students(token as string), [token]);
  const own = useAsync(() => market.ownProfile(token as string).catch(() => null), [token]);
  const invite = () => own.data && Share.share({ message: t('invite.message', { name: user?.name ?? '', link: `${API_URL.replace(/\/+$/, '')}/p/${own.data.id}` }) });
  const [q, setQ] = useState('');
  const rows = useMemo(() => (res.data ?? []).filter((r) => !q.trim() || (r.name ?? '').toLowerCase().includes(q.trim().toLowerCase())), [res.data, q]);
  const attention = rows.filter((r) => r.attention);
  const others = rows.filter((r) => !r.attention);

  const message = async (bookingId: string | null) => {
    if (!bookingId) return Alert.alert(t('stu.noChat'));
    try {
      const th = await market.openThread(token as string, bookingId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  const card = (r: NonNullable<typeof res.data>[number]) => (
    <Card key={r.pupilId} onPress={() => router.push(`/market/student/${r.pupilId}` as never)} style={{ gap: spacing.sm }}>
      <View style={styles.head}>
        <Avatar name={r.name} tone={r.attention ? 'warning' : 'primary'} userId={r.hasPhoto ? r.pupilId : null} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {r.nextAt ? t('stu.next', { time: fmtDayTime(r.nextAt) }) : r.lastLessonAt ? t('stu.last', { time: fmtDayTime(r.lastLessonAt) }) : t('stu.noLessons')}
          </Text>
          {!!r.since && <Text style={styles.sub} numberOfLines={1}>{t('stu.since', { date: fmtDay(r.since) })}</Text>}
        </View>
        <Pressable onPress={() => message(r.chatBookingId)} accessibilityRole="button" accessibilityLabel={t('stu.message')} hitSlop={8} style={styles.msg}><Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} /></Pressable>
      </View>
      <View style={styles.pills}>
        <Pill label={t('stu.lessons', { n: r.lessonsCompleted })} icon="school" tone="primary" />
        {r.classes.map((c) => <Pill key={c.id} label={c.title} icon="people" tone="neutral" />)}
        {r.payment.owedCount > 0 ? <Pill label={t('stu.owed', { sum: fmtMoney(r.payment.owedMinor) })} tone="danger" icon="cash" /> : (r.lessonsCompleted > 0 || r.classes.length > 0) && <Pill label={t('stu.paidUp')} tone="success" icon="checkmark-circle" />}
        {r.homework.toMark > 0 && <Pill label={t('stu.toMark', { n: r.homework.toMark })} tone="warning" icon="checkmark-done" />}
        {r.homework.assigned > 0 && <Pill label={t('stu.hw', { done: r.homework.submitted, total: r.homework.assigned })} tone="neutral" icon="document-text" />}
        {r.homework.avgScore !== null && <Pill label={t('stu.avg', { n: r.homework.avgScore })} tone="success" icon="trophy" />}
      </View>
    </Card>
  );

  return (
    <Page onRefresh={res.reload}>
      <Text style={styles.h1}>{t('stu.title')}</Text>
      {own.data && (
        <Pressable accessibilityRole="button" onPress={invite} style={styles.invite}>
          <View style={styles.inviteIcon}><Ionicons name="person-add" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteTitle}>{t('invite.title')}</Text>
            <Text style={styles.inviteText}>{t('invite.text')}</Text>
          </View>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </Pressable>
      )}
      <TextInput value={q} onChangeText={setQ} placeholderTextColor={colors.textMuted} placeholder={t('stu.search')} accessibilityLabel={t('stu.search')} style={styles.search} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : res.data.length === 0 ? (
        <Empty icon="people" title={t('stu.emptyTitle')} text={t('stu.emptyText')} action={{ label: t('class.create'), onPress: () => router.push('/market/class-edit' as never) }} />
      ) : (
        <>
          {attention.length > 0 && <SectionTitle title={t('stu.attention')} />}
          {attention.map(card)}
          {others.length > 0 && <SectionTitle title={t('stu.all', { n: others.length })} />}
          {others.map(card)}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, borderRadius: 20, padding: 14 },
  inviteIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  inviteText: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 48, color: colors.text },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  msg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
