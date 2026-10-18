import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { fmtDate, fmtDayTime } from '../../src/ui/format';
import { Avatar, Card, Empty, Group, ListRow, Page, Pill, SectionTitle } from '../../src/ui';

/** Pupil / guardian: my classes (attendance, homework, next session), what is coming up, and the learning history. */
export default function LearningScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [child, setChild] = useState<string | undefined>();
  const res = useAsync(() => market.learning(token as string, child), [token, child]);
  const waiting = useAsync(() => market.myRequests(token as string).catch(() => []), [token]);

  if (res.state !== 'ready' || !res.data) return <Page><StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} /></Page>;
  const d = res.data;
  const statusTone = (s: string) => (s === 'COMPLETED' || s === 'ATTENDED' ? 'success' : s === 'CANCELLED' || s === 'NO_SHOW_STUDENT' || s === 'MISSED' ? 'danger' : 'primary') as 'success' | 'danger' | 'primary';
  const statusLabel = (s: string) => (s === 'ATTENDED' ? t('learn.attendedLabel') : s === 'MISSED' ? t('learn.missedLabel') : t(`status.${s}`));

  return (
    <Page onRefresh={res.reload}>
      <Text style={styles.h1}>{t('learn.title')}</Text>
      {d.children && d.children.length > 1 && (
        <View style={styles.chips}>
          {d.children.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => setChild(c.id)} style={[styles.chip, d.pupil.id === c.id && styles.chipOn]}>
              <Text style={{ color: d.pupil.id === c.id ? '#fff' : colors.text, fontWeight: '600' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {d.children && <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Avatar name={d.pupil.name} /><Text style={styles.childName}>{d.pupil.name}</Text></Card>}

      <View style={styles.statsRow}>
        {[
          { icon: 'school' as const, label: t('learn.lessons'), value: d.stats.lessonsCompleted, color: '#1A8CFF' },
          { icon: 'people' as const, label: t('learn.classSessions'), value: d.stats.classSessionsAttended, color: '#2ED573' },
          { icon: 'document-text' as const, label: t('learn.homeworkDone'), value: d.stats.homeworkSubmitted, color: '#FF8A00' },
          { icon: 'trophy' as const, label: t('learn.avgScore'), value: d.stats.avgScore === null ? '–' : d.stats.avgScore, color: '#F5B301' },
        ].map((x) => (
          <View key={x.label} style={styles.stat}>
            <Ionicons name={x.icon} size={18} color={x.color} />
            <Text style={styles.statNum}>{x.value}</Text>
            <Text style={styles.statLabel} numberOfLines={2}>{x.label}</Text>
          </View>
        ))}
      </View>

      {(waiting.data ?? []).map((w) => (
        <View key={w.classId} style={styles.wait}>
          <Ionicons name={w.status === 'PENDING' ? 'hourglass' : 'close-circle'} size={22} color={w.status === 'PENDING' ? '#FF9500' : colors.danger} />
          <View style={{ flex: 1 }}><Text style={styles.waitTitle} numberOfLines={1}>{w.title}</Text><Text style={styles.waitSub}>{t(w.status === 'PENDING' ? 'join.waitingText' : 'join.declinedText')}</Text></View>
        </View>
      ))}

      <SectionTitle title={t('learn.myClasses')} action={{ label: t('learn.joinClass'), onPress: () => router.push('/market/classes' as never) }} />
      {d.classes.length === 0 ? (
        <Card><Empty icon="people" title={t('learn.noClasses')} text={t('learn.noClassesHint')} action={{ label: t('class.joinByCode'), onPress: () => router.push('/market/classes' as never) }} /></Card>
      ) : (
        d.classes.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/market/class/${c.id}` as never)} style={{ gap: spacing.sm }}>
            <Text style={styles.cTitle}>{c.title}</Text>
            <Text style={styles.cSub}>{c.subject} · {c.teacher.name}</Text>
            <View style={styles.pills}>
              {c.next ? <Pill tone="primary" icon="time" label={t('learn.nextSession', { time: fmtDayTime(c.next.startAt) })} /> : <Pill tone="neutral" label={t('learn.noNext')} />}
              <Pill tone="success" icon="checkmark-circle" label={t('learn.attendance', { a: c.attendance.attended, n: c.attendance.total })} />
              {c.homework.total > 0 && <Pill tone={c.homework.submitted < c.homework.total ? 'warning' : 'success'} icon="document-text" label={t('stu.hw', { done: c.homework.submitted, total: c.homework.total })} />}
              {c.homework.avgScore !== null && <Pill tone="success" icon="trophy" label={t('stu.avg', { n: c.homework.avgScore })} />}
            </View>
          </Card>
        ))
      )}

      <SectionTitle title={t('learn.upcoming')} />
      {d.upcoming.length === 0 ? <Text style={styles.muted}>{t('home.emptyPupil')}</Text> : (
        <Group>
          {d.upcoming.map((u) => (
            <ListRow key={`${u.kind}${u.id}`} icon={u.kind === 'class' ? 'people' : 'person'} title={u.kind === 'class' ? u.title : u.counterpart || t('home.lesson')} subtitle={fmtDayTime(u.startAt)} onPress={() => router.push((u.kind === 'class' ? `/market/class-room/${u.id}` : '/market/lessons') as never)} />
          ))}
        </Group>
      )}

      <SectionTitle title={t('learn.history')} />
      {d.history.length === 0 ? <Text style={styles.muted}>{t('learn.noHistory')}</Text> : (
        <Group>
          {d.history.map((h) => (
            <ListRow
              key={`${h.kind}${h.id}`}
              icon={h.kind === 'class' ? 'people' : 'videocam'}
              tone={statusTone(h.status)}
              title={h.kind === 'class' ? h.title : h.teacher ?? t('home.lesson')}
              subtitle={`${fmtDate(h.at)}${h.durationMin ? ` · ${h.durationMin} min` : ''}${h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}`}
              right={statusLabel(h.status)}
              onPress={h.kind === 'class' ? () => router.push(`/market/class-recap/${h.id}` as never) : undefined}
            />
          ))}
        </Group>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 14 },
  waitTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  waitSub: { fontSize: 13, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  childName: { fontSize: 17, fontWeight: '700', color: colors.text },
  cTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cSub: { fontSize: 13, color: colors.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muted: { color: colors.textMuted },
});
