import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { API_URL } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { CLASS_QUALITY, precheckVerdict, PrecheckVerdict } from '../../src/call/class-quality';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

interface Result extends PrecheckVerdict { downMbps: number; upMbps: number | null; rttMs: number; mic: boolean }

/** Pre-call check: microphone permission + a 5 s network test (download, round trip, and upload for teachers). Device picker / level meter need the media SDK (development build). */
export default function PrecheckScreen() {
  const { token } = useAuth();
  const me = useAsync(() => market.me(token as string), [token]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const isTeacher = me.data?.role === 'TEACHER';

  const run = async () => {
    setBusy(true);
    setFailed(false);
    setRes(null);
    try {
      const mic = (await requestRecordingPermissionsAsync()).granted;
      const auth = { authorization: `Bearer ${token}` };
      // RTT: median of 3 tiny requests
      const rtts: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        await fetch(`${API_URL}/netcheck/up`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ pad: 'x' }) });
        rtts.push(Date.now() - t0);
      }
      rtts.sort((a, b) => a - b);
      const half = CLASS_QUALITY.precheck.durationMs / (isTeacher ? 2 : 1);
      let bytes = 0;
      const d0 = Date.now();
      while (Date.now() - d0 < half) {
        const r = await fetch(`${API_URL}/netcheck/down`, { headers: auth });
        bytes += (await r.arrayBuffer()).byteLength;
      }
      const downMbps = (bytes * 8) / 1e6 / ((Date.now() - d0) / 1000);
      let upMbps: number | null = null;
      if (isTeacher) {
        const pad = 'a'.repeat(60_000);
        let sent = 0;
        const u0 = Date.now();
        while (Date.now() - u0 < half) {
          await fetch(`${API_URL}/netcheck/up`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ pad }) });
          sent += pad.length;
        }
        upMbps = (sent * 8) / 1e6 / ((Date.now() - u0) / 1000);
      }
      const rttMs = rtts[1];
      setRes({ ...precheckVerdict({ downMbps, upMbps, rttMs, isTeacher }), downMbps, upMbps, rttMs, mic });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('pre.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <Text style={styles.help}>{t('pre.help')}</Text>
        <PrimaryButton title={t('pre.run')} onPress={run} loading={busy} />
        {failed && <Text accessibilityLiveRegion="polite" style={styles.bad}>{t('pre.failed')}</Text>}
        {res && (
          <View style={styles.card} accessibilityLiveRegion="polite">
            <Text style={styles.strong}>{t(`pre.verdict.${res.verdict}`)}</Text>
            <Text>{t('pre.numbers', { down: res.downMbps.toFixed(1), rtt: Math.round(res.rttMs) })}{res.upMbps !== null ? ` · ${t('pre.up', { up: res.upMbps.toFixed(1) })}` : ''}</Text>
            <Text>{t(res.mic ? 'pre.micOk' : 'pre.micDenied')}</Text>
            {res.teacherUploadLow && <Text style={styles.bad}>{t('pre.uploadLow', { min: CLASS_QUALITY.precheck.minTeacherUpMbps })}</Text>}
            {res.verdict !== 'good' && <Text style={styles.help}>{t('pre.advice')}</Text>}
          </View>
        )}
        <Text style={styles.help}>{t('pre.deviceNote')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  strong: { fontWeight: '700', color: colors.text, fontSize: 16 },
  help: { color: colors.textMuted, fontSize: 13 },
  bad: { color: '#b00020' },
});
