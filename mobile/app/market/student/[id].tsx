import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { fmtDate, fmtDayTime } from '../../../src/ui/format';
import { Action, Avatar, Card, Empty, Group, ListRow, Page, Pill, SectionTitle } from '../../../src/ui';

/** Teacher view of one pupil: lessons, classes with attendance, homework and payment marks. Only data between this teacher and this pupil. */
export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const res = useAsync(() => market.studentDetail(token as string, id), [token, id]);

  const message = async (bookingId: string | null) => {
    if (!bookingId) return Alert.alert(t('stu.noChat'));
    try {
      const th = await market.openThread(token as string, bookingId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };

  if (res.state !== 'ready' || !res.data) return <Page><Stack.Screen options={{ headerShown: true, title: t('stu.detail'), headerBackTitle: t('common.back') }} /><StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} /></Page>;
  const d = res.data;
  const statusTone = (s: string) => (s === 'COMPLETED' ? 'success' : s === 'CANCELLED' || s === 'NO_SHOW_STUDENT' ? 'danger' : 'primary') as 'success' | 'danger' | 'primary';
  return (
    <Page edges={[]} onRefresh={res.reload}>
      <Stack.Screen options={{ headerShown: true, title: d.pupil.name, headerBackTitle: t('common.back') }} />
      <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Avatar name={d.pupil.name} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{d.pupil.name}</Text>
          <View style={styles.pills}>
            {d.payments.lessonsOwed + d.payments.classOwed > 0 ? <Pill tone="danger" icon="cash" label={t('stu.owedCount', { n: d.payments.lessonsOwed + d.payments.classOwed })} /> : <Pill tone="success" icon="checkmark-circle" label={t('stu.paidUp')} />}
            <Pill tone="neutral" label={t('stu.confirmed', { n: d.payments.confirmed })} />
          </View>
        </View>
      </Card>
      <Action label={t('stu.message')} icon="chatbubble" kind="accent" onPress={() => message(d.chatBookingId)} />

      <SectionTitle title={t('stu.classesTitle')} />
      {d.classes.length === 0 ? <Text style={styles.muted}>{t('stu.noClasses')}</Text> : (
        <Group>
          {d.classes.map((c) => (
            <ListRow key={c.id} icon="people" title={c.title} subtitle={`${c.since ? `${t('stu.since', { date: fmtDate(c.since) })} · ` : ''}${t('stu.attended', { a: c.attendance.attended, n: c.attendance.total })}${c.attendance.late ? ` · ${t('stu.late', { n: c.attendance.late })}` : ''}${c.enrolled ? '' : ` · ${t('stu.left')}`}`} onPress={() => router.push(`/market/class/${c.id}` as never)} />
          ))}
        </Group>
      )}

      <SectionTitle title={t('stu.homeworkTitle')} />
      {d.homework.length === 0 ? <Text style={styles.muted}>{t('stu.noHomework')}</Text> : (
        <Group>
          {d.homework.map((h) => (
            <ListRow key={h.id} icon="document-text" tone={h.submitted ? (h.late ? 'warning' : 'success') : 'danger'} title={h.title} subtitle={h.submitted ? (h.marked ? t('hw.score', { score: h.score ?? 0 }) : t('stu.waitingMark')) : t('stu.notSubmitted')} right={fmtDate(h.dueAt)} onPress={() => router.push(`/market/class-homework/${h.classId}` as never)} />
          ))}
        </Group>
      )}

      <SectionTitle title={t('stu.lessonsTitle')} />
      {d.lessons.length === 0 ? <Empty icon="calendar" title={t('stu.noLessons')} /> : (
        <Group>
          {d.lessons.slice(0, 20).map((l) => (
            <ListRow key={l.id} icon="videocam" tone={statusTone(l.status)} title={fmtDayTime(l.startAt)} subtitle={`${l.durationMin} min${l.isTrial ? ` · ${t('home.trial')}` : ''}`} right={t(`status.${l.status}`)} />
          ))}
        </Group>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  muted: { color: colors.textMuted },
});
