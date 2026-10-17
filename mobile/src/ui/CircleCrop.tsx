import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';

const MAX_ZOOM = 4;

/** Round photo cropper (like Telegram): drag to move, pinch to zoom, the circle is what becomes the profile picture. */
export function CircleCrop({ uri, width, height, onCancel, onDone }: { uri: string; width: number; height: number; onCancel: () => void; onDone: (crop: { originX: number; originY: number; size: number }) => void }) {
  const V = Math.min(Dimensions.get('window').width - 32, 360);
  const s0 = V / Math.min(width, height); // cover scale
  const [k, setK] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const st = useRef({ k: 1, x: 0, y: 0, startK: 1, startX: 0, startY: 0, dist: 0 });

  const clamp = (kk: number, x: number, y: number) => {
    const dw = width * s0 * kk, dh = height * s0 * kk;
    return { x: Math.max(-(dw - V) / 2, Math.min((dw - V) / 2, x)), y: Math.max(-(dh - V) / 2, Math.min((dh - V) / 2, y)) };
  };
  const apply = (kk: number, x: number, y: number) => {
    const c = clamp(kk, x, y);
    st.current.k = kk; st.current.x = c.x; st.current.y = c.y;
    setK(kk); setPos(c);
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { const s = st.current; s.startK = s.k; s.startX = s.x; s.startY = s.y; s.dist = 0; },
    onPanResponderMove: (e, g) => {
      const s = st.current;
      const ts = e.nativeEvent.touches;
      if (ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!s.dist) { s.dist = d; s.startK = s.k; s.startX = s.x - g.dx; s.startY = s.y - g.dy; }
        apply(Math.max(1, Math.min(MAX_ZOOM, s.startK * (d / s.dist))), s.x, s.y);
      } else {
        s.dist = 0;
        apply(s.k, s.startX + g.dx, s.startY + g.dy);
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [V, width, height]);

  const done = () => {
    const sc = s0 * k;
    const dw = width * sc, dh = height * sc;
    const size = V / sc;
    const originX = Math.max(0, Math.min(width - size, (dw / 2 - V / 2 - pos.x) / sc));
    const originY = Math.max(0, Math.min(height - size, (dh / 2 - V / 2 - pos.y) / sc));
    onDone({ originX: Math.round(originX), originY: Math.round(originY), size: Math.floor(size) });
  };
  const dw = width * s0 * k, dh = height * s0 * k;
  return (
    <Modal visible transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}><Text style={styles.cancel}>{t('common.cancel')}</Text></Pressable>
          <Text style={styles.title}>{t('crop.title')}</Text>
          <Pressable accessibilityRole="button" onPress={done} hitSlop={12}><Text style={styles.ok}>{t('crop.choose')}</Text></Pressable>
        </View>
        <View style={styles.center}>
          <View style={{ width: V, height: V, overflow: 'hidden', backgroundColor: '#000' }} {...pan.panHandlers}>
            <Image source={{ uri }} style={{ position: 'absolute', width: dw, height: dh, left: V / 2 - dw / 2 + pos.x, top: V / 2 - dh / 2 + pos.y }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: -V / 2, top: -V / 2, width: V * 2, height: V * 2, borderRadius: V, borderWidth: V / 2, borderColor: 'rgba(0,0,0,0.62)' }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: V, height: V, borderRadius: V / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }} />
          </View>
          <Text style={styles.hint}>{t('crop.hint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

export function CropBusy() { return <ActivityIndicator color={colors.primary} />; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancel: { color: '#fff', fontSize: 17 },
  ok: { color: '#3DA0FF', fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },
});

/** Picks a photo from the gallery, lets the person frame it in a circle, and gives back a square JPEG. Render `node` once in the screen. */
export function useRoundPhotoPicker() {
  const [job, setJob] = useState<{ uri: string; width: number; height: number; resolve: (v: { uri: string; name: string; mime: string } | null) => void } | null>(null);
  const pick = async (): Promise<{ uri: string; name: string; mime: string } | null> => {
    const { imagePicker } = require('../lib/native') as typeof import('../lib/native');
    const { Alert } = require('react-native') as typeof import('react-native');
    const IP = imagePicker();
    if (!IP) return null;
    const perm = await IP.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('attach.permission')); return null; }
    const r = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return null;
    return new Promise((resolve) => setJob({ uri: a.uri, width: a.width, height: a.height, resolve }));
  };
  const node = job ? (
    <CircleCrop
      uri={job.uri} width={job.width} height={job.height}
      onCancel={() => { job.resolve(null); setJob(null); }}
      onDone={async (c) => {
        const j = job; setJob(null);
        try {
          const IM = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
          const r = await IM.manipulateAsync(j.uri, [{ crop: { originX: c.originX, originY: c.originY, width: c.size, height: c.size } }, { resize: { width: 640 } }], { compress: 0.9, format: IM.SaveFormat.JPEG });
          j.resolve({ uri: r.uri, name: 'photo.jpg', mime: 'image/jpeg' });
        } catch { j.resolve({ uri: j.uri, name: 'photo.jpg', mime: 'image/jpeg' }); }
      }}
    />
  ) : null;
  return { pick, node };
}
