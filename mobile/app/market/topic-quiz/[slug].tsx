import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../src/ui/Text';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market, QuizResult } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { Celebrate } from '../../../src/ui/Celebrate';
import { GoalRing } from '../../../src/ui/Progress';

/** The one-minute test: one question at a time, then the score, where you stand, and the answers to learn from. Scoring happens on the server. */
export default function TopicQuizScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const quiz = useAsync(() => market.quiz(token as string, slug), [token, slug]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState(false);

  const header = <Stack.Screen options={{ headerShown: true, title: quiz.data?.title ?? '', headerBackTitle: t('common.back') }} />;
  if (quiz.state !== 'ready' || !quiz.data) return <View style={styles.root}>{header}<StateView state={quiz.state === 'ready' ? 'loading' : quiz.state} onRetry={quiz.reload} /></View>;
  const qs = quiz.data.questions;

  const answer = async (choice: number) => {
    if (busy) return;
    void Haptics.selectionAsync().catch(() => undefined);
    const next = [...picked, choice];
    if (i + 1 < qs.length) { setPicked(next); setI(i + 1); return; }
    setPicked(next);
    setBusy(true);
    try {
      const r = await market.submitQuiz(token as string, slug, qs.map((q, k) => ({ id: q.id, choice: next[k] })));
      setResult(r);
      if (r.score / r.total >= 0.75) setWin(true);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  const again = () => { setI(0); setPicked([]); setResult(null); quiz.reload(); };

  if (result) {
    const title = result.score === result.total ? t('quiz.perfect') : result.score / result.total >= 0.75 ? t('quiz.great') : result.score / result.total >= 0.5 ? t('quiz.good') : t('quiz.keep');
    const share = () => Share.share({ message: t('quiz.shareMsg', { a: result.score, b: result.total, title: quiz.data!.title, link: `${API_URL.replace(/\/+$/, '')}/t/${slug}` }) });
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.resultTop}>
            <GoalRing done={result.score} goal={result.total} size={132} />
            <Text style={styles.big}>{title}</Text>
            <Text style={styles.sub}>{t('quiz.score', { a: result.score, b: result.total })}{result.percentile !== null ? ` · ${t('topic.better', { n: result.percentile })}` : ''}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={share} style={styles.primary}><Ionicons name="paper-plane" size={20} color="#fff" /><Text style={styles.primaryText}>{t('quiz.share')}</Text></Pressable>
          <View style={styles.pair}>
            <Pressable accessibilityRole="button" onPress={again} style={styles.secondary}><Text style={styles.secondaryText}>{t('quiz.again')}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>{t('quiz.back')}</Text></Pressable>
          </View>
          <Text style={styles.review}>{t('quiz.review')}</Text>
          {qs.map((q, k) => {
            const r = result.results.find((x) => x.id === q.id);
            const ok = !!r?.right;
            return (
              <View key={q.id} style={styles.rev}>
                <View style={styles.revHead}><Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={22} color={ok ? '#2ED573' : colors.danger} /><Text style={styles.revQ}>{q.text}</Text></View>
                {!ok && <Text style={styles.wrong}>{t('quiz.yours')}: {q.options[picked[k]] ?? '–'}</Text>}
                <Text style={styles.right}>{t('quiz.correct')}: {q.options[r?.correct ?? 0]}</Text>
              </View>
            );
          })}
        </ScrollView>
        <Celebrate visible={win} title={t('quiz.winTitle')} text={t('quiz.winText', { a: result.score, b: result.total })} icon="trophy" onClose={() => setWin(false)} />
      </View>
    );
  }

  const q = qs[i];
  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.bar}><View style={[styles.fill, { width: `${((i + 1) / qs.length) * 100}%` }]} /></View>
        <Text style={styles.count}>{t('quiz.count', { a: i + 1, b: qs.length })}</Text>
        <Text style={styles.question}>{q.text}</Text>
        {q.options.map((o, k) => (
          <Pressable key={`${q.id}-${k}`} accessibilityRole="button" disabled={busy} onPress={() => void answer(k)} style={styles.option}>
            <View style={styles.letter}><Text style={styles.letterText}>{String.fromCharCode(65 + k)}</Text></View>
            <Text style={styles.optionText}>{o}</Text>
          </Pressable>
        ))}
        {busy && <Text style={styles.count}>{t('state.loading')}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: spacing.md },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  count: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  question: { fontSize: 23, fontWeight: '800', color: colors.text, lineHeight: 30, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  letter: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontWeight: '800', color: colors.primary },
  optionText: { flex: 1, fontSize: 17, color: colors.text, fontWeight: '600' },
  resultTop: { alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  big: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 6 },
  sub: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 999, height: 54 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  secondary: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '800' },
  review: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  rev: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 4 },
  revHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  revQ: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  wrong: { color: colors.danger, fontSize: 14 },
  right: { color: '#2ED573', fontSize: 14, fontWeight: '700' },
});
