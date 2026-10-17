import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { PrimaryButton } from '../components/PrimaryButton';
import { ApiError } from '../lib/api';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';
import { market } from './marketApi';

export interface Gate { required: boolean; ok: boolean; paymentId?: string | null; status?: string; amountMinor?: number; teacherId?: string }

/** Shown to a pupil whose class needs a confirmed payment before joining: plain explanation, card details on request, "I paid" mark. The app moves no money. */
export function ClassPayGate({ token, gate, onChanged }: { token: string; gate: Gate; onChanged: () => void }) {
  if (!gate.required || gate.ok) return null;
  const showCard = async () => {
    try {
      const c = await market.revealCard(token, gate.teacherId as string);
      Alert.alert(t('cpay.card'), `${c.cardNumber}\n${c.holderName}`);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  const paid = async () => {
    try {
      await market.classPaid(token, gate.paymentId as string);
      onChanged();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.strong}>{t('cpay.title')}</Text>
      <Text>{t('cpay.explain', { sum: Math.round((gate.amountMinor ?? 0) / 100).toLocaleString() })}</Text>
      <Text style={styles.help}>{t('free.notice')}</Text>
      {gate.status === 'PUPIL_MARKED_PAID' ? <Text>{t('cpay.waitingConfirm')}</Text> : null}
      <View style={styles.row}>
        {gate.teacherId && <PrimaryButton title={t('cpay.showCard')} variant="outline" onPress={showCard} />}
        {gate.paymentId && gate.status !== 'PUPIL_MARKED_PAID' && <PrimaryButton title={t('cpay.iPaid')} onPress={paid} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
