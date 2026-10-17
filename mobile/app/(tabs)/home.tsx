import React, { useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { API_URL } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { takePendingJoin } from '../../src/lib/pending-join';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { AgendaCard } from '../../src/ui/AgendaRow';
import { PressScale } from '../../src/ui/PressScale';
import { fmtDayTime } from '../../src/ui/format';
import { Avatar, Card, Empty, Group, IconName, ListRow, Page, Pill, SectionTitle, Stars } from '../../src/ui';

const TILE = ['#1A8CFF', '#2ED573', '#FF8A00', '#A55EEA'];
function Quick({ icon, label, onPress, n = 0 }: { icon: IconName; label: string; onPress: () => void; n?: number }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} style={styles.quick}>
      <View style={[styles.quickIcon, { backgroundColor: TILE[n % 4] }]}><Ionicons name={icon} size={26} color="#fff" /></View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </PressScale>
  );
}

/** Home: what is next, shortcuts, my classes and who needs attention (teacher) or who to learn from (pupil). */
export default function HomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const teacher = user?.role === 'TEACHER';
  const go = (path: string) => router.push(path as never);
  const home = useAsync(() => market.home(token as string), [token]);
  const classes = useAsync(() => market.myClasses(token as string).catch(() => []), [token]);
  const students = useAsync(() => (teacher ? market.students(token as string).catch(() => []) : Promise.resolve([])), [token, teacher]);
  const profile = useAsync(() => (teacher ? market.ownProfile(token as string).catch(() => null) : Promise.resolve(null)), [token, teacher]);
  const rating = useAsync(() => (profile.data ? market.reviews(token as string, profile.data.id).catch(() => null) : Promise.resolve(null)), [token, profile.data?.id]);
  const unread = useAsync(() => market.unread(token as string).catch(() => null), [token]);
  const top = useAsync(() => (teacher ? Promise.resolve(null) : market.search(token as string, { sort: 'rating' }).catch(() => null)), [token, teacher]);
  useEffect(() => { takePendingJoin().then((inv) => { if (inv) router.push(`/join/${inv}` as never); }); }, [router]);
  const reload = () => { unread.reload(); home.reload(); classes.reload(); students.reload(); profile.reload(); top.reload(); };

  if (home.state !== 'ready' || !home.data) return <Page padded><StateView state={home.state === 'ready' ? 'loading' : home.state} onRetry={home.reload} /></Page>;
  const d = home.data;
  const next = d.agenda[0];
  const rest = d.agenda.slice(1, 4);
  const attention = (students.data ?? []).filter((s) => s.attention).slice(0, 3);
  const myClasses = (classes.data ?? []).filter((c) => c.status === 'ACTIVE');
  const shareProfile = () => profile.data && Share.share({ message: t('share.profile', { name: user?.name ?? '', link: `${API_URL.replace(/\/+$/, '')}/p/${profile.data.id}` }) });

  return (
    <Page padded={false} onRefresh={reload}>
      <View style={styles.body}>
        {!teacher && (
          <Pressable accessibilityRole="search" onPress={() => go('/(tabs)/find')} style={styles.search}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <Text style={styles.searchText}>{t('home.searchHint')}</Text>
          </Pressable>
        )}

        <View style={styles.quickRow}>
          {teacher ? (
            <>
              <Quick icon="add-circle" label={t('class.create')} onPress={() => go('/market/class-edit')} n={0} />
              <Quick icon="calendar" label={t('sched.add')} onPress={() => (myClasses.length === 1 ? go(`/market/class-schedule/${myClasses[0].id}`) : go('/(tabs)/classes'))} n={1} />
              <Quick icon="paper-plane" label={t('share.telegram')} onPress={shareProfile} n={2} />
              <Quick icon="time" label={t('setup.availability')} onPress={() => go('/market/availability')} n={3} />
            </>
          ) : (
            <>
              <Quick icon="search" label={t('market.find')} onPress={() => go('/(tabs)/find')} n={0} />
              <Quick icon="key" label={t('class.joinByCode')} onPress={() => go('/market/classes')} n={1} />
              <Quick icon="book" label={t('tab.learning')} onPress={() => go('/(tabs)/learning')} n={2} />
              <Quick icon="star" label={t('rev.title')} onPress={() => go('/market/reviews')} n={3} />
            </>
          )}
        </View>

        <SectionTitle title={t('home.next')} />
        {next ? <AgendaCard item={next} big /> : (
          <Card>
            <Empty icon="calendar" title={t(teacher ? 'home.emptyTeacher' : 'home.emptyPupil')} text={t(teacher ? 'home.emptyTeacherHint' : 'home.emptyPupilHint')} action={teacher ? { label: t('class.create'), onPress: () => go('/market/class-edit') } : { label: t('market.find'), onPress: () => go('/(tabs)/find') }} />
          </Card>
        )}
        {rest.map((i) => <AgendaCard key={`${i.kind}${i.id}`} item={i} />)}

        {myClasses.length > 0 && (
          <>
            <SectionTitle title={t(teacher ? 'class.titleTeacher' : 'learn.myClasses')} action={{ label: t('home.all'), onPress: () => go(teacher ? '/(tabs)/classes' : '/(tabs)/learning') }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }} style={{ marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}>
              {myClasses.map((c) => (
                <Pressable key={c.id + (c.pupil?.id ?? '')} accessibilityRole="button" onPress={() => go(`/market/class/${c.id}`)} style={styles.classTile}>
                  <View style={styles.classIcon}><Ionicons name="chatbubbles" size={22} color="#fff" />{!!unread.data?.byClass[c.id] && <View style={styles.tileBadge}><Text style={styles.tileBadgeText}>{unread.data.byClass[c.id] > 99 ? '99+' : unread.data.byClass[c.id]}</Text></View>}</View>
                  <Text style={styles.classTitle} numberOfLines={2}>{c.title}</Text>
                  <Text style={styles.classSub} numberOfLines={1}>{c.next ? fmtDayTime(c.next.startAt) : t('class.members', { n: c.enrolled ?? 0 })}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {teacher && (
          <>
            <SectionTitle title={t('home.attention')} action={{ label: t('home.all'), onPress: () => go('/(tabs)/students') }} />
            {attention.length === 0 ? (
              <Card><Text style={styles.muted}>{(students.data ?? []).length ? t('home.allGood') : t('stu.emptyText')}</Text></Card>
            ) : (
              <Group>
                {attention.map((s) => (
                  <Pressable key={s.pupilId} onPress={() => go(`/market/student/${s.pupilId}`)} style={styles.person}>
                    <Avatar name={s.name} tone="warning" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>{s.name}</Text>
                      <View style={styles.pills}>
                        {s.payment.owedCount > 0 && <Pill label={t('stu.owedCount', { n: s.payment.owedCount })} tone="danger" />}
                        {s.homework.toMark > 0 && <Pill label={t('stu.toMark', { n: s.homework.toMark })} tone="warning" />}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </Group>
            )}

            <SectionTitle title={t('home.yourRating')} action={profile.data ? { label: t('home.reviews'), onPress: () => go(`/market/teacher/${profile.data!.id}`) } : undefined} />
            <Card style={styles.ratingCard}>
              {rating.data && rating.data.summary.count > 0 ? (
                <>
                  <Text style={styles.ratingBig}>{(rating.data.summary.average ?? 0).toFixed(1)}</Text>
                  <Stars value={rating.data.summary.average ?? 0} size={22} />
                  <Text style={styles.muted}>{t('home.ratingCount', { n: rating.data.summary.count })}</Text>
                </>
              ) : (
                <Text style={styles.muted}>{profile.data ? t('home.noRatingYet') : t('home.finishProfile')}</Text>
              )}
              {!profile.data && <Pressable onPress={() => go('/market/profile-edit')} accessibilityRole="button"><Text style={styles.link}>{t('setup.profile')}</Text></Pressable>}
            </Card>
          </>
        )}

        {!teacher && (d.homework?.length ?? 0) > 0 && (
          <>
            <SectionTitle title={t('home.homeworkDue')} action={{ label: t('home.all'), onPress: () => go('/(tabs)/learning') }} />
            <Group>
              {d.homework!.map((h) => (
                <ListRow key={h.id} icon="document-text" tone={h.overdue ? 'danger' : 'warning'} title={h.title} subtitle={`${h.classTitle} · ${t('hw.due', { time: fmtDayTime(h.dueAt) })}`} onPress={() => go(`/market/class-homework/${h.classId}`)} right={h.overdue ? t('hw.overdue') : undefined} />
              ))}
            </Group>
          </>
        )}

        {!teacher && top.data && top.data.items.length > 0 && (
          <>
            <SectionTitle title={t('home.topTeachers')} action={{ label: t('home.all'), onPress: () => go('/(tabs)/find') }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }} style={{ marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}>
              {top.data.items.slice(0, 8).map((p) => (
                <Pressable key={p.id} accessibilityRole="button" onPress={() => go(`/market/teacher/${p.id}`)} style={styles.teacherTile}>
                  <Avatar name={p.name} size={64} photoOf={p.hasPhoto ? p.id : null} />
                  <Text style={styles.tileName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.classSub} numberOfLines={1}>{p.subjects.slice(0, 2).map((s) => t(`subj.${s}`)).join(', ')}</Text>
                  <View style={styles.starsRow}><Ionicons name="star" size={13} color="#F5B301" /><Text style={styles.rate}>{p.rating.average ? p.rating.average.toFixed(1) : '–'}</Text></View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: spacing.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 18, minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchText: { color: colors.textMuted, fontSize: 15 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quick: { width: '24%', alignItems: 'center', gap: 6 },
  quickIcon: { width: 62, height: 62, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  classTile: { width: 156, borderRadius: 22, padding: 16, backgroundColor: colors.surface, gap: 6 },
  classIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileBadge: { position: 'absolute', top: -6, right: -10, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  tileBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  classTitle: { fontSize: 15, fontWeight: '700', color: colors.text, minHeight: 38 },
  classSub: { fontSize: 12, color: colors.textMuted },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  ratingCard: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  ratingBig: { fontSize: 44, fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted, textAlign: 'center' },
  link: { color: colors.primaryLight, fontWeight: '700' },
  teacherTile: { width: 136, borderRadius: 22, padding: 14, alignItems: 'center', backgroundColor: colors.surface, gap: 4 },
  tileName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rate: { fontSize: 13, fontWeight: '700', color: colors.text },
});
