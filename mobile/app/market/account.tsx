import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Stack, useRouter } from 'expo-router';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { colors, spacing } from '../../src/theme/colors';
import { Group, ListRow, Page } from '../../src/ui';

/** Sign out and delete the account live here, one screen away from the everyday ones, so nobody taps them by accident. Deleting needs two confirmations. */
export default function AccountScreen() {
  const { token, signOut, user } = useAuth();
  const router = useRouter();
  const logout = () => Alert.alert(t('profile.logout'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('profile.logout'), onPress: async () => { await signOut(); router.replace('/'); } },
  ]);
  const remove = () => Alert.alert(t('more.deleteTitle'), t('more.deleteText'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('more.deleteConfirm'), style: 'destructive', onPress: () => Alert.alert(t('acct.sure'), t('acct.sureText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('acct.deleteForever'), style: 'destructive', onPress: async () => { try { await market.deleteAccount(token as string); await signOut(); router.replace('/'); } catch (e) { Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error')); } } },
    ]) },
  ]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: t('acct.title'), headerBackTitle: t('common.back') }} />
      <Page edges={[]}>
        <Text style={styles.who}>{user?.name ?? ''}</Text>
        <Text style={styles.mail}>{user?.email?.endsWith('@phone.school17.invalid') ? '' : user?.email}</Text>
        <Group>
          <ListRow icon="log-out" title={t('profile.logout')} onPress={logout} tone="neutral" />
        </Group>
        <Text style={styles.zone}>{t('acct.danger')}</Text>
        <Group>
          <ListRow icon="trash" title={t('more.deleteTitle')} onPress={remove} danger />
        </Group>
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  who: { fontSize: 22, fontWeight: '800', color: colors.text },
  mail: { color: colors.textMuted, marginBottom: spacing.sm },
  zone: { marginTop: spacing.xl, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
