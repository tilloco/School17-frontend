import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../src/ui/Text';
import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { useKeyboardPadding } from '../../../src/lib/keyboard';
import { useRealtime } from '../../../src/lib/realtime';
import { SignalPill, useConnection } from '../../../src/lib/connection';
import { useSessionProtect } from '../../../src/lib/protect';
import { LiveLesson } from '../../../src/call/LiveLesson';
import { t } from '../../../src/i18n';
import { Audience, AudienceItem, ClassRoomState, market } from '../../../src/market/marketApi';
import { ClassPayGate } from '../../../src/market/ClassPayGate';
import { PollPanel } from '../../../src/market/PollPanel';
import { PresentationPanel } from '../../../src/market/PresentationPanel';
import { colors, spacing } from '../../../src/theme/colors';
import { Avatar } from '../../../src/ui';
import { fmtTime } from '../../../src/ui/format';
import { PersonSheet, Person } from '../../../src/ui/PersonSheet';
import { Sheet, SheetAction } from '../../../src/ui/Sheet';

const POLL_MS = 15000; // safety net only: changes arrive instantly over the live connection

type Panel = 'poll' | 'material' | null;

/** Small round-corner shortcut used under the video (whiteboard, chat, poll, material). */
function Chip({ icon, label, onPress, badge }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.chip}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
      {!!badge && <View style={styles.chipBadge}><Text style={styles.chipBadgeText}>{badge}</Text></View>}
    </Pressable>
  );
}

/**
 * A live class, Telegram voice-chat style: the picture on top, a slim row of shortcuts, then the people in the class.
 * Pupils raise a hand; the teacher taps a person to give the stage (voice or video), mute, remove, or write to them.
 */
export default function ClassRoomScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  useSessionProtect(sid);
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kbModal = useKeyboardPadding({ modal: true });
  const [st, setSt] = useState<ClassRoomState | null>(null);
  const [aud, setAud] = useState<AudienceItem[]>([]);
  const [view, setView] = useState<'loading' | 'ready' | 'error'>('loading');
  const [panel, setPanel] = useState<Panel>(null);
  const [who, setWho] = useState<AudienceItem | null>(null);
  const [profile, setProfile] = useState<Person | null>(null);
  const [menu, setMenu] = useState(false);
  const { online } = useConnection();

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([market.roomState(token as string, sid), market.roomAudience(token as string, sid).catch(() => ({ items: [] } as Audience))]);
      setSt(s);
      setAud(a.items);
      setView('ready');
    } catch {
      setView((v) => (v === 'ready' ? v : 'error'));
    }
  }, [token, sid]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);
  useRealtime(['class:state', 'class:present', 'class:settings', 'connect'], () => void load());

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      Alert.alert(t('common.error'), code === 'STAGE_FULL' ? t('room.stageFull') : code === 'TOO_EARLY' ? t('room.tooEarly') : code === 'ROOM_LOCKED' ? t('room.locked') : e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  const post = (path: string, body: object = {}) => act(() => market.roomPost(token as string, sid, path, body));
  const openDirect = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error'));
    }
  };

  const header = <Stack.Screen options={{ headerShown: true, title: t('room.title'), headerBackTitle: t('common.back'), headerRight: () => <SignalPill /> }} />;
  if (view !== 'ready' || !st) return <Screen>{header}<StateView state={view === 'error' ? 'error' : 'loading'} onRetry={load} /></Screen>;

  const teacher = st.role === 'teacher';
  const live = st.status === 'LIVE';
  const me = st.me;
  const hands = aud.filter((a) => a.hand).length;
  const rowActions = (a: AudienceItem): SheetAction[] => {
    const out: SheetAction[] = [];
    if (teacher && !a.teacher) {
      if (a.stage === 'NONE') {
        out.push({ label: t('room.grantVoice'), icon: 'mic', onPress: () => void post('stage/grant', { pupilId: a.key, mode: 'VOICE' }) });
        out.push({ label: t('room.grantVideo'), icon: 'videocam', onPress: () => void post('stage/grant', { pupilId: a.key, mode: 'VOICE_VIDEO' }) });
      } else {
        out.push({ label: t('room.revoke'), icon: 'mic-off', onPress: () => void post('stage/revoke', { pupilId: a.key }) });
        out.push({ label: t('room.mute'), icon: 'volume-mute', onPress: () => void post('mute', { pupilId: a.key }) });
      }
      out.push({ label: t('room.spotlight'), icon: 'star', onPress: () => void post('spotlight', { pupilId: a.key }) });
    }
    if (a.id && !a.me) out.push({ label: t('dm.write'), icon: 'chatbubble', onPress: () => void openDirect(a.id as string) });
    if (a.id && !a.me) out.push({ label: t('room.profile'), icon: 'person-circle', onPress: () => setProfile({ userId: a.id as string, name: a.name, username: a.username, hasPhoto: a.hasPhoto, teacher: a.teacher }) });
    if (teacher && !a.teacher) out.push({ label: t('room.removePupil'), icon: 'close-circle', danger: true, onPress: () => void post('remove', { pupilId: a.key }) });
    return out;
  };

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {!online && <View style={styles.offline}><Text style={styles.offlineText}>{t('net.lessonLost')}</Text></View>}

        {live ? (
          <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs }}>
            <LiveLesson token={token as string} sid={sid} teacher={teacher} teacherId={st.teacherId} teacherName={st.teacherName ?? ''} canPublish={!!me && me.stage !== 'NONE' && !me.removed} />
          </View>
        ) : (
          <View style={styles.status}>
            <Text style={styles.statusTitle}>{t(`class.status.${st.status}`)}</Text>
            {st.status === 'LOBBY' && !teacher && <Text style={styles.muted}>{t('room.waiting')}</Text>}
            {st.status === 'SCHEDULED' && <Text style={styles.muted}>{t('room.lobbyAt', { time: fmtTime(new Date(st.lobbyOpensAt)) })}</Text>}
            {st.status === 'ENDED' && st.teacherNoShow && <Text style={styles.muted}>{t('room.noShow')}</Text>}
          </View>
        )}
        {st.teacherReconnecting && <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]} accessibilityLiveRegion="polite">{t('room.teacherReconnecting')}</Text>}

        <View style={styles.chips}>
          {live && <Chip icon="brush" label={t('wb.title')} onPress={() => router.push(`/market/class-whiteboard/${sid}` as never)} />}
          {(live || st.status === 'LOBBY') && <Chip icon="chatbubbles" label={t('cchat.title')} onPress={() => router.push(`/market/class-chat/${sid}` as never)} />}
          {live && <Chip icon="stats-chart" label={t('poll.title')} onPress={() => setPanel('poll')} />}
          {live && <Chip icon="document-text" label={t('pres.title')} onPress={() => setPanel('material')} />}
          {(st.status === 'SCHEDULED' || st.status === 'LOBBY') && <Chip icon="speedometer" label={t('pre.title')} onPress={() => router.push('/market/precheck' as never)} />}
          {teacher && live && <Chip icon="ellipsis-horizontal" label={t('room.more')} onPress={() => setMenu(true)} />}
        </View>

        {teacher && st.status === 'LOBBY' && (
          <Pressable accessibilityRole="button" onPress={() => act(() => market.roomStart(token as string, sid))} style={styles.start}>
            <Ionicons name="play" size={18} color="#fff" /><Text style={styles.startText}>{t('room.start')}</Text>
          </Pressable>
        )}

        {!teacher && me?.paymentGate && st.status !== 'ENDED' && <View style={{ paddingHorizontal: spacing.md }}><ClassPayGate token={token as string} gate={me.paymentGate} onChanged={load} /></View>}

        {!teacher && live && me && (
          <View style={styles.pupilBar}>
            {me.removed ? <Text style={styles.muted}>{t('room.removed')}</Text> : me.stage !== 'NONE' ? (
              <Pressable accessibilityRole="button" onPress={() => post('stage/leave')} style={[styles.pill, { backgroundColor: colors.neutralSoft }]}><Ionicons name="exit" size={16} color={colors.text} /><Text style={[styles.pillText, { color: colors.text }]}>{t('room.leaveStage')}</Text></Pressable>
            ) : st.stageMode === 'HAND_RAISE' ? (
              <Pressable accessibilityRole="button" onPress={() => act(() => market.roomHand(token as string, sid, !me.handRaised))} style={[styles.pill, me.handRaised && { backgroundColor: colors.warning }]}><Text style={styles.pillText}>✋ {t(me.handRaised ? 'room.lowerHand' : 'room.raiseHand')}</Text></Pressable>
            ) : st.stageMode === 'OPEN_STAGE' ? (
              <Pressable accessibilityRole="button" onPress={() => post('stage/take')} style={styles.pill}><Ionicons name="mic" size={16} color="#fff" /><Text style={styles.pillText}>{t('room.takeStage')}</Text></Pressable>
            ) : <Text style={styles.muted}>{t('room.listenOnly')}</Text>}
          </View>
        )}

        {(live || st.status === 'LOBBY') && (
          <View style={styles.listCard}>
            <View style={styles.listHead}>
              <Text style={styles.listTitle}>{t('room.audience')}</Text>
              <Text style={styles.count}>{aud.length}</Text>
              {hands > 0 && teacher && <View style={styles.handsBadge}><Text style={styles.handsText}>✋ {hands}</Text></View>}
              <View style={{ flex: 1 }} />
              {live && <Text style={styles.muted}>{t('room.stageCount', { n: st.stageCount, max: st.stageMax })}</Text>}
            </View>
            {aud.map((a) => {
              const actions = rowActions(a);
              return (
                <Pressable key={a.key} accessibilityRole="button" disabled={!actions.length} onPress={() => setWho(a)} style={styles.row}>
                  <Avatar name={a.name} size={42} userId={a.hasPhoto ? a.id : null} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{a.name}{a.me ? ` (${t('rank.you')})` : ''}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{a.teacher ? t('role.TEACHER') : a.stage !== 'NONE' ? t('room.onStage') : a.hand ? t('room.handUp') : a.present ? t('room.here') : ''}</Text>
                  </View>
                  {a.hand && <Text style={{ fontSize: 18 }}>✋</Text>}
                  {a.stage !== 'NONE' && <View style={styles.micDot}><Ionicons name={a.stage === 'VOICE_VIDEO' ? 'videocam' : 'mic'} size={13} color="#fff" /></View>}
                  {a.present && !a.hand && a.stage === 'NONE' && !a.teacher && <View style={styles.presentDot} />}
                  {!!actions.length && <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {st.status === 'ENDED' && (
          <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md }}>
            {!st.teacherNoShow && <Pressable accessibilityRole="button" onPress={() => router.push(`/market/class-recap/${sid}` as never)} style={styles.pill}><Text style={styles.pillText}>{t('recap.open')}</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.pill, { backgroundColor: colors.neutralSoft }]}><Text style={[styles.pillText, { color: colors.text }]}>{t('common.back')}</Text></Pressable>
          </View>
        )}
      </ScrollView>

      <Sheet visible={!!who} onClose={() => setWho(null)} title={who?.name ?? undefined} actions={who ? rowActions(who) : []} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title={t('room.title')} actions={[
        ...(['LISTEN_ONLY', 'HAND_RAISE', 'OPEN_STAGE'] as const).map((m): SheetAction => ({ label: `${st.stageMode === m ? '✓ ' : ''}${t(`room.mode.${m}`)}`, icon: m === 'LISTEN_ONLY' ? 'ear' : m === 'HAND_RAISE' ? 'hand-left' : 'mic', onPress: () => void act(() => market.roomStageMode(token as string, sid, m)) })),
        { label: t('room.muteAll'), icon: 'volume-mute', onPress: () => void post('mute-all') },
        { label: t(st.locked ? 'room.unlock' : 'room.lock'), icon: st.locked ? 'lock-open' : 'lock-closed', onPress: () => void post('lock', { locked: !st.locked }) },
        { label: t('room.end'), icon: 'stop-circle', danger: true, onPress: () => Alert.alert(t('room.end'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), style: 'destructive', onPress: () => void post('end') }]) },
      ]} />
      <PersonSheet person={profile} onClose={() => setProfile(null)} onMessage={openDirect} />

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPanel(null)}>
          <Pressable style={[styles.panel, { paddingBottom: (kbModal || insets.bottom) + 12, maxHeight: kbModal ? '95%' : '82%' }]} onPress={() => undefined}>
            <View style={styles.grip} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {panel === 'poll' && <PollPanel token={token as string} sessionId={sid} teacher={teacher} />}
              {panel === 'material' && <PresentationPanel token={token as string} classId={st.classId} sessionId={sid} state={st} teacher={teacher} onChanged={load} />}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  offline: { backgroundColor: colors.warningSoft, padding: 8, marginHorizontal: spacing.md, borderRadius: 12, marginTop: 6 },
  offlineText: { color: colors.warningText, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  status: { alignItems: 'center', gap: 4, paddingVertical: spacing.lg },
  statusTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chipBadge: { backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chipBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  start: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, borderRadius: 16, paddingVertical: 13, marginHorizontal: spacing.md, marginTop: spacing.md },
  startText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  pupilBar: { paddingHorizontal: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22 },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  listCard: { backgroundColor: colors.surface, borderRadius: 22, marginHorizontal: spacing.md, marginTop: spacing.md, paddingVertical: 6 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  listTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  count: { color: colors.textMuted, fontWeight: '700', backgroundColor: colors.neutralSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 1, overflow: 'hidden', fontSize: 12 },
  handsBadge: { backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  handsText: { color: colors.warningText, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 9 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted },
  micDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  presentDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  panel: { backgroundColor: colors.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%', paddingHorizontal: spacing.md, paddingTop: 10 },
  grip: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
});

export { RouteError as ErrorBoundary } from '../../../src/ui/RouteError';
