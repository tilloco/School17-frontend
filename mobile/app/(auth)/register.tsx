import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardScroll } from '../../src/ui/KeyboardScroll';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { getLocale, t } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action, IconName } from '../../src/ui';

type Role = 'STUDENT' | 'TEACHER' | 'GUARDIAN';
const ROLES: { id: Role; icon: IconName }[] = [
  { id: 'STUDENT', icon: 'school' },
  { id: 'TEACHER', icon: 'easel' },
];
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [role, setRole] = useState<Role>('STUDENT');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dob = (() => {
    const d = num(dd), m = num(mm), y = num(yyyy);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear())) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  })();
  const problem = !name.trim() || name.trim().length < 2 ? t('auth.errName') : (username && username.length < 3) ? t('auth.usernameBad') : !/^\S+@\S+\.\S+$/.test(email.trim()) ? t('auth.errEmail') : password.length < 8 ? t('auth.errPassword') : !dob ? t('auth.errDob') : !accept ? t('auth.errTerms') : null;

  const submit = async () => {
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const r = await api.registerEmail({ email: email.trim(), password, name: name.trim(), role, dateOfBirth: dob as string, acceptTerms: true, locale: getLocale(), ...(username ? { username } : {}) });
      await signIn(r.accessToken);
      router.replace(role === 'TEACHER' ? '/(auth)/setup' : '/(tabs)/home');
    } catch (e) {
      const m: Record<string, string> = { EMAIL_TAKEN: 'auth.emailTaken', WEAK_PASSWORD: 'auth.weak', TOO_YOUNG: role === 'STUDENT' ? 'auth.tooYoungPupil' : 'auth.tooYoungAdult', TERMS_REQUIRED: 'auth.errTerms', BAD_DOB: 'auth.errDob', USERNAME_TAKEN: 'auth.usernameTaken', BAD_USERNAME: 'auth.usernameBad', RESERVED_USERNAME: 'auth.usernameTaken' };
      setError(e instanceof ApiError ? (e.code && m[e.code] ? t(m[e.code]) : e.statusCode === 429 ? t('auth.tooMany') : e.message) : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        <KeyboardScroll contentContainerStyle={styles.body}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('auth.create')}</Text>

          <Text style={styles.label}>{t('auth.iAm')}</Text>
          <View style={styles.roles}>
            {ROLES.map((r) => (
              <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ selected: role === r.id }} onPress={() => setRole(r.id)} style={[styles.role, role === r.id && styles.roleOn]}>
                <Ionicons name={r.icon} size={26} color={role === r.id ? '#fff' : colors.primary} />
                <Text style={[styles.roleText, role === r.id && { color: '#fff' }]}>{t(`role.${r.id}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.roleHint}>{t(`auth.roleHint.${role}`)}</Text>

          <Text style={styles.label}>{t('auth.fullName')}</Text>
          <TextInput value={name} onChangeText={setName} autoComplete="name" textContentType="name" accessibilityLabel={t('auth.fullName')} style={styles.input} maxLength={100} />
          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput value={username} onChangeText={(v) => setUsername(v.replace(/[^A-Za-z0-9_]/g, '').toLowerCase())} autoCapitalize="none" autoCorrect={false} placeholder="aziz_tursunov" placeholderTextColor={colors.textMuted} accessibilityLabel={t('auth.username')} style={styles.input} maxLength={20} />
          <Text style={styles.hint}>{t(role === 'TEACHER' ? 'auth.usernameHintTeacher' : 'auth.usernameHint')}</Text>
          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel={t('auth.email')} style={styles.input} maxLength={254} />
          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.pwRow}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" textContentType="newPassword" accessibilityLabel={t('auth.password')} style={[styles.input, { flex: 1 }]} maxLength={72} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('auth.showPassword')} onPress={() => setShow(!show)} hitSlop={10} style={styles.eye}>
              <Ionicons name={show ? 'eye-off' : 'eye'} size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

          <Text style={styles.label}>{t('auth.dob')}</Text>
          <View style={styles.dobRow}>
            <TextInput value={dd} onChangeText={setDd} placeholderTextColor={colors.textMuted} placeholder={t('auth.dd')} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('auth.dd')} style={[styles.input, styles.dob]} />
            <TextInput value={mm} onChangeText={setMm} placeholderTextColor={colors.textMuted} placeholder={t('auth.mm')} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('auth.mm')} style={[styles.input, styles.dob]} />
            <TextInput value={yyyy} onChangeText={setYyyy} placeholderTextColor={colors.textMuted} placeholder={t('auth.yyyy')} keyboardType="number-pad" maxLength={4} accessibilityLabel={t('auth.yyyy')} style={[styles.input, styles.dob, { flex: 1.6 }]} />
          </View>
          <Text style={styles.hint}>{t('auth.dobHint')}</Text>

          <View style={styles.termsRow}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accept }} onPress={() => setAccept(!accept)} hitSlop={8}>
              <Ionicons name={accept ? 'checkbox' : 'square-outline'} size={26} color={accept ? colors.primary : colors.textMuted} />
            </Pressable>
            <Text style={styles.terms}>
              {t('auth.accept')}{' '}
              <Text style={styles.link} onPress={() => router.push('/(auth)/legal')}>{t('auth.readTerms')}</Text>
            </Text>
          </View>

          {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
          <Action label={busy ? t('state.loading') : t('auth.create')} kind="accent" onPress={submit} disabled={busy} />
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/signin')} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={styles.link}>{t('auth.haveAccount')}</Text>
          </Pressable>
        </KeyboardScroll>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  label: { fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 16, color: colors.text },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { position: 'absolute', right: 14 },
  roles: { flexDirection: 'row', gap: spacing.sm },
  role: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  roleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  roleHint: { color: colors.textMuted, fontSize: 13 },
  dobRow: { flexDirection: 'row', gap: spacing.sm },
  dob: { flex: 1, textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 12 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  terms: { flex: 1, color: colors.text, fontSize: 14 },
  link: { color: colors.primaryLight, fontWeight: '700' },
  error: { color: colors.danger, marginVertical: spacing.sm },
});
