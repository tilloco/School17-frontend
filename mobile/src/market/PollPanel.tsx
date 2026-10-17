import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { useRealtime } from '../lib/realtime';
import { PrimaryButton } from '../components/PrimaryButton';
import { ApiError } from '../lib/api';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';
import { market, PollView } from './marketApi';

const POLL_MS = 15000;

/** Live poll. Teacher: open (question + 2-6 options), see live counts, close. Pupil: vote once; results appear when the poll is closed. Nobody sees who voted for what. */
export function PollPanel({ token, sessionId, teacher }: { token: string; sessionId: string; teacher: boolean }) {
  const [poll, setPoll] = useState<PollView | null>(null);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const load = () => market.pollCurrent(token, sessionId).then((p) => setPoll(p && Array.isArray((p as PollView).options) ? p : null)).catch(() => undefined);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [token, sessionId]);
  useRealtime(['class:poll', 'connect'], () => void load());
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'POLL_OPEN' ? t('poll.alreadyOpen') : e.code === 'ALREADY_VOTED' ? t('cchat.voted') : e.code === 'POLL_CLOSED' ? t('poll.closedMsg') : e.message) : t('state.error'));

  const open = poll?.status === 'OPEN';
  const maxVotes = Math.max(1, ...(poll?.options.map((o) => o.votes ?? 0) ?? [0]));
  return (
    <View style={styles.card}>
      <Text style={styles.strong}>{t('poll.title')}</Text>
      {poll && (
        <>
          <Text style={styles.strong}>{poll.question}</Text>
          {poll.options.map((o, i) => (
            <View key={i} style={{ gap: 2 }}>
              {!teacher && open ? (
                <PrimaryButton title={`${poll.myVote === i ? '✓ ' : ''}${o.text}`} variant={poll.myVote === i ? 'primary' : 'outline'} disabled={poll.myVote !== null} onPress={() => market.pollVote(token, sessionId, poll.id, i).then(load).catch(fail)} />
              ) : (
                <>
                  <Text>{o.text}{o.votes !== undefined ? ` — ${o.votes}` : ''}{poll.myVote === i ? ' ✓' : ''}</Text>
                  {o.votes !== undefined && <View style={[styles.bar, { width: `${Math.round((o.votes / maxVotes) * 100)}%` }]} />}
                </>
              )}
            </View>
          ))}
          {poll.total !== undefined && <Text style={styles.help}>{t('poll.total', { n: poll.total })}</Text>}
          {!teacher && open && poll.myVote !== null && <Text style={styles.help}>{t('poll.voted')}</Text>}
          {!open && <Text style={styles.help}>{t('poll.closed')}</Text>}
          {teacher && open && <PrimaryButton title={t('poll.close')} variant="outline" onPress={() => market.pollClose(token, sessionId, poll.id).then(load).catch(fail)} />}
        </>
      )}
      {!poll && !teacher && <Text style={styles.help}>{t('poll.none')}</Text>}
      {teacher && !open && (
        <View style={{ gap: spacing.xs }}>
          <TextInput value={q} onChangeText={setQ} maxLength={200} placeholderTextColor={colors.textMuted} placeholder={t('poll.question')} accessibilityLabel={t('poll.question')} style={styles.input} />
          {opts.map((o, i) => (
            <TextInput key={i} value={o} onChangeText={(v) => setOpts((a) => a.map((x, j) => (j === i ? v : x)))} maxLength={100} placeholderTextColor={colors.textMuted} placeholder={t('poll.option', { n: i + 1 })} accessibilityLabel={t('poll.option', { n: i + 1 })} style={styles.input} />
          ))}
          <View style={styles.row}>
            {opts.length < 6 && <PrimaryButton title={t('poll.addOption')} variant="outline" onPress={() => setOpts((a) => [...a, ''])} />}
            <PrimaryButton title={t('poll.open')} disabled={!q.trim() || opts.filter((o) => o.trim()).length < 2} onPress={() => market.pollOpen(token, sessionId, q.trim(), opts.map((o) => o.trim()).filter(Boolean)).then(() => { setQ(''); setOpts(['', '']); load(); }).catch(fail)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
