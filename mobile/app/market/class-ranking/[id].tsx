import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market, RankRow } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { Avatar, Card, Empty, Page, SectionTitle } from '../../../src/ui';
import { Person, PersonSheet } from '../../../src/ui/PersonSheet';
import { Sheet } from '../../../src/ui/Sheet';

const MEDAL = ['#FFB800', '#A7A9AF', '#CD7F32'];

function Bar({ percent, color }: { percent: number | null; color: string }) {
  return (
    <View style={styles.track} accessibilityLabel={percent === null ? '–' : `${percent}%`}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent ?? 0))}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Class leaderboard: points from live-lesson attendance, assignments and polls, with a bar for how often each pupil joined. The teacher can add bonus points. */
export default function ClassRankingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const res = useAsync(() => market.ranking(token as string, id), [token, id]);
  const [who, setWho] = useState<Person | null>(null);
  const [bonusFor, setBonusFor] = useState<RankRow | null>(null);
  const d = res.data;

  const message = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error'));
    }
  };
  const give = async (points: number) => {
    const r = bonusFor;
    if (!r?.userId) return;
    setBonusFor(null);
    try {
      await market.giveBonus(token as string, id, r.userId, points, '');
      res.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  const row = (r: RankRow) => (
    <Pressable key={r.rank + r.name} onPress={() => setWho({ userId: r.userId, name: r.name, username: r.username, hasPhoto: r.hasPhoto })} onLongPress={() => d?.canGiveBonus && r.userId && setBonusFor(r)} style={[styles.row, r.mine && styles.mine]}>
      <Text style={styles.rank}>{r.rank}</Text>
      <Avatar name={r.name} size={44} userId={r.hasPhoto ? r.userId : null} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>{r.name}{r.mine ? `  ·  ${t('rank.you')}` : ''}</Text>
          <Text style={styles.points}>{Math.round(r.points)}</Text>
        </View>
        <Bar percent={r.attendance.percent} color={colors.success} />
        <Text style={styles.sub} numberOfLines={1}>
          {r.attendance.total ? t('rank.attendance', { a: r.attendance.attended, n: r.attendance.total, p: r.attendance.percent ?? 0 }) : t('rank.noLessons')}
          {r.homework.total ? ` · ${t('rank.hw', { a: r.homework.done, n: r.homework.total })}` : ''}
          {r.bonus ? ` · +${r.bonus}★` : ''}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('rank.title'), headerBackTitle: t('common.back') }} />
      <Page edges={[]} onRefresh={res.reload}>
        {res.state !== 'ready' || !d ? <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} /> : d.items.length === 0 ? (
          <Empty icon="trophy" title={t('rank.empty')} text={t('rank.emptyText')} />
        ) : (
          <>
            <View style={styles.podium}>
              {d.items.slice(0, 3).map((r, i) => (
                <Pressable key={r.rank} onPress={() => setWho({ userId: r.userId, name: r.name, username: r.username, hasPhoto: r.hasPhoto })} style={styles.pod}>
                  <View style={[styles.medal, { backgroundColor: MEDAL[i] }]}><Text style={styles.medalText}>{r.rank}</Text></View>
                  <Avatar name={r.name} size={i === 0 ? 72 : 60} userId={r.hasPhoto ? r.userId : null} />
                  <Text style={styles.podName} numberOfLines={1}>{r.name.split(' ')[0]}</Text>
                  <Text style={styles.podPoints}>{Math.round(r.points)}</Text>
                </Pressable>
              ))}
            </View>
            <SectionTitle title={t('rank.all')} />
            <Card style={{ padding: 0 }}>{d.items.map(row)}</Card>
            <Text style={styles.how}>{t('rank.how', { a: d.weights.attendance, h: d.weights.homework, p: d.weights.polls })}</Text>
            {d.canGiveBonus && <Text style={styles.how}>{t('rank.bonusHint')}</Text>}
          </>
        )}
      </Page>
      <PersonSheet person={who} onClose={() => setWho(null)} onMessage={message} />
      <Sheet visible={!!bonusFor} onClose={() => setBonusFor(null)} title={bonusFor ? `${t('rank.bonus')}: ${bonusFor.name}` : ''} actions={[5, 10, 20].map((p) => ({ label: `+${p} ${t('rank.points')}`, icon: 'gift' as const, onPress: () => give(p) }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.lg, paddingVertical: spacing.md },
  pod: { alignItems: 'center', gap: 4, width: 96 },
  medal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: -4, zIndex: 1 },
  medalText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  podName: { fontWeight: '700', color: colors.text },
  podPoints: { color: colors.textMuted, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  mine: { backgroundColor: colors.primarySoft },
  rank: { width: 22, textAlign: 'center', fontWeight: '800', color: colors.textMuted },
  nameLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 15 },
  points: { fontWeight: '800', color: colors.primary, fontSize: 16 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.neutralSoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  sub: { fontSize: 12, color: colors.textMuted },
  how: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.md },
});
