import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';

const SEEN = 'school17_intro_seen_v1';
const SLIDES: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { icon: 'chatbubbles', color: '#1A8CFF' },
  { icon: 'videocam', color: '#6C4DFF' },
  { icon: 'trophy', color: '#FF9F1A' },
  { icon: 'shield-checkmark', color: '#2ED573' },
];

/** Four short cards shown once to a new user: what the app is and how to use the main parts. */
export function Intro() {
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    SecureStore.getItemAsync(SEEN).then((v) => { if (!v) setVisible(true); }).catch(() => undefined);
  }, []);
  const close = () => { setVisible(false); void SecureStore.setItemAsync(SEEN, '1').catch(() => undefined); };
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 }]}>
        <Pressable accessibilityRole="button" onPress={close} hitSlop={12} style={styles.skip}><Text style={styles.skipText}>{t('intro.skip')}</Text></Pressable>
        <View style={styles.center}>
          <View style={[styles.icon, { backgroundColor: s.color }]}><Ionicons name={s.icon} size={54} color="#fff" /></View>
          <Text style={styles.title}>{t(`intro.${i + 1}.title`)}</Text>
          <Text style={styles.text}>{t(`intro.${i + 1}.text`)}</Text>
        </View>
        <View style={styles.dots}>{SLIDES.map((_, k) => <View key={k} style={[styles.dot, k === i && { backgroundColor: s.color, width: 22 }]} />)}</View>
        <Pressable accessibilityRole="button" onPress={() => (last ? close() : setI(i + 1))} style={[styles.btn, { backgroundColor: s.color }]}>
          <Text style={styles.btnText}>{last ? t('intro.start') : t('intro.next')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  skip: { alignSelf: 'flex-end', padding: 6 },
  skipText: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  icon: { width: 118, height: 118, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 24, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  btn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
