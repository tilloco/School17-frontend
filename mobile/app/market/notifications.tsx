import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../src/ui/Text';
import { Stack, useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market, InboxItem } from '../../src/market/marketApi';
import { routeFor } from '../../src/notifications/routes';
import { setBadge } from '../../src/notifications/push';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { fmtDay, fmtTime } from '../../src/ui/format';
import { Empty, Group, Page } from '../../src/ui';
import { PressScale } from '../../src/ui/PressScale';

const ICON: { test: RegExp; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { test: /^message/, icon: 'chatbubble', color: '#007AFF' },
  { test: /^class\.(live|reminder|session)/, icon: 'videocam', color: '#34C759' },
  { test: /^class\.(cancelled|removed)|cancel/, icon: 'close-circle', color: '#FF3B30' },
  { test: /homework/, icon: 'document-text', color: '#FF9500' },
  { test: /^class/, icon: 'people', color: '#5856D6' },
  { test: /^booking|lesson|reminder/, icon: 'calendar', color: '#34C759' },
  { test: /review/, icon: 'star', color: '#FFB800' },
  { test: /pay|money|directpay/, icon: 'cash', color: '#AF52DE' },
];
const iconFor = (type: string) => ICON.find((x) => x.test.test(type)) ?? { icon: 'notifications' as const, color: '#8E8E93' };
const when = (iso: string) => (fmtDay(iso) === t('common.today') ? fmtTime(iso) : `${fmtDay(iso)}, ${fmtTime(iso)}`);

/** Notification inbox: one icon per kind, unread ones in bold with a blue dot, newest first. "Mark all read" and the settings are small buttons at the top. */
export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const res = useAsync(() => market.inbox(token as string), [token], (d) => d.length === 0);
  const open = (n: InboxItem) => {
    if (!n.read) void market.readNotif(token as string, n.id).then(res.reload).catch(() => undefined);
    const path = routeFor(n.type, n.data);
    if (path) router.push(path as never);
  };
  const unread = res.data?.filter((n) => !n.read).length ?? 0;
  React.useEffect(() => void setBadge(unread), [unread]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('notif.title'), headerBackTitle: t('common.back'), headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel={t('ns.title')} onPress={() => router.push('/market/notification-settings' as never)} hitSlop={12}><Ionicons name="options-outline" size={24} color={colors.primary} /></Pressable>
      ) }} />
      <Page edges={[]} onRefresh={res.reload}>
        {res.state === 'empty' ? <Empty icon="notifications" title={t('notif.emptyTitle')} text={t('notif.emptyText')} /> : res.state !== 'ready' || !res.data ? (
          <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
        ) : (
          <>
            {unread > 0 && (
              <PressScale accessibilityRole="button" onPress={() => market.readAll(token as string).then(res.reload).catch(() => undefined)} style={styles.markAll}>
                <Ionicons name="checkmark-done" size={18} color={colors.primary} /><Text style={styles.markAllText}>{t('notif.markAll')} ({unread})</Text>
              </PressScale>
            )}
            <Group>
              {res.data.map((n) => {
                const ic = iconFor(n.type);
                return (
                  <PressScale key={n.id} accessibilityRole="button" onPress={() => open(n)} scaleTo={0.99} haptic={false} style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: ic.color }]}><Ionicons name={ic.icon} size={18} color="#fff" /></View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.title, !n.read && styles.bold]} numberOfLines={2}>{n.title}</Text>
                      <Text style={styles.body} numberOfLines={3}>{n.body}</Text>
                      <Text style={styles.when}>{when(n.at)}</Text>
                    </View>
                    {!n.read && <View style={styles.dot} />}
                  </PressScale>
                );
              })}
            </Group>
          </>
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  markAllText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800' },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 19 },
  when: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2F8CF4', marginTop: 6 },
});
