import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

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

  if (me.state !== 'ready' || !me.data) return <Screen><StateView state={me.state === 'ready' ? 'loading' : me.state} onRetry={me.reload} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t(isTeacher ? 'class.titleTeacher' : 'class.titlePupil'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        {isTeacher ? (
          <PrimaryButton title={t('class.create')} onPress={() => router.push('/market/class-edit' as never)} />
        ) : (
          <View style={styles.card}>
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
            <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={12} placeholder={t('class.codePlaceholder')} accessibilityLabel={t('class.codePlaceholder')} style={styles.input} />
            <PrimaryButton title={t('class.join')} onPress={join} disabled={code.trim().length < 8 || (me.data.role === 'GUARDIAN' && !child)} />
          </View>
        )}
        {list.state !== 'ready' || !list.data ? (
          <StateView state={list.state === 'ready' ? 'loading' : list.state} onRetry={list.reload} />
        ) : list.data.length === 0 ? (
          <Text style={styles.help}>{t('class.none')}</Text>
        ) : (
          list.data.map((c) => (
            <Pressable key={c.id + (c.pupil?.id ?? '')} accessibilityRole="button" onPress={() => router.push(`/market/class/${c.id}` as never)} style={styles.card}>
              <Text style={styles.strong}>{c.title}</Text>
              <Text>{c.subject}{c.teacher ? ` · ${c.teacher.name}` : ''}{c.pupil ? ` · ${c.pupil.name}` : ''}</Text>
              {isTeacher && <Text style={styles.help}>{t('class.enrolled', { n: c.enrolled ?? 0, max: c.capacity })}</Text>}
              {c.status === 'CANCELLED' && <Text style={styles.help}>{t('class.cancelledLabel')}</Text>}
              {c.next && <Text style={styles.help}>{t('class.next', { time: new Date(c.next.startAt).toLocaleString() })}{c.next.isTrial ? ` · ${t('class.trial')}` : ''}</Text>}
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
