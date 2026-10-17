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
/** "+998 90 123 45 67" while typing; always starts with the Uzbekistan code, which the person does not have to type. */
const fmtPhone = (raw: string) => {
  let d = raw.replace(/\D/g, '');
  if (!d.startsWith('998')) d = '998' + d.replace(/^0+/, '');
  d = d.slice(0, 12);
  const r = d.slice(3);
  return `+998${r ? ' ' + r.slice(0, 2) : ''}${r.length > 2 ? ' ' + r.slice(2, 5) : ''}${r.length > 5 ? ' ' + r.slice(5, 7) : ''}${r.length > 7 ? ' ' + r.slice(7, 9) : ''}`;
};
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

/** Sign in or sign up with a phone number: Telegram sends the code in its official "Verification Codes" chat. New people then give a name, role and date of birth. */
export default function PhoneScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [phone, setPhone] = useState('+998 ');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
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

  const fail = (e: unknown) => {
    const m: Record<string, string> = { BAD_PHONE: 'phone.badPhone', NO_TELEGRAM: 'phone.noTelegram', SEND_FAILED: 'phone.sendFailed', CODE_RATE: 'phone.rate', BAD_CODE: 'phone.badCode', TERMS_REQUIRED: 'auth.errTerms', BAD_DOB: 'auth.errDob', USERNAME_TAKEN: 'auth.usernameTaken', BAD_USERNAME: 'auth.usernameBad', RESERVED_USERNAME: 'auth.usernameTaken', TOO_YOUNG: role === 'STUDENT' ? 'auth.tooYoungPupil' : 'auth.tooYoungAdult' };
    setError(e instanceof ApiError ? (e.code && m[e.code] ? t(m[e.code]) : e.statusCode === 429 ? t('auth.tooMany') : e.message) : t('state.error'));
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    const r = await api.requestPhoneCode(phone.trim());
    setDevCode(r.devCode ?? null);
    setCode('');
    setStep('code');
  });
  const verify = (profile?: object) => run(async () => {
    const r = await api.verifyPhoneCode({ phone: phone.trim(), code, ...(profile ?? {}) });
    if (r.accessToken) {
      await signIn(r.accessToken);
      router.replace(profile && (profile as { role?: string }).role === 'TEACHER' ? '/(auth)/setup' : '/(tabs)/home');
    } else if (r.needsProfile) setStep('profile');
  });
  const finish = () => {
    if (name.trim().length < 2) return setError(t('auth.errName'));
    if (!dob) return setError(t('auth.errDob'));
    if (!accept) return setError(t('auth.errTerms'));
    verify({ name: name.trim(), role, dateOfBirth: dob, acceptTerms: true, locale: getLocale(), ...(username ? { username } : {}) });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardScroll contentContainerStyle={styles.body}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => (step === 'phone' ? router.back() : setStep(step === 'profile' ? 'code' : 'phone'))} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t(step === 'phone' ? 'phone.title' : step === 'code' ? 'phone.codeTitle' : 'phone.profileTitle')}</Text>

          {step === 'phone' && (
            <>
              <Text style={styles.help}>{t('phone.help')}</Text>
              <Text style={styles.label}>{t('phone.number')}</Text>
              <TextInput value={phone} onChangeText={(v) => setPhone(fmtPhone(v))} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" accessibilityLabel={t('phone.number')} style={styles.input} maxLength={20} onSubmitEditing={sendCode} />
              {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
              <Action label={busy ? t('state.loading') : t('phone.send')} kind="accent" onPress={sendCode} disabled={busy || phone.replace(/\D/g, '').length < 12} />
              <Text style={styles.hint}>{t('phone.privacy')}</Text>
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.help}>{t('phone.codeSent', { phone })}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setStep('phone'); setError(null); }} hitSlop={8}><Text style={styles.link}>{t('phone.change')}</Text></Pressable>
              {!!devCode && <Text style={styles.dev}>Dev code: {devCode}</Text>}
              <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" accessibilityLabel={t('phone.code')} placeholderTextColor={colors.textMuted} placeholder="123456" style={[styles.input, styles.codeInput]} maxLength={6} autoFocus />
              {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
              <Action label={busy ? t('state.loading') : t('phone.verify')} kind="accent" onPress={() => verify()} disabled={busy || code.length !== 6} />
              <Pressable accessibilityRole="button" onPress={sendCode} disabled={busy} style={{ alignItems: 'center', padding: 12 }}>
                <Text style={styles.link}>{t('phone.resend')}</Text>
              </Pressable>
            </>
          )}

          {step === 'profile' && (
            <>
              <Text style={styles.help}>{t('phone.welcomeNew')}</Text>
              <Text style={styles.label}>{t('auth.iAm')}</Text>
              <View style={styles.roles}>
                {ROLES.map((r) => (
                  <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ selected: role === r.id }} onPress={() => setRole(r.id)} style={[styles.role, role === r.id && styles.roleOn]}>
                    <Ionicons name={r.icon} size={26} color={role === r.id ? '#fff' : colors.primary} />
                    <Text style={[styles.roleText, role === r.id && { color: '#fff' }]}>{t(`role.${r.id}`)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>{t('auth.fullName')}</Text>
              <TextInput value={name} onChangeText={setName} autoComplete="name" textContentType="name" accessibilityLabel={t('auth.fullName')} style={styles.input} maxLength={100} />
              <Text style={styles.label}>{t('auth.username')}</Text>
              <TextInput value={username} onChangeText={(v) => setUsername(v.replace(/[^A-Za-z0-9_]/g, '').toLowerCase())} autoCapitalize="none" autoCorrect={false} placeholder="aziz_tursunov" placeholderTextColor={colors.textMuted} accessibilityLabel={t('auth.username')} style={styles.input} maxLength={20} />
              <Text style={styles.label}>{t('auth.dob')}</Text>
              <View style={styles.dobRow}>
                <TextInput value={dd} onChangeText={setDd} placeholderTextColor={colors.textMuted} placeholder={t('auth.dd')} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('auth.dd')} style={[styles.input, styles.dob]} />
                <TextInput value={mm} onChangeText={setMm} placeholderTextColor={colors.textMuted} placeholder={t('auth.mm')} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('auth.mm')} style={[styles.input, styles.dob]} />
                <TextInput value={yyyy} onChangeText={setYyyy} placeholderTextColor={colors.textMuted} placeholder={t('auth.yyyy')} keyboardType="number-pad" maxLength={4} accessibilityLabel={t('auth.yyyy')} style={[styles.input, styles.dob, { flex: 1.6 }]} />
              </View>
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
              <Action label={busy ? t('state.loading') : t('auth.create')} kind="accent" onPress={finish} disabled={busy} />
            </>
          )}
        </KeyboardScroll>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  help: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  label: { fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 16, color: colors.text },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  dev: { color: colors.warning, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12 },
  roles: { flexDirection: 'row', gap: spacing.sm },
  role: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  roleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  dobRow: { flexDirection: 'row', gap: spacing.sm },
  dob: { flex: 1, textAlign: 'center' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  terms: { flex: 1, color: colors.text, fontSize: 14 },
  link: { color: colors.primaryLight, fontWeight: '700' },
  error: { color: colors.danger, marginVertical: spacing.sm },
});
