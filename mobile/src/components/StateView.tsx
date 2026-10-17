import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

export type ViewState = 'loading' | 'empty' | 'error' | 'offline';

/** One clear look for loading / empty / error / offline. */
export function StateView({ state, message, onRetry }: { state: ViewState; message?: string; onRetry?: () => void }) {
  const text = message ?? t(state === 'loading' ? 'state.loading' : state === 'empty' ? 'state.empty' : state === 'offline' ? 'state.offline' : 'state.error');
  const bad = state === 'error' || state === 'offline';
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      {state === 'loading' ? <ActivityIndicator size="large" color={colors.primary} /> : (
        <View style={[styles.icon, { backgroundColor: bad ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons name={state === 'offline' ? 'cloud-offline' : bad ? 'alert-circle' : 'file-tray'} size={30} color={bad ? colors.danger : colors.primary} />
        </View>
      )}
      <Text style={[styles.text, bad && styles.err]}>{text}</Text>
      {onRetry && bad && <View style={{ alignSelf: 'stretch', paddingHorizontal: spacing.xl }}><PrimaryButton title={t('common.retry')} onPress={onRetry} variant="outline" /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  err: { color: colors.text },
});
