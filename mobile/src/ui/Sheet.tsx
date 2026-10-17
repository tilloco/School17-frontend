import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';
import type { IconName } from './index';

export interface SheetAction { label: string; icon: IconName; onPress: () => void; danger?: boolean }

/** Bottom sheet with a short list of actions. Rarely used and risky actions (delete, leave) go in here, away from the main screens. */
export function Sheet({ visible, onClose, title, actions }: { visible: boolean; onClose: () => void; title?: string; actions: SheetAction[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')}>
        <Pressable style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} onPress={() => undefined}>
          <View style={styles.grip} />
          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {actions.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={() => { onClose(); a.onPress(); }} style={styles.row}>
              <Ionicons name={a.icon} size={22} color={a.danger ? colors.danger : colors.primary} />
              <Text style={[styles.label, a.danger && { color: colors.danger }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  title: { fontSize: 13, color: colors.textMuted, marginBottom: 4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 4 },
  label: { fontSize: 17, color: colors.text, fontWeight: '500' },
});
