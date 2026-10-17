import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from './api';
import { Text } from '../ui/Text';
import { t } from '../i18n';
import { spacing } from '../theme/colors';

export type Quality = 'great' | 'good' | 'fair' | 'poor' | 'offline';
interface Conn { online: boolean; rtt: number | null; quality: Quality; lastOnlineChange: number }

const QUALITY_COLOR: Record<Quality, string> = { great: '#34C759', good: '#7BD16A', fair: '#FF9500', poor: '#FF3B30', offline: '#FF3B30' };
export const qualityColor = (q: Quality) => QUALITY_COLOR[q];
const qualityOf = (rtt: number | null): Quality => (rtt === null ? 'offline' : rtt < 150 ? 'great' : rtt < 400 ? 'good' : rtt < 900 ? 'fair' : 'poor');

const Ctx = createContext<Conn>({ online: true, rtt: null, quality: 'good', lastOnlineChange: 0 });
export const useConnection = () => useContext(Ctx);

const listeners = new Set<() => void>();
/** Runs `cb` every time the connection comes back after having been lost (returns the unsubscribe function). */
export const onReconnect = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Measures the round trip to the server every few seconds (and when the app comes back to the front). Three failures in a row = offline. */
export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [conn, setConn] = useState<Conn>({ online: true, rtt: null, quality: 'good', lastOnlineChange: 0 });
  const fails = useRef(0);
  const wasOnline = useRef(true);
  const samples = useRef<number[]>([]);

  const probe = useCallback(async () => {
    const started = Date.now();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(`${API_URL}/ping`, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } });
      if (!r.ok) throw new Error('bad');
      fails.current = 0;
      samples.current = [...samples.current.slice(-3), Date.now() - started];
      const avg = Math.round(samples.current.reduce((a, b) => a + b, 0) / samples.current.length);
      setConn((c) => ({ online: true, rtt: avg, quality: qualityOf(avg), lastOnlineChange: c.online ? c.lastOnlineChange : Date.now() }));
      if (!wasOnline.current) { wasOnline.current = true; listeners.forEach((l) => l()); }
    } catch (e) {
      fails.current += 1;
      if (fails.current >= 2) {
        wasOnline.current = false;
        setConn((c) => ({ online: false, rtt: null, quality: 'offline', lastOnlineChange: c.online ? Date.now() : c.lastOnlineChange }));
      }
    } finally {
      clearTimeout(to);
    }
  }, []);

  useEffect(() => {
    void probe();
    const timer = setInterval(() => void probe(), 5000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void probe(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [probe]);

  return <Ctx.Provider value={conn}>{children}</Ctx.Provider>;
}

/** A slim strip at the top of a screen: orange "Reconnecting…" while the server cannot be reached, green "Back online" for two seconds after. It sits in the page (not on top of it) so nothing can hide it. */
export function ConnectionStrip() {
  const { online } = useConnection();
  const [mode, setMode] = useState<'hidden' | 'offline' | 'back'>('hidden');
  const was = useRef(true);
  useEffect(() => {
    if (!online) { was.current = false; setMode('offline'); return; }
    if (!was.current) { was.current = true; setMode('back'); const id = setTimeout(() => setMode('hidden'), 2200); return () => clearTimeout(id); }
  }, [online]);
  if (mode === 'hidden') return null;
  return (
    <View style={[styles.strip, { backgroundColor: mode === 'back' ? '#34C759' : '#FF9500' }]} accessibilityLiveRegion="polite">
      <Ionicons name={mode === 'back' ? 'checkmark-circle' : 'cloud-offline'} size={16} color="#fff" />
      <Text style={styles.text}>{t(mode === 'back' ? 'net.back' : 'net.lost')}</Text>
    </View>
  );
}

/** Signal bars + a word (great / good / low / poor), green when strong and red when weak. */
export function SignalPill({ compact }: { compact?: boolean }) {
  const { quality, rtt } = useConnection();
  const color = qualityColor(quality);
  const level = quality === 'great' ? 4 : quality === 'good' ? 3 : quality === 'fair' ? 2 : quality === 'poor' ? 1 : 0;
  return (
    <View style={[styles.sig, { borderColor: color }]} accessibilityLabel={`${t(`net.q.${quality}`)}${rtt ? ` ${rtt} ms` : ''}`}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => <View key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 1.5, backgroundColor: i <= level ? color : 'rgba(128,128,128,0.35)' }} />)}
      </View>
      {!compact && <Text style={[styles.sigText, { color }]}>{t(`net.q.${quality}`)}{rtt ? ` · ${rtt} ms` : ''}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7 },
  text: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 2 },
  sig: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, marginHorizontal: spacing.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  sigText: { fontSize: 12, fontWeight: '700' },
});
