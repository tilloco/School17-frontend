import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'english', 'russian', 'uzbek', 'history', 'law', 'informatics'];

const money = (minor: number) => Math.round(minor / 100).toLocaleString('en-US').replace(/,/g, ' ');

export default function SearchScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | undefined>();
  const [sort, setSort] = useState<'rating' | 'price_asc'>('rating');
  const res = useAsync(() => market.search(token as string, { q: query, subject, sort }), [token, query, subject, sort], (d) => d.items.length === 0);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('market.find'), headerBackTitle: t('common.back') }} />
      <TextInput
        accessibilityLabel={t('search.placeholder')}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setQuery(text.trim())}
        returnKeyType="search"
        placeholder={t('search.placeholder')}
        style={styles.input}
        maxLength={80}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={t('search.all')} active={!subject} onPress={() => setSubject(undefined)} />
        {SUBJECTS.map((s) => (
          <Chip key={s} label={s} active={subject === s} onPress={() => setSubject(s)} />
        ))}
      </ScrollView>
      <View style={styles.row}>
        <Chip label={t('search.sortRating')} active={sort === 'rating'} onPress={() => setSort('rating')} />
        <Chip label={t('search.sortPrice')} active={sort === 'price_asc'} onPress={() => setSort('price_asc')} />
      </View>
      <Text style={styles.note}>{t('search.rankingNote')}</Text>
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
          data={res.data.items}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={<Text style={styles.count}>{t('search.results', { count: res.data.total })}</Text>}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/market/teacher/${item.id}` as never)} style={styles.card}>
              <Text style={styles.name}>{item.name} {item.verified ? '✓' : ''}</Text>
              <Text style={styles.headline}>{item.headline}</Text>
              <Text style={styles.meta}>
                {item.rating.count ? t('teacher.rating', { avg: (item.rating.average ?? 0).toFixed(1), count: item.rating.count }) : t('teacher.noReviews')}
              </Text>
              <Text style={styles.price}>{t('teacher.perHour', { price: money(item.priceMinor) })}</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md, fontSize: 16, minHeight: 48 },
  chips: { flexGrow: 0, marginVertical: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  note: { fontSize: 12, color: colors.textMuted, marginVertical: spacing.sm },
  count: { color: colors.textMuted, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  headline: { color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  price: { color: colors.primary, fontWeight: '700' },
});
