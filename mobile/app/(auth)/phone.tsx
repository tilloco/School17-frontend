import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ErrorText } from '../../src/components/ErrorText';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { signInWithGoogle } from '../../src/lib/google-auth';
import { colors, spacing } from '../../src/theme/colors';

const EXAM_DATE = '2026-12-23';

export default function PhoneScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      <ErrorText message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.xl },
});