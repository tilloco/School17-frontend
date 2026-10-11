import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { API_URL } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { FeedPost, market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

/** Class feed: saved boards, session notes, homework, recaps and late answers. */
export default function ClassFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const feed = useAsync(() => market.classFeed(token as string, id), [token, id], (d) => d.length === 0);

  const body = (p: FeedPost) => {
    const d = (p.data ?? {}) as Record<string, string>;
    switch (p.kind) {
      case 'NOTE':
        return (
          <>
            {!!d.topic && <Text>{t('feed.topic')}: {d.topic}</Text>}
            {!!d.homework && <Text>{t('feed.homework')}: {d.homework}</Text>}
            {!!d.nextStep && <Text>{t('feed.nextStep')}: {d.nextStep}</Text>}
          </>
        );
      case 'HOMEWORK':
        return (
          <>
            <Text style={styles.strong}>{p.title}</Text>
            {!!p.text && <Text>{p.text}</Text>}
            {!!d.dueAt && <Text style={styles.help}>{t('hw.due', { time: new Date(d.dueAt).toLocaleString() })}</Text>}
            <PrimaryButton title={t('hw.open')} variant="outline" onPress={() => router.push(`/market/class-homework/${id}` as never)} />
          </>
        );
      case 'RECAP':
        return p.sessionId ? <PrimaryButton title={t('recap.open')} variant="outline" onPress={() => router.push(`/market/class-recap/${p.sessionId}` as never)} /> : null;
      case 'ANSWER':
        return (
          <>
            <Text style={styles.strong}>{p.title}</Text>
            <Text>{p.text}</Text>
          </>
        );
      default:
        return p.hasImage ? <Image accessibilityLabel={t(`feed.kind.${p.kind}`)} source={{ uri: `${API_URL}/classes/${id}/feed/${p.id}/image`, headers: { Authorization: `Bearer ${token}` } }} style={styles.img} resizeMode="contain" /> : null;
    }
  };

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
              {body(p)}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  img: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#fff' },
});
