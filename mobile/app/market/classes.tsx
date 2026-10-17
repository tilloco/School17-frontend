import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { useRouter } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { fmtDayTime } from '../../src/ui/format';
import { Action, Card, Empty, Header, Page, Pill } from '../../src/ui';

/** Teacher: my classes + create. Pupil / guardian: my classes + join by code. */
export default function ClassesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const me = useAsync(() => market.me(token as string), [token]);
  const list = useAsync(() => market.myClasses(token as string), [token]);
  const children = useAsync(async () => (me.data?.role === 'GUARDIAN' ? market.children(token as string) : []), [token, me.data?.role]);
  const [code, setCode] = useState('');
  const [child, setChild] = useState<string | null>(null);
  const isTeacher = me.data?.role === 'TEACHER';

  const join = async () => {
    try {
      const c = await market.joinClass(token as string, { code: code.trim(), studentId: child ?? undefined });
      setCode('');
      list.reload();
      router.push(`/market/class/${c.id}` as never);
    } catch (e) {
      const msg = e instanceof ApiError ? (e.code === 'CLASS_FULL' ? t('class.full') : e.code === 'CLASS_NOT_FOUND' ? t('class.notFound') : e.code === 'JOIN_LIMIT' ? t('class.joinLimit') : e.code === 'REMOVED' ? t('class.removedFromClass') : e.message) : t('state.error');
      Alert.alert(t('common.error'), msg);
    }
  };

  return (
    <Page onRefresh={() => { me.reload(); list.reload(); }}>
      <Header title={t(isTeacher ? 'class.titleTeacher' : 'class.titlePupil')} />
      {me.state !== 'ready' || !me.data ? <StateView state={me.state === 'ready' ? 'loading' : me.state} onRetry={me.reload} /> : isTeacher ? (
        <Action label={t('class.create')} icon="add" kind="accent" onPress={() => router.push('/market/class-edit' as never)} />
      ) : (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.strong}>{t('class.joinByCode')}</Text>
          {(children.data?.length ?? 0) > 0 && (
            <View style={styles.row}>
              {children.data!.map((c) => (
                <Pressable key={c.id} accessibilityRole="button" onPress={() => setChild(c.id)} style={[styles.chip, child === c.id && styles.chipOn]}>
                  <Text style={{ color: child === c.id ? '#fff' : colors.text }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={12} placeholder={t('class.codePlaceholder')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('class.codePlaceholder')} style={styles.input} />
          <Action label={t('class.join')} onPress={join} disabled={code.trim().length < 8 || (me.data.role === 'GUARDIAN' && !child)} />
        </Card>
      )}
      {list.state !== 'ready' || !list.data ? (
        <StateView state={list.state === 'ready' ? 'loading' : list.state} onRetry={list.reload} />
      ) : list.data.length === 0 ? (
        <Empty icon="people" title={t('class.none')} text={t(isTeacher ? 'class.noneTeacherHint' : 'learn.noClassesHint')} />
      ) : (
        list.data.map((c) => (
          <Card key={c.id + (c.pupil?.id ?? '')} onPress={() => router.push(`/market/class/${c.id}` as never)} style={{ gap: spacing.sm }}>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.sub}>{[c.subject, c.teacher?.name, c.pupil?.name].filter(Boolean).join(' · ')}</Text>
            <View style={styles.row}>
              {isTeacher && <Pill tone="primary" icon="people" label={t('class.members', { n: c.enrolled ?? 0 })} />}
              {c.status === 'CANCELLED' && <Pill tone="danger" label={t('class.cancelledLabel')} />}
              {c.next && <Pill tone="neutral" icon="time" label={fmtDayTime(c.next.startAt)} />}
              {c.next?.isTrial && <Pill tone="success" label={t('class.trial')} />}
            </View>
          </Card>
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: '700', color: colors.text, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 48, color: colors.text, backgroundColor: colors.surface, letterSpacing: 2, fontSize: 16 },
});
