import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { fmtMoney } from '../../src/ui/format';
import { Avatar, Card, Empty, Header, Page, Pill, Stars } from '../../src/ui';

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'english', 'russian', 'uzbek', 'history', 'law', 'informatics'];

/** Find a teacher: search, subject chips, sort. Cards show who the teacher is at a glance. */
export default function SearchScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const [who, setWho] = useState<'teachers' | 'students'>('teachers');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string | undefined>();
  const [sort, setSort] = useState<'rating' | 'price_asc'>('rating');
  const res = useAsync(() => market.search(token as string, { q: query, subject, sort }), [token, query, subject, sort]);
  const pupils = useAsync(() => (who === 'students' && query.replace(/^@/, '').length >= 3 ? market.findPupils(token as string, query) : Promise.resolve([])), [token, who, query]);
  // search as you type (after a short pause), by name or by part of the @username
  useEffect(() => {
    const id = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <Page>
      <Header title={t('market.find')} />
      {isTeacher && (
        <View style={styles.seg}>
          {(['teachers', 'students'] as const).map((k) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: who === k }} onPress={() => setWho(k)} style={[styles.segItem, who === k && styles.segOn]}>
              <Text style={[styles.segText, who === k && { color: '#fff' }]}>{t(k === 'teachers' ? 'find.teachers' : 'find.students')}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel={t('search.placeholder')}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => setQuery(text.trim())}
          returnKeyType="search"
          placeholder={t(who === 'students' ? 'find.studentHint' : 'search.placeholder')}
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={80}
        />
      </View>
      {who === 'students' ? (
        <>
          <Text style={styles.count}>{t('find.studentsNote')}</Text>
          {pupils.data && pupils.data.length === 0 && query.replace(/^@/, '').length >= 3 && <Empty icon="search" title={t('search.noneTitle')} text={t('find.studentNone')} />}
          {pupils.data?.map((s) => (
            <Card key={s.username} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar name={s.name} size={46} />
              <View style={{ flex: 1 }}><Text style={styles.name}>{s.name}</Text><Text style={styles.headline}>@{s.username}</Text></View>
            </Card>
          ))}
        </>
      ) : (<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flexGrow: 0 }}>
        <Chip label={t('search.all')} active={!subject} onPress={() => setSubject(undefined)} />
        {SUBJECTS.map((s) => <Chip key={s} label={t(`subj.${s}`)} active={subject === s} onPress={() => setSubject(s)} />)}
      </ScrollView>
      <View style={styles.sortRow}>
        <Text style={styles.count}>{res.data ? t('search.results', { count: res.data.total }) : ''}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSort(sort === 'rating' ? 'price_asc' : 'rating')} style={styles.sort}>
          <Ionicons name="swap-vertical" size={16} color={colors.primary} />
          <Text style={styles.sortText}>{sort === 'rating' ? t('search.sortRating') : t('search.sortPrice')}</Text>
        </Pressable>
      </View>
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : res.data.items.length === 0 ? (
        <Empty icon="search" title={t('search.noneTitle')} text={t('search.noneText')} />
      ) : (
        res.data.items.map((item) => (
          <Card key={item.id} onPress={() => router.push(`/market/teacher/${item.id}` as never)} style={{ gap: spacing.sm }}>
            <View style={styles.head}>
              <Avatar name={item.name} size={52} photoOf={item.hasPhoto ? item.id : null} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {item.verified && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                </View>
                {!!item.username && <Text style={styles.username}>@{item.username}</Text>}
                <Text style={styles.headline} numberOfLines={2}>{item.headline}</Text>
              </View>
            </View>
            <View style={styles.pills}>
              {item.subjects.slice(0, 3).map((s) => <Pill key={s} label={t(`subj.${s}`)} tone="primary" />)}
              {item.instantBooking && <Pill label={t('search.instant')} tone="success" icon="flash" />}
            </View>
            <View style={styles.foot}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{item.rating.count ? <><Stars value={item.rating.average ?? 0} size={14} /><Text style={styles.rating}>{(item.rating.average ?? 0).toFixed(1)} ({item.rating.count})</Text></> : <Text style={styles.headline}>{t('teacher.noReviews')}</Text>}</View>
              <Text style={styles.price}>{t('teacher.perHour', { price: fmtMoney(item.priceMinor).replace(` ${t('common.currency')}`, '') })}</Text>
            </View>
          </Card>
        ))
      )}
      </>)}
    </Page>
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
  seg: { flexDirection: 'row', backgroundColor: colors.neutralSoft, borderRadius: 999, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontWeight: '700', color: colors.text },
  username: { color: colors.primaryLight, fontWeight: '600', fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.md },
  input: { flex: 1, minHeight: 48, fontSize: 16, color: colors.text },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.textMuted },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  sortText: { color: colors.primary, fontWeight: '600' },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  headline: { color: colors.textMuted, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: colors.text, fontWeight: '600' },
  price: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
