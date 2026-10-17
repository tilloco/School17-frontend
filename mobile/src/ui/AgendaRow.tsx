import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { t } from '../i18n';
import { AgendaItem } from '../market/marketApi';
import { colors, spacing } from '../theme/colors';
import { fmtDay, fmtIn, fmtTime } from './format';
import { Action, Card, Pill } from './index';

/** One lesson or class session. `big` is the "next up" widget on the home screen: a solid coloured card with the time in large type, like an Apple widget. */
export function AgendaCard({ item, big }: { item: AgendaItem; big?: boolean }) {
  const router = useRouter();
  const isClass = item.kind === 'class';
  const title = isClass ? item.title : item.counterpart || t('home.lesson');
  const sub = isClass ? [item.counterpart, item.pupil].filter(Boolean).join(' · ') : [item.pupil].filter(Boolean).join(' · ');
  const open = () => router.push((isClass ? `/market/class-room/${item.id}` : '/market/lessons') as never);
  const join = () => router.push((isClass ? `/market/class-room/${item.id}` : `/call/${item.id}`) as never);
  const start = new Date(item.startAt);

  if (big) {
    return (
      <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.92 }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}><Ionicons name={isClass ? 'people' : 'person'} size={14} color="#fff" /><Text style={styles.heroBadgeText}>{isClass ? t('home.class') : t('home.lesson')}</Text></View>
          <Text style={styles.heroIn}>{fmtIn(start)}</Text>
        </View>
        <Text style={styles.heroTime}>{fmtTime(start)}</Text>
        <Text style={styles.heroDay}>{fmtDay(start)}</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.heroSub} numberOfLines={1}>{sub}</Text>}
        {item.canJoin && (
          <Pressable accessibilityRole="button" onPress={join} style={styles.heroBtn}>
            <Ionicons name="videocam" size={20} color={colors.hero} />
            <Text style={styles.heroBtnText}>{t('home.join')}</Text>
          </Pressable>
        )}
      </Pressable>
    );
  }
  return (
    <Card onPress={open}>
      <View style={styles.top}>
        <View style={styles.time}>
          <Text style={styles.timeText}>{fmtTime(start)}</Text>
          <Text style={styles.dayText}>{fmtDay(start)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
          <View style={styles.pills}>
            <Pill label={isClass ? t('home.class') : t('home.lesson')} tone="primary" icon={isClass ? 'people' : 'person'} />
            {item.status === 'REQUESTED' && <Pill label={t('status.REQUESTED')} tone="warning" />}
            {item.status === 'LIVE' && <Pill label={t('class.status.LIVE')} tone="success" icon="radio" />}
            {item.isTrial && <Pill label={t('home.trial')} tone="success" />}
          </View>
        </View>
      </View>
      {item.canJoin && (
        <View style={{ marginTop: spacing.sm }}>
          <Action label={t('home.join')} icon="videocam" kind="accent" onPress={join} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.hero, borderRadius: 26, padding: spacing.lg, gap: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  heroIn: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 13 },
  heroTime: { color: '#fff', fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 58 },
  heroDay: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  heroBtn: { marginTop: spacing.md, backgroundColor: '#fff', borderRadius: 16, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBtnText: { color: colors.hero, fontSize: 17, fontWeight: '800' },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  time: { alignItems: 'center', minWidth: 62 },
  timeText: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  dayText: { fontSize: 12, color: colors.textMuted },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
