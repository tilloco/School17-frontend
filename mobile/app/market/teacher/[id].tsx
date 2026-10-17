import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';
import { fmtDay, fmtTime, fmtDayShort } from '../../../src/ui/format';
import { Action, Avatar, Card, Pill, SectionTitle, Stars } from '../../../src/ui';
import { Sheet } from '../../../src/ui/Sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAY = 86_400_000;

/** Teacher profile: who they are, the stars, what former pupils and other people say (two separate lists), and booking. */
export default function TeacherScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dayOffset, setDayOffset] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'ex' | 'other'>('ex');
  const [open, setOpen] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);

  const teacher = useAsync(() => market.teacher(token as string, id), [token, id]);
  const reviews = useAsync(() => market.reviewsAll(token as string, id), [token, id]);
  const comments = useAsync(() => market.comments(token as string, id), [token, id]);
  const day = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return new Date(start.getTime() + dayOffset * DAY);
  }, [dayOffset]);
  const slots = useAsync(() => market.slots(token as string, id, day.toISOString(), new Date(day.getTime() + DAY).toISOString(), 60), [token, id, day]);
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'CONTACT_INFO_NOT_ALLOWED' ? t('comment.noContacts') : e.message) : t('state.error'));

  const book = async () => {
    if (!picked || !token) return;
    setBusy(true);
    try {
      const b = await market.book(token, { teacherId: id, startAt: picked, durationMin: 60 });
      Alert.alert(t('teacher.book'), t('teacher.booked', { status: t(`status.${b.status}`) }));
      router.push('/market/lessons' as never);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const sendComment = async () => {
    try {
      await market.writeComment(token as string, id, draft.trim());
      setDraft('');
      comments.reload();
    } catch (e) { fail(e); }
  };
  const removeComment = () => market.deleteComment(token as string, id).then(comments.reload).catch(fail);
  const share = () => teacher.data && Share.share({ message: t('share.profile', { name: teacher.data.name ?? '', link: `${API_URL.replace(/\/+$/, '')}/p/${id}` }) });
  const block = () => market.blockTeacher(token as string, id).then(() => router.back()).catch(() => undefined);

  const header = (
    <Stack.Screen options={{
      headerShown: true, title: '', headerBackTitle: t('common.back'), headerTransparent: false,
      headerRight: () => <Pressable onPress={() => setMenu(true)} hitSlop={12}><Ionicons name="ellipsis-vertical" size={22} color={colors.text} /></Pressable>,
    }} />
  );
  if (teacher.state !== 'ready' || !teacher.data) return <View style={styles.root}>{header}<StateView state={teacher.state === 'ready' ? 'loading' : teacher.state} onRetry={teacher.reload} /></View>;
  const p = teacher.data;
  const mine = user?.role === 'TEACHER'; // teachers do not comment on teachers
  const fmt = (iso: string) => fmtTime(new Date(iso));
  const exComments = (comments.data?.items ?? []).filter((c) => c.exStudent);
  const otherComments = (comments.data?.items ?? []).filter((c) => !c.exStudent);
  const myComment = comments.data?.mine ?? null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Avatar name={p.name} size={96} photoOf={p.hasPhoto ? p.id : null} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{p.name}</Text>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
          {!!p.username && <Text style={styles.username}>@{p.username}</Text>}
          <Text style={styles.headline}>{p.headline}</Text>
          <View style={styles.starsRow}>
            <Stars value={p.rating.average ?? 0} size={20} />
            <Text style={styles.ratingText}>{p.rating.count ? `${(p.rating.average ?? 0).toFixed(1)} · ${t('home.ratingCount', { n: p.rating.count })}` : t('teacher.noReviews')}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{Math.round(p.priceMinor / 100).toLocaleString('en-US').replace(/,/g, ' ')}</Text><Text style={styles.statLabel}>{t('teacher.perHourShort')}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{p.subjects.length}</Text><Text style={styles.statLabel}>{t('profile.subjects')}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{p.languages.map((l) => l.toUpperCase()).join(' ')}</Text><Text style={styles.statLabel}>{t('profile.languages')}</Text></View>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={share} style={styles.shareBtn}><Ionicons name="paper-plane" size={20} color={colors.primary} /><Text style={styles.shareText}>{t('share.telegram')}</Text></Pressable>
        </View>

        <SectionTitle title={t('teacher.about')} />
        <Card><Text style={styles.bio}>{p.bio}</Text>
          <View style={styles.chips}>{p.subjects.map((s) => <Pill key={s} label={t(`subj.${s}`)} tone="primary" />)}</View>
        </Card>

        <SectionTitle title={t('teacher.chooseTime')} />
        <Text style={styles.meta}>{t('teacher.timezone', { tz: slots.data?.timezone ?? p.timezone })}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => {
            const d = new Date(new Date().setHours(0, 0, 0, 0) + n * DAY);
            return (
              <Pressable key={n} accessibilityRole="button" onPress={() => { setDayOffset(n); setPicked(null); }} style={[styles.chip, dayOffset === n && styles.chipOn]}>
                <Text style={[styles.chipText, dayOffset === n && { color: '#fff' }]}>{fmtDayShort(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {slots.state === 'loading' ? <StateView state="loading" /> : slots.state === 'offline' || slots.state === 'error' ? <StateView state={slots.state} onRetry={slots.reload} /> : (
          <View style={styles.slots}>
            {slots.data && slots.data.slots.length === 0 && <Text style={styles.meta}>{t('teacher.noSlots')}</Text>}
            {slots.data?.slots.map((s) => (
              <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: picked === s }} onPress={() => setPicked(s)} style={[styles.chip, picked === s && styles.chipOn]}>
                <Text style={[styles.chipText, picked === s && { color: '#fff' }]}>{fmt(s)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.meta}>{t(`pay.timing.${p.paymentTiming}`)}</Text>
        <Action label={busy ? t('state.loading') : t('teacher.book')} kind="accent" onPress={book} disabled={!picked || busy} />

        <SectionTitle title={t('comment.title')} />
        {!open ? (
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.opinionBtn}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
            <Text style={styles.opinionText}>{t('comment.show')}</Text>
          </Pressable>
        ) : (<>
        <View style={styles.seg}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'ex' }} onPress={() => setTab('ex')} style={[styles.segItem, tab === 'ex' && styles.segOn]}>
            <Text style={[styles.segText, tab === 'ex' && { color: '#fff' }]}>{t('comment.ex')} ({(reviews.data?.items.length ?? 0) + exComments.length})</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'other' }} onPress={() => setTab('other')} style={[styles.segItem, tab === 'other' && styles.segOn]}>
            <Text style={[styles.segText, tab === 'other' && { color: '#fff' }]}>{t('comment.other')} ({otherComments.length})</Text>
          </Pressable>
        </View>
        <Text style={styles.meta}>{t(tab === 'ex' ? 'comment.exHint' : 'comment.otherHint')}</Text>

        {tab === 'ex' && (
          <>
            {(reviews.data?.items ?? []).map((r) => (
              <Card key={r.id} style={{ gap: 4 }}>
                <View style={styles.reviewHead}><Text style={styles.author}>{r.author}</Text><Stars value={r.rating} size={14} /></View>
                {r.textHidden ? <Text style={styles.hiddenText}>{t('comment.textHidden')}</Text> : !!r.text && <Text style={styles.text}>{r.text}</Text>}
                {r.reply && <Text style={styles.reply}>↳ {r.reply.text}</Text>}
                <Text style={styles.date}>{fmtDay(r.createdAt)}</Text>
              </Card>
            ))}
            {exComments.map((c) => (
              <Card key={c.id} style={{ gap: 4 }}>
                <Text style={styles.author}>{c.author}</Text>
                <Text style={styles.text}>{c.text}</Text>
                <Text style={styles.date}>{fmtDay(c.at)}</Text>
              </Card>
            ))}
            {!(reviews.data?.items.length || exComments.length) && <Text style={styles.empty}>{t('comment.noneEx')}</Text>}
          </>
        )}
        {tab === 'other' && (
          <>
            {otherComments.map((c) => (
              <Card key={c.id} style={{ gap: 4 }}>
                <View style={styles.reviewHead}><Text style={styles.author}>{c.author}</Text>{c.mine ? <Pressable onPress={removeComment} hitSlop={8}><Text style={styles.del}>{t('common.delete')}</Text></Pressable> : <Pressable onPress={() => setReportFor(c.id)} hitSlop={8}><Text style={styles.report}>{t('chat.report')}</Text></Pressable>}</View>
                <Text style={styles.text}>{c.text}</Text>
                <Text style={styles.date}>{fmtDay(c.at)}</Text>
              </Card>
            ))}
            {!otherComments.length && <Text style={styles.empty}>{t('comment.noneOther')}</Text>}
            {!mine && (
              <View style={styles.write}>
                <TextInput value={draft || (myComment && !draft ? '' : draft)} onChangeText={setDraft} placeholder={myComment ? t('comment.editHint') : t('comment.placeholder')} placeholderTextColor={colors.textMuted} multiline maxLength={500} style={styles.input} accessibilityLabel={t('comment.placeholder')} />
                <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} onPress={sendComment} disabled={draft.trim().length < 3} style={[styles.send, draft.trim().length < 3 && { opacity: 0.4 }]}><Ionicons name="send" size={20} color="#fff" /></Pressable>
              </View>
            )}
          </>
        )}
        </>)}
        <Text style={styles.meta}>{t('free.notice')}</Text>
      </ScrollView>
      <Sheet visible={!!reportFor} onClose={() => setReportFor(null)} title={t('chat.report')} actions={(['ABUSE', 'SPAM', 'PERSONAL_DATA', 'OTHER'] as const).map((reason) => ({ label: t(`report.${reason}`), icon: 'flag' as const, onPress: () => { const cid = reportFor!; market.reportComment(token as string, id, cid, reason).then(() => Alert.alert(t('report.sent'))).catch(fail); } }))} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title={p.name ?? ''} actions={[
        { label: t('share.telegram'), icon: 'paper-plane', onPress: share },
        ...(!mine ? [{ label: t('teacher.block'), icon: 'ban' as const, onPress: block, danger: true }] : []),
      ]} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: spacing.md },
  top: { alignItems: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  username: { color: colors.primaryLight, fontWeight: '600', fontSize: 15 },
  headline: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  ratingText: { color: colors.text, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.primary, fontWeight: '700' },
  bio: { fontSize: 15, lineHeight: 22, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 13 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '600', color: colors.text },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  seg: { flexDirection: 'row', backgroundColor: colors.neutralSoft, borderRadius: 999, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { fontWeight: '700', color: colors.text },
  text: { color: colors.text, lineHeight: 21 },
  reply: { color: colors.textMuted },
  date: { color: colors.textMuted, fontSize: 12 },
  del: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  opinionBtn: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, backgroundColor: colors.primarySoft },
  opinionText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  hiddenText: { color: colors.textMuted, fontStyle: 'italic' },
  report: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  write: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl - 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, maxHeight: 120, color: colors.text, fontSize: 15 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
