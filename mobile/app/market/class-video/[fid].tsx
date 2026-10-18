import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from '../../../src/ui/Text';
import { API_URL } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { useClassProtect } from '../../../src/lib/protect';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { colors, spacing } from '../../../src/theme/colors';

/** A recorded lesson plays inside the app. The viewer's own name drifts over the picture, so a leaked screen recording points back to who made it; protected classes also block screen capture. */
export default function ClassVideoScreen() {
  const { fid, classId, title } = useLocalSearchParams<{ fid: string; classId: string; title?: string }>();
  const { token, user } = useAuth();
  useClassProtect(classId);
  const [src, setSrc] = useState<string | null>(null);
  const [mime, setMime] = useState('video/mp4');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);
  const [spot, setSpot] = useState({ top: 30, left: 12 });

  useEffect(() => {
    let alive = true;
    setFailed(false);
    market.classVideoUrl(token as string, classId, fid).then((r) => { if (alive) { setSrc(r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url); setMime(r.mime); } }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [token, classId, fid, tries]);
  // the watermark moves every few seconds so it cannot simply be cropped out
  useEffect(() => { const i = setInterval(() => setSpot({ top: 8 + Math.floor(Math.random() * 70), left: 4 + Math.floor(Math.random() * 40) }), 6000); return () => clearInterval(i); }, []);

  const html = useMemo(() => (src ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;background:#000}</style></head><body><video controls playsinline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture oncontextmenu="return false"><source src="${src.replace(/"/g, '&quot;')}" type="${mime}"></video></body></html>` : ''), [src, mime]);
  const mark = `${user?.name ?? ''} · ${(user?.id ?? '').slice(0, 4)}`;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: t('common.back'), headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }} />
      <View style={styles.player}>
        {src && !failed ? (
          <WebView key={tries} source={{ html, baseUrl: API_URL }} style={styles.web} originWhitelist={['*']} javaScriptEnabled domStorageEnabled allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} setSupportMultipleWindows={false} onLoadEnd={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} mixedContentMode="always" />
        ) : failed ? (
          <View style={styles.fail}>
            <Ionicons name="cloud-offline-outline" size={34} color="#fff" />
            <Text style={styles.failText}>{t('topic.cannotPlay')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setLoading(true); setTries((n) => n + 1); }} style={styles.retry}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable>
          </View>
        ) : null}
        {loading && !failed && <View style={styles.spin} pointerEvents="none"><ActivityIndicator color="#fff" /></View>}
        <View style={[styles.mark, { top: `${spot.top}%`, left: `${spot.left}%` }]} pointerEvents="none"><Text style={styles.markText}>{mark}</Text></View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{t('video.hint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  spin: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center' },
  fail: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  failText: { color: '#fff', textAlign: 'center', fontSize: 14 },
  retry: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '800' },
  mark: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  markText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '700' },
  info: { padding: spacing.md, gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
});
