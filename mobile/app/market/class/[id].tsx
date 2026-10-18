import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { inviteLink } from '../../../src/lib/pending-join';
import { useRealtime } from '../../../src/lib/realtime';
import { useClassProtect } from '../../../src/lib/protect';
import { t } from '../../../src/i18n';
import { Bubble, Composer } from '../../../src/chat/chat-ui';
import { ChannelPost, market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { useKeyboardOpen } from '../../../src/lib/keyboard';
import { ConnectionStrip, onReconnect } from '../../../src/lib/connection';
import { colors, radius, spacing } from '../../../src/theme/colors';
import { fmtDayTime } from '../../../src/ui/format';
import { Sheet, SheetAction } from '../../../src/ui/Sheet';
import { Person, PersonSheet } from '../../../src/ui/PersonSheet';
import { PinnedBar, PinsSheet } from '../../../src/ui/PinnedBar';
import { ClassLogo } from '../../../src/ui/ClassLogo';
import { themeOf, wallOf } from '../../../src/theme/chatThemes';

const POLL_MS = 15000; // safety net; new posts arrive instantly over the live connection

/**
 * A class is a channel, like a Telegram group: everyone in it writes, shares photos and files, and the next lesson is pinned on top.
 * Everything rarely needed (invite link, add a lesson, pupils, edit, cancel) is in the menu at the top right.
 */
export default function ClassChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  useClassProtect(id);
  const kbOpen = useKeyboardOpen();
  const router = useRouter();
  const cls = useAsync(() => market.classDetail(token as string, id), [token, id]);
  const sessions = useAsync(() => market.classSessions(token as string, id), [token, id]);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [menu, setMenu] = useState(false);
  const [who, setWho] = useState<Person | null>(null);
  const list = useRef<FlatList<ChannelPost>>(null);
  const lastSeq = useRef(0);
  const stick = useRef(true); // stay at the newest message unless the reader scrolled up
  const [pins, setPins] = useState<ChannelPost[]>([]);
  const [pinIdx, setPinIdx] = useState(0);
  const [pinList, setPinList] = useState(false);
  const [actionsFor, setActionsFor] = useState<ChannelPost | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChannelPost | null>(null);
  const [reporting, setReporting] = useState<ChannelPost | null>(null);
  const loadPins = useCallback(async () => {
    try { setPins((await market.channelPins(token as string, id)).items.filter((p) => !p.hidden)); } catch { /* the strip simply stays as it was */ }
  }, [token, id]);

  const load = useCallback(async (initial: boolean) => {
    try {
      const r = await market.channel(token as string, id, initial ? {} : { after: lastSeq.current || undefined });
      if (initial) setPosts(r.items);
      else if (r.items.length) setPosts((p) => [...p, ...r.items.filter((n) => !p.some((x) => x.id === n.id))]);
      lastSeq.current = Math.max(lastSeq.current, ...r.items.map((m) => m.seq));
      setState('ready');
    } catch {
      if (initial) setState('error');
    }
  }, [token, id]);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(false), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => { void loadPins(); }, [loadPins]);
  useEffect(() => { if (pinIdx >= pins.length) setPinIdx(0); }, [pins.length, pinIdx]);
  useRealtime(['class.channel', 'connect'], () => { void load(false); void loadPins(); });

  /** Scrolls to a message, loading older history first when it is not on screen yet, and flashes it so the eye finds it. */
  const jumpTo = async (postId: string, seq: number) => {
    let all = posts;
    let guard = 0;
    while (!all.some((p) => p.id === postId) && all.length && guard++ < 40) {
      const r = await market.channel(token as string, id, { before: Math.min(...all.map((p) => p.seq)) }).catch(() => null);
      if (!r || !r.items.length) break;
      all = [...r.items, ...all.filter((p) => !r.items.some((n) => n.id === p.id))];
      setPosts(all);
      if (!r.more) break;
    }
    const idx = all.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    stick.current = false;
    setTimeout(() => list.current?.scrollToIndex({ index: idx, viewPosition: 0.35, animated: true }), 60);
    setFlash(postId);
    setTimeout(() => setFlash(null), 1600);
    void seq;
  };
  const onPinBar = (p: { id: string }) => {
    const i = pins.findIndex((x) => x.id === p.id);
    void jumpTo(p.id, pins[i]?.seq ?? 0);
    setPinIdx((i + 1) % Math.max(1, pins.length));
  };
  const sendReport = (p: ChannelPost, reason: string) => market.channelReport(token as string, id, p.id, reason)
    .then(() => {
      setPosts((x) => x.map((y) => (y.id === p.id ? { ...y, hidden: 'reported', body: '', file: null, replyTo: null } : y)));
      Alert.alert(t('rp.sentTitle'), t('rp.sentText'));
    }).catch(fail);
  const clearReports = (p: ChannelPost) => market.channelClearReports(token as string, id, p.id)
    .then(() => { setPosts((x) => x.map((y) => (y.id === p.id ? { ...y, reports: 0, hidden: null } : y))); Alert.alert(t('rp.cleared')); void load(true); })
    .catch(fail);
  const pinPost = (p: ChannelPost, on: boolean) => market.channelPin(token as string, id, p.id, on)
    .then(() => { setPosts((x) => x.map((y) => (y.id === p.id ? { ...y, pinned: on } : y))); return loadPins(); })
    .catch(fail);

  const c = cls.data;
  const th = themeOf(c?.theme);
  const teacher = c?.role === 'teacher';
  const staff = teacher || c?.role === 'assistant'; // a helper answers and moderates like the teacher, but cannot edit the class
  const next = sessions.data?.find((s) => ['SCHEDULED', 'LOBBY', 'LIVE'].includes(s.status));
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
  const push = (path: string) => router.push(path as never);

  const add = (p: ChannelPost) => { lastSeq.current = Math.max(lastSeq.current, p.seq); setPosts((x) => [...x, p]); };
  // Outbox: shown at once as "sending", marked "not sent" when the connection drops, re-sent by itself when it returns.
  type Pending = ChannelPost & { state: 'SENDING' | 'FAILED' };
  const [pending, setPending] = useState<Pending[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;
  const deliver = async (tmp: Pending) => {
    setPending((p) => p.map((x) => (x.id === tmp.id ? { ...x, state: 'SENDING' } : x)));
    try {
      add(await market.channelPost(token as string, id, { body: tmp.body, replyToId: tmp.replyTo?.id }));
      setPending((p) => p.filter((x) => x.id !== tmp.id));
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 0) setPending((p) => p.map((x) => (x.id === tmp.id ? { ...x, state: 'FAILED' } : x)));
      else { setPending((p) => p.filter((x) => x.id !== tmp.id)); Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'CONTACT_INFO_NOT_ALLOWED' ? t('chat.contactBlocked') : e.message) : t('state.error')); }
    }
  };
  const send = (text: string) => {
    const tmp: Pending = { id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, seq: 0, at: new Date().toISOString(), body: text, mine: true, author: { id: null, name: null, teacher: false, username: null, hasPhoto: false }, file: null, state: 'SENDING' };
    stick.current = true;
    tmp.replyTo = replyTo ? { id: replyTo.id, body: replyTo.body, author: replyTo.author.name, hasFile: !!replyTo.file } : null;
    setReplyTo(null);
    setPending((p) => [...p, tmp]);
    void deliver(tmp);
  };
  useEffect(() => onReconnect(() => pendingRef.current.filter((x) => x.state === 'FAILED').forEach((x) => void deliver(x))), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sendFile = async (fileId: string) => { try { add(await market.channelPost(token as string, id, { fileId, replyToId: replyTo?.id })); setReplyTo(null); } catch (e) { throw new Error(e instanceof ApiError ? e.message : t('state.error')); } };
  const removePost = (p: ChannelPost) => {
    if (!(p.mine || staff)) return;
    Alert.alert(t('chan.deleteMsg'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.ok'), style: 'destructive', onPress: () => market.channelRemove(token as string, id, p.id).then(() => setPosts((x) => x.filter((y) => y.id !== p.id))).catch(fail) },
    ]);
  };
  const invite = () => Alert.alert(t('invite.warn'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.ok'), onPress: async () => {
      try {
        const r = await market.regenerateClassCode(token as string, id);
        await Share.share({ message: t(c?.joinApproval ? 'tg.message' : 'invite.message', { title: c?.title ?? '', link: inviteLink(API_URL, r.inviteToken), code: r.joinCode }) });
      } catch (e) { fail(e); }
    } },
  ]);
  const openDirect = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      push(`/market/thread/${th.id}`);
    } catch (e) { Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error')); }
  };
  const leave = () => Alert.alert(t('class.leave'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.ok'), style: 'destructive', onPress: async () => { try { for (const pid of c?.mySeats ?? []) await market.leaveClass(token as string, id, pid); router.back(); } catch (e) { fail(e); } } },
  ]);

  const actions: SheetAction[] = teacher
    ? [
        { label: t('invite.share'), icon: 'share-social', onPress: invite },
        { label: t('desk.title'), icon: 'people-circle', onPress: () => push(`/market/class-desk/${id}`) },
        { label: t('sched.add'), icon: 'calendar', onPress: () => push(`/market/class-schedule/${id}`) },
        { label: t('rank.title'), icon: 'trophy', onPress: () => push(`/market/class-ranking/${id}`) },
        { label: t('class.pupils'), icon: 'people', onPress: () => push(`/market/class-pupils/${id}`) },
        { label: t('cfile.title'), icon: 'document-text', onPress: () => push(`/market/class-files/${id}`) },
        { label: t('hw.title'), icon: 'create', onPress: () => push(`/market/class-homework/${id}`) },
        { label: t('class.edit'), icon: 'settings', onPress: () => push(`/market/class-edit?id=${id}`) },
      ]
    : [
        ...(c?.role === 'assistant' ? [{ label: t('desk.title'), icon: 'people-circle' as const, onPress: () => push(`/market/class-desk/${id}`) }] : []),
        { label: t('rank.title'), icon: 'trophy', onPress: () => push(`/market/class-ranking/${id}`) },
        { label: t('class.classmates'), icon: 'people', onPress: () => push(`/market/class-pupils/${id}`) },
        { label: t('hw.title'), icon: 'create', onPress: () => push(`/market/class-homework/${id}`) },
        { label: t('rev.rateClass'), icon: 'star', onPress: () => push(`/market/class-review/${id}`) },
        { label: t('class.leave'), icon: 'exit', onPress: leave, danger: true },
      ];

  const header = (
    <Stack.Screen options={{
      headerShown: true, title: c?.title ?? '', headerBackTitle: t('common.back'),
      headerTitle: () => (
        <Pressable accessibilityRole="button" onPress={() => push(`/market/class-info/${id}`)} style={styles.headTitle}>
          <ClassLogo classId={id} size={36} hasLogo={c?.hasLogo} title={c?.title} theme={c?.theme} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headName} numberOfLines={1}>{c?.title ?? ''}</Text>
            <Text style={styles.headSub} numberOfLines={1}>{c ? t('class.members', { n: c.enrolled }) : ''}</Text>
          </View>
        </Pressable>
      ),
      headerRight: () => <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel={t('common.more')}><Ionicons name="ellipsis-vertical" size={22} color={colors.text} /></Pressable>,
    }} />
  );
  if (cls.state !== 'ready' || !c || state === 'loading') return <View style={styles.root}>{header}<StateView state={cls.state === 'error' || state === 'error' ? 'error' : 'loading'} onRetry={() => { cls.reload(); void load(true); }} /></View>;
  const closed = c.status !== 'ACTIVE';

  return (
    <View style={[styles.root, { backgroundColor: wallOf(th) }]}>
      {header}
      <Pressable accessibilityRole="button" onPress={() => push(`/market/class-ranking/${id}`)} style={[styles.info, styles.infoRow]}>
        <Text style={styles.infoText} numberOfLines={1}>{c.subject}</Text>
        <View style={styles.rankChip}><Ionicons name="trophy" size={14} color="#FF9500" /><Text style={styles.rankChipText}>{t('rank.title')}</Text></View>
      </Pressable>
      <PinnedBar accent={th.accent} items={pins.map((p) => ({ id: p.id, body: p.body, at: p.at, fileName: p.file?.name, image: p.file?.image }))} index={pinIdx} onJump={onPinBar} onList={() => setPinList(true)} />
      {next && !closed && (
        <Pressable accessibilityRole="button" onPress={() => push(`/market/class-room/${next.id}`)} style={[styles.next, { backgroundColor: th.accent }]}>
          <Ionicons name={next.status === 'LIVE' ? 'radio' : 'videocam'} size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextTitle}>{next.status === 'LIVE' ? t('chan.liveNow') : t('chan.nextLesson')}</Text>
            <Text style={styles.nextSub}>{fmtDayTime(next.startAt)}</Text>
          </View>
          <View style={styles.nextBtn}><Text style={styles.nextBtnText}>{teacher ? t('chan.start') : t('room.open')}</Text></View>
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <ConnectionStrip />
        {posts.length + pending.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('chan.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{teacher ? t('chan.emptyTeacher') : t('chan.emptyPupil')}</Text>
          </View>
        ) : (
          <FlatList
            ref={list}
            data={[...posts, ...pending] as (ChannelPost & { state?: 'SENDING' | 'FAILED' })[]}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: spacing.sm }}
            onScrollToIndexFailed={(info) => setTimeout(() => list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true }), 80)}
            onContentSizeChange={() => { if (stick.current) list.current?.scrollToEnd({ animated: false }); }}
            onLayout={() => { if (stick.current) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 30); }}
            onScrollBeginDrag={(e) => { stick.current = false; void e; }}
            onMomentumScrollEnd={(e) => { const m = e.nativeEvent; stick.current = m.contentSize.height - m.layoutMeasurement.height - m.contentOffset.y < 160; }}
            onScrollEndDrag={(e) => { const m = e.nativeEvent; stick.current = m.contentSize.height - m.layoutMeasurement.height - m.contentOffset.y < 160; }}
            renderItem={({ item }) => (
              <Bubble
                token={token as string}
                mine={item.mine}
                body={item.body}
                at={item.at}
                state={(item as Partial<Pending>).state}
                onRetry={() => void deliver(item as Pending)}
                author={item.author.name}
                authorIsTeacher={item.author.teacher}
                authorIsAssistant={!!item.author.assistant}
                authorPhotoId={item.author.hasPhoto ? item.author.id : null}
                onAuthorPress={() => setWho({ userId: item.author.id, name: item.author.name, username: item.author.username, hasPhoto: item.author.hasPhoto, teacher: item.author.teacher })}
                file={item.file ? { id: item.file.id, name: item.file.name, size: item.file.size, image: item.file.image } : null}
                onLongPress={() => (!(item as Partial<Pending>).state ? setActionsFor(item) : undefined)}
                pinned={pins.some((x) => x.id === item.id)}
                theme={th}
                hidden={item.hidden ?? null}
                locked={!!c.protectContent && !teacher}
                reports={item.reports ?? 0}
                replyTo={item.replyTo ?? null}
                onQuotePress={() => item.replyTo && void jumpTo(item.replyTo.id, 0)}
                onSwipeReply={(item as Partial<Pending>).state ? undefined : () => setReplyTo(item)}
                highlight={flash === item.id}
              />
            )}
          />
        )}
        {closed ? <Text style={styles.closed}>{t('class.cancelledLabel')}</Text> : <Composer reply={replyTo ? { id: replyTo.id, body: replyTo.body, author: replyTo.author.name, hasFile: !!replyTo.file } : null} onCancelReply={() => setReplyTo(null)} accent={th.accent} wall={wallOf(th)} keyboardOpen={kbOpen} token={token as string} placeholder={t('chan.placeholder')} onSend={send} onAttached={sendFile} />}
      </View>
      <PinsSheet visible={pinList} items={pins.map((p) => ({ id: p.id, body: p.body, at: p.at, fileName: p.file?.name, image: p.file?.image }))} onClose={() => setPinList(false)}
        onJump={(p) => void jumpTo(p.id, 0)} onUnpin={staff ? (p) => { const full = pins.find((x) => x.id === p.id); if (full) void pinPost(full, false); } : undefined} />
      <Sheet visible={!!actionsFor} onClose={() => setActionsFor(null)} title={actionsFor?.body ? actionsFor.body.slice(0, 40) : undefined} actions={actionsFor ? [
        ...(actionsFor.hidden ? [] : [{ label: t('reply.action'), icon: 'arrow-undo' as const, onPress: () => setReplyTo(actionsFor) }]),
        ...(!actionsFor.mine && !actionsFor.hidden ? [{ label: t('rp.action'), icon: 'flag' as const, onPress: () => setReporting(actionsFor), danger: true }] : []),
        ...(staff && (actionsFor.reports ?? 0) > 0 ? [{ label: t('rp.clear'), icon: 'checkmark-circle' as const, onPress: () => void clearReports(actionsFor) }] : []),
        ...(staff && !actionsFor.hidden ? [{ label: pins.some((x) => x.id === actionsFor.id) ? t('pin.unpin') : t('pin.pin'), icon: 'pin' as const, onPress: () => void pinPost(actionsFor, !pins.some((x) => x.id === actionsFor.id)) }] : []),
        ...((actionsFor.mine || staff) ? [{ label: t('common.delete'), icon: 'trash' as const, onPress: () => removePost(actionsFor), danger: true }] : []),
      ] : []} />
      <Sheet visible={!!reporting} onClose={() => setReporting(null)} title={t('rp.title')} actions={reporting ? [
        { label: t('rp.spam'), icon: 'megaphone' as const, onPress: () => void sendReport(reporting, 'SPAM') },
        { label: t('rp.inappropriate'), icon: 'eye-off' as const, onPress: () => void sendReport(reporting, 'INAPPROPRIATE') },
        { label: t('rp.abuse'), icon: 'sad' as const, onPress: () => void sendReport(reporting, 'ABUSE') },
        { label: t('rp.personal'), icon: 'id-card' as const, onPress: () => void sendReport(reporting, 'PERSONAL_DATA') },
        { label: t('rp.other'), icon: 'ellipsis-horizontal' as const, onPress: () => void sendReport(reporting, 'OTHER') },
      ] : []} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title={c.title} actions={actions} />
      <PersonSheet person={who} onClose={() => setWho(null)} onMessage={openDirect} extra={teacher && who?.userId && !who.teacher ? { label: t('stu.detail'), icon: 'stats-chart', onPress: () => push(`/market/student/${who.userId}`) } : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 230 },
  logo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.hero, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headName: { fontSize: 16, fontWeight: '800', color: colors.text },
  headSub: { fontSize: 12, color: colors.textMuted },
  root: { flex: 1, backgroundColor: colors.background },
  info: { paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.warningSoft },
  rankChipText: { fontSize: 12, fontWeight: '700', color: colors.warningText },
  infoText: { color: colors.textMuted, fontSize: 13 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: spacing.sm, padding: 12, borderRadius: radius.lg, backgroundColor: colors.primary },
  nextTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nextSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  nextBtn: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  nextBtnText: { color: '#fff', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  closed: { textAlign: 'center', color: colors.textMuted, padding: spacing.md },
});

export { RouteError as ErrorBoundary } from '../../../src/ui/RouteError';
