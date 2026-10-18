import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, TextInput } from '../../src/ui/Text';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { subjectStyle } from '../../src/theme/subjects';
import { colors, spacing } from '../../src/theme/colors';
import { Empty, Page } from '../../src/ui';

/** Topics: one page for each exact thing a pupil is stuck on, with the best videos, a one-minute test and the teachers who teach it. */
export default function TopicsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const all = useAsync(() => market.topics(token as string, {}), [token]);
  const reloadRef = React.useRef(() => {});
  useFocusEffect(React.useCallback(() => { reloadRef.current(); }, []));
  reloadRef.current = all.reload;
  const subjects = useMemo(() => Array.from(new Set((all.data ?? []).map((x) => x.subject))), [all.data]);
  const rows = useMemo(() => (all.data ?? []).filter((x) => (!subject || x.subject === subject) && (!q.trim() || x.title.toLowerCase().includes(q.trim().toLowerCase()))), [all.data, subject, q]);

  return (
    <Page onRefresh={all.reload}>
      <Text style={styles.h1}>{t('topics.title')}</Text>
      <Text style={styles.lead}>{t('topics.lead')}</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('topics.search')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('topics.search')} style={styles.input} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Pressable accessibilityRole="button" onPress={() => setSubject(null)} style={[styles.chip, !subject && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, !subject && { color: '#fff' }]}>{t('topics.all')}</Text></Pressable>
        {subjects.map((s) => {
          const st = subjectStyle(s);
          const on = subject === s;
          return (
            <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSubject(on ? null : s)} style={[styles.chip, { backgroundColor: on ? st.color : st.color + '26' }]}>
              <Ionicons name={st.icon} size={14} color={on ? '#fff' : st.color} />
              <Text style={[styles.chipText, { color: on ? '#fff' : st.color }]}>{t(`subj.${s}`)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {all.state !== 'ready' || !all.data ? (
        <StateView state={all.state === 'ready' ? 'loading' : all.state} onRetry={all.reload} />
      ) : rows.length === 0 ? (
        <Empty icon="search" title={t('topics.none')} text={t('topics.noneHint')} />
      ) : (
        rows.map((x) => {
          const st = subjectStyle(x.subject);
          return (
            <Pressable key={x.slug} accessibilityRole="button" onPress={() => router.push(`/market/topic/${x.slug}` as never)} style={styles.card}>
              <View style={[styles.icon, { backgroundColor: st.color }]}><Ionicons name={st.icon} size={24} color="#fff" /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title} numberOfLines={2}>{x.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>{t(`subj.${x.subject}`)} · {t('topics.videos', { n: x.videos })} · {t('topics.test')}</Text>
              </View>
              {x.best !== null ? <View style={[styles.best, { backgroundColor: st.color + '26' }]}><Text style={[styles.bestText, { color: st.color }]}>{x.best}/{x.questions}</Text></View> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            </Pressable>
          );
        })
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  lead: { fontSize: 14, color: colors.textMuted, marginTop: -6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 16, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: colors.neutralSoft },
  chipText: { fontWeight: '800', fontSize: 13, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 20, padding: 14 },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted },
  best: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  bestText: { fontWeight: '800', fontSize: 13 },
});
