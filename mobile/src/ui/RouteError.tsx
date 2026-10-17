import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';

/** Used as `export { RouteError as ErrorBoundary }` in a screen: a crash shows this card with a retry button, never a blank screen. */
export function RouteError({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('state.error')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.btn}><Text style={styles.btnText}>{t('common.retry')}</Text></Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  btnText: { color: '#fff', fontWeight: '800' },
});
