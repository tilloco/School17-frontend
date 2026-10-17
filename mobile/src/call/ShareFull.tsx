import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import { QualityBadge, Video } from './CallStage';
import { FaceBubble } from './FaceBubble';
import type { CallMedia, LinkQuality } from './rtc';

/**
 * Full-screen viewer for a shared screen, like YouTube: the phone turns sideways, the shared screen fills it edge to edge,
 * the teacher's face becomes a small round picture in the top right corner. Double-tap (or the back button) returns to the lesson.
 */
export function ShareFull({ visible, media, quality, onClose, name = '', swapped = false, onSwap }: { swapped?: boolean; onSwap?: () => void; name?: string; visible: boolean; media: CallMedia; quality: LinkQuality; onClose: () => void }) {
  const last = useRef(0);
  const hint = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    let SO: typeof import('expo-screen-orientation') | null = null;
    try { SO = require('expo-screen-orientation'); void SO?.lockAsync(SO.OrientationLock.LANDSCAPE).catch((e: unknown) => console.warn('ORIENT_ERR', String(e))); } catch (e) { console.warn('ORIENT_ERR', String(e)); SO = null; }
    hint.setValue(1);
    Animated.timing(hint, { toValue: 0, duration: 2200, delay: 1800, useNativeDriver: true }).start();
    return () => { try { void SO?.lockAsync(SO.OrientationLock.PORTRAIT_UP); } catch { /* ignore */ } };
  }, [visible, hint]);

  const tap = () => {
    const now = Date.now();
    if (now - last.current < 350) { last.current = 0; onClose(); } else last.current = now;
  };
  return (
    <Modal visible={visible} animationType="fade" supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']} statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={tap} accessibilityLabel={t('share.exitFull')}>
          <Video track={swapped ? media.remoteCamera : media.remoteScreen} style={StyleSheet.absoluteFill} cover={swapped} />
        </Pressable>
        <FaceBubble track={swapped ? media.remoteScreen : media.remoteCamera} name={name} size={64} inset={14} rect={swapped} onPress={onSwap} />
        <View style={styles.badge} pointerEvents="box-none"><QualityBadge q={quality} /></View>
        <Animated.View style={[styles.toast, { opacity: hint }]} pointerEvents="none">
          <Ionicons name="contract" size={14} color="#fff" /><Text style={styles.toastText}>{t('share.doubleTapExit')}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  face: { position: 'absolute', top: 14, right: 14, width: 64, height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: '#111' },
  faceVideo: { flex: 1 },
  badge: { position: 'absolute', top: 18, alignSelf: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
