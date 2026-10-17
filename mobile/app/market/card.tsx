import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Stack } from 'expo-router';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { cardDigits, cardGroups, luhnOk } from '../../src/lib/card';
import { Action, Card, Page } from '../../src/ui';
import { BankCard } from '../../src/ui/BankCard';

/** Teacher: the card pupils pay to. Only the number and the holder's name: never an expiry date, a CVV or an SMS code. Shown to a pupil only after a lesson is accepted. */
export default function CardScreen() {
  const { token } = useAuth();
  const info = useAsync(() => market.getPaymentInfo(token as string), [token]);
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);

  const header = <Stack.Screen options={{ headerShown: true, title: t('card.title'), headerBackTitle: t('common.back') }} />;
  if (info.state === 'loading') return <View style={styles.root}>{header}<StateView state="loading" /></View>;
  if (info.state === 'offline' || info.state === 'error') return <View style={styles.root}>{header}<StateView state={info.state} onRetry={info.reload} /></View>;

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : undefined;
    Alert.alert(t('common.error'), code === 'INVALID_CARD_NUMBER' ? t('card.invalidNumber') : code === 'INVALID_HOLDER_NAME' ? t('card.invalidHolder') : code === 'CARD_FEATURE_DISABLED' ? t('card.disabled') : e instanceof ApiError ? e.message : t('state.error'));
  };
  const save = async () => {
    setBusy(true);
    try {
      await market.setPaymentInfo(token as string, number, holder);
      setNumber(''); // the full number never stays on the screen
      setHolder('');
      info.reload();
      Alert.alert(t('card.saved'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const digits = cardDigits(number);
  const full = digits.length === 16;
  const valid = luhnOk(digits);

  return (
    <View style={styles.root}>
      {header}
      <Page edges={[]}>
        <BankCard last4={info.data?.set ? info.data.cardLast4 : null} number={digits.length >= 4 ? digits : null} holder={holder || info.data?.holderName} verifiedName />
        {info.data?.set && !digits ? <Text style={styles.current}>{t('card.current', { last4: info.data.cardLast4 ?? '', holder: info.data.holderName ?? '' })}</Text> : null}

        <Card style={{ gap: spacing.sm }}>
          <TextInput accessibilityLabel={t('card.number')} placeholderTextColor={colors.textMuted} placeholder={t('card.number')} value={cardGroups(digits)} onChangeText={(v) => setNumber(cardDigits(v))} keyboardType="number-pad" maxLength={19} autoComplete="off" importantForAutofill="no" style={styles.input} />
          <TextInput accessibilityLabel={t('card.holder')} placeholderTextColor={colors.textMuted} placeholder={t('card.holder')} value={holder} onChangeText={setHolder} autoCapitalize="characters" maxLength={40} autoComplete="off" importantForAutofill="no" style={styles.input} />
          {full && <Text style={[styles.check, { color: valid ? colors.success : colors.danger }]}>{valid ? t('card.checkOk') : t('card.checkBad')}</Text>}
          <Action label={busy ? t('state.loading') : t('card.save')} kind="accent" onPress={save} disabled={busy || !valid || holder.trim().length < 2} />
        </Card>

        <Card tone="warning" style={{ gap: 4 }}>
          <Text style={styles.ruleTitle}>{t('card.rulesTitle')}</Text>
          <Text style={styles.rule}>• {t('card.rule1')}</Text>
          <Text style={styles.rule}>• {t('card.rule2')}</Text>
          <Text style={styles.rule}>• {t('card.rule3')}</Text>
        </Card>
        {info.data?.set && <Action label={t('card.remove')} kind="outline" onPress={() => market.removePaymentInfo(token as string).then(info.reload).catch(fail)} />}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  check: { fontWeight: '700', fontSize: 14 },
  current: { textAlign: 'center', color: colors.textMuted },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 17, color: colors.text, backgroundColor: colors.background },
  ruleTitle: { fontWeight: '800', color: colors.warningText },
  rule: { color: colors.warningText, lineHeight: 20 },
});
