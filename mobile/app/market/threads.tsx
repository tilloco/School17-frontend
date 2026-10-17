import React from 'react';
import { useRealtime } from '../../src/lib/realtime';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { ApiError } from '../../src/lib/api';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { fmtDay, fmtTime } from '../../src/ui/format';
import { Avatar, Empty, Page } from '../../src/ui';

const BLUE = '#2F8CF4';

/** Direct messages like Instagram or Telegram: big avatar, name, last message, time; unread chats are bold with a small blue number. Booking requests sit on top as one row. */
export default function ThreadsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const res = useAsync(() => market.threads(token as string), [token]);
  useRealtime(['message', 'receipt', 'connect'], () => res.reload());
  const home = useAsync(() => (user?.role === 'TEACHER' ? market.home(token as string) : Promise.resolve(null)), [token, user?.role]);
  const contacts = useAsync(() => market.contacts(token as string).catch(() => []), [token]);
  const top = useAsync(() => (user?.role === 'TEACHER' ? Promise.resolve(null) : market.search(token as string, { sort: 'rating' }).catch(() => null)), [token, user?.role]);
  const requests = home.data?.counts.pendingRequests ?? 0;
  const have = new Set((res.data ?? []).map((x) => x.other.id).filter(Boolean));
  const suggested = (contacts.data ?? []).filter((c) => !have.has(c.userId)).slice(0, 8);
  const startChat = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error'));
    }
  };
  const when = (iso: string) => (fmtDay(iso) === t('common.today') ? fmtTime(iso) : fmtDay(iso));
  const reload = () => { res.reload(); home.reload(); contacts.reload(); top.reload(); };

  return (
    <Page onRefresh={reload}>
      <View style={styles.titleRow}>
        <Text style={styles.h1}>{t('market.messages')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('dm.new')} onPress={() => router.push('/market/new-message' as never)} style={styles.compose}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>
      {user?.role === 'TEACHER' && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/market/requests' as never)} style={styles.requests}>
          <View style={styles.reqIcon}><Ionicons name="mail-unread" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t('home.requests')}</Text>
            <Text style={styles.preview}>{requests ? t('msg.requestsWaiting', { n: requests }) : t('msg.noRequests')}</Text>
          </View>
          {requests > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{requests}</Text></View>}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : res.data.length === 0 ? (
        <Empty icon="chatbubbles" title={t('msg.emptyTitle')} text={t('msg.emptyText')} />
      ) : (
        <View style={{ marginHorizontal: -spacing.md }}>
          {res.data.some((x) => x.status === 'REQUEST' && !x.requestedByMe) && <Text style={styles.reqHead}>{t('dm.requests')}</Text>}
          {[...res.data].sort((a, b) => Number(b.status === 'REQUEST' && !b.requestedByMe) - Number(a.status === 'REQUEST' && !a.requestedByMe)).map((item) => {
            const unread = item.unread > 0;
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push(`/market/thread/${item.id}` as never)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.neutralSoft }]}>
                <Avatar name={item.other.name} size={54} userId={item.other.hasPhoto ? item.other.id : null} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>{item.other.name ?? '-'}</Text>
                  <Text style={[styles.preview, unread && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                    {(item.lastMessage?.mine ? `${t('msg.you')}: ` : '') + (item.lastMessage?.preview === '📎' ? t('chat.photoOrFile') : item.lastMessage?.preview || t('msg.noMessages'))}
                  </Text>
                </View>
                <View style={styles.right}>
                  {!!item.lastMessage && <Text style={[styles.time, unread && { color: BLUE, fontWeight: '700' }]}>{when(item.lastMessage.at)}</Text>}
                  {unread && <View style={[styles.badge, { backgroundColor: BLUE }]}><Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text></View>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {res.state === 'ready' && (suggested.length > 0 || (res.data?.length === 0 && (top.data?.items.length ?? 0) > 0)) && (
        <>
          <Text style={styles.sugTitle}>{t('msg.suggested')}</Text>
          {suggested.length > 0 ? (
            <>
              <Text style={styles.sugText}>{t('msg.suggestedText')}</Text>
              <View style={{ marginHorizontal: -spacing.md }}>
              {suggested.map((c) => (
                <Pressable key={c.userId} accessibilityRole="button" onPress={() => startChat(c.userId)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                  <Avatar name={c.name} size={54} userId={c.hasPhoto ? c.userId : null} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.preview} numberOfLines={1}>{t(`role.${c.role}`)} · {c.classes.join(', ')}</Text>
                  </View>
                  <View style={styles.writeChip} accessibilityLabel={t('dm.write')}><Ionicons name="chatbubble" size={16} color="#fff" /></View>
                </Pressable>
              ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sugText}>{t('msg.topTeachers')}</Text>
              {top.data!.items.slice(0, 5).map((p) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/market/teacher/${p.id}` as never)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                  <Avatar name={p.name} size={54} photoOf={p.hasPhoto ? p.id : null} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.preview} numberOfLines={1}>{p.subjects.slice(0, 2).map((x) => t(`subj.${x}`)).join(', ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </>
          )}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  compose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sugTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.md, letterSpacing: -0.4 },
  sugText: { color: colors.textMuted, marginTop: -8 },
  writeChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  writeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reqHead: { fontSize: 13, fontWeight: '700', color: colors.textMuted, paddingHorizontal: spacing.md, paddingTop: 6 },
  requests: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, backgroundColor: colors.primarySoft },
  reqIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  name: { fontSize: 17, color: colors.text, fontWeight: '600' },
  bold: { fontWeight: '800' },
  preview: { fontSize: 14, color: colors.textMuted },
  right: { alignItems: 'flex-end', gap: 6, minWidth: 44 },
  time: { fontSize: 12, color: colors.textMuted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
