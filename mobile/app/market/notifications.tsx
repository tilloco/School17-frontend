import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const res = useAsync(() => market.inbox(token as string), [token], (d) => d.length === 0);
  const open = (n: { data: { bookingId?: string; threadId?: string } | null }) => {
    if (n.data?.threadId) router.push(`/market/thread/${n.data.threadId}` as never);
    else if (n.data?.bookingId) router.push('/market/lessons' as never);
  };
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('notif.title'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <>
          <PrimaryButton title={t('notif.markAll')} variant="outline" onPress={() => market.readAll(token as string).then(res.reload)} />
          <FlatList
            data={res.data}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ paddingVertical: spacing.md }}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => open(item)} style={[styles.row, !item.read && styles.unread]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.when}>{new Date(item.at).toLocaleString()}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: colors.primary, borderWidth: 2 },
  title: { fontWeight: '700', color: colors.text },
  body: { color: colors.text },
  when: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
