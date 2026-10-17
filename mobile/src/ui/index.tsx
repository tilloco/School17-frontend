import React, { useEffect, useState } from 'react';
import { ActivityIndicator, findNodeHandle, Image, Platform, Pressable, RefreshControl, ScrollView, ImageStyle, StyleProp, StyleSheet, UIManager, View, ViewStyle } from 'react-native';
import { FocusScrollContext } from './KeyboardScroll';
import { Text } from './Text';
import { PressScale } from './PressScale';
import { useKeyboardPadding } from '../lib/keyboard';
import { ConnectionStrip } from '../lib/connection';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { colors, radius, shadow, spacing } from '../theme/colors';
import { t } from '../i18n';
import { API_URL } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.neutralSoft, fg: colors.textMuted },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warningText },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

/** Big page title; shows a back arrow when the screen was pushed (not when it is a tab). */
export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const inTabs = segments[0] === '(tabs)';
  return (
    <View style={styles.header}>
      {!inTabs && router.canGoBack() && (
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      )}
      <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

/** Scrolling page with pull-to-refresh, consistent padding and a safe area. Every main screen uses this. */
export function Page({ children, onRefresh, refreshing, edges = ['top'], padded = true }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; edges?: ('top' | 'bottom')[]; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const inTabs = (useSegments() as string[])[0] === '(tabs)'; // the tab screens have the top bar above them, which already handles the status bar
  const kb = useKeyboardPadding();
  const enter = React.useRef(new Animated.Value(0)).current;
  const scroll = React.useRef<ScrollView>(null);
  const inner = React.useRef<View>(null);
  const toField = React.useCallback((target: number) => {
    setTimeout(() => {
      const node = findNodeHandle(inner.current);
      if (node && target) UIManager.measureLayout(target, node, () => undefined, (_x: number, y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }));
    }, 280);
  }, []);
  React.useEffect(() => { Animated.timing(enter, { toValue: 1, duration: 320, useNativeDriver: true }).start(); }, [enter]);
  return (
    <SafeAreaView style={styles.safe} edges={inTabs ? [] : edges}>
      <ConnectionStrip />
      <Animated.View style={{ flex: 1, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <ScrollView
        contentContainerStyle={[styles.pageContent, { paddingBottom: spacing.xl + (kb > 0 ? kb : insets.bottom) + (inTabs && Platform.OS === 'ios' ? 64 : 0) }, padded && { paddingHorizontal: spacing.md }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        keyboardShouldPersistTaps="handled"
        ref={scroll}
      >
        <FocusScrollContext.Provider value={toField}>
          <View ref={inner} collapsable={false}>{children}</View>
        </FocusScrollContext.Provider>
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

export function Card({ children, onPress, style, tone }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; tone?: Tone }) {
  const body = [styles.card, tone && { backgroundColor: TONES[tone].bg, borderColor: 'transparent' }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <PressScale accessibilityRole="button" onPress={onPress} style={body}>
      {children}
    </PressScale>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Round avatar: the teacher's photo when `photoOf` (a teacher profile id) is given and loads, otherwise the initials. `v` changes after a new upload so the picture refreshes. */
const imageCache = new Map<string, string>();
/** Loads a picture that needs the sign-in header (Android's Image drops it) and shows it from memory. */
function AuthImage({ url, token, style, onFail }: { url: string; token: string; style: StyleProp<ImageStyle>; onFail: () => void }) {
  const [src, setSrc] = useState<string | null>(imageCache.get(url) ?? null);
  useEffect(() => {
    let alive = true;
    const cached = imageCache.get(url);
    if (cached) { setSrc(cached); return; }
    const x = new XMLHttpRequest();
    x.responseType = 'blob';
    x.onload = () => {
      if (x.status !== 200) { onFail(); return; }
      const r = new FileReader();
      r.onloadend = () => { const d = String(r.result); imageCache.set(url, d); if (alive) setSrc(d); };
      r.readAsDataURL(x.response as Blob);
    };
    x.onerror = () => { if (alive) onFail(); };
    x.open('GET', url, true);
    x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.send(null);
    return () => { alive = false; };
  }, [url, token]);
  if (!src) return <View style={style as StyleProp<ViewStyle>} />;
  return <Image source={{ uri: src }} style={style} accessibilityIgnoresInvertColors />;
}

export function Avatar({ name, size = 44, tone = 'primary', photoOf, userId, v }: { name?: string | null; size?: number; tone?: Tone; photoOf?: string | null; userId?: string | null; v?: number }) {
  const { token } = useAuth();
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [v, userId, photoOf]);
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if ((photoOf || userId) && token && !failed) {
    return <AuthImage url={`${API_URL}${userId ? `/users/${userId}/avatar` : `/teachers/${photoOf}/photo`}?v=${v ?? 0}`} token={token} style={[box, { backgroundColor: TONES[tone].bg }]} onFail={() => setFailed(true)} />;
  }
  return (
    <View style={[box, { backgroundColor: TONES[tone].bg, alignItems: 'center', justifyContent: 'center' }]} accessibilityElementsHidden>
      <Text style={{ color: TONES[tone].fg, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

/** Five stars, filled to `value` (halves allowed). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'} size={size} color="#F5B301" />
      ))}
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: TONES[tone].bg }]}>
      {icon && <Ionicons name={icon} size={12} color={TONES[tone].fg} />}
      <Text style={[styles.pillText, { color: TONES[tone].fg }]}>{label}</Text>
    </View>
  );
}

export function StatTile({ label, value, icon, tone = 'primary', onPress }: { label: string; value: string | number; icon: IconName; tone?: Tone; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: TONES[tone].bg }]}>
        <Ionicons name={icon} size={18} color={TONES[tone].fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

/** One tappable line: icon, title, optional subtitle, optional right text/badge, chevron. */
const SOLID: Record<Tone, string> = { neutral: '#8E8E93', primary: '#007AFF', success: '#34C759', warning: '#FF9500', danger: '#FF3B30' };

export function ListRow({ icon, title, subtitle, right, badge, onPress, tone = 'primary', danger }: { icon?: IconName; title: string; subtitle?: string; right?: string; badge?: number; onPress?: () => void; tone?: Tone; danger?: boolean }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} disabled={!onPress} scaleTo={0.985} haptic={false} style={styles.row}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: SOLID[danger ? 'danger' : tone] }]}>
          <Ionicons name={icon} size={17} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {!!right && <Text style={styles.rowRight}>{right}</Text>}
      {!!badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </PressScale>
  );
}

/** Rows grouped in one rounded card with hairline separators. */
export function Group({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
      {items.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.sepLine} />}
          {c}
        </React.Fragment>
      ))}
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/** Coloured top block with a greeting; content below overlaps it slightly. */
export function Hero({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroTitle} accessibilityRole="header">{title}</Text>
      {!!subtitle && <Text style={styles.heroSub}>{subtitle}</Text>}
      {children}
    </View>
  );
}

/** Solid action button used inside cards (orange = main action, outline = secondary). */
export function Action({ label, onPress, kind = 'primary', icon, disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'accent' | 'outline'; icon?: IconName; disabled?: boolean }) {
  const bg = kind === 'accent' ? colors.accent : kind === 'primary' ? colors.primary : colors.primarySoft;
  const fg = kind === 'outline' ? colors.primary : '#fff';
  return (
    <PressScale accessibilityRole="button" disabled={disabled} onPress={onPress} scaleTo={0.96} style={[styles.action, { backgroundColor: bg, borderColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { marginLeft: -6, paddingRight: 4 },
  headerTitle: { flex: 1, fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  pageContent: { paddingTop: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sectionAction: { color: colors.primaryLight, fontWeight: '600', fontSize: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  stat: { flex: 1, minWidth: '45%', gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingHorizontal: spacing.md, paddingVertical: 14, minHeight: 56 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sepLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 60 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowRight: { color: colors.textMuted, fontSize: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  emptyBtn: { marginTop: spacing.sm, backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  hero: { backgroundColor: colors.hero, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg + 8, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, gap: 4 },
  heroTitle: { color: colors.heroText, fontSize: 24, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 0, paddingHorizontal: 20, minHeight: 52 },
  actionText: { fontWeight: '700', fontSize: 17, letterSpacing: -0.2 },
});
