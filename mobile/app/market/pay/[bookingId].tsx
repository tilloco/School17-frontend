import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { UploadError, uploadFile } from '../../../src/market/uploader';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

const money = (minor: number) => Math.round(minor / 100).toLocaleString('en-US').replace(/,/g, ' ');

/**
 * To'lov ekrani. School17 pulni ushlamaydi va tekshirmaydi: karta ma'lumotlari ko'rsatiladi, o'quvchi "To'ladim" deb belgilaydi,
 * o'qituvchi "Oldim"/"Kelmadi"/"Bu safar bepul" deb belgilaydi. Holat matnlari "o'quvchi belgilagan" / "o'qituvchi tasdiqlagan".
 * HOLAT: faqat tiplar tekshirilgan, qurilmada ishlatilmagan.
 */
export default function PayScreen() {
  const { token } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const dp = useAsync(() => market.directPayment(token as string, bookingId), [token, bookingId]);
  const [card, setCard] = useState<{ cardNumber: string; holderName: string } | null>(null);
  const [cardNote, setCardNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ fileId: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const header = <Stack.Screen options={{ headerShown: true, title: t('pay.title'), headerBackTitle: t('common.back') }} />;
  if (dp.state !== 'ready' || !dp.data) return <Screen>{header}<StateView state={dp.state === 'ready' ? 'loading' : dp.state} onRetry={dp.reload} /></Screen>;
  const v = dp.data;
  if (v.trial) return <Screen>{header}<StateView state="empty" message={t('pay.trialFree')} /></Screen>;
  if (!v.status) return <Screen>{header}<StateView state="empty" message={t('pay.notAccepted')} /></Screen>;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      dp.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  const showCard = async () => {
    setCardNote(null);
    try {
      setCard(await market.revealCard(token as string, v.teacher!.id));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setCardNote(code === 'NO_PAYMENT_INFO' ? t('pay.noCard') : code === 'NOT_ELIGIBLE' ? t('pay.notAccepted') : e instanceof ApiError && e.statusCode === 429 ? t('pay.tooMany') : t('state.error'));
    }
  };
  const copy = async () => {
    if (!card) return;
    await Clipboard.setStringAsync(card.cardNumber.replace(/\s/g, ''));
    Alert.alert(t('pay.copied'));
  };
  const pickReceipt = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      setProgress(0);
      const up = await uploadFile({ token: token as string, uri: a.uri, name: a.fileName ?? 'receipt.jpg', mime: a.mimeType ?? 'image/jpeg', purpose: 'PAYMENT_PROOF', onProgress: setProgress });
      setReceipt(up);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof UploadError ? e.message : t('state.error'));
    } finally {
      setProgress(null);
    }
  };

  const mine = v.canMarkPaid;
  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}>
        <Text style={styles.amount}>{t('pay.amount', { amount: money(v.amountMinor ?? 0) })}</Text>
        {v.paymentTiming && <Text style={styles.help}>{t(`pay.timing.${v.paymentTiming}`)}</Text>}
        <Text style={styles.status} accessibilityLiveRegion="polite">{t(`pay.state.${v.status}`)}</Text>
        <Text style={styles.help}>{t('pay.help')}</Text>

        {v.side === 'pupil' && (
          <View style={styles.box}>
            {!card ? (
              <PrimaryButton title={t('pay.showCard')} onPress={showCard} disabled={v.status === 'WAIVED'} />
            ) : (
              <>
                <Text style={styles.label}>{t('pay.card')}</Text>
                <Text style={styles.card} selectable>{card.cardNumber}</Text>
                <PrimaryButton title={t('pay.copy')} variant="outline" onPress={copy} />
                <Text style={styles.label}>{t('pay.holder')}</Text>
                <Text style={styles.holder} selectable>{card.holderName}</Text>
              </>
            )}
            {!!cardNote && <Text style={styles.err} accessibilityRole="alert">{cardNote}</Text>}
          </View>
        )}

        {mine && (
          <View style={styles.box}>
            <PrimaryButton title={receipt ? t('pay.attached') : t('pay.attach')} variant="outline" onPress={pickReceipt} loading={progress !== null} />
            {progress !== null && <Text style={styles.help}>{t('pay.uploading', { percent: Math.round(progress * 100) })}</Text>}
            <PrimaryButton title={t('pay.iPaid')} onPress={() => run(() => market.directAction(token as string, bookingId, 'paid', receipt ? { proofFileId: receipt.fileId } : {}))} loading={busy} />
          </View>
        )}

        {(v.canConfirm || v.canMarkNotReceived || v.canWaive) && (
          <View style={styles.box}>
            {v.canConfirm && <PrimaryButton title={t('pay.received')} onPress={() => run(() => market.directAction(token as string, bookingId, 'received'))} loading={busy} />}
            {v.canMarkNotReceived && <PrimaryButton title={t('pay.notReceived')} variant="outline" onPress={() => run(() => market.directAction(token as string, bookingId, 'not-received'))} />}
            {v.canWaive && <PrimaryButton title={t('pay.waive')} variant="outline" onPress={() => run(() => market.directAction(token as string, bookingId, 'waive'))} />}
          </View>
        )}
        <Text style={styles.help}>{t('pay.disclaimer')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 22, fontWeight: '800', color: colors.text },
  status: { fontSize: 16, fontWeight: '700', color: colors.primary },
  help: { color: colors.textMuted, fontSize: 13 },
  box: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.textMuted, fontSize: 13 },
  card: { fontSize: 26, fontWeight: '800', letterSpacing: 1, color: colors.text },
  holder: { fontSize: 22, fontWeight: '700', color: colors.text, textTransform: 'uppercase' },
  err: { color: colors.danger },
});
