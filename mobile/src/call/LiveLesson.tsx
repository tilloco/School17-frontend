import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import { market } from '../market/marketApi';
import { CleanCatcher, CleanHint, useCleanScreen } from './useCleanScreen';
import { CallStage, QualityBadge, RoundButton } from './CallStage';
import { CallMedia, createRtcDriver, EMPTY_MEDIA, LinkQuality, rtcAvailability, RtcDriver } from './rtc';

/**
 * The picture of a live class lesson. The teacher sends camera + screen together; pupils watch the teacher (the teacher's screen
 * fills the stage, the teacher's face is a small tile). A pupil who was given the stage gets mic / camera buttons.
 * Quality adapts by itself (see adaptive.ts): the screen stays readable, the faces give way.
 */
export function LiveLesson({ token, sid, teacher, teacherId, teacherName, canPublish }: { token: string; sid: string; teacher: boolean; teacherId?: string | null; teacherName: string; canPublish: boolean }) {
  const [media, setMedia] = useState<CallMedia>(EMPTY_MEDIA);
  const [quality, setQuality] = useState<LinkQuality>({ level: 'excellent' });
  const [state, setState] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [big, setBig] = useState(false);
  const driver = useRef<RtcDriver | null>(null);
  const publish = teacher || canPublish;
  const cs = useCleanScreen();
  const avail = rtcAvailability();

  useEffect(() => {
    if (!avail.ok) return;
    let dead = false;
    let tries = 0;
    const open = async () => {
      try {
        driver.current ??= createRtcDriver();
        const d = driver.current;
        if (!d) throw new Error('rtc');
        const tok = (await market.roomPost(token, sid, 'token')) as { token: string; url: string };
        await d.connect(tok.url, tok.token, {
          onDisconnected: () => { if (!dead) { setState('reconnecting'); setTimeout(() => { if (!dead && tries++ < 8) void open(); }, Math.min(8000, 1000 * 2 ** tries)); } },
          onReconnecting: () => setState('reconnecting'),
          onReconnected: () => setState('live'),
          onMedia: setMedia,
          onQuality: setQuality,
          onRemoteJoined: () => undefined,
          onRemoteLeft: () => undefined,
          onData: () => undefined,
        }, { videoEnabled: publish, publish, focusIdentity: teacherId ?? undefined });
        if (!dead) { tries = 0; setState('live'); }
      } catch {
        if (!dead) setState(tries++ < 8 ? 'reconnecting' : 'error');
        if (!dead && tries < 8) setTimeout(() => void open(), Math.min(8000, 1000 * 2 ** tries));
      }
    };
    void open();
    return () => { dead = true; void driver.current?.disconnect(); driver.current = null; };
  }, [token, sid, teacherId, publish]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!avail.ok) {
    return (
      <View style={styles.note}>
        <Ionicons name="videocam-off" size={22} color="#fff" />
        <Text style={styles.noteText}>{t('call.devbuild.body')}</Text>
      </View>
    );
  }
  const q: LinkQuality = state === 'live' ? quality : { ...quality, level: 'lost' };
  return (
    <View style={[styles.box, { height: big ? 520 : 280 }]}>
      <CallStage
        media={media}
        otherName={teacher ? t('room.title') : teacherName}
        waiting={state === 'live' && !media.remoteCamera && !media.remoteScreen}
        sharingMine={sharing}
        onStopShare={() => { setSharing(false); void driver.current?.setScreenShare(false); }}
        cameraOff={!cam}
      />
      {!cs.clean && <View style={styles.top} pointerEvents="box-none">
        <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>{state === 'live' ? t('chan.liveNow') : t('call.banner.reconnecting')}</Text></View>
        <QualityBadge q={q} />
      </View>}
      {!cs.clean && <Pressable accessibilityRole="button" accessibilityLabel="expand" onPress={() => setBig((v) => !v)} style={styles.expand}>
        <Ionicons name={big ? 'contract' : 'expand'} size={18} color="#fff" />
      </Pressable>}
      {publish && !cs.clean && (
        <View style={styles.controls}>
          <RoundButton size={42} icon={mic ? 'mic' : 'mic-off'} label={mic ? t('call.mute') : t('call.unmute')} active={mic} onPress={() => { setMic(!mic); void driver.current?.setMic(!mic); }} />
          <RoundButton size={42} icon={cam ? 'videocam' : 'videocam-off'} label={cam ? t('call.cameraOff') : t('call.cameraOn')} active={cam} onPress={() => { setCam(!cam); void driver.current?.setCamera(!cam); }} />
          <RoundButton size={42} icon="camera-reverse" label={t('call.flip')} onPress={() => void driver.current?.flipCamera()} />
          {teacher && <RoundButton size={42} icon="desktop" label={sharing ? t('call.stopShare') : t('call.share')} accent={sharing} onPress={() => { const on = !sharing; setSharing(on); void driver.current?.setScreenShare(on).catch(() => setSharing(false)); }} />}
        </View>
      )}
      {!cs.clean && <Pressable accessibilityRole="button" accessibilityLabel={t('clean.enter')} onPress={cs.enter} style={styles.eye}><Ionicons name="eye-off" size={18} color="#fff" /></Pressable>}
      <CleanHint show={cs.hint && !cs.clean} onClose={cs.dismissHint} />
      <CleanCatcher show={cs.clean} onTap={cs.onTap} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  top: { position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,59,48,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  expand: { position: 'absolute', left: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  eye: { position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 54, bottom: 8, flexDirection: 'row', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 14 },
  noteText: { color: '#fff', flex: 1, fontSize: 13 },
});
