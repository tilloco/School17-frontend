import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

/** Class page: info + upcoming sessions. Teacher: code, edit, cancel, remove pupils. Pupil / guardian: classmates (first names), leave. */
export default function ClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const cls = useAsync(() => market.classDetail(token as string, id), [token, id]);
  const sessions = useAsync(() => market.classSessions(token as string, id), [token, id]);
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    try {
      await fn();
      cls.reload();
      sessions.reload();
      after?.();
    } catch (e) {
      fail(e);
    }
  };
  const confirm = (title: string, fn: () => void) => Alert.alert(title, undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), style: 'destructive', onPress: fn }]);

  if (cls.state !== 'ready' || !cls.data) return <Screen><Stack.Screen options={{ headerShown: true, title: t('class.titlePupil'), headerBackTitle: t('common.back') }} /><StateView state={cls.state === 'ready' ? 'loading' : cls.state} onRetry={cls.reload} /></Screen>;
  const c = cls.data;
  const teacher = c.role === 'teacher';
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: c.title, headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <View style={styles.card}>
          <Text style={styles.strong}>{c.subject}</Text>
          {!!c.description && <Text>{c.description}</Text>}
          <Text style={styles.help}>{t('class.enrolled', { n: c.enrolled, max: c.capacity })}</Text>
          {c.priceMinor > 0 && <Text style={styles.help}>{t('class.priceInfo', { sum: Math.round(c.priceMinor / 100).toLocaleString() })}</Text>}
          {c.status === 'CANCELLED' && <Text style={styles.strong}>{t('class.cancelledLabel')}</Text>}
        </View>

        <PrimaryButton title={t('cfile.title')} variant="outline" onPress={() => router.push(`/market/class-files/${id}` as never)} />
        <PrimaryButton title={t('hw.title')} variant="outline" onPress={() => router.push(`/market/class-homework/${id}` as never)} />
        <PrimaryButton title={t('feed.title')} variant="outline" onPress={() => router.push(`/market/class-feed/${id}` as never)} />
        <Text style={styles.h2}>{t('class.sessions')}</Text>
        {sessions.state !== 'ready' || !sessions.data ? (
          <StateView state={sessions.state === 'ready' ? 'loading' : sessions.state} onRetry={sessions.reload} />
        ) : sessions.data.length === 0 ? (
          <Text style={styles.help}>{t('class.noSessions')}</Text>
        ) : (
          sessions.data.map((s) => (
            <View key={s.id} style={styles.card}>
              <Text style={styles.strong}>{new Date(s.startAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.help}>{t(`class.status.${s.status}`)}{s.isTrial ? ` · ${t('class.trial')}` : ''}</Text>
              {['SCHEDULED', 'LOBBY', 'LIVE'].includes(s.status) && <PrimaryButton title={t('room.open')} variant="outline" onPress={() => router.push(`/market/class-room/${s.id}` as never)} />}
              {teacher && s.status === 'SCHEDULED' && <PrimaryButton title={t('class.cancelSession')} variant="outline" onPress={() => confirm(t('class.cancelSession'), () => run(() => market.cancelClassSession(token as string, id, s.id)))} />}
            </View>
          ))
        )}

        {teacher ? (
          <>
            <Text style={styles.h2}>{t('class.pupils')}</Text>
            {c.pupils?.length === 0 && <Text style={styles.help}>{t('class.noPupils')}</Text>}
            {c.pupils?.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.strong}>{p.name}</Text>
                <PrimaryButton title={t('class.removePupil')} variant="outline" onPress={() => confirm(t('class.removePupil'), () => run(() => market.removeClassPupil(token as string, id, p.id)))} />
              </View>
            ))}
            {c.status === 'ACTIVE' && (
              <View style={{ gap: spacing.sm }}>
                <PrimaryButton title={t('cmoney.title')} variant="outline" onPress={() => router.push(`/market/class-money/${id}` as never)} />
                <PrimaryButton title={t('class.newCode')} variant="outline" onPress={() => run(async () => { const r = await market.regenerateClassCode(token as string, id); Alert.alert(t('class.codeTitle'), t('class.codeShown', { code: r.joinCode })); })} />
                <PrimaryButton title={t('class.edit')} variant="outline" onPress={() => router.push(`/market/class-edit?id=${id}` as never)} />
                <PrimaryButton title={t('class.cancelClass')} variant="outline" onPress={() => confirm(t('class.cancelClass'), () => run(() => market.cancelClass(token as string, id)))} />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.h2}>{t('class.classmates')}</Text>
            {c.classmates?.length === 0 && <Text style={styles.help}>{t('class.noPupils')}</Text>}
            <Text>{c.classmates?.map((m) => m.name).join(', ')}</Text>
            {c.mySeats?.map((pid) => (
              <PrimaryButton key={pid} title={t('class.leave')} variant="outline" onPress={() => confirm(t('class.leave'), () => run(() => market.leaveClass(token as string, id, pid), () => router.back()))} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
});
