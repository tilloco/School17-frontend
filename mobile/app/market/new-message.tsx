import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { contactHashes } from '../../src/lib/contacts-match';
import { Action, Avatar, Empty, Group, Page, SectionTitle } from '../../src/ui';

/** Start a chat without a booking: people from your classes (right away) or anyone found by @username (they must accept first). */
export default function NewMessageScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);
  const contacts = useAsync(() => market.contacts(token as string).catch(() => []), [token]);
  const found = useAsync(() => (q.replace(/^@/, '').length >= 3 ? market.people(token as string, q).catch(() => []) : Promise.resolve([])), [token, q]);

  const [mine, setMine] = useState<Awaited<ReturnType<typeof market.peopleFromContacts>> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncContacts = async () => {
    setSyncing(true);
    try {
      const { denied, hashes } = await contactHashes();
      if (denied) { Alert.alert(t('contacts.title'), t('contacts.denied')); return; }
      setMine(hashes.length ? await market.peopleFromContacts(token as string, hashes) : []);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setSyncing(false);
    }
  };

  const open = async (userId: string) => {
    try {
      const th = await market.directOpen(token as string, userId);
      router.replace(`/market/thread/${th.id}` as never);
    } catch (e) {
      const msg = e instanceof ApiError ? (e.code === 'MINOR_RESTRICTED' ? t('dm.minor') : e.statusCode === 404 ? t('dm.notFound') : e.message) : t('state.error');
      Alert.alert(t('common.error'), msg);
    }
  };

  const typing = q.replace(/^@/, '').length >= 3;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('dm.new'), headerBackTitle: t('common.back') }} />
      <Page edges={[]}>
        <View style={styles.box}>
          <Ionicons name="at" size={20} color={colors.textMuted} />
          <TextInput value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} placeholder={t('dm.searchHint')} placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel={t('dm.searchHint')} maxLength={21} />
        </View>
        {typing ? (
          <>
            <SectionTitle title={t('dm.results')} />
            {found.data && found.data.length === 0 ? <Empty icon="search" title={t('dm.nobody')} text={t('dm.nobodyText')} /> : (
              <Group>
                {(found.data ?? []).map((p) => (
                  <Pressable key={p.userId} onPress={() => open(p.userId)} style={styles.row}>
                    <Avatar name={p.name} userId={p.hasPhoto ? p.userId : null} />
                    <View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.sub}>@{p.username} · {t(`role.${p.role}`)}</Text></View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </Group>
            )}
            <Text style={styles.note}>{t('dm.requestNote')}</Text>
          </>
        ) : (
          <>
            {mine === null ? (
              <View style={styles.findCard}>
                <View style={styles.findIcon}><Ionicons name="people-circle" size={26} color="#fff" /></View>
                <Text style={styles.findTitle}>{t('contacts.title')}</Text>
                <Text style={styles.findText}>{t('contacts.text')}</Text>
                <Action label={t('contacts.find')} icon="search" onPress={syncContacts} disabled={syncing} />
              </View>
            ) : (
              <>
                <SectionTitle title={t('contacts.found')} />
                {mine.length === 0 ? <Empty icon="people" title={t('contacts.none')} text="" /> : (
                  <Group>
                    {mine.map((p) => (
                      <Pressable key={p.userId} onPress={() => open(p.userId)} style={styles.row}>
                        <Avatar name={p.name} userId={p.hasPhoto ? p.userId : null} />
                        <View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.sub}>{p.username ? `@${p.username} · ` : ''}{t(`role.${p.role}`)}</Text></View>
                        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                      </Pressable>
                    ))}
                  </Group>
                )}
              </>
            )}
            <SectionTitle title={t('dm.yourClasses')} />
            {(contacts.data ?? []).length === 0 ? <Empty icon="people" title={t('dm.noContacts')} text={t('dm.noContactsText')} /> : (
              <Group>
                {(contacts.data ?? []).map((p) => (
                  <Pressable key={p.userId} onPress={() => open(p.userId)} style={styles.row}>
                    <Avatar name={p.name} userId={p.hasPhoto ? p.userId : null} />
                    <View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.sub} numberOfLines={1}>{t(`role.${p.role}`)} · {p.classes.join(', ')}</Text></View>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                  </Pressable>
                ))}
              </Group>
            )}
          </>
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.md },
  input: { flex: 1, minHeight: 50, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  findCard: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  findIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  findTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  findText: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.md },
});
