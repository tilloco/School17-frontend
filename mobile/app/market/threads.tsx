import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

export default function ThreadsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const res = useAsync(() => market.threads(token as string), [token], (d) => d.length === 0);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('market.messages'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
          data={res.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/market/thread/${item.id}` as never)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.other.name}</Text>
                <Text style={styles.preview} numberOfLines={1}>{item.lastMessage?.preview ?? ''}</Text>
              </View>
              {item.unread > 0 && <Text style={styles.badge}>{item.unread}</Text>}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, minHeight: 60 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  preview: { color: colors.textMuted },
  badge: { backgroundColor: colors.danger, color: colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', fontWeight: '700' },
});
