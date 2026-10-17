import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import type { CallMedia, LinkQuality } from './rtc';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

export const QUALITY_COLOR: Record<LinkQuality['level'], string> = {
  excellent: '#34C759',
  good: '#A3D635',
  poor: '#FF9F0A',
  bad: '#FF453A',
  lost: '#8E8E93',
};
const BARS: Record<LinkQuality['level'], number> = { excellent: 4, good: 3, poor: 2, bad: 1, lost: 0 };

function Video({ track, style, cover = true, mirror = false }: { track: unknown | null; style: object; cover?: boolean; mirror?: boolean }) {
  if (!track) return <View style={[style, { backgroundColor: '#111' }]} />;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VideoView } = require('@livekit/react-native');
    return <VideoView style={style} videoTrack={track} objectFit={cover ? 'cover' : 'contain'} mirror={mirror} />;
  } catch {
    return <View style={[style, { backgroundColor: '#111' }]} />;
  }
}

/** Small signal badge for the top right corner: four bars + one word + the real ping. Tap it for the numbers behind it. */
export function QualityBadge({ q }: { q: LinkQuality }) {
  const [open, setOpen] = useState(false);
  const color = QUALITY_COLOR[q.level];
  const bars = BARS[q.level];
  const mbps = (k?: number) => (k === undefined ? '–' : k >= 1000 ? `${(k / 1000).toFixed(1)} Mb/s` : `${Math.round(k)} kb/s`);
  return (
    <View style={styles.badgeWrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(`cq.${q.level}`)} hitSlop={8} onPress={() => setOpen((v) => !v)} style={styles.badge}>
        <View style={styles.bars}>
          {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.bar, { height: 3 + i * 2.5, backgroundColor: i <= bars ? color : 'rgba(255,255,255,0.3)' }]} />)}
        </View>
        {q.level === 'lost' ? <Text style={[styles.badgeText, { color }]}>{t('cq.lost')}</Text> : q.rttMs !== undefined ? <Text style={styles.badgeText}>{Math.round(q.rttMs)}<Text style={styles.badgeUnit}> ms</Text></Text> : null}
      </Pressable>
      {open && (
        <View style={styles.badgeCard}>
          <View style={styles.cardHead}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.cardLevel, { color }]}>{t(`cq.${q.level}`)}</Text></View>
          <Row label={t('cq.ping')} value={q.rttMs === undefined ? '–' : `${Math.round(q.rttMs)} ms`} />
          <Row label={t('cq.loss')} value={q.lossPct === undefined ? '–' : `${q.lossPct.toFixed(1)} %`} />
          <Row label={t('cq.jitter')} value={q.jitterMs === undefined ? '–' : `${Math.round(q.jitterMs)} ms`} />
          <Row label={t('cq.up')} value={mbps(q.upKbps)} />
          <Row label={t('cq.down')} value={mbps(q.downKbps)} />
          {q.adapt && <Row label={t('cq.video')} value={q.adapt.camera === 'off' ? t('cq.paused') : q.adapt.camera} />}
          {q.adapt?.screen && <Row label={t('cq.screen')} value={q.adapt.screen} />}
        </View>
      )}
    </View>
  );
}
const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
);

/**
 * The picture of a call. Camera and screen share are separate tracks and can run together:
 *  - the other person's screen (if shared) fills the stage, their camera and mine are small tiles on top;
 *  - otherwise the other person's camera fills the stage and my camera is a small tile;
 *  - while I share my own screen, a card says so (showing my screen to myself would only mirror it forever).
 */
export function CallStage({ media, otherName, waiting, sharingMine, onStopShare, cameraOff, onTapStage, onFlip, hideTiles }: { onTapStage?: () => void; onFlip?: () => void; hideTiles?: boolean; media: CallMedia; otherName: string; waiting: boolean; sharingMine: boolean; onStopShare: () => void; cameraOff: boolean }) {
  const hasScreen = !!media.remoteScreen;
  const main = hasScreen ? media.remoteScreen : media.remoteCamera;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })])).start();
  }, [pulse]);
  return (
    <View style={styles.stage}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTapStage} accessible={false} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Video track={main} style={StyleSheet.absoluteFill} cover={!hasScreen} /></View>
      {!main && (
        <View style={styles.center}>
          <Animated.View style={[styles.avatar, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
            <Text style={styles.avatarLetter}>{(otherName || '?').trim().slice(0, 1).toUpperCase()}</Text>
          </Animated.View>
          <Text style={styles.name}>{otherName}</Text>
          <Text style={styles.sub}>{waiting ? t('call.waiting', { name: otherName }) : media.remoteMicMuted ? t('call.cameraOffOther') : ''}</Text>
        </View>
      )}
      {hasScreen && <View style={styles.tag}><Ionicons name="desktop" size={13} color="#fff" /><Text style={styles.tagText}>{t('call.theirScreen', { name: otherName })}</Text></View>}
      {!hideTiles && (
        <View style={styles.tiles} pointerEvents="box-none">
          {hasScreen && media.remoteCamera ? <View style={styles.tile} pointerEvents="none"><Video track={media.remoteCamera} style={styles.tileVideo} /></View> : null}
          {media.localCamera && !cameraOff ? <Pressable accessibilityRole="button" accessibilityLabel="flip" onPress={onFlip} style={styles.tile}><View style={styles.tileVideo} pointerEvents="none"><Video track={media.localCamera} style={styles.tileVideo} mirror /></View></Pressable> : null}
        </View>
      )}
      {media.remoteMicMuted && main ? <View style={styles.muted}><Ionicons name="mic-off" size={14} color="#fff" /></View> : null}
      {sharingMine && (
        <View style={styles.sharing}>
          <View style={styles.sharingDot} />
          <Text style={styles.sharingText}>{t('call.youShare')}</Text>
          <Pressable accessibilityRole="button" onPress={onStopShare} style={styles.sharingBtn}><Text style={styles.sharingBtnText}>{t('call.stopShare')}</Text></Pressable>
        </View>
      )}
    </View>
  );
}

export function RoundButton({ icon, label, onPress, active = true, danger = false, accent = false, size = 54 }: { icon: Icon; label: string; onPress: () => void; active?: boolean; danger?: boolean; accent?: boolean; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, !active && styles.roundOff, accent && styles.roundAccent, danger && styles.roundDanger, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}>
      <Ionicons name={icon} size={Math.round(size * 0.42)} color={danger || accent || active ? '#fff' : '#1C1C1E'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0E1116' },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#2B3340', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 46, fontWeight: '800' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  tag: { position: 'absolute', left: 12, top: 84, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tiles: { position: 'absolute', right: 12, bottom: 110, gap: 10, alignItems: 'flex-end' },
  tile: { width: 92, height: 128, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: '#111' },
  tileVideo: { flex: 1 },
  muted: { position: 'absolute', left: 14, bottom: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,69,58,0.9)', alignItems: 'center', justifyContent: 'center' },
  sharing: { position: 'absolute', left: 12, right: 12, top: 84, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,122,255,0.92)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  sharingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  sharingText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  sharingBtn: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  sharingBtnText: { color: '#0A5BD6', fontWeight: '800', fontSize: 13 },
  badgeWrap: { alignItems: 'flex-end' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, minHeight: 22 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardLevel: { fontSize: 13, fontWeight: '800' },
  badgeUnit: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 13 },
  bar: { width: 2.5, borderRadius: 1 },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  badgeCard: { marginTop: 6, minWidth: 170, backgroundColor: 'rgba(20,22,26,0.94)', borderRadius: 14, padding: 10, gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  rowLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  rowValue: { color: '#fff', fontSize: 12, fontWeight: '700' },
  round: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  roundOff: { backgroundColor: '#fff' },
  roundAccent: { backgroundColor: '#0A84FF' },
  roundDanger: { backgroundColor: '#FF3B30' },
});
