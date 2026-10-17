import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { ClassMsg, ClassQuestionItem, market } from '../../../src/market/marketApi';
import { colors, radius, spacing } from '../../../src/theme/colors';

const POLL_MS = 2500; // polling fallback; the realtime channel pushes class:message / class:question events when connected

function errText(e: unknown): string {
  if (!(e instanceof ApiError)) return t('state.error');
  const m: Record<string, string> = {
    RATE_LIMIT: 'cchat.rate', SLOW_MODE: 'cchat.slow', MUTED: 'cchat.muted', CHAT_OFF: 'cchat.off', CHAT_QUESTIONS_ONLY: 'cchat.questionsOnly',
    QUESTIONS_OFF: 'cchat.questionsOff', CONTACT_INFO_NOT_ALLOWED: 'cchat.contact', NOT_OPEN: 'cchat.notOpen', REMOVED_FROM_SESSION: 'room.removed', ALREADY_VOTED: 'cchat.voted',
  };
  return e.code && m[e.code] ? t(m[e.code]) : e.message;
}

/** Class chat + question queue (pupils) and moderation (teacher). */
export default function ClassChatScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { token } = useAuth();
  const [tab, setTab] = useState<'chat' | 'questions'>('chat');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [role, setRole] = useState<'teacher' | 'pupil'>('pupil');
  const [msgs, setMsgs] = useState<ClassMsg[]>([]);
  const [qs, setQs] = useState<ClassQuestionItem[]>([]);
  const [draft, setDraft] = useState('');
  const [anon, setAnon] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const last = useRef(0);

  const load = useCallback(async () => {
    try {
      const [st, fresh, questions] = await Promise.all([market.roomState(token as string, sid), market.classMessages(token as string, sid, last.current || undefined), market.classQuestions(token as string, sid)]);
      setRole(st.role);
      if (fresh.length) {
        last.current = Math.max(last.current, ...fresh.map((m) => m.seq));
        setMsgs((cur) => {
          const next = [...cur];
          for (const f of fresh) { const i = next.findIndex((x) => x.id === f.id); if (i >= 0) next[i] = f; else next.push(f); }
          return next;
        });
      }
      setQs(questions);
      setState('ready');
    } catch {
      setState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [token, sid]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setProblem(errText(e));
    }
  };
  const send = () => run(async () => {
    const text = draft.trim();
    if (!text) return;
    if (tab === 'chat') await market.classSend(token as string, sid, text);
    else await market.classAsk(token as string, sid, text, anon);
    setDraft('');
  });
  const report = (m: ClassMsg) => Alert.alert(t('cchat.report'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('cchat.report'), onPress: () => void market.classReportMessage(token as string, sid, m.id, 'ABUSE').then(() => Alert.alert(t('common.ok'))).catch((e) => Alert.alert(t('common.error'), errText(e))) },
  ]);

  const header = <Stack.Screen options={{ headerShown: true, title: t('cchat.title'), headerBackTitle: t('common.back') }} />;
  if (state !== 'ready') return <Screen>{header}<StateView state={state === 'error' ? 'error' : 'loading'} onRetry={load} /></Screen>;
  const teacher = role === 'teacher';
  return (
    <Screen>
      {header}
      <View style={styles.tabs}>
        <PrimaryButton title={t('cchat.chat')} variant={tab === 'chat' ? 'primary' : 'outline'} onPress={() => setTab('chat')} />
        <PrimaryButton title={t('cchat.questions')} variant={tab === 'questions' ? 'primary' : 'outline'} onPress={() => setTab('questions')} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {tab === 'chat' ? (
          <FlatList
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: spacing.sm, gap: spacing.xs }}
            ListEmptyComponent={<Text style={styles.help}>{t('cchat.noMessages')}</Text>}
            renderItem={({ item: m }) => (
              <View style={styles.card}>
                <Text style={styles.strong}>{m.from === 'teacher' ? `${t('cchat.teacher')} · ` : ''}{m.name}</Text>
                <Text>{m.deleted ? t('cchat.deleted') : m.body}</Text>
                <View style={styles.row}>
                  {!m.deleted && !teacher && m.from !== 'teacher' && <PrimaryButton title={t('cchat.report')} variant="outline" onPress={() => report(m)} />}
                  {!m.deleted && teacher && <PrimaryButton title={t('cchat.delete')} variant="outline" onPress={() => void run(() => market.classDeleteMessage(token as string, sid, m.id))} />}
                </View>
              </View>
            )}
          />
        ) : (
          <FlatList
            data={qs}
            keyExtractor={(q) => q.id}
            contentContainerStyle={{ paddingVertical: spacing.sm, gap: spacing.xs }}
            ListEmptyComponent={<Text style={styles.help}>{t('cchat.noQuestions')}</Text>}
            renderItem={({ item: q }) => (
              <View style={styles.card}>
                <Text style={styles.strong}>{q.pinned ? '📌 ' : ''}{q.author ?? t('cchat.anonymous')}{q.anonymous && teacher ? ` (${t('cchat.anonymous')})` : ''} · ▲ {q.upvotes}</Text>
                <Text>{q.text}</Text>
                {q.reply && <Text style={styles.help}>{t('cchat.teacher')}: {q.reply.text}</Text>}
                {q.status !== 'OPEN' && <Text style={styles.help}>{t(`cchat.status.${q.status}`)}</Text>}
                <View style={styles.row}>
                  {!teacher && !q.voted && !q.mine && <PrimaryButton title={t('cchat.upvote')} variant="outline" onPress={() => void run(() => market.classUpvote(token as string, sid, q.id))} />}
                  {teacher && (
                    <>
                      <PrimaryButton title={t('cchat.callOn')} variant="outline" onPress={() => void run(() => market.classQuestionAction(token as string, sid, q.id, 'call'))} />
                      <PrimaryButton title={t('cchat.markAnswered')} variant="outline" onPress={() => void run(() => market.classQuestionAction(token as string, sid, q.id, 'answer', { reply: draft.trim() || undefined }).then(() => setDraft('')))} />
                      <PrimaryButton title={t('cchat.later')} variant="outline" onPress={() => void run(() => market.classQuestionAction(token as string, sid, q.id, 'later'))} />
                      <PrimaryButton title={t(q.pinned ? 'cchat.unpin' : 'cchat.pin')} variant="outline" onPress={() => void run(() => market.classQuestionAction(token as string, sid, q.id, 'pin', { pinned: !q.pinned }))} />
                      <PrimaryButton title={t('cchat.hide')} variant="outline" onPress={() => void run(() => market.classQuestionAction(token as string, sid, q.id, 'hide'))} />
                    </>
                  )}
                </View>
              </View>
            )}
          />
        )}
        {!!problem && <Text style={styles.problem} accessibilityLiveRegion="polite">{problem}</Text>}
        {!(teacher && tab === 'questions') || true ? (
          <View style={{ gap: spacing.xs }}>
            {tab === 'questions' && !teacher && (
              <View style={styles.row}>
                <Switch value={anon} onValueChange={setAnon} accessibilityLabel={t('cchat.hideName')} />
                <Text>{t('cchat.hideName')}</Text>
              </View>
            )}
            {!(teacher && tab === 'questions') || draft ? null : <Text style={styles.help}>{t('cchat.replyHint')}</Text>}
            <TextInput value={draft} onChangeText={setDraft} multiline maxLength={tab === 'chat' ? 500 : 500} placeholderTextColor={colors.textMuted} placeholder={t(tab === 'chat' ? 'cchat.messagePlaceholder' : teacher ? 'cchat.replyPlaceholder' : 'cchat.questionPlaceholder')} accessibilityLabel={t('cchat.messagePlaceholder')} style={styles.input} />
            {!(teacher && tab === 'questions') && <PrimaryButton title={t(tab === 'chat' ? 'chat.send' : 'cchat.ask')} onPress={send} disabled={!draft.trim()} />}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 2 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  problem: { color: '#b00020' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
