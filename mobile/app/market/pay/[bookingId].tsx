import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { clipboard, imagePicker } from '../../../src/lib/native';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { UploadError, uploadFile } from '../../../src/market/uploader';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { Action, Card, Page, Pill } from '../../../src/ui';
import { BankCard } from '../../../src/ui/BankCard';

const money = (minor: number) => Math.round(minor / 100).toLocaleString('en-US').replace(/,/g, ' ');
const words = (s: string) => s.toLowerCase().replace(/[^a-zа-яёўқғҳ'\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2);
/** Do the card holder and the teacher share a name part? A mismatch is a warning sign, not a block. */
const namesMatch = (holder: string, teacher: string) => { const h = words(holder); return words(teacher).some((w) => h.includes(w)); };

/**
 * Payment screen. School17 never holds or checks money: the pupil sees the teacher's card only after the lesson is accepted, pays in their own bank app,
 * and marks "I paid"; the teacher marks "received". The full number stays hidden until the pupil taps, hides again after a minute, and the card holder's
 * name is compared with the verified teacher's name so a mismatch is flagged.
 */
export default function PayScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const dp = useAsync(() => market.directPayment(token as string, bookingId), [token, bookingId]);
  const [card, setCard] = useState<{ cardNumber: string; holderName: string } | null>(null);
  const [cardNote, setCardNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ fileId: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const header = <Stack.Screen options={{ headerShown: true, title: t('pay.title'), headerBackTitle: t('common.back') }} />;
  if (dp.state !== 'ready' || !dp.data) return <View style={styles.root}>{header}<StateView state={dp.state === 'ready' ? 'loading' : dp.state} onRetry={dp.reload} /></View>;
  const v = dp.data;
  if (v.trial) return <View style={styles.root}>{header}<StateView state="empty" message={t('pay.trialFree')} /></View>;
  if (!v.status) return <View style={styles.root}>{header}<StateView state="empty" message={t('pay.notAccepted')} /></View>;

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
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCard(null), 60_000); // the number hides itself again
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setCardNote(code === 'NO_PAYMENT_INFO' ? t('pay.noCard') : code === 'NOT_ELIGIBLE' ? t('pay.notAccepted') : e instanceof ApiError && e.statusCode === 429 ? t('pay.tooMany') : t('state.error'));
    }
  };
  /** Pay in Click or Payme without ever seeing the number: the card is copied to the clipboard, the app opens, and the pupil pastes it. */
  const payWith = async (app: 'click' | 'payme') => {
    setCardNote(null);
    try {
      const c = await market.revealCard(token as string, v.teacher!.id);
      const CB = clipboard();
      if (!CB) return Alert.alert(t('native.missing'));
      await CB.setStringAsync(c.cardNumber.replace(/\s/g, ''));
      setCopied(c.cardNumber.replace(/\s/g, '').slice(-4));
      await Linking.openURL(app === 'click' ? 'https://click.uz' : 'https://payme.uz').catch(() => undefined);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setCardNote(code === 'NO_PAYMENT_INFO' ? t('pay.noCard') : code === 'NOT_ELIGIBLE' ? t('pay.notAccepted') : e instanceof ApiError && e.statusCode === 429 ? t('pay.tooMany') : t('state.error'));
    }
  };
  const copyAmount = async () => {
    const CB = clipboard();
    if (!CB) return;
    await CB.setStringAsync(String(Math.round((v.amountMinor ?? 0) / 100)));
    Alert.alert(t('pay.amountCopied'));
  };
  const copy = async () => {
    if (!card) return;
    const CB = clipboard();
    if (!CB) return;
    await CB.setStringAsync(card.cardNumber.replace(/\s/g, ''));
    Alert.alert(t('pay.copied'));
  };
  const pickReceipt = async () => {
    const IP = imagePicker();
    if (!IP) return;
    const res = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
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

  const teacherName = v.teacher?.name ?? '';
  const mismatch = !!card && !!teacherName && !namesMatch(card.holderName, teacherName);
  const mine = v.canMarkPaid;
  return (
    <View style={styles.root}>
      {header}
      <Page edges={[]}>
        <View style={styles.top}>
          <Text style={styles.amount}>{money(v.amountMinor ?? 0)} <Text style={styles.cur}>{t('common.currency')}</Text></Text>
          <Pill label={t(`pay.state.${v.status}`)} tone={v.status === 'TEACHER_CONFIRMED' ? 'success' : v.status === 'NOT_RECEIVED' ? 'danger' : 'primary'} />
          {v.paymentTiming && <Text style={styles.help}>{t(`pay.timing.${v.paymentTiming}`)}</Text>}
        </View>

        {v.side === 'pupil' && (
          <>
            <BankCard number={card?.cardNumber} last4={copied} holder={card?.holderName ?? teacherName} verifiedName />
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Action label="Click" icon="flash" onPress={() => payWith('click')} disabled={v.status === 'WAIVED'} /></View>
              <View style={{ flex: 1 }}><Action label="Payme" icon="wallet" onPress={() => payWith('payme')} disabled={v.status === 'WAIVED'} /></View>
            </View>
            {copied && (
              <Card tone="primary" style={{ gap: 6 }}>
                <Text style={styles.stepTitle}>{t('pay.copiedTitle', { last4: copied })}</Text>
                <Text style={styles.step}>{t('pay.copiedText', { amount: money(v.amountMinor ?? 0) })}</Text>
                <Action label={t('pay.copyAmount')} kind="outline" icon="copy" onPress={copyAmount} />
              </Card>
            )}
            {!card ? (
              <>
                <Pressable accessibilityRole="button" onPress={showCard} disabled={v.status === 'WAIVED'} style={styles.scam}><Text style={styles.showLink}>{t('pay.showCard')}</Text></Pressable>
                <Text style={styles.help}>{t('pay.hiddenHint')}</Text>
              </>
            ) : (
              <>
                {mismatch && (
                  <Card tone="danger" style={{ gap: 4 }}>
                    <Text style={styles.warnTitle}>{t('pay.mismatchTitle')}</Text>
                    <Text style={styles.warnText}>{t('pay.mismatchText', { holder: card.holderName, name: teacherName })}</Text>
                  </Card>
                )}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Action label={t('pay.copy')} icon="copy" onPress={copy} /></View>
                  <View style={{ flex: 1 }}><Action label={t('pay.hide')} kind="outline" icon="eye-off" onPress={() => setCard(null)} /></View>
                </View>
              </>
            )}
            {!!cardNote && <Text style={styles.err} accessibilityRole="alert">{cardNote}</Text>}

            <Card style={{ gap: 6 }}>
              <Text style={styles.stepTitle}>{t('pay.howTitle')}</Text>
              <Text style={styles.step}>1. {t('pay.how1')}</Text>
              <Text style={styles.step}>2. {t('pay.how2')}</Text>
              <Text style={styles.step}>3. {t('pay.how3')}</Text>
            </Card>
            <Pressable accessibilityRole="button" onPress={() => router.push('/market/safety' as never)} style={styles.scam}>
              <Ionicons name="shield-half" size={18} color={colors.danger} />
              <Text style={styles.scamText}>{t('pay.scam')}</Text>
            </Pressable>
          </>
        )}

        {mine && (
          <Card style={{ gap: spacing.sm }}>
            <Action label={receipt ? t('pay.attached') : t('pay.attach')} kind="outline" icon="attach" onPress={pickReceipt} disabled={progress !== null} />
            {progress !== null && <Text style={styles.help}>{t('pay.uploading', { percent: Math.round(progress * 100) })}</Text>}
            <Action label={t('pay.iPaid')} kind="accent" icon="checkmark-circle" onPress={() => run(() => market.directAction(token as string, bookingId, 'paid', receipt ? { proofFileId: receipt.fileId } : {}))} disabled={busy} />
          </Card>
        )}

        {(v.canConfirm || v.canMarkNotReceived || v.canWaive) && (
          <Card style={{ gap: spacing.sm }}>
            {v.canConfirm && <Action label={t('pay.received')} kind="accent" icon="checkmark-circle" onPress={() => run(() => market.directAction(token as string, bookingId, 'received'))} disabled={busy} />}
            {v.canMarkNotReceived && <Action label={t('pay.notReceived')} kind="outline" onPress={() => run(() => market.directAction(token as string, bookingId, 'not-received'))} />}
            {v.canWaive && <Action label={t('pay.waive')} kind="outline" onPress={() => run(() => market.directAction(token as string, bookingId, 'waive'))} />}
          </Card>
        )}
        <Text style={styles.help}>{t('pay.disclaimer')}</Text>
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { alignItems: 'center', gap: 8, paddingVertical: spacing.sm },
  amount: { fontSize: 38, fontWeight: '800', color: colors.text },
  cur: { fontSize: 18, color: colors.textMuted, fontWeight: '600' },
  help: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  err: { color: colors.danger, textAlign: 'center' },
  warnTitle: { fontWeight: '800', color: colors.danger },
  warnText: { color: colors.text, lineHeight: 20 },
  stepTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  step: { color: colors.text, lineHeight: 21 },
  scam: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  showLink: { color: colors.primary, fontWeight: '700' },
  scamText: { color: colors.danger, fontWeight: '700' },
});
