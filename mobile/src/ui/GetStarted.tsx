import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';

export interface Step { key: string; label: string; done: boolean; onPress: () => void }
const HIDE = (role: string) => `school17_getstarted_hidden_${role}`;

/** A short "get started" list for new people. Disappears when every step is done, or when it is dismissed. */
export function GetStarted({ role, steps }: { role: string; steps: Step[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { SecureStore.getItemAsync(HIDE(role)).then((v) => setHidden(!!v)).catch(() => setHidden(false)); }, [role]);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  const close = () => { setHidden(true); void SecureStore.setItemAsync(HIDE(role), '1').catch(() => undefined); };
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('start.title')}</Text>
          <Text style={styles.sub}>{t('start.progress', { a: done, b: steps.length })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={close} hitSlop={10}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
      </View>
      <View style={styles.bar}><View style={[styles.fill, { width: `${(done / steps.length) * 100}%` }]} /></View>
      {steps.map((s) => (
        <Pressable key={s.key} accessibilityRole="button" onPress={s.onPress} disabled={s.done} style={styles.row}>
          <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={s.done ? '#2ED573' : colors.textMuted} />
          <Text style={[styles.label, s.done && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>{s.label}</Text>
          {!s.done && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primarySoft, borderRadius: 22, padding: spacing.md, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
