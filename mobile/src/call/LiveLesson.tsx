import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import { market } from '../market/marketApi';
import { CallStage, QualityBadge, RoundButton } from './CallStage';
import { ShareFull } from './ShareFull';
import { useLessonKeepAlive } from './useLessonKeepAlive';
import { CallMedia, createRtcDriver, EMPTY_MEDIA, LinkQuality, rtcAvailability, RtcDriver } from './rtc';

/**
 * The picture of a live class lesson, kept simple:
 *  - nothing shared: the teacher's face fills the box;
 *  - a screen is shared: the screen fills the box, the teacher's face is a small round picture in the top right, and a "Full" button
 *    opens the shared screen full screen and sideways (double-tap to come back).
 * The teacher also gets three small buttons (mic, camera, share screen). The lesson keeps running with the screen off.
 */
export function LiveLesson({ token, sid, teacher, teacherId, teacherName, canPublish }: { token: string; sid: string; teacher: boolean; teacherId?: string | null; teacherName: string; canPublish: boolean }) {
  const [media, setMedia] = useState<CallMedia>(EMPTY_MEDIA);
  const [quality, setQuality] = useState<LinkQuality>({ level: 'excellent' });
  const [state, setState] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [full, setFull] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const lastTap = useRef(0);
  const tapStage = () => {
    const now = Date.now();
    if (media.remoteScreen && now - lastTap.current < 350) { lastTap.current = 0; setFull(true); } else lastTap.current = now;
  };
  const driver = useRef<RtcDriver | null>(null);
  const publish = teacher || canPublish;
  const avail = rtcAvailability();
  useLessonKeepAlive(avail.ok, teacherName || t('room.title'));

  useEffect(() => {
    if (!avail.ok) return;
    let dead = false;
    let tries = 0;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const d = createRtcDriver();
    driver.current = d;
    const later = () => {
      if (dead || timer) return;
      timer = setTimeout(() => { timer = null; void open(); }, Math.min(8000, 1000 * 2 ** Math.min(tries, 3)));
    };
    const open = async () => {
      if (dead || busy || !d) return; // never two connections with the same identity: the server would kick the first one out
      busy = true;
      try {
        const tok = (await market.roomPost(token, sid, 'token')) as { token: string; url: string };
        if (dead) return;
        await d.connect(tok.url, tok.token, {
          onDisconnected: () => { if (!dead) { setState('reconnecting'); tries++; later(); } },
          onReconnecting: () => setState('reconnecting'),
          onReconnected: () => setState('live'),
          onMedia: setMedia,
          onQuality: setQuality,
          onRemoteJoined: () => undefined,
          onRemoteLeft: () => undefined,
          onData: () => undefined,
        }, { videoEnabled: publish, publish, focusIdentity: teacherId ?? undefined });
        if (dead) { await d.disconnect(); return; }
        tries = 0;
        setState('live');
      } catch {
        if (!dead) { tries++; setState(tries < 10 ? 'reconnecting' : 'error'); if (tries < 10) later(); }
      } finally {
        busy = false;
      }
    };
    void open();
    return () => { dead = true; if (timer) clearTimeout(timer); void d?.disconnect(); if (driver.current === d) driver.current = null; };
  }, [token, sid, teacherId, publish]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!media.remoteScreen) { setFull(false); setSwapped(false); } }, [media.remoteScreen]);

  if (!avail.ok) {
    return (
      <View style={styles.note}>
        <Ionicons name="videocam-off" size={22} color="#fff" />
        <Text style={styles.noteText}>{t('call.devbuild.body')}</Text>
      </View>
    );
  }
  const q: LinkQuality = state === 'live' ? quality : { ...quality, level: 'lost' };
  const showsScreen = !!media.remoteScreen;
  return (
    <View style={[styles.box, { height: showsScreen ? 250 : 230 }]}>
      <CallStage
        hideTiles={false}
        compact
        selfView={publish}
        swapped={swapped}
        onSwap={() => setSwapped((v) => !v)}
        onTapStage={tapStage}
        onFlip={() => void driver.current?.flipCamera()}
        media={media}
        otherName={teacher ? t('room.title') : teacherName}
        waiting={!publish && state === 'live' && !media.remoteCamera && !media.remoteScreen}
        sharingMine={sharing}
        onStopShare={() => { setSharing(false); void driver.current?.setScreenShare(false); }}
        cameraOff={!cam}
      />
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>{state === 'live' ? t('chan.liveNow') : t('call.banner.reconnecting')}</Text></View>
        <QualityBadge q={q} />
      </View>
      {publish && (
        <View style={styles.controls}>
          <RoundButton size={40} icon={mic ? 'mic' : 'mic-off'} label={mic ? t('call.mute') : t('call.unmute')} active={mic} onPress={() => { setMic(!mic); void driver.current?.setMic(!mic); }} />
          <RoundButton size={40} icon={cam ? 'videocam' : 'videocam-off'} label={cam ? t('call.cameraOff') : t('call.cameraOn')} active={cam} onPress={() => { setCam(!cam); void driver.current?.setCamera(!cam); }} />
          {teacher && <RoundButton size={40} icon="desktop" label={sharing ? t('call.stopShare') : t('call.share')} accent={sharing} onPress={() => { const on = !sharing; setSharing(on); void driver.current?.setScreenShare(on).catch(() => setSharing(false)); }} />}
        </View>
      )}
      <ShareFull visible={full} media={media} quality={q} name={teacherName} swapped={swapped} onSwap={() => setSwapped((v) => !v)} onClose={() => setFull(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#000' },
  top: { position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,59,48,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  fullBtn: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  fullText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  controls: { position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 14 },
  noteText: { color: '#fff', flex: 1, fontSize: 13 },
});
