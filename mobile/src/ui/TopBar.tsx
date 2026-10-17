import React, { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '../lib/realtime';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth-context';
import { t } from '../i18n';
import { market } from '../market/marketApi';
import { colors, spacing } from '../theme/colors';

const BLUE = '#2F8CF4';

function IconButton({ name, label, count, onPress }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; count?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={count ? `${label}: ${count}` : label} onPress={onPress} hitSlop={8} style={styles.iconBtn}>
      <Ionicons name={name} size={26} color={colors.text} />
      {!!count && count > 0 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>
      )}
    </Pressable>
  );
}

/** Top bar of every main screen, like Instagram: logo on the left, messages (paper plane) and notifications (bell) on the right, each with a small blue counter. */
export function TopBar() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState(0);
  const [notes, setNotes] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [m, n] = await Promise.all([market.unread(token).catch(() => null), market.unreadCount(token).catch(() => null)]);
    if (m) setMsgs(m.total);
    if (n) setNotes(n.unread);
  }, [token]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);
  useRealtime(['message', 'receipt', 'class.channel', 'connect'], () => void refresh());

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <View style={styles.brand}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="School17" />
        <Text style={styles.brandText}>School17</Text>
      </View>
      <View style={styles.right}>
        <IconButton name="notifications-outline" label={t('notif.title')} count={notes} onPress={() => router.push('/market/notifications' as never)} />
        <IconButton name="paper-plane-outline" label={t('market.messages')} count={msgs} onPress={() => router.push('/market/threads' as never)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: 8, backgroundColor: colors.background },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 30, borderRadius: 8 },
  brandText: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.background },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
