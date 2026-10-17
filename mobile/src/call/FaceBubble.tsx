import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Video } from './CallStage';

/**
 * The teacher's face as a small round picture that floats over the shared screen (like a YouTuber's face cam).
 * It starts in the top right corner; drag it anywhere and it snaps to the nearest corner so it never covers the middle of the material.
 * It never takes touches away from the material: only the bubble itself reacts.
 */
export function FaceBubble({ track, name, size = 60, inset = 10 }: { track: unknown | null; name: string; size?: number; inset?: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: inset })).current;
  const corner = useRef({ right: true, bottom: false }); // which corner it sits in: kept when the screen turns sideways
  const start = useRef({ x: 0, y: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;

  const corners = (b: { w: number; h: number }) => ({ left: inset, right: Math.max(inset, b.w - size - inset), top: inset, bottom: Math.max(inset, b.h - size - inset) });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const h = e.nativeEvent.layout.height;
    setBox({ w, h });
    if (w > 0 && h > 0) {
      const c = corners({ w, h });
      pos.setValue({ x: corner.current.right ? c.right : c.left, y: corner.current.bottom ? c.bottom : c.top });
    }
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      pos.stopAnimation((v) => { start.current = { x: v.x, y: v.y }; });
    },
    onPanResponderMove: (_, g) => {
      const c = corners(boxRef.current);
      pos.setValue({ x: Math.min(c.right, Math.max(c.left, start.current.x + g.dx)), y: Math.min(c.bottom, Math.max(c.top, start.current.y + g.dy)) });
    },
    onPanResponderRelease: (_, g) => {
      const c = corners(boxRef.current);
      const x = Math.min(c.right, Math.max(c.left, start.current.x + g.dx));
      const y = Math.min(c.bottom, Math.max(c.top, start.current.y + g.dy));
      const toX = x + size / 2 < boxRef.current.w / 2 ? c.left : c.right;
      const toY = y + size / 2 < boxRef.current.h / 2 ? c.top : c.bottom;
      corner.current = { right: toX === c.right, bottom: toY === c.bottom };
      Animated.spring(pos, { toValue: { x: toX, y: toY }, useNativeDriver: false, friction: 8, tension: 90 }).start();
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [size, inset]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      <Animated.View {...pan.panHandlers} style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }, { transform: pos.getTranslateTransform() }]}>
        {track ? <Video track={track} style={styles.fill} mirror={false} /> : <View style={[styles.fill, styles.empty]}><Text style={styles.letter}>{(name || '?').trim().slice(0, 1).toUpperCase()}</Text></View>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: '#111', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  fill: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B3340' },
  letter: { color: '#fff', fontWeight: '800', fontSize: 22 },
});
