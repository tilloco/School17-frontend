import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

export type ViewState = 'loading' | 'empty' | 'error' | 'offline';

/** Yuklanmoqda / bo'sh / xato / oflayn holatlari uchun yagona, tushunarli ko'rinish. */
export function StateView({ state, message, onRetry }: { state: ViewState; message?: string; onRetry?: () => void }) {
  const text = message ?? t(state === 'loading' ? 'state.loading' : state === 'empty' ? 'state.empty' : state === 'offline' ? 'state.offline' : 'state.error');
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      {state === 'loading' && <ActivityIndicator color={colors.primary} />}
      <Text style={[styles.text, (state === 'error' || state === 'offline') && styles.err]}>{text}</Text>
      {onRetry && (state === 'error' || state === 'offline') && <PrimaryButton title={t('common.retry')} onPress={onRetry} variant="outline" />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  text: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  err: { color: colors.danger },
});
