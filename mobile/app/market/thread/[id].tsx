import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { ChatMessage, market } from '../../../src/market/marketApi';
import { colors, radius, spacing } from '../../../src/theme/colors';

const POLL_MS = 5000; // real vaqt kanali (socket.io) hali ulanmagan: oddiy so'rov (polling)

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const code = e.code;
    if (code === 'CONTACT_INFO_NOT_ALLOWED') return t('chat.contactBlocked');
    if (code === 'GUARDIAN_REQUIRED') return t('chat.guardianRequired');
    if (code === 'BLOCKED') return t('chat.blocked');
    return e.message;
  }
  return t('common.error');
}

export default function ThreadScreen() {
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'offline'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const last = useRef(0);

  const load = useCallback(async (initial: boolean) => {
    if (!token) return;
    try {
      const fresh = await market.messages(token, id, initial ? undefined : last.current);
      if (initial) setMsgs(fresh);
      else if (fresh.length) setMsgs((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
      const max = Math.max(last.current, ...fresh.map((m) => m.seq));
      if (max > last.current) {
        last.current = max;
        void market.markRead(token, id, max).catch(() => undefined); // faqat ishtirokchi; vasiy 403 oladi — e'tiborsiz
      }
      setState('ready');
    } catch (e) {
      if (initial) setState(e instanceof ApiError && e.statusCode === 0 ? 'offline' : 'error');
    }
  }, [token, id]);

  useEffect(() => {
    void load(true);
    market.threads(token as string).then((l) => setReadOnly(!!l.find((x) => x.id === id)?.readOnly)).catch(() => undefined);
    const timer = setInterval(() => void load(false), POLL_MS);
    return () => clearInterval(timer);
  }, [load, token, id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !token) return;
    setSending(true);
    setProblem(null);
    try {
      const m = await market.send(token, id, text);
      setDraft('');
      last.current = Math.max(last.current, m.seq);
      setMsgs((x) => [...x, m]);
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setSending(false);
    }
  };
  const block = () => Alert.alert(t('chat.block'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('chat.block'), style: 'destructive', onPress: () => market.blockThread(token as string, id).then(() => setProblem(t('chat.blocked'))).catch(() => undefined) },
  ]);
  const report = () => market.reportThread(token as string, id, 'OTHER').then(() => Alert.alert(t('chat.report'), t('common.ok'))).catch((e) => Alert.alert(t('common.error'), errorText(e)));

  const header = <Stack.Screen options={{ headerShown: true, title: t('chat.title'), headerBackTitle: t('common.back') }} />;
  if (state === 'loading') return <Screen>{header}<StateView state="loading" /></Screen>;
  if (state === 'error' || state === 'offline') return <Screen>{header}<StateView state={state} onRetry={() => { setState('loading'); void load(true); }} /></Screen>;

  const stateLabel = (s?: string) => (s === 'READ' ? t('chat.read') : s === 'DELIVERED' ? t('chat.delivered') : s === 'SENT' ? t('chat.sent') : '');
  return (
    <Screen>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {msgs.length === 0 ? <StateView state="empty" /> : (
          <FlatList
            data={msgs}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                {/* Matn HECH QACHON HTML sifatida emas, oddiy matn sifatida ko'rsatiladi */}
                <Text style={item.mine ? styles.mineText : undefined}>{item.body}{item.file ? `\n📎 ${item.file.name}` : ''}</Text>
                {item.mine && <Text style={styles.state}>{stateLabel(item.state)}</Text>}
              </View>
            )}
          />
        )}
        {!!problem && <Text style={styles.problem} accessibilityLiveRegion="polite">{problem}</Text>}
        {readOnly ? <Text style={styles.ro}>{t('chat.readOnly')}</Text> : (
          <View style={styles.composer}>
            <TextInput accessibilityLabel={t('chat.placeholder')} value={draft} onChangeText={setDraft} placeholder={t('chat.placeholder')} style={styles.input} maxLength={2000} multiline />
            <PrimaryButton title={t('chat.send')} onPress={send} loading={sending} disabled={!draft.trim()} />
          </View>
        )}
        <View style={styles.tools}>
          <PrimaryButton title={t('chat.report')} variant="outline" onPress={report} />
          <PrimaryButton title={t('chat.block')} variant="outline" onPress={block} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: spacing.sm, borderRadius: radius.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mineText: { color: colors.white },
  state: { fontSize: 10, color: colors.white, opacity: 0.8, textAlign: 'right', marginTop: 2 },
  composer: { gap: spacing.sm, paddingVertical: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, minHeight: 48, maxHeight: 120 },
  problem: { color: colors.danger, paddingVertical: spacing.xs },
  ro: { color: colors.textMuted, textAlign: 'center', padding: spacing.md },
  tools: { gap: spacing.sm, paddingBottom: spacing.sm },
});
