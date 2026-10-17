import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { t } from '../i18n';
import { fmtDayShort, fmtTime } from './format';
import { colors, spacing } from '../theme/colors';

export interface PinnedItem { id: string; body: string; at: string; fileName?: string | null; image?: boolean }

const preview = (p: PinnedItem) => (p.body.trim() ? p.body.trim().replace(/\s+/g, ' ') : p.fileName ? `📎 ${p.fileName}` : t('chat.photoOrFile'));

/**
 * A slim pinned-message strip under the header (one line, 46 px, it never covers the chat).
 * The left rail shows how many pins there are and which one you are on; a tap jumps to that message and moves to the next pin;
 * the list button opens all pins.
 */
export function PinnedBar({ items, index, onJump, onList, accent }: { items: PinnedItem[]; index: number; onJump: (p: PinnedItem) => void; onList: () => void; accent?: string }) {
  const ac = accent ?? colors.primary;
  const fade = useRef(new Animated.Value(1)).current;
  const cur = items[Math.min(index, items.length - 1)];
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [cur?.id, fade]);
  if (!cur) return null;
  const n = items.length;
  const segs = Math.min(n, 4);
  const active = n <= 4 ? Math.min(index, n - 1) : Math.min(3, Math.floor((index / Math.max(1, n - 1)) * 3));
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('pin.title')} onPress={() => onJump(cur)} style={styles.main}>
        <View style={styles.rail}>
          {Array.from({ length: segs }).map((_, i) => <View key={i} style={[styles.seg, { flex: 1 }, i === active && { backgroundColor: ac }]} />)}
        </View>
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <Text style={[styles.label, { color: ac }]} numberOfLines={1}>{n > 1 ? `${t('pin.title')} #${index + 1}` : t('pin.title')}</Text>
          <Text style={styles.text} numberOfLines={1}>{preview(cur)}</Text>
        </Animated.View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('pin.all')} onPress={onList} hitSlop={8} style={styles.listBtn}>
        <Ionicons name={n > 1 ? 'list' : 'pin'} size={20} color={ac} />
      </Pressable>
    </View>
  );
}

/** Bottom sheet with every pinned message (newest first). The teacher can unpin from here. */
export function PinsSheet({ visible, items, onClose, onJump, onUnpin }: { visible: boolean; items: PinnedItem[]; onClose: () => void; onJump: (p: PinnedItem) => void; onUnpin?: (p: PinnedItem) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} onPress={() => undefined}>
          <View style={styles.grip} />
          <View style={styles.sheetHead}>
            <Ionicons name="pin" size={18} color={colors.primary} />
            <Text style={styles.sheetTitle}>{t('pin.all')}</Text>
            <Text style={styles.count}>{items.length}</Text>
          </View>
          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {items.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => { onClose(); onJump(p); }} style={styles.row}>
                <View style={styles.dot}><Ionicons name={p.image ? 'image' : p.fileName ? 'document-text' : 'chatbubble'} size={16} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText} numberOfLines={2}>{preview(p)}</Text>
                  <Text style={styles.rowMeta}>{fmtDayShort(p.at)} · {fmtTime(p.at)}</Text>
                </View>
                {onUnpin && (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('pin.unpin')} onPress={() => onUnpin(p)} hitSlop={8} style={styles.unpin}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', height: 46, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingLeft: spacing.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: '100%' },
  rail: { width: 3, height: 30, borderRadius: 2, overflow: 'hidden', gap: 2 },
  seg: { backgroundColor: colors.primarySoft, borderRadius: 2 },
  segOn: { backgroundColor: colors.primary },
  label: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  text: { color: colors.text, fontSize: 14 },
  listBtn: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: spacing.md, paddingTop: 10 },
  grip: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: spacing.sm },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  count: { color: colors.textMuted, fontWeight: '700', backgroundColor: colors.neutralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rowText: { color: colors.text, fontSize: 15 },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  unpin: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
});
