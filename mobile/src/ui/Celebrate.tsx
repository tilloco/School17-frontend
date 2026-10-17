import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { t } from '../i18n';
import { colors } from '../theme/colors';

const PIECES = 26;
const PALETTE = ['#1A8CFF', '#2ED573', '#FF8A00', '#A55EEA', '#FF6B6B', '#F5B301'];

/** A short, friendly win moment: confetti falls once and a small card says what was achieved. Closes by itself. */
export function Celebrate({ visible, title, text, icon = 'sparkles', onClose }: { visible: boolean; title: string; text?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; onClose: () => void }) {
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    x: (i / PIECES) * width + Math.random() * 18, size: 8 + Math.random() * 8, color: PALETTE[i % PALETTE.length], delay: Math.random() * 450, spin: Math.random() > 0.5 ? 1 : -1, dur: 1500 + Math.random() * 900,
  })), [width, visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const fall = useRef(pieces.map(() => new Animated.Value(0))).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    fall.forEach((v, i) => { v.setValue(0); Animated.timing(v, { toValue: 1, duration: pieces[i].dur, delay: pieces[i].delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(); });
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.root} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        {pieces.map((p, i) => (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', top: -20, left: p.x, width: p.size, height: p.size * 0.6, backgroundColor: p.color, borderRadius: 2, opacity: fall[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: fall[i].interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) }, { rotate: fall[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${720 * p.spin}deg`] }) }] }} />
        ))}
        <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
          <View style={styles.badge}><Ionicons name={icon} size={34} color="#fff" /></View>
          <Text style={styles.title}>{title}</Text>
          {!!text && <Text style={styles.text}>{text}</Text>}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 28, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 8, width: '100%', maxWidth: 340 },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  text: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
});
