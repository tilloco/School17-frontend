import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

/** O'qituvchi: to'lov kartasi. Faqat raqam va ism; CVV/muddat/SMS maydonlari YO'Q. */
export default function CardScreen() {
  const { token } = useAuth();
  const info = useAsync(() => market.getPaymentInfo(token as string), [token]);
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);

  const header = <Stack.Screen options={{ headerShown: true, title: t('card.title'), headerBackTitle: t('common.back') }} />;
  if (info.state === 'loading') return <Screen>{header}<StateView state="loading" /></Screen>;
  if (info.state === 'offline' || info.state === 'error') return <Screen>{header}<StateView state={info.state} onRetry={info.reload} /></Screen>;

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : undefined;
    Alert.alert(t('common.error'), code === 'INVALID_CARD_NUMBER' ? t('card.invalidNumber') : code === 'INVALID_HOLDER_NAME' ? t('card.invalidHolder') : code === 'CARD_FEATURE_DISABLED' ? t('card.disabled') : e instanceof ApiError ? e.message : t('state.error'));
  };
  const save = async () => {
    setBusy(true);
    try {
      await market.setPaymentInfo(token as string, number, holder);
      setNumber(''); // to'liq raqam ekranda qolmaydi
      setHolder('');
      info.reload();
      Alert.alert(t('card.saved'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={styles.warn} accessibilityRole="alert">{t('card.warning')}</Text>
        <Text style={styles.help}>{t('card.shownTo')}</Text>
        <Text style={styles.current}>
          {info.data?.set ? t('card.current', { last4: info.data.cardLast4 ?? '', holder: info.data.holderName ?? '' }) : t('card.none')}
        </Text>
        <View style={styles.box}>
          <TextInput
            accessibilityLabel={t('card.number')}
            placeholder={t('card.number')}
            value={number}
            onChangeText={setNumber}
            keyboardType="number-pad"
            maxLength={19}
            autoComplete="off"
            importantForAutofill="no"
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t('card.holder')}
            placeholder={t('card.holder')}
            value={holder}
            onChangeText={setHolder}
            autoCapitalize="characters"
            maxLength={40}
            autoComplete="off"
            importantForAutofill="no"
            style={styles.input}
          />
          <PrimaryButton title={t('card.save')} onPress={save} loading={busy} disabled={number.replace(/\D/g, '').length < 16 || holder.trim().length < 2} />
        </View>
        {info.data?.set && (
          <PrimaryButton title={t('card.remove')} variant="outline" onPress={() => market.removePaymentInfo(token as string).then(info.reload).catch(fail)} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: { backgroundColor: '#FEF3C7', color: '#92400E', padding: spacing.md, borderRadius: radius.md, fontWeight: '600' },
  help: { color: colors.textMuted },
  current: { fontSize: 16, color: colors.text, fontWeight: '600' },
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minHeight: 48, fontSize: 16 },
});
