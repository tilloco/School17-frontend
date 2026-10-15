import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ErrorText } from '../../src/components/ErrorText';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { signInWithGoogle } from '../../src/lib/google-auth';
import { API_URL } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme/colors';

const EXAM_DATE = '2026-12-23';

export default function PhoneScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local testing only: shown when the app was started by scripts/dev-tunnel.ps1 (EXPO_PUBLIC_DEV_LOGIN=1) against the throwaway local backend.
  const devLogin = async (role: 'STUDENT' | 'TEACHER' | 'GUARDIAN') => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/dev/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      await signIn(j.accessToken);
      router.replace('/(tabs)/market');
    } catch (e) {
      setError(`Dev login failed: ${(e as Error).message}`);
    }
  };

  const onGooglePress = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { idToken, name } = await signInWithGoogle();
      const result = await api.loginWithGoogle(idToken);
      if (name) {
        await api.updateProfile(result.accessToken, { name, examDate: EXAM_DATE });
      }
      await signIn(result.accessToken);
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Google orqali kirishda xatolik yuz berdi');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen style={styles.content}>
      <Text style={styles.title}>Huquq imtihoniga tayyorgarlik</Text>
      <Text style={styles.subtitle}>Davom etish uchun Google hisobingiz bilan kiring</Text>

      <PrimaryButton
        title="Google orqali kirish"
        onPress={onGooglePress}
        loading={googleLoading}
        disabled={false}
      />

      {process.env.EXPO_PUBLIC_DEV_LOGIN === '1' && (
        <>
          <Text style={styles.subtitle}>Local test accounts (dev only)</Text>
          <PrimaryButton title="Test pupil" variant="outline" onPress={() => devLogin('STUDENT')} />
          <PrimaryButton title="Test teacher" variant="outline" onPress={() => devLogin('TEACHER')} />
          <PrimaryButton title="Test guardian" variant="outline" onPress={() => devLogin('GUARDIAN')} />
        </>
      )}

      <ErrorText message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.xl },
});