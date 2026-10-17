import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Stack, useRouter } from 'expo-router';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

/** Choose the @username that others use to find you. Letters, digits and _, 3 to 20 characters. */
export default function UsernameScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const me = useAsync(() => market.me(token as string), [token]);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const v = value ?? me.data?.username ?? '';
  const save = async () => {
    setBusy(true);
    try {
      await market.updateMe(token as string, { username: v });
      router.back();
    } catch (e) {
      const m: Record<string, string> = { USERNAME_TAKEN: 'auth.usernameTaken', BAD_USERNAME: 'auth.usernameBad', RESERVED_USERNAME: 'auth.usernameTaken' };
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code && m[e.code] ? t(m[e.code]) : e.message) : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: t('auth.username'), headerBackTitle: t('common.back') }} />
      <View style={styles.body}>
        <Text style={styles.lead}>{t('auth.usernameLead')}</Text>
        <View style={styles.box}>
          <Text style={styles.at}>@</Text>
          <TextInput value={v} onChangeText={(x) => setValue(x.replace(/[^A-Za-z0-9_]/g, '').toLowerCase())} autoCapitalize="none" autoCorrect={false} autoFocus maxLength={20} style={styles.input} accessibilityLabel={t('auth.username')} placeholderTextColor={colors.textMuted} placeholder="aziz_tursunov" />
        </View>
        <Text style={styles.hint}>{t('auth.usernameRules')}</Text>
        <Action label={busy ? t('state.loading') : t('common.save')} kind="accent" onPress={save} disabled={busy || v.length < 3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.md },
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.md },
  at: { fontSize: 20, color: colors.textMuted, marginRight: 4 },
  input: { flex: 1, minHeight: 52, fontSize: 18, color: colors.text },
  hint: { color: colors.textMuted, fontSize: 13 },
});
