import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { useRealtime } from '../../../src/lib/realtime';
import { t } from '../../../src/i18n';
import { Bubble, Composer } from '../../../src/chat/chat-ui';
import { ChatMessage, market } from '../../../src/market/marketApi';
import { useKeyboardPadding } from '../../../src/lib/keyboard';
import { ConnectionStrip, onReconnect } from '../../../src/lib/connection';
import { colors, spacing } from '../../../src/theme/colors';
import { Sheet } from '../../../src/ui/Sheet';

const POLL_MS = 15000; // safety net only: new messages arrive instantly over the live connection

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'CONTACT_INFO_NOT_ALLOWED') return t('chat.contactBlocked');
    if (e.code === 'GUARDIAN_REQUIRED') return t('chat.guardianRequired');
    if (e.code === 'BLOCKED') return t('chat.blocked');
    return e.message;
  }
  return t('common.error');
}

/** Direct chat in the Telegram / Instagram style: bubbles, ticks (sent, delivered, read in blue), photos and files. Block and report are in the menu. */
export default function ThreadScreen() {
  const { token } = useAuth();
  const kb = useKeyboardPadding();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'offline'>('loading');
  const [readOnly, setReadOnly] = useState(false);
  const [title, setTitle] = useState('');
  const [req, setReq] = useState<{ status?: string; mine?: boolean }>({});
  const [menu, setMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const last = useRef(0);
  const list = useRef<FlatList<ChatMessage>>(null);

  const load = useCallback(async (initial: boolean) => {
    if (!token) return;
    try {
      // After the first load we ask from 0 again so that tick changes (delivered, read) on my own messages show up too.
      const fresh = await market.messages(token, id, undefined);
      setMsgs((old) => (old.length === fresh.length && old.every((m, i) => m.id === fresh[i].id && m.state === fresh[i].state) ? old : fresh));
      const max = Math.max(0, ...fresh.map((m) => m.seq));
      if (max > last.current) {
        last.current = max;
        void market.markRead(token, id, max).catch(() => undefined);
      }
      setState('ready');
    } catch (e) {
      if (initial) setState(e instanceof ApiError && e.statusCode === 0 ? 'offline' : 'error');
    }
  }, [token, id]);

  useEffect(() => {
    void load(true);
    market.threads(token as string).then((l) => {
      const th = l.find((x) => x.id === id);
      setReadOnly(!!th?.readOnly);
      setTitle(th?.other.name ?? '');
      setReq({ status: th?.status, mine: th?.requestedByMe });
    }).catch(() => undefined);
    const timer = setInterval(() => void load(false), POLL_MS);
    return () => clearInterval(timer);
  }, [load, token, id]);
  useRealtime(['message', 'receipt', 'connect'], () => void load(false));

  // Messages go out through a small outbox: shown at once as "sending", marked "not sent" when the connection drops, and re-sent by themselves when it returns.
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const pendingRef = useRef<ChatMessage[]>([]);
  pendingRef.current = pending;
  const deliver = async (tmp: ChatMessage) => {
    setPending((p) => p.map((x) => (x.id === tmp.id ? { ...x, state: 'SENDING' as never } : x)));
    try {
      const m = await market.send(token as string, id, tmp.body, undefined, (tmp as ChatMessage & { replyToId?: string }).replyToId);
      last.current = Math.max(last.current, m.seq);
      setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
      setPending((p) => p.filter((x) => x.id !== tmp.id));
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 0) setPending((p) => p.map((x) => (x.id === tmp.id ? { ...x, state: 'FAILED' as never } : x)));
      else { setPending((p) => p.filter((x) => x.id !== tmp.id)); Alert.alert(t('common.error'), errorText(e)); }
    }
  };
  const jumpTo = (messageId: string) => {
    const idx = [...msgs, ...pending].findIndex((m) => m.id === messageId);
    if (idx >= 0) list.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: true });
  };
  const send = (text: string) => {
    const tmp = { id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, seq: 0, mine: true, from: 'STUDENT', body: text, createdAt: new Date().toISOString(), state: 'SENDING' as never, file: null } as ChatMessage;
    (tmp as ChatMessage & { replyToId?: string }).replyToId = replyTo?.id;
    tmp.replyTo = replyTo ? { id: replyTo.id, body: replyTo.body, hasFile: !!replyTo.file, deleted: false, mine: replyTo.mine, name: null } : null;
    setReplyTo(null);
    setPending((p) => [...p, tmp]);
    void deliver(tmp);
  };
  useEffect(() => onReconnect(() => pendingRef.current.filter((x) => (x.state as string) === 'FAILED').forEach((x) => void deliver(x))), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sendFile = async (fileId: string) => {
    try {
      const m = await market.send(token as string, id, '', fileId, replyTo?.id);
      setReplyTo(null);
      last.current = Math.max(last.current, m.seq);
      setMsgs((x) => [...x, m]);
    } catch (e) {
      throw new Error(errorText(e));
    }
  };
  const answer = (accept: boolean) => market.answerRequest(token as string, id, accept).then((r) => { if (accept) setReq({ status: 'ACTIVE' }); else { setReq({ status: 'DECLINED' }); router.back(); } return r; }).catch((e) => Alert.alert(t('common.error'), errorText(e)));
  const block = () => Alert.alert(t('chat.block'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('chat.block'), style: 'destructive', onPress: () => market.blockThread(token as string, id).then(() => Alert.alert(t('chat.blocked'))).catch(() => undefined) },
  ]);
  const report = () => market.reportThread(token as string, id, 'OTHER').then(() => Alert.alert(t('chat.report'), t('common.ok'))).catch((e) => Alert.alert(t('common.error'), errorText(e)));

  const header = (
    <Stack.Screen options={{
      headerShown: true, title: title || t('chat.title'), headerBackTitle: t('common.back'),
      headerRight: () => <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel={t('common.more')}><Ionicons name="ellipsis-vertical" size={22} color={colors.text} /></Pressable>,
    }} />
  );
  if (state === 'loading') return <View style={styles.root}>{header}<StateView state="loading" /></View>;
  if (state === 'error' || state === 'offline') return <View style={styles.root}>{header}<StateView state={state} onRetry={() => { setState('loading'); void load(true); }} /></View>;

  return (
    <View style={styles.root}>
      {header}
      <View style={{ flex: 1, paddingBottom: kb }}>
        <ConnectionStrip />
        {msgs.length + pending.length === 0 ? (
          <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={46} color={colors.textMuted} /><Text style={styles.emptyText}>{t('msg.noMessages')}</Text></View>
        ) : (
          <FlatList
            ref={list}
            data={[...msgs, ...pending]}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.sm, paddingBottom: spacing.md }}
            onScrollToIndexFailed={(info) => setTimeout(() => list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true }), 80)}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <Bubble
                token={token as string}
                mine={item.mine}
                body={item.body}
                at={item.createdAt}
                state={item.state as never}
                onRetry={() => void deliver(item)}
                replyTo={item.replyTo ? { id: item.replyTo.id, body: item.replyTo.body, author: item.replyTo.mine ? t('msg.you') : item.replyTo.name ?? title, deleted: item.replyTo.deleted, hasFile: item.replyTo.hasFile } : null}
                onQuotePress={() => item.replyTo && jumpTo(item.replyTo.id)}
                onSwipeReply={(item.state as string | undefined) === 'SENDING' || (item.state as string | undefined) === 'FAILED' ? undefined : () => setReplyTo(item)}
                onLongPress={() => ((item.state as string | undefined) === 'SENDING' || (item.state as string | undefined) === 'FAILED' ? undefined : setActionsFor(item))}
                file={item.file ? { id: item.file.id, name: item.file.name, size: item.file.sizeBytes, image: !!item.file.mime?.startsWith('image/') } : null}
              />
            )}
          />
        )}
        {req.status === 'REQUEST' && !req.mine && (
          <View style={styles.request}>
            <Text style={styles.requestText}>{t('dm.requestBanner', { name: title })}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => answer(false)} style={[styles.reqBtn, { backgroundColor: colors.neutralSoft }]}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('dm.decline')}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => answer(true)} style={[styles.reqBtn, { backgroundColor: colors.primary }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{t('dm.accept')}</Text></Pressable>
            </View>
          </View>
        )}
        {req.status === 'REQUEST' && req.mine && <Text style={styles.ro}>{t('dm.waiting')}</Text>}
        {readOnly || req.status === 'DECLINED' ? <Text style={styles.ro}>{t(req.status === 'DECLINED' ? 'dm.declined' : 'chat.readOnly')}</Text> : <Composer reply={replyTo ? { id: replyTo.id, body: replyTo.body, author: replyTo.mine ? t('msg.you') : title, hasFile: !!replyTo.file } : null} onCancelReply={() => setReplyTo(null)} keyboardOpen={kb > 0} token={token as string} placeholder={t('chat.placeholder')} onSend={send} onAttached={sendFile} />}
      </View>
      <Sheet visible={!!actionsFor} onClose={() => setActionsFor(null)} title={actionsFor?.body ? actionsFor.body.slice(0, 40) : undefined} actions={actionsFor ? [{ label: t('reply.action'), icon: 'arrow-undo' as const, onPress: () => setReplyTo(actionsFor) }] : []} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title={title} actions={[
        { label: t('chat.report'), icon: 'flag', onPress: report },
        { label: t('chat.block'), icon: 'ban', onPress: block, danger: true },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: colors.textMuted },
  request: { margin: spacing.sm, padding: spacing.md, borderRadius: 18, backgroundColor: colors.primarySoft, gap: 10 },
  requestText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  reqBtn: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ro: { color: colors.textMuted, textAlign: 'center', padding: spacing.md },
});
