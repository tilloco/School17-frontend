import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, API_URL, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { LOCALES, Locale, t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { signInWithGoogle } from '../../src/lib/google-auth';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

const NAMES: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

/** First screen: pick a language, then continue with a phone number (a code arrives on Telegram), or with e-mail / Google. */
export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { locale, setLanguage } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      const { idToken } = await signInWithGoogle();
      const r = await api.loginWithGoogle(idToken);
      await signIn(r.accessToken);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message || t('auth.googleFailed'));
    } finally {
      setBusy(false);
    }
  };
  // Local testing only (scripts/dev-tunnel.ps1 and dev-usb.ps1 set EXPO_PUBLIC_DEV_LOGIN=1 and a local backend).
  const dev = async (role: 'STUDENT' | 'TEACHER') => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/dev/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await signIn((await res.json()).accessToken);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(`Dev login failed: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.langs}>
        {LOCALES.map((l) => (
          <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: l === locale }} onPress={() => setLanguage(l)} style={[styles.lang, l === locale && styles.langOn]}>
            <Text style={[styles.langText, l === locale && { color: '#fff' }]}>{NAMES[l]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.center}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="School17" />
        <Text style={styles.title}>School17</Text>
      </View>
      <View style={styles.actions}>
        <Action label={t('auth.phoneContinue')} kind="accent" icon="call" onPress={() => router.push('/(auth)/phone')} />
        <Action label={t('auth.emailContinue')} kind="outline" icon="mail" onPress={() => router.push('/(auth)/signin')} />
        <Pressable accessibilityRole="button" onPress={google} disabled={busy} style={styles.google}>
          <Text style={styles.googleText}>{t('auth.google')}</Text>
        </Pressable>
        {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
        {process.env.EXPO_PUBLIC_DEV_LOGIN === '1' && (
          <View style={styles.dev}>
            <Text style={styles.devTitle}>Local test accounts (dev only)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.devBtn} onPress={() => dev('STUDENT')}><Text style={styles.devText}>Pupil</Text></Pressable>
              <Pressable style={styles.devBtn} onPress={() => dev('TEACHER')}><Text style={styles.devText}>Teacher</Text></Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  langs: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: spacing.sm },
  lang: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.neutralSoft },
  langOn: { backgroundColor: colors.primary },
  langText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logo: { width: 120, height: 120, borderRadius: 30 },
  title: { fontSize: 38, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  actions: { gap: spacing.sm },
  google: { alignItems: 'center', paddingVertical: 12 },
  googleText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  error: { color: colors.danger, textAlign: 'center' },
  dev: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.sm, gap: 6 },
  devTitle: { fontSize: 12, color: colors.warningText, fontWeight: '700' },
  devBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  devText: { fontWeight: '700', color: colors.warningText },
});
