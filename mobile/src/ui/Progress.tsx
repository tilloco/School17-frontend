import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';
import type { Progress } from '../market/marketApi';

const FLAME = '#FF8A00';

/** Days in a row with something done. Grey when there is no streak yet, so it invites rather than nags. */
export function StreakChip({ streak, todayDone }: { streak: number; todayDone: boolean }) {
  const on = streak > 0;
  return (
    <View style={[styles.streak, on && { backgroundColor: 'rgba(255,138,0,0.16)' }]} accessibilityLabel={t('prog.streakLabel', { n: streak })}>
      <Ionicons name="flame" size={18} color={on ? FLAME : colors.textMuted} />
      <Text style={[styles.streakNum, { color: on ? FLAME : colors.textMuted }]}>{streak}</Text>
      {on && !todayDone && <View style={styles.dot} />}
    </View>
  );
}

/** A circle that fills as the week's goal is reached. */
export function GoalRing({ done, goal, size = 84 }: { done: number; goal: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, goal ? done / goal : 0);
  const full = done >= goal;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={full ? '#2ED573' : colors.primary} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
      </Svg>
      {full ? <Ionicons name="checkmark" size={size * 0.4} color="#2ED573" /> : <Text style={styles.ringNum}>{done}<Text style={styles.ringOf}>/{goal}</Text></Text>}
    </View>
  );
}

/** "Your week": the goal ring, what was done, and where you stand in your best class. One card, one glance. */
export function WeekCard({ p, onRank }: { p: Progress; onRank: (classId: string) => void }) {
  const best = p.ranks[0];
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <GoalRing done={p.week.done} goal={p.week.goal} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{p.week.reached ? t('prog.goalDone') : t('prog.week')}</Text>
          <Text style={styles.sub}>{t('prog.lessons', { n: p.week.lessons })} · {t('prog.homework', { n: p.week.homework })}</Text>
          {!p.week.reached && <Text style={styles.hint}>{p.streak > 0 && !p.todayDone ? t('prog.keepStreak') : t('prog.goalHint', { n: p.week.goal - p.week.done })}</Text>}
        </View>
      </View>
      {best && (
        <Pressable accessibilityRole="button" onPress={() => onRank(best.classId)} style={styles.rank}>
          <Ionicons name="trophy" size={18} color="#F5B301" />
          <Text style={styles.rankText} numberOfLines={1}>{t('prog.rank', { rank: best.rank, of: best.of, title: best.title })}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.neutralSoft, paddingHorizontal: 12, height: 36, borderRadius: 18 },
  streakNum: { fontWeight: '800', fontSize: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: FLAME, marginLeft: 1 },
  ringNum: { fontSize: 24, fontWeight: '800', color: colors.text },
  ringOf: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing.md, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.neutralSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  rankText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
});
