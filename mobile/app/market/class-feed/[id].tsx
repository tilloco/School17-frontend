import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { StateView } from '../../../src/components/StateView';
import { API_URL } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

/** Class feed: boards the teacher saved (R8 adds notes, homework and recap entries). */
export default function ClassFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const feed = useAsync(() => market.classFeed(token as string, id), [token, id], (d) => d.length === 0);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('feed.title'), headerBackTitle: t('common.back') }} />
      {feed.state !== 'ready' || !feed.data ? (
        <StateView state={feed.state === 'ready' ? 'loading' : feed.state} onRetry={feed.reload} />
      ) : (
        <FlatList
          data={feed.data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
          renderItem={({ item: p }) => (
            <View style={styles.card}>
              <Text style={styles.help}>{t(`feed.kind.${p.kind}`)} · {new Date(p.at).toLocaleString()}</Text>
              {!!p.text && <Text>{p.text}</Text>}
              {p.hasImage && <Image accessibilityLabel={t(`feed.kind.${p.kind}`)} source={{ uri: `${API_URL}/classes/${id}/feed/${p.id}/image`, headers: { Authorization: `Bearer ${token}` } }} style={styles.img} resizeMode="contain" />}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  help: { color: colors.textMuted, fontSize: 13 },
  img: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#fff' },
});
