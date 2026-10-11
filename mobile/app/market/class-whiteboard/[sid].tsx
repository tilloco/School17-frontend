import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { BoardStroke, market } from '../../../src/market/marketApi';
import { colors, radius, spacing } from '../../../src/theme/colors';

const UPLOAD_EVERY_MS = 15_000; // snapshot cadence (only when changed, and on leaving)
const POLL_MS = 3000;
const COLORS = ['#111111', '#d32f2f', '#1565c0', '#2e7d32'];
const MAX_POINTS = 4900; // keep under the server cap (5000 points)

/**
 * Teacher whiteboard. The teacher draws; a snapshot goes to the backend every 15 s when changed. Pupils (and late joiners) poll the latest snapshot.
 * STATUS: type-checked only. Live stroke streaming over the media data channel needs the media SDK (BLOCKED.md); until then pupils see updates with a few seconds delay.
 */
export default function WhiteboardScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { token } = useAuth();
  const [role, setRole] = useState<'teacher' | 'pupil' | null>(null);
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [color, setColor] = useState(COLORS[0]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const dirty = useRef(false);
  const strokesRef = useRef<BoardStroke[]>([]);
  const lastRev = useRef(-1);
  const sizeRef = useRef(size);
  const colorRef = useRef(color);
  sizeRef.current = size;
  colorRef.current = color;
  strokesRef.current = strokes;
  const teacher = role === 'teacher';

  const pull = useCallback(async () => {
    try {
      const st = await market.roomState(token as string, sid);
      setRole(st.role);
      if (st.role === 'pupil' && st.whiteboardRev !== lastRev.current) {
        const b = await market.boardGet(token as string, sid);
        lastRev.current = b.rev;
        setStrokes(b.strokes);
      }
      if (st.role === 'teacher' && lastRev.current === -1) {
        lastRev.current = st.whiteboardRev;
        const b = await market.boardGet(token as string, sid);
        setStrokes(b.strokes);
      }
      setState('ready');
    } catch {
      setState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [token, sid]);
  useEffect(() => {
    void pull();
    const timer = setInterval(() => void pull(), POLL_MS);
    return () => clearInterval(timer);
  }, [pull]);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await market.boardPut(token as string, sid, strokesRef.current);
    } catch (e) {
      dirty.current = true;
      if (e instanceof ApiError && e.statusCode === 400) Alert.alert(t('common.error'), t('wb.tooBig'));
    }
  }, [token, sid]);
  useEffect(() => {
    if (!teacher) return;
    const timer = setInterval(() => void flush(), UPLOAD_EVERY_MS);
    return () => {
      clearInterval(timer);
      void flush(); // on stop / leaving
    };
  }, [teacher, flush]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { w, h } = sizeRef.current;
          const total = strokesRef.current.reduce((n, s) => n + s.p.length, 0);
          if (total >= MAX_POINTS) return Alert.alert(t('wb.full'));
          setStrokes((s) => [...s, { c: colorRef.current, w: 3, p: [[clamp(e.nativeEvent.locationX / w), clamp(e.nativeEvent.locationY / h)]] }]);
          dirty.current = true;
        },
        onPanResponderMove: (e) => {
          const { w, h } = sizeRef.current;
          const total = strokesRef.current.reduce((n, s) => n + s.p.length, 0);
          if (total >= MAX_POINTS) return;
          setStrokes((s) => {
            if (!s.length) return s;
            const last = s[s.length - 1];
            const pt: [number, number] = [clamp(e.nativeEvent.locationX / w), clamp(e.nativeEvent.locationY / h)];
            const prev = last.p[last.p.length - 1];
            if (Math.abs(prev[0] - pt[0]) + Math.abs(prev[1] - pt[1]) < 0.004) return s; // skip tiny moves
            return [...s.slice(0, -1), { ...last, p: [...last.p, pt] }];
          });
          dirty.current = true;
        },
      }),
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: Math.max(1, e.nativeEvent.layout.width), h: Math.max(1, e.nativeEvent.layout.height) });
  const save = async () => {
    try {
      await flush();
      await market.boardPut(token as string, sid, strokesRef.current);
      await market.boardSave(token as string, sid, false);
      Alert.alert(t('wb.saved'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'BOARD_EMPTY' ? t('wb.empty') : t('state.error'));
    }
  };

  const header = <Stack.Screen options={{ headerShown: true, title: t('wb.title'), headerBackTitle: t('common.back') }} />;
  if (state !== 'ready') return <Screen>{header}<StateView state={state === 'error' ? 'error' : 'loading'} onRetry={pull} /></Screen>;
  return (
    <Screen>
      {header}
      <View style={styles.board} onLayout={onLayout} {...(teacher ? pan.panHandlers : {})} accessibilityLabel={t('wb.title')}>
        <Svg width="100%" height="100%">
          {strokes.map((s, i) =>
            s.p.length === 1 ? (
              <Circle key={i} cx={s.p[0][0] * size.w} cy={s.p[0][1] * size.h} r={s.w / 2} fill={s.c} />
            ) : (
              <Polyline key={i} points={s.p.map(([x, y]) => `${x * size.w},${y * size.h}`).join(' ')} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
            ),
          )}
        </Svg>
      </View>
      {teacher ? (
        <View style={styles.tools}>
          <View style={styles.row}>
            {COLORS.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
            ))}
          </View>
          <View style={styles.row}>
            <PrimaryButton title={t('wb.undo')} variant="outline" onPress={() => { setStrokes((s) => s.slice(0, -1)); dirty.current = true; }} />
            <PrimaryButton title={t('wb.clear')} variant="outline" onPress={() => { setStrokes([]); dirty.current = true; }} />
            <PrimaryButton title={t('wb.save')} onPress={save} />
          </View>
          <Text style={styles.help}>{t('wb.delayNote')}</Text>
        </View>
      ) : (
        <Text style={styles.help}>{t('wb.viewOnly')}</Text>
      )}
    </Screen>
  );
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

const styles = StyleSheet.create({
  board: { flex: 1, minHeight: 240, backgroundColor: '#ffffff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.sm, overflow: 'hidden' },
  tools: { gap: spacing.xs, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.primary },
  help: { color: colors.textMuted, fontSize: 13 },
});
