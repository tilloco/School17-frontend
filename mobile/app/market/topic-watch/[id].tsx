import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../src/ui/Text';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { colors, spacing } from '../../../src/theme/colors';

/** Only the player itself may load here. Anything else (the YouTube logo, "watch on YouTube", channel links) is blocked, so a pupil stays in the lesson. */
const ALLOWED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/|www\.youtube\.com\/(s\/player|youtubei|api\/stats|generate_204|ptracking|pagead)|[a-z0-9.-]*(ytimg\.com|googlevideo\.com|gstatic\.com|googleapis\.com|vimeocdn\.com|vimeo\.com|doubleclick\.net)\/)/i;

/** A video inside the app: a small page that holds the player, with the title, who it is from, a useful button and a way into the test. */
export default function TopicWatchScreen() {
  const { id, embed, title, slug, by, curated } = useLocalSearchParams<{ id: string; embed: string; title: string; slug: string; by?: string; curated?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ytError, setYtError] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [voted, setVoted] = useState(false);
  const [votes, setVotes] = useState<number | null>(null);

  // The embed address is built by our server; still, refuse anything that is not an https player address.
  const uri = useMemo(() => (embed && /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//.test(embed) ? embed : null), [embed]);
  const isYoutube = !!uri && uri.includes('youtube-nocookie.com');
  const youtubeId = isYoutube ? /\/embed\/([\w-]{6,20})/.exec(uri as string)?.[1] ?? null : null;
  // enablejsapi lets the player tell us when it is ready or why it cannot play (embedding switched off, video removed...)
  const src = useMemo(() => (uri && isYoutube ? `${uri}${uri.includes('?') ? '&' : '?'}enablejsapi=1&origin=${encodeURIComponent('https://school17.app')}` : uri), [uri, isYoutube]);
  const html = useMemo(() => (src ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head><body><iframe id="p" src="${src}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><script>var f=document.getElementById('p');function out(m){try{window.ReactNativeWebView.postMessage(m)}catch(e){}}window.addEventListener('message',function(e){if(typeof e.data==='string')out(e.data)});f.addEventListener('load',function(){out('{"event":"frameLoaded"}');try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*')}catch(e){}});</script></body></html>` : ''), [src]);

  // A YouTube player that has not said "ready" after 15 seconds is not going to: show the reason and a way out instead of a spinner.
  useEffect(() => {
    if (!isYoutube || failed || ytError !== null || !loading) return;
    const timer = setTimeout(() => setYtError(-1), 15000);
    return () => clearTimeout(timer);
  }, [isYoutube, failed, ytError, loading, tries]);
  const onPlayerMessage = (raw: string) => {
    try {
      const m = JSON.parse(raw) as { event?: string; info?: unknown };
      if (m.event === 'onReady' || m.event === 'infoDelivery') setLoading(false);
      if (m.event === 'onError') setYtError(Number(m.info) || -1);
    } catch { /* not a player message */ }
  };
  const errorText = ytError === 100 ? t('topic.removed') : ytError === 101 || ytError === 150 || ytError === 153 ? t('topic.embedBlocked') : t('topic.cannotPlay');

  const vote = async () => {
    try {
      const r = await market.voteVideo(token as string, id);
      setVoted(r.voted);
      setVotes(r.votes);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError && e.statusCode === 403 ? t('topic.ownVideo') : t('state.error'));
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: t('common.back'), headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }} />
      <View style={styles.player}>
        {uri && !failed && ytError === null ? (
          <WebView
            key={tries}
            source={{ html, baseUrl: 'https://school17.app' }}
            onMessage={(ev) => onPlayerMessage(ev.nativeEvent.data)}
            style={styles.web}
            originWhitelist={['https://*', 'about:blank']}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            onLoadEnd={() => { if (!isYoutube) setLoading(false); }}
            onError={() => { setFailed(true); setLoading(false); }}
            onHttpError={() => undefined}
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('https://school17.app') || ALLOWED.test(r.url)}
          />
        ) : (
          <View style={styles.fail}>
            <Ionicons name="cloud-offline-outline" size={34} color="#fff" />
            <Text style={styles.failText}>{errorText}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setYtError(null); setLoading(true); setTries((n) => n + 1); }} style={styles.retry}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable>
              {!!youtubeId && <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${youtubeId}`)} style={[styles.retry, { backgroundColor: '#FF0033' }]}><Text style={styles.retryText}>{t('topic.openYoutube')}</Text></Pressable>}
            </View>
          </View>
        )}
        {loading && uri && !failed && ytError === null && <View style={styles.spin} pointerEvents="none"><ActivityIndicator color="#fff" /></View>}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.title}>{title}</Text>
        {!!by && <View style={styles.by}><Ionicons name={curated === '1' ? 'shield-checkmark' : 'person-circle-outline'} size={16} color={curated === '1' ? '#1D9BF0' : colors.textMuted} /><Text style={styles.byText} numberOfLines={1}>{curated === '1' ? `${t('topic.picked')} · ${by}` : by}</Text></View>}
        <Pressable accessibilityRole="button" accessibilityState={{ selected: voted }} onPress={() => void vote()} style={[styles.useful, voted && { backgroundColor: colors.primary }]}>
          <Ionicons name={voted ? 'thumbs-up' : 'thumbs-up-outline'} size={20} color={voted ? '#fff' : colors.primary} />
          <Text style={[styles.usefulText, voted && { color: '#fff' }]}>{t('topic.vote')}{votes !== null ? ` · ${votes}` : ''}</Text>
        </Pressable>
      </ScrollView>
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
  body: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, lineHeight: 26 },
  by: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  byText: { flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  useful: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft },
  usefulText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 16, backgroundColor: colors.primary },
  ctaTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 1 },
});
