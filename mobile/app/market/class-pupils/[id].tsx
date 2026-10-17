import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { Avatar, Empty, Group, Page } from '../../../src/ui';
import { Person, PersonSheet } from '../../../src/ui/PersonSheet';
import { ApiError as ApiErr } from '../../../src/lib/api';

/** Who is in the class. The teacher can open a pupil's progress; removing a pupil is a small action at the very bottom of each pupil's row menu (long press). */
export default function ClassPupilsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const cls = useAsync(() => market.classDetail(token as string, id), [token, id]);
  const c = cls.data;
  const teacher = c?.role === 'teacher';
  const members = useAsync(() => market.channelMembers(token as string, id), [token, id]);
  const [who, setWho] = useState<Person | null>(null);
  const openDirect = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      router.push(`/market/thread/${th.id}` as never);
    } catch (e) { Alert.alert(t('common.error'), e instanceof ApiErr ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.message) : t('state.error')); }
  };
  const remove = (pid: string, name: string | null) => Alert.alert(t('class.removePupil'), name ?? undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.ok'), style: 'destructive', onPress: () => market.removeClassPupil(token as string, id, pid).then(cls.reload).catch((e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'))) },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t(teacher ? 'class.pupils' : 'class.classmates'), headerBackTitle: t('common.back') }} />
      <Page edges={[]} onRefresh={cls.reload}>
        {cls.state !== 'ready' || !c ? <StateView state={cls.state === 'ready' ? 'loading' : cls.state} onRetry={cls.reload} /> : teacher ? (
          c.pupils?.length ? (
            <>
              <Group>
                {c.pupils.map((p) => (
                  <Pressable key={p.id} onPress={() => router.push(`/market/student/${p.id}` as never)} onLongPress={() => remove(p.id, p.name)}>
                    <View style={styles.row}><Avatar name={p.name} /><Text style={styles.name}>{p.name}</Text></View>
                  </Pressable>
                ))}
              </Group>
              <Text style={styles.hint}>{t('pupils.hint')}</Text>
            </>
          ) : <Empty icon="people" title={t('class.noPupils')} />
        ) : (members.data?.items.length ?? 0) > 0 ? (
          <Group>
            {members.data!.items.map((m, i) => (
              <Pressable key={m.id ?? `h${i}`} disabled={!m.id || m.me} onPress={() => m.id && setWho({ userId: m.id, name: m.name, username: m.username, hasPhoto: m.hasPhoto, teacher: m.teacher })}>
                <View style={styles.row}>
                  <Avatar name={m.name} userId={m.hasPhoto ? m.id : null} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}{m.me ? ` (${t('rank.you')})` : ''}</Text>
                    {(m.teacher || !!m.username) && <Text style={styles.sub}>{m.teacher ? t('role.TEACHER') : ''}{m.teacher && m.username ? ' · ' : ''}{m.username ? `@${m.username}` : ''}</Text>}
                  </View>
                  {!!m.id && !m.me && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                </View>
              </Pressable>
            ))}
          </Group>
        ) : <Empty icon="people" title={t('class.noPupils')} />}
      </Page>
      <PersonSheet person={who} onClose={() => setWho(null)} onMessage={openDirect} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
