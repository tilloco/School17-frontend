import { SignalPill } from '../../src/lib/connection';
import React, { useEffect, useState } from 'react';
import { fmtTime } from '../../src/ui/format';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ErrorText } from '../../src/components/ErrorText';
import { useAuth } from '../../src/lib/auth-context';
import { callApi } from '../../src/call/callApi';
import { classifyQuality } from '../../src/call/call-machine';
import { useCall } from '../../src/call/useCall';
import { t } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme/colors';

/** Native video ko'rinishi: @livekit/react-native o'rnatilgan bo'lsagina; aks holda bo'sh joy. */
function VideoSurface({ track, style }: { track: unknown | null; style: object }) {
  if (!track) return <View style={[style, styles.videoEmpty]} />;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VideoView } = require('@livekit/react-native');
    return <VideoView style={style} videoTrack={track} objectFit="cover" />;
  } catch {
    return <View style={[style, styles.videoEmpty]} />;
  }
}

function ControlButton({ label, onPress, active = true, danger = false }: { label: string; onPress: () => void; active?: boolean; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.ctrl, !active && styles.ctrlOff, danger && styles.ctrlDanger]}
    >
      <Text style={styles.ctrlText} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export default function CallScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const call = useCall(bookingId, token);
  const [netMs, setNetMs] = useState<number | null>(null);
  const [netBusy, setNetBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    call.enterLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runNetworkCheck = async () => {
    if (!token) return;
    setNetBusy(true);
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      try {
        await callApi.lobby(token, bookingId);
        samples.push(Date.now() - t0);
      } catch {
        samples.push(5000);
      }
    }
    samples.sort((a, b) => a - b);
    setNetMs(samples[1]);
    setNetBusy(false);
  };

  const header = <Stack.Screen options={{ headerShown: true, title: t('call.title'), headerBackTitle: t('common.back'), headerRight: () => <SignalPill /> }} />;

  if (!call.availability.ok) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <Text style={styles.h1}>{t('call.devbuild.title')}</Text>
          <Text style={styles.body}>{t('call.devbuild.body')}</Text>
          <PrimaryButton title={t('common.back')} variant="outline" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (call.error) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <ErrorText message={call.error} />
          <PrimaryButton title={t('common.retry')} onPress={call.reload} />
        </View>
      </Screen>
    );
  }

  if (!call.lobby) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.body}>{t('common.loading')}</Text>
        </View>
      </Screen>
    );
  }

  const { lobby, ctx } = call;
  const banner =
    ctx.banner === 'reconnecting' ? t('call.banner.reconnecting')
    : ctx.banner === 'audio_only' ? t('call.banner.audioOnly')
    : ctx.banner === 'poor_connection' ? t('call.banner.poor')
    : ctx.banner === 'failed' ? t('call.banner.failed')
    : ctx.banner === 'window_closed' ? t('call.banner.windowClosed')
    : null;

  // ---- Yakuniy ekran ----
  if (ctx.state === 'ended' || (ctx.state === 'failed' && call.summary?.finalized)) {
    const s = call.summary;
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <Text style={styles.h1}>{t('call.summary.title')}</Text>
          {s ? (
            <>
              <Text style={styles.body}>{t('call.summary.together', { minutes: Math.round(s.togetherSeconds / 60) })}</Text>
              {s.status === 'COMPLETED' && <Text style={styles.body}>{t('call.summary.billable', { minutes: Math.round(s.billableSeconds / 60) })}</Text>}
              {s.status === 'NO_SHOW_STUDENT' && <Text style={styles.body}>{t('call.summary.noShowStudent')}</Text>}
              {s.status === 'NO_SHOW_TEACHER' && <Text style={styles.body}>{t('call.summary.noShowTeacher')}</Text>}
              {s.status === 'FAILED' && <Text style={styles.body}>{t('call.summary.failed')}</Text>}
              {s.canRejoin && <PrimaryButton title={t('call.summary.rejoin')} variant="outline" onPress={() => { call.enterLobby(); call.join(); }} />}
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <PrimaryButton title={t('call.summary.done')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // ---- Qo'ng'iroq ekrani ----
  if (ctx.state === 'connecting' || ctx.state === 'connected' || ctx.state === 'reconnecting') {
    const qualityLabel = t(`call.quality.${ctx.audioOnlyAuto ? 'poor' : ctx.tier}`);
    return (
      <Screen style={{ paddingHorizontal: 0 }}>
        {header}
        {banner && (
          <View accessibilityLiveRegion="polite" style={[styles.banner, ctx.banner === 'failed' && { backgroundColor: colors.danger }]}>
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        )}
        <View style={styles.videoArea}>
          <VideoSurface track={call.remoteVideo} style={styles.remote} />
          {!call.remoteJoined && ctx.state === 'connected' && <Text style={styles.waiting}>{t('call.waiting', { name: lobby.other.name })}</Text>}
          {ctx.state === 'connecting' && <ActivityIndicator style={styles.waiting} color={colors.white} />}
          <View style={styles.localWrap}>
            <VideoSurface track={ctx.cameraOff || ctx.audioOnlyAuto ? null : call.localVideo()} style={styles.local} />
          </View>
          <View style={styles.quality} accessibilityLabel={qualityLabel}>
            <Text style={styles.qualityText}>● {qualityLabel}</Text>
          </View>
        </View>

        {chatOpen && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chat}>
            <Text style={styles.chatNote}>{t('call.chatNotSaved')}</Text>
            <FlatList
              data={call.chat}
              keyExtractor={(m) => String(m.id)}
              renderItem={({ item }) => <Text style={[styles.chatLine, item.mine && styles.chatMine]}>{item.text}</Text>}
            />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => { call.sendChat(draft); setDraft(''); }}
              placeholderTextColor={colors.textMuted} placeholder={t('call.chat')}
              style={styles.chatInput}
              maxLength={500}
            />
          </KeyboardAvoidingView>
        )}

        <View style={styles.controls}>
          <ControlButton label={ctx.micMuted ? t('call.unmute') : t('call.mute')} active={!ctx.micMuted} onPress={call.toggleMic} />
          <ControlButton label={ctx.cameraOff ? t('call.cameraOn') : t('call.cameraOff')} active={!ctx.cameraOff} onPress={call.toggleCamera} />
          <ControlButton label={t('call.flip')} onPress={call.flipCamera} />
          <ControlButton label={ctx.screenSharing ? t('call.stopShare') : t('call.share')} active={!ctx.screenSharing} onPress={call.toggleShare} />
          <ControlButton label={t('call.chat')} active={!chatOpen} onPress={() => setChatOpen((v) => !v)} />
          <ControlButton label={t('call.leave')} danger onPress={call.leave} />
        </View>
      </Screen>
    );
  }

  // ---- Lobby (qo'ng'iroqdan oldin tekshiruv) yoki 'failed' ----
  const opensAt = fmtTime(new Date(lobby.joinWindow.opensAt));
  const reasonText =
    lobby.reason === 'TOO_EARLY' ? t('call.lobby.opensAt', { time: opensAt })
    : lobby.reason === 'WINDOW_CLOSED' ? t('call.lobby.closed')
    : lobby.reason === 'NOT_CONFIRMED' ? t('call.lobby.notConfirmed')
    : null;
  const netTier = netMs == null ? null : classifyQuality({ rttMs: netMs });

  return (
    <Screen>
      {header}
      <View style={styles.lobby}>
        <Text style={styles.h1}>{t('call.with', { name: lobby.other.name })}</Text>
        <Text style={styles.body}>{t('call.lobby.title')}</Text>
        {banner && <Text style={styles.bannerInline}>{banner}</Text>}

        <View style={styles.checkRow}>
          <Text style={styles.checkLabel}>{t('call.lobby.network')}</Text>
          <Text style={styles.checkValue}>
            {netBusy ? t('common.loading') : netMs == null ? '—' : netTier === 'good' ? `${t('call.lobby.ok')} (${netMs} ms)` : `${t('call.lobby.weak')} (${netMs} ms)`}
          </Text>
          <PrimaryButton title={t('call.lobby.test')} variant="outline" onPress={runNetworkCheck} disabled={netBusy} />
        </View>
        <Text style={styles.hint}>{t('call.lobby.permission')}</Text>
        <Text style={styles.hint}>{t('call.recording.off')}</Text>

        {reasonText && <Text style={styles.warn}>{reasonText}</Text>}
        <PrimaryButton title={t('call.lobby.join')} onPress={call.join} disabled={!lobby.canJoin} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  lobby: { flex: 1, paddingTop: spacing.lg, gap: spacing.md },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted },
  warn: { fontSize: 15, color: colors.warning, fontWeight: '600' },
  checkRow: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  checkLabel: { fontSize: 14, color: colors.textMuted },
  checkValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  banner: { backgroundColor: colors.warning, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bannerText: { color: colors.white, fontWeight: '600', textAlign: 'center' },
  bannerInline: { color: colors.danger, textAlign: 'center' },
  videoArea: { flex: 1, backgroundColor: '#000' },
  remote: { flex: 1 },
  videoEmpty: { backgroundColor: '#111' },
  local: { width: 96, height: 128, borderRadius: radius.sm },
  localWrap: { position: 'absolute', right: spacing.md, bottom: spacing.md, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.white },
  waiting: { position: 'absolute', alignSelf: 'center', top: '45%', color: colors.white, fontSize: 16 },
  quality: { position: 'absolute', left: spacing.md, top: spacing.md, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  qualityText: { color: colors.white, fontSize: 12 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.primaryDark },
  ctrl: { minWidth: 76, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  ctrlOff: { backgroundColor: '#6B7280' },
  ctrlDanger: { backgroundColor: colors.danger },
  ctrlText: { color: colors.white, fontSize: 12, textAlign: 'center' },
  chat: { maxHeight: 220, backgroundColor: colors.surface, padding: spacing.sm },
  chatNote: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  chatLine: { paddingVertical: 2, color: colors.text },
  chatMine: { textAlign: 'right', color: colors.primary },
  chatInput: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, height: 40 },
});
