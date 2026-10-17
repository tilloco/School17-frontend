import React, { useEffect, useState } from 'react';
import { Alert, AlertButton, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';

interface Spec { title: string; message?: string; buttons: AlertButton[] }
let show: ((s: Spec) => void) | null = null;
const queue: Spec[] = [];
const original = Alert.alert.bind(Alert);

/** Replaces the phone's plain system pop-ups with our own rounded, theme-aware dialog (same Alert.alert calls everywhere in the app). */
export function installDialog() {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const spec: Spec = { title, message, buttons: buttons?.length ? buttons : [{ text: t('common.ok') }] };
    if (show) show(spec);
    else queue.push(spec);
  };
}
export const systemAlert = original;

export function DialogHost() {
  const [spec, setSpec] = useState<Spec | null>(null);
  useEffect(() => {
    show = (s) => setSpec(s);
    const first = queue.shift();
    if (first) setSpec(first);
    return () => { show = null; };
  }, []);
  const close = (b?: AlertButton) => { setSpec(null); b?.onPress?.(); };
  const stacked = (spec?.buttons.length ?? 0) > 2;
  return (
    <Modal visible={!!spec} transparent animationType="fade" statusBarTranslucent onRequestClose={() => close(spec?.buttons.find((b) => b.style === 'cancel'))}>
      <Pressable style={styles.backdrop} onPress={() => { const c = spec?.buttons.find((b) => b.style === 'cancel'); if (c) close(c); }}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.body}>
            <Text style={styles.title}>{spec?.title}</Text>
            {!!spec?.message && <Text style={styles.message}>{spec.message}</Text>}
          </View>
          <View style={[styles.buttons, stacked && { flexDirection: 'column' }]}>
            {spec?.buttons.map((b, i) => (
              <Pressable key={i} accessibilityRole="button" onPress={() => close(b)} style={({ pressed }) => [styles.btn, !stacked && i > 0 && styles.divV, stacked && i > 0 && styles.divH, pressed && { backgroundColor: colors.neutralSoft }]}>
                <Text style={[styles.btnText, b.style === 'destructive' && { color: colors.danger }, b.style === 'cancel' && { color: colors.textMuted, fontWeight: '600' }]}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden' },
  body: { padding: spacing.lg, gap: 6, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  buttons: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  btn: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  divV: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  divH: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  btnText: { fontSize: 17, fontWeight: '700', color: colors.primary },
});
