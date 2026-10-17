import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { PressScale } from '../ui/PressScale';
import { colors, spacing } from '../theme/colors';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

/** Main button: solid tint colour. The "outline" variant is a soft tinted button (no border), like iOS secondary buttons. */
export function PrimaryButton({ title, onPress, disabled, loading, variant = 'primary' }: Props) {
  const soft = variant === 'outline';
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.96}
      style={[styles.base, soft ? styles.soft : styles.solid, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={soft ? colors.primary : '#fff'} /> : <Text style={[styles.text, { color: soft ? colors.primary : '#fff' }]}>{title}</Text>}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 16, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  solid: { backgroundColor: colors.primary },
  soft: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.5 },
  text: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
});
