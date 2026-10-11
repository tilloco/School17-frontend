import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { getLocale, t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

export default function SafetyScreen() {
  const { token, signOut } = useAuth();
  const locale = getLocale();
  const me = useAsync(() => market.me(token as string), [token]);
  const audience = me.data?.role === 'TEACHER' ? 'teacher' : me.data?.role === 'GUARDIAN' ? 'guardian' : 'pupil';
  const tips = useAsync(() => market.tips(audience, locale), [audience, locale, me.data?.role]);
  const blocks = useAsync(() => market.blocks(token as string), [token]);
  const terms = useAsync(() => market.terms(locale), [locale]);
  const [code, setCode] = useState<string | null>(null);
  const [childCode, setChildCode] = useState('');
  const [showTerms, setShowTerms] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) Alert.alert(ok);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : String(e));
    }
  };
  const remove = () => Alert.alert(t('safety.delete'), `${t('safety.deleteConfirm')}\n\n${t('safety.retained')}`, [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('safety.delete'), style: 'destructive',
      onPress: async () => {
        try {
          await market.deleteAccount(token as string);
          await signOut();
        } catch (e) {
          Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'DELETE_BLOCKED' ? t('safety.deleteBlocked') : e instanceof ApiError ? e.message : String(e));
        }
      },
    },
  ]);

  if (me.state === 'loading') return <Screen><Stack.Screen options={{ headerShown: true, title: t('safety.title') }} /><StateView state="loading" /></Screen>;
  if (me.state === 'offline' || me.state === 'error') return <Screen><StateView state={me.state} onRetry={me.reload} /></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('safety.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}>
        <Text style={styles.h2}>{t('safety.tips')}</Text>
        <Text style={styles.draft}>{t('safety.draft')}</Text>
        {tips.data?.tips.map((tip) => <Text key={tip} style={styles.tip}>• {tip}</Text>)}

        {me.data?.isMinor && (
          <View style={styles.box}>
            <Text style={styles.h3}>{t('safety.guardianCode')}</Text>
            <Text style={styles.help}>{t('safety.guardianCodeHelp')}</Text>
            {code && <Text style={styles.code} selectable>{code}</Text>}
            <PrimaryButton title={t('safety.guardianCode')} onPress={() => run(async () => setCode((await market.guardianCode(token as string)).code))} />
          </View>
        )}
        {me.data?.role === 'GUARDIAN' && (
          <View style={styles.box}>
            <Text style={styles.h3}>{t('safety.linkChild')}</Text>
            <TextInput accessibilityLabel={t('safety.enterCode')} value={childCode} onChangeText={setChildCode} placeholder={t('safety.enterCode')} autoCapitalize="characters" maxLength={9} style={styles.input} />
            <PrimaryButton title={t('safety.linkChild')} disabled={childCode.length < 8} onPress={() => run(() => market.linkChild(token as string, childCode), t('safety.linked'))} />
          </View>
        )}

        <View style={styles.box}>
          <Text style={styles.h3}>{t('safety.blocks')}</Text>
          {blocks.data?.length === 0 && <Text style={styles.help}>{t('state.empty')}</Text>}
          {blocks.data?.map((b) => (
            <View key={b.id} style={styles.blockRow}>
              <Text style={{ flex: 1 }}>{b.name}</Text>
              <PrimaryButton title={t('safety.unblock')} variant="outline" onPress={() => run(async () => { await market.unblock(token as string, b.id); blocks.reload(); })} />
            </View>
          ))}
        </View>

        <View style={styles.box}>
          <PrimaryButton title={t('safety.terms')} variant="outline" onPress={() => setShowTerms((v) => !v)} />
          {showTerms && terms.data && (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.draft}>{terms.data.draftBanner}</Text>
              {terms.data.sections.map((s) => (
                <View key={s.heading}>
                  <Text style={styles.h3}>{s.heading}</Text>
                  <Text>{s.body}</Text>
                </View>
              ))}
              <PrimaryButton title={t('safety.accept')} onPress={() => run(() => market.acceptConsent(token as string, 'TERMS', terms.data!.version, locale), t('common.ok'))} />
            </View>
          )}
          <Text style={styles.help}>{t('safety.noEncryptionClaim')}</Text>
        </View>

        <View style={styles.box}>
          <PrimaryButton title={t('safety.export')} variant="outline" onPress={() => run(async () => { const d = await market.exportData(token as string); Alert.alert(t('safety.export'), `${Object.keys(d).length} ${t('common.ok')}`); })} />
          <PrimaryButton title={t('safety.delete')} variant="outline" onPress={remove} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  draft: { fontSize: 12, color: colors.warning },
  tip: { color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center', color: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minHeight: 48, fontSize: 18, textAlign: 'center' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
