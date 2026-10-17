import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardScroll } from '../../src/ui/KeyboardScroll';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.loginEmail(email.trim(), password);
      await signIn(r.accessToken);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof ApiError ? (e.code === 'ACCOUNT_LOCKED' ? t('auth.locked') : e.statusCode === 401 ? t('auth.invalid') : e.message) : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardScroll contentContainerStyle={styles.body}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('auth.signin')}</Text>
          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel={t('auth.email')} style={styles.input} maxLength={254} />
          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.pwRow}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoComplete="password" textContentType="password" accessibilityLabel={t('auth.password')} style={[styles.input, { flex: 1, marginBottom: 0 }]} maxLength={72} onSubmitEditing={submit} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('auth.showPassword')} onPress={() => setShow(!show)} hitSlop={10} style={styles.eye}>
              <Ionicons name={show ? 'eye-off' : 'eye'} size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          <Action label={busy ? t('state.loading') : t('auth.signin')} onPress={submit} kind="accent" disabled={busy || !email.trim() || !password} />
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/register')} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={styles.link}>{t('auth.noAccount')}</Text>
          </Pressable>
          <Text style={styles.hint}>{t('auth.resetHint')}</Text>
        </KeyboardScroll>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 16, color: colors.text, marginBottom: spacing.xs },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eye: { position: 'absolute', right: 14 },
  error: { color: colors.danger, marginVertical: spacing.sm },
  link: { color: colors.primaryLight, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
