import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Text } from '../ui/Text';
import { t } from '../i18n';

const SEEN = 'school17_clean_hint_seen';

/**
 * "Clean screen": one tap on the eye button hides every button and badge so only the picture is left;
 * a double tap anywhere brings them back. The first time, a short hint explains both gestures.
 */
export function useCleanScreen() {
  const [clean, setClean] = useState(false);
  const [hint, setHint] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    SecureStore.getItemAsync(SEEN).then((v) => { if (!v) setHint(true); }).catch(() => undefined);
  }, []);
  const dismissHint = () => { setHint(false); void SecureStore.setItemAsync(SEEN, '1').catch(() => undefined); };
  const enter = () => { setClean(true); if (hint) dismissHint(); };
  /** goes on the full-screen layer that exists only in clean mode */
  const onTap = () => {
    const now = Date.now();
    if (now - last.current < 350) { setClean(false); last.current = 0; } else last.current = now;
  };
  return { clean, enter, onTap, hint, dismissHint };
}

/** Covers the picture in clean mode and catches the double tap. */
export function CleanCatcher({ onTap, show }: { onTap: () => void; show: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!show) return;
    fade.setValue(1);
    Animated.timing(fade, { toValue: 0, duration: 2600, delay: 1200, useNativeDriver: true }).start();
  }, [show, fade]);
  if (!show) return null;
  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityLabel={t('clean.restore')}>
      <Animated.View style={[styles.toast, { opacity: fade }]} pointerEvents="none">
        <Ionicons name="hand-left" size={14} color="#fff" />
        <Text style={styles.toastText}>{t('clean.doubleTap')}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** First-time tip shown above the controls. */
export function CleanHint({ show, onClose }: { show: boolean; onClose: () => void }) {
  if (!show) return null;
  return (
    <Pressable onPress={onClose} style={styles.hint} accessibilityRole="button">
      <Ionicons name="eye-off" size={18} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.hintTitle}>{t('clean.hintTitle')}</Text>
        <Text style={styles.hintText}>{t('clean.hintText')}</Text>
      </View>
      <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', bottom: 40, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hint: { position: 'absolute', left: 12, right: 12, bottom: 120, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,132,255,0.95)', borderRadius: 18, padding: 12 },
  hintTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hintText: { color: 'rgba(255,255,255,0.92)', fontSize: 12, marginTop: 2 },
});
