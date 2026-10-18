import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../src/ui/Text';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market, TopicDetail } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { subjectStyle } from '../../../src/theme/subjects';
import { colors, spacing } from '../../../src/theme/colors';
import { Avatar, SectionTitle } from '../../../src/ui';

const LANGS = ['uz', 'ru', 'en'] as const;

/** One topic: what it is, a one-minute test, the best videos (voted by people), who teaches it, and who scored best. */
export default function TopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState<string | null>(null);
  const res = useAsync(() => market.topic(token as string, slug), [token, slug]);
  const reloadRef = React.useRef(() => {});
  useFocusEffect(React.useCallback(() => { reloadRef.current(); }, []));
  reloadRef.current = res.reload; // coming back from the test or from adding a video shows the new state
  const teacher = user?.role === 'TEACHER';
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));

  const d: TopicDetail | null = res.data ?? null;
  const videos = useMemo(() => (d?.videos ?? []).filter((v) => !lang || v.lang === lang), [d, lang]);
  const open = (v: TopicDetail['videos'][number]) => {
    if (!v.embed) return Alert.alert(t('topic.cannotPlay'));
    const by = v.curated ? v.author : v.by?.name;
    router.push(`/market/topic-watch/${v.id}?embed=${encodeURIComponent(v.embed)}&title=${encodeURIComponent(v.title)}&slug=${d!.slug}&by=${encodeURIComponent(by ?? '')}&curated=${v.curated ? 1 : 0}` as never);
  };
  const share = () => d && Share.share({ message: t('topic.shareMsg', { title: d.title, link: `${API_URL.replace(/\/+$/, '')}/t/${d.slug}` }) });
  const vote = (id: string) => market.voteVideo(token as string, id).then(res.reload).catch(fail);
  const remove = (id: string) => Alert.alert(t('topic.removeVideo'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('topic.removeVideo'), style: 'destructive', onPress: () => void market.removeVideo(token as string, id).then(res.reload).catch(fail) }]);

  const header = <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: t('common.back'), headerRight: () => <Pressable onPress={share} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('topic.share')}><Ionicons name="share-outline" size={24} color={colors.text} /></Pressable> }} />;
  if (res.state !== 'ready' || !d) return <View style={styles.root}>{header}<StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} /></View>;
  const st = subjectStyle(d.subject);
  const best = d.leaderboard.best;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={[styles.hero, { backgroundColor: st.color }]}>
          <View style={styles.heroIcon}><Ionicons name={st.icon} size={30} color="#fff" /></View>
          <Text style={styles.heroTitle}>{d.title}</Text>
          <Text style={styles.heroText}>{d.summary}</Text>
          <Text style={styles.heroMeta}>{t(`subj.${d.subject}`)} · {t(`level.${d.level}`)}</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push(`/market/topic-quiz/${d.slug}` as never)} style={[styles.cta, { backgroundColor: colors.primary }]}>
          <Ionicons name="flash" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>{t('topic.takeTest')}</Text>
            <Text style={styles.ctaSub}>{best !== null ? t('topic.yourBest', { a: best, b: d.questions }) + (d.leaderboard.percentile !== null ? ` · ${t('topic.better', { n: d.leaderboard.percentile })}` : '') : t('topic.testHint', { n: d.questions })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>

        <SectionTitle title={t('topic.videos')} action={teacher ? { label: t('topic.addVideo'), onPress: () => router.push(`/market/topic-add/${d.slug}` as never) } : undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Pressable accessibilityRole="button" onPress={() => setLang(null)} style={[styles.lang, !lang && { backgroundColor: colors.primary }]}><Text style={[styles.langText, !lang && { color: '#fff' }]}>{t('topics.all')}</Text></Pressable>
          {LANGS.map((l) => <Pressable key={l} accessibilityRole="button" onPress={() => setLang(lang === l ? null : l)} style={[styles.lang, lang === l && { backgroundColor: colors.primary }]}><Text style={[styles.langText, lang === l && { color: '#fff' }]}>{l.toUpperCase()}</Text></Pressable>)}
        </ScrollView>
        {videos.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t(teacher ? 'topic.noVideosTeacher' : 'topic.noVideos')}</Text>
          </View>
        ) : videos.map((v) => (
          <View key={v.id} style={styles.video}>
            <Pressable accessibilityRole="button" accessibilityLabel={v.title} onPress={() => open(v)} style={styles.thumbWrap}>
              {v.videoId ? <Image source={{ uri: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg` }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="play" size={26} color={colors.textMuted} /></View>}
              <View style={styles.play}><Ionicons name="play" size={16} color="#fff" /></View>
            </Pressable>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.vTitle} numberOfLines={2}>{v.title}</Text>
              <View style={styles.vMeta}>
                <View style={styles.langTag}><Text style={styles.langTagText}>{v.lang.toUpperCase()}</Text></View>
                {v.curated ? <View style={styles.picked}><Ionicons name="shield-checkmark" size={12} color="#1D9BF0" /><Text style={styles.pickedText} numberOfLines={1}>{v.author}</Text></View> : v.by && <Pressable onPress={() => router.push(`/market/teacher/${v.by!.teacherId}` as never)} hitSlop={6}><Text style={styles.by} numberOfLines={1}>{v.by.name}</Text></Pressable>}
              </View>
            </View>
            {v.mine ? (
              <Pressable accessibilityRole="button" onPress={() => remove(v.id)} hitSlop={8} style={styles.voteBtn}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: v.voted }} accessibilityLabel={t('topic.vote')} onPress={() => vote(v.id)} hitSlop={8} style={[styles.voteBtn, v.voted && { backgroundColor: st.color + '26' }]}>
                <Ionicons name={v.voted ? 'caret-up-circle' : 'caret-up-circle-outline'} size={26} color={v.voted ? st.color : colors.textMuted} />
                <Text style={[styles.voteNum, v.voted && { color: st.color }]}>{v.votes}</Text>
              </Pressable>
            )}
          </View>
        ))}

        {d.teachers.length > 0 && (<>
          <SectionTitle title={t('topic.teachers')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {d.teachers.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/market/teacher/${p.id}` as never)} style={styles.teacher}>
                <Avatar name={p.name} size={56} photoOf={p.hasPhoto ? p.id : null} />
                <Text style={styles.tName} numberOfLines={1}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="star" size={12} color="#F5B301" /><Text style={styles.tRate}>{p.rating ?? '–'}</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        </>)}

        {d.leaderboard.top.length > 0 && (<>
          <SectionTitle title={t('topic.top')} />
          <View style={styles.board}>
            {d.leaderboard.top.map((r) => (
              <View key={r.rank} style={[styles.row, r.mine && { backgroundColor: st.color + '1F' }]}>
                <Text style={styles.rank}>{r.rank}</Text>
                <Text style={[styles.rName, r.mine && { fontWeight: '800' }]} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.rScore}>{r.score}/{d.questions}</Text>
              </View>
            ))}
            <Text style={styles.players}>{t('topic.players', { n: d.leaderboard.players })}</Text>
          </View>
        </>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: spacing.md },
  hero: { borderRadius: 26, padding: 20, gap: 6 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroText: { fontSize: 15, color: 'rgba(255,255,255,0.92)', lineHeight: 21 },
  heroMeta: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 16 },
  ctaTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 1 },
  lang: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  langText: { fontWeight: '800', fontSize: 12, color: colors.text },
  empty: { alignItems: 'center', gap: 8, padding: 24, backgroundColor: colors.surface, borderRadius: 20 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  video: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 10 },
  thumbWrap: { width: 118, height: 66, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: 118, height: 66 },
  play: { position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  vTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  vMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langTag: { backgroundColor: colors.neutralSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  langTagText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  pickedText: { fontSize: 12, color: colors.textMuted, fontWeight: '700', flexShrink: 1 },
  by: { fontSize: 12, color: colors.primaryLight, fontWeight: '700', maxWidth: 110 },
  voteBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: 14 },
  voteNum: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  teacher: { width: 96, alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6 },
  tName: { fontSize: 12, fontWeight: '700', color: colors.text },
  tRate: { fontSize: 12, fontWeight: '700', color: colors.text },
  board: { backgroundColor: colors.surface, borderRadius: 20, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12 },
  rank: { width: 22, fontWeight: '800', color: colors.textMuted },
  rName: { flex: 1, color: colors.text, fontSize: 15 },
  rScore: { fontWeight: '800', color: colors.text },
  players: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: 6 },
});
