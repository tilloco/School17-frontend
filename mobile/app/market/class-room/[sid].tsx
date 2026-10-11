import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { ClassRoomState, market, RosterRow } from '../../../src/market/marketApi';
import { ClassPayGate } from '../../../src/market/ClassPayGate';
import { PresentationPanel } from '../../../src/market/PresentationPanel';
import { colors, radius, spacing } from '../../../src/theme/colors';

const POLL_MS = 3000; // control plane polling; media itself needs the LiveKit client in a development build (R4)

/** Class room control plane: lobby / live state, hand raise, stage, teacher controls and roster. Media is not connected here yet. */
export default function ClassRoomScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [st, setSt] = useState<ClassRoomState | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [view, setView] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    try {
      const s = await market.roomState(token as string, sid);
      setSt(s);
      if (s.role === 'teacher') setRoster(await market.roomRoster(token as string, sid));
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

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      Alert.alert(t('common.error'), code === 'STAGE_FULL' ? t('room.stageFull') : code === 'TOO_EARLY' ? t('room.tooEarly') : code === 'ROOM_LOCKED' ? t('room.locked') : code === 'REMOVED_FROM_SESSION' ? t('room.removed') : e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  if (view !== 'ready' || !st) return <Screen><Stack.Screen options={{ headerShown: true, title: t('room.title'), headerBackTitle: t('common.back') }} /><StateView state={view === 'error' ? 'error' : 'loading'} onRetry={load} /></Screen>;
  const teacher = st.role === 'teacher';
  const live = st.status === 'LIVE';
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('room.title'), headerBackTitle: t('common.back') }} />
      <FlatList
        data={teacher && live ? roster : []}
        keyExtractor={(r) => r.pupilId}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
            <View style={styles.card}>
              <Text style={styles.strong}>{t(`class.status.${st.status}`)}</Text>
              {st.status === 'LOBBY' && !teacher && <Text>{t('room.waiting')}</Text>}
              {st.status === 'SCHEDULED' && <Text style={styles.help}>{t('room.lobbyAt', { time: new Date(st.lobbyOpensAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</Text>}
              {st.teacherReconnecting && <Text accessibilityLiveRegion="polite">{t('room.teacherReconnecting')}</Text>}
              {st.status === 'ENDED' && st.teacherNoShow && <Text>{t('room.noShow')}</Text>}
              {live && <Text style={styles.help}>{t('room.stageCount', { n: st.stageCount, max: st.stageMax })}</Text>}
              {live && <Text style={styles.help}>{t('room.mediaNote')}</Text>}
            </View>
            {(st.status === 'SCHEDULED' || st.status === 'LOBBY') && <PrimaryButton title={t('pre.title')} variant="outline" onPress={() => router.push('/market/precheck' as never)} />}
            {live && <PrimaryButton title={t('wb.title')} variant="outline" onPress={() => router.push(`/market/class-whiteboard/${sid}` as never)} />}
            {(live || st.status === 'LOBBY') && <PrimaryButton title={t('cchat.title')} variant="outline" onPress={() => router.push(`/market/class-chat/${sid}` as never)} />}
            {live && <PresentationPanel token={token as string} classId={st.classId} sessionId={sid} state={st} teacher={teacher} onChanged={load} />}
            {teacher && st.status === 'LOBBY' && <PrimaryButton title={t('room.start')} onPress={() => act(() => market.roomStart(token as string, sid))} />}
            {teacher && live && (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.row}>
                  {(['LISTEN_ONLY', 'HAND_RAISE', 'OPEN_STAGE'] as const).map((m) => (
                    <PrimaryButton key={m} title={t(`room.mode.${m}`)} variant={st.stageMode === m ? 'primary' : 'outline'} onPress={() => act(() => market.roomStageMode(token as string, sid, m))} />
                  ))}
                </View>
                <PrimaryButton title={t('room.muteAll')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'mute-all'))} />
                <PrimaryButton title={t(st.locked ? 'room.unlock' : 'room.lock')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'lock', { locked: !st.locked }))} />
                <PrimaryButton title={t('room.end')} variant="outline" onPress={() => Alert.alert(t('room.end'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), style: 'destructive', onPress: () => void act(() => market.roomPost(token as string, sid, 'end')) }])} />
                <Text style={styles.h2}>{t('room.roster')}</Text>
              </View>
            )}
            {!teacher && st.me?.paymentGate && st.status !== 'ENDED' && <ClassPayGate token={token as string} gate={st.me.paymentGate} onChanged={load} />}
            {!teacher && live && st.me && (
              <View style={{ gap: spacing.sm }}>
                {st.me.removed ? <Text>{t('room.removed')}</Text> : (
                  <>
                    {st.me.stage !== 'NONE' && <Text style={styles.strong}>{t('room.onStage')}</Text>}
                    {st.stageMode === 'HAND_RAISE' && st.me.stage === 'NONE' && (
                      <PrimaryButton title={t(st.me.handRaised ? 'room.lowerHand' : 'room.raiseHand')} onPress={() => act(() => market.roomHand(token as string, sid, !st.me!.handRaised))} />
                    )}
                    {st.stageMode === 'OPEN_STAGE' && st.me.stage === 'NONE' && <PrimaryButton title={t('room.takeStage')} onPress={() => act(() => market.roomPost(token as string, sid, 'stage/take'))} />}
                    {st.me.stage !== 'NONE' && <PrimaryButton title={t('room.leaveStage')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'stage/leave'))} />}
                    {st.stageMode === 'LISTEN_ONLY' && <Text style={styles.help}>{t('room.listenOnly')}</Text>}
                  </>
                )}
              </View>
            )}
            {st.status === 'ENDED' && <PrimaryButton title={t('common.back')} variant="outline" onPress={() => router.back()} />}
          </View>
        }
        renderItem={({ item: r }) => (
          <View style={styles.card}>
            <Text style={styles.strong}>{r.hand ? '✋ ' : ''}{r.name}{r.present ? ' ●' : ''}</Text>
            <Text style={styles.help}>{r.removed ? t('room.removedShort') : r.stage !== 'NONE' ? t('room.onStage') : ''}</Text>
            {!r.removed && (
              <View style={styles.row}>
                {r.stage === 'NONE' ? (
                  <>
                    <PrimaryButton title={t('room.grantVoice')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'stage/grant', { pupilId: r.pupilId, mode: 'VOICE' }))} />
                    <PrimaryButton title={t('room.grantVideo')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'stage/grant', { pupilId: r.pupilId, mode: 'VOICE_VIDEO' }))} />
                  </>
                ) : (
                  <PrimaryButton title={t('room.revoke')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'stage/revoke', { pupilId: r.pupilId }))} />
                )}
                <PrimaryButton title={t('room.mute')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'mute', { pupilId: r.pupilId }))} />
                <PrimaryButton title={t('room.spotlight')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'spotlight', { pupilId: r.pupilId }))} />
                <PrimaryButton title={t('room.removePupil')} variant="outline" onPress={() => act(() => market.roomPost(token as string, sid, 'remove', { pupilId: r.pupilId }))} />
              </View>
            )}
          </View>
        )}
        initialNumToRender={12}
        windowSize={7}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
