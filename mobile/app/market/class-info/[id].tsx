import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { useClassProtect } from '../../../src/lib/protect';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { Avatar } from '../../../src/ui';
import { fmtDayTime, fmtMoney } from '../../../src/ui/format';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Channel info (tap the channel name in the chat): logo, name, the head teacher, lessons, files and, for the teacher, the
 * "protect paid content" switch with a clear picture of what it does.
 */
export default function ClassInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  useClassProtect(id);
  const info = useAsync(() => market.channelInfo(token as string, id), [token, id]);
  const [protect, setProtect] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  const d = info.data;
  const teacher = d?.role === 'teacher';

  useEffect(() => { if (d) setProtect(d.protectContent); }, [d]);
  useEffect(() => { Animated.spring(glow, { toValue: protect ? 1 : 0, useNativeDriver: false, friction: 7 }).start(); }, [protect, glow]);

  const toggle = async (v: boolean) => {
    setProtect(v);
    try { await market.updateClass(token as string, id, { protectContent: v }); } catch (e) { setProtect(!v); Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error')); }
  };
  const writeTeacher = async () => {
    if (!d) return;
    try {
      const th = await market.directOpen(token as string, d.teacher.id);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) { Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error')); }
  };

  if (info.state !== 'ready' || !d) return <View style={styles.root}><Stack.Screen options={{ headerShown: true, title: t('info.title'), headerBackTitle: t('common.back') }} /><StateView state={info.state === 'error' ? 'error' : 'loading'} onRetry={info.reload} /></View>;

  const days = d.weekdays.length ? d.weekdays.map((w) => t(`dow.${w % 7}`)).join(', ') : '';
  const time = `${String(Math.floor(d.startMinute / 60)).padStart(2, '0')}:${String(d.startMinute % 60).padStart(2, '0')}`;
  const quick: { icon: Icon; label: string; count?: number; onPress: () => void }[] = [
    { icon: 'document-text', label: t('info.files'), count: d.filesCount, onPress: () => router.push(`/market/class-files/${id}` as never) },
    { icon: 'pin', label: t('info.pinned'), count: d.pinsCount, onPress: () => router.back() },
    { icon: 'trophy', label: t('rank.title'), onPress: () => router.push(`/market/class-ranking/${id}` as never) },
    { icon: 'people', label: t('info.members'), count: d.members, onPress: () => router.push(`/market/class-pupils/${id}` as never) },
  ];
  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.success] });
  const chips: { icon: Icon; label: string }[] = [
    { icon: 'camera-reverse', label: t('info.noShots') },
    { icon: 'cloud-download', label: t('info.noDownloads') },
    { icon: 'arrow-redo', label: t('info.noForward') },
  ];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: t('info.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.ringOuter}>
            <View style={styles.ring}>
              <Avatar name={d.teacher.name ?? d.title} size={104} userId={d.teacher.hasPhoto ? d.teacher.id : null} tone="primary" />
            </View>
          </View>
          <Text style={styles.title}>{d.title}</Text>
          <View style={styles.pills}>
            <View style={styles.pill}><Text style={styles.pillText}>{d.subject}</Text></View>
            <View style={styles.pill}><Ionicons name="people" size={13} color="#fff" /><Text style={styles.pillText}>{t('class.members', { n: d.members })}</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>{d.priceMinor ? fmtMoney(d.priceMinor) : t('info.free')}</Text></View>
          </View>
        </View>

        <View style={styles.quickRow}>
          {quick.map((q) => (
            <Pressable key={q.label} accessibilityRole="button" onPress={q.onPress} style={styles.quick}>
              <View style={styles.quickIcon}><Ionicons name={q.icon} size={22} color={colors.primary} /></View>
              <Text style={styles.quickLabel} numberOfLines={1}>{q.label}</Text>
              {q.count !== undefined && <Text style={styles.quickCount}>{q.count}</Text>}
            </Pressable>
          ))}
        </View>

        {!!d.description.trim() && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('info.about')}</Text>
            <Text style={styles.body}>{d.description}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('info.teacher')}</Text>
          <View style={styles.teacherRow}>
            <Avatar name={d.teacher.name} size={58} userId={d.teacher.hasPhoto ? d.teacher.id : null} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.teacherName}>{d.teacher.name}</Text>
              {!!d.teacher.username && <Text style={styles.username}>@{d.teacher.username}</Text>}
            </View>
          </View>
          {!!d.teacher.bio && <Text style={styles.body}>{d.teacher.bio}</Text>}
          {d.teacher.subjects.length > 0 && (
            <View style={styles.subjects}>{d.teacher.subjects.map((s) => <View key={s} style={styles.subject}><Text style={styles.subjectText}>{s}</Text></View>)}</View>
          )}
          {!teacher && (
            <Pressable accessibilityRole="button" onPress={writeTeacher} style={styles.writeBtn}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              <Text style={styles.writeText}>{t('info.writeTeacher')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('info.upcoming')}</Text>
          {d.upcoming.length === 0 ? <Text style={styles.muted}>{t('info.noLessons')}</Text> : d.upcoming.map((s, i) => (
            <View key={s.id} style={[styles.lesson, i > 0 && styles.lessonSep]}>
              <View style={styles.lessonDot}><Ionicons name={s.status === 'LIVE' ? 'radio' : 'videocam'} size={15} color="#fff" /></View>
              <Text style={styles.lessonText}>{fmtDayTime(s.startAt)}</Text>
            </View>
          ))}
          {!!days && <Text style={[styles.muted, { marginTop: 8 }]}>{t('info.schedule')}: {t('info.every', { days, time })}</Text>}
        </View>

        <Animated.View style={[styles.protect, { borderColor }]}>
          <View style={styles.protectHead}>
            <View style={[styles.shield, protect && { backgroundColor: colors.success }]}>
              <Ionicons name={protect ? 'shield-checkmark' : 'shield-outline'} size={26} color={protect ? '#fff' : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.protectTitle}>{t('protect.title')}</Text>
              <Text style={[styles.protectState, protect && { color: colors.success }]}>{protect ? t('info.protected') : t('info.open')}</Text>
            </View>
            {teacher && <Switch value={protect} onValueChange={toggle} trackColor={{ true: colors.success }} />}
          </View>
          <View style={styles.chipRow}>
            {chips.map((c) => (
              <View key={c.label} style={[styles.chip, protect && styles.chipOn]}>
                <Ionicons name={c.icon} size={15} color={protect ? colors.success : colors.textMuted} />
                <Text style={[styles.chipText, protect && { color: colors.text }]}>{c.label}</Text>
                <Ionicons name={protect ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={protect ? colors.success : colors.border} />
              </View>
            ))}
          </View>
          {teacher && <Text style={styles.muted}>{t('protect.text')}</Text>}
          {teacher && <Text style={[styles.muted, { fontSize: 12 }]}>{t('protect.limit')}</Text>}
        </Animated.View>

        {teacher && (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/market/class-edit?id=${id}` as never)} style={styles.editBtn}>
            <Ionicons name="settings" size={18} color={colors.primary} />
            <Text style={styles.editText}>{t('class.edit')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.hero, alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, gap: 10, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  ringOuter: { padding: 5, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.22)' },
  ring: { padding: 4, borderRadius: 66, backgroundColor: '#fff' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md, marginTop: -26 },
  quick: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  quickIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  quickCount: { fontSize: 12, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: 22, marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teacherName: { fontSize: 18, fontWeight: '800', color: colors.text },
  username: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subject: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  subjectText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  writeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 13 },
  writeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  lessonSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  lessonText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  protect: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 2, marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, gap: 12 },
  protectHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shield: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  protectTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  protectState: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  chipRow: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.neutralSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  chipOn: { backgroundColor: colors.successSoft },
  chipText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, paddingVertical: 14, borderRadius: 18, backgroundColor: colors.primarySoft },
  editText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
