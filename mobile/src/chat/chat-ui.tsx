import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../lib/api';
import { documentPicker, imagePicker } from '../lib/native';
import { t } from '../i18n';
import { market } from '../market/marketApi';
import { UploadError, uploadFile } from '../market/uploader';
import { uploadErrorText } from '../market/AttachBar';
import { colors, radius, spacing } from '../theme/colors';
import { fmtTime } from '../ui/format';
import { Avatar } from '../ui';
import { ChatTheme, themeOf } from '../theme/chatThemes';

export type DeliveryState = 'SENDING' | 'FAILED' | 'SENT' | 'DELIVERED' | 'READ' | undefined;
export interface ChatFile { id: string; name: string; size?: number; image?: boolean }

/** Telegram-style ticks: one grey tick = sent, two grey = delivered, two blue = read. */
export function Ticks({ state, onDark }: { state?: DeliveryState; onDark?: boolean }) {
  if (!state) return null;
  if (state === 'SENDING') return <Ionicons name="time-outline" size={14} color={onDark ? 'rgba(255,255,255,0.75)' : colors.textMuted} accessibilityLabel={t('chat.sending')} />;
  if (state === 'FAILED') return <Ionicons name="alert-circle" size={16} color="#FFD2CF" accessibilityLabel={t('chat.failed')} />;
  const read = state === 'READ';
  const color = read ? '#7DE0FF' : onDark ? 'rgba(255,255,255,0.75)' : colors.textMuted;
  return <Ionicons name={read ? 'checkmark-done' : 'checkmark'} size={15} color={color} accessibilityLabel={t(read ? 'chat.read' : state === 'DELIVERED' ? 'chat.delivered' : 'chat.sent')} />;
}

const NAME_COLORS = ['#C2410C', '#0F766E', '#7C3AED', '#B45309', '#BE185D', '#2563EB', '#15803D'];
const nameColor = (s: string) => NAME_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length];

async function openUrl(token: string, fileId: string) {
  const { url } = await market.fileUrl(token, fileId);
  await Linking.openURL(url.startsWith('/') ? `${API_URL}${url}` : url);
}

function ImageThumb({ token, file, onDark, onLongPress, locked }: { token: string; file: ChatFile; onDark: boolean; onLongPress?: () => void; locked?: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    market.fileUrl(token, file.id).then((r) => live && setUri(r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url)).catch(() => live && setBad(true));
    return () => { live = false; };
  }, [token, file.id]);
  if (bad) return <FileChip token={token} file={file} onDark={onDark} onLongPress={onLongPress} locked={locked} />;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onLongPress={onLongPress} onPress={locked ? undefined : () => uri && Linking.openURL(uri)}>
      {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setBad(true)} /> : <View style={[styles.thumb, styles.thumbWait]}><ActivityIndicator color={colors.textMuted} /></View>}
    </Pressable>
  );
}

function FileChip({ token, file, onDark, onLongPress, locked }: { token: string; file: ChatFile; onDark: boolean; onLongPress?: () => void; locked?: boolean }) {
  const fg = onDark ? '#fff' : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('attach.open', { name: file.name })} onLongPress={onLongPress} onPress={locked ? () => Alert.alert(t('protect.title'), t('info.protectedPupil')) : () => openUrl(token, file.id).catch(() => undefined)} style={[styles.file, { backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.neutralSoft }]}>
      <View style={[styles.fileIcon, { backgroundColor: onDark ? 'rgba(255,255,255,0.25)' : colors.primarySoft }]}><Ionicons name="document-text" size={22} color={onDark ? '#fff' : colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: fg, fontWeight: '600' }} numberOfLines={1}>{file.name}</Text>
        {!!file.size && <Text style={{ color: fg, opacity: 0.7, fontSize: 12 }}>{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</Text>}
      </View>
    </Pressable>
  );
}

export interface ReplyInfo { id: string; body: string; author: string | null; deleted?: boolean; hasFile?: boolean }

/** The small quoted block inside a bubble (or above the message box) that shows which message is being answered. */
export function ReplyQuote({ reply, accent, onDark, onPress, onClose }: { reply: ReplyInfo; accent: string; onDark?: boolean; onPress?: () => void; onClose?: () => void }) {
  const text = reply.deleted ? t('reply.deleted') : reply.body.trim() || (reply.hasFile ? `📎 ${t('chat.photoOrFile')}` : '');
  const bar = onDark ? 'rgba(255,255,255,0.9)' : accent;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" style={[styles.quote, { backgroundColor: onDark ? 'rgba(255,255,255,0.18)' : accent + '1F' }]}>
      <View style={[styles.quoteBar, { backgroundColor: bar }]} />
      <View style={{ flex: 1 }}>
        {!!reply.author && !reply.deleted && <Text style={[styles.quoteAuthor, { color: onDark ? '#fff' : accent }]} numberOfLines={1}>{reply.author}</Text>}
        <Text style={[styles.quoteText, { color: onDark ? 'rgba(255,255,255,0.85)' : colors.textMuted }, reply.deleted && { fontStyle: 'italic' }]} numberOfLines={2}>{text}</Text>
      </View>
      {onClose && <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>}
    </Pressable>
  );
}

/**
 * One chat bubble. `author` is shown above other people's messages in group chats (class channel).
 * Swipe a bubble to the right to reply (like Telegram); a quoted message shows on top and a tap on it jumps to the original.
 */
export function Bubble({ token, mine, body, at, file, state, author, authorIsTeacher, authorIsAssistant, onLongPress, onAuthorPress, authorPhotoId, onRetry, pinned, highlight, theme, replyTo, onQuotePress, onSwipeReply, hidden, reports, locked }: {
  locked?: boolean; hidden?: 'reported' | 'review' | null; reports?: number;
  pinned?: boolean; highlight?: boolean; theme?: ChatTheme; replyTo?: ReplyInfo | null; onQuotePress?: () => void; onSwipeReply?: () => void;
  token: string; mine: boolean; body: string; at: string; file?: ChatFile | null; state?: DeliveryState; author?: string | null; authorIsTeacher?: boolean; authorIsAssistant?: boolean; onLongPress?: () => void; onAuthorPress?: () => void; authorPhotoId?: string | null; onRetry?: () => void;
}) {
  const th = theme ?? themeOf(null);
  const x = useRef(new Animated.Value(0)).current;
  const swipe = useRef(onSwipeReply);
  swipe.current = onSwipeReply;
  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !!swipe.current && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
    onPanResponderMove: (_, g) => x.setValue(Math.max(-72, Math.min(72, g.dx))),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 56) swipe.current?.(); back(); },
    onPanResponderTerminate: back,
  })).current;
  const fg = mine ? th.mineText : colors.text;
  if (hidden) {
    return (
      <View style={{ width: '100%', alignItems: 'flex-start' }}>
        <Pressable onLongPress={onLongPress} style={styles.hiddenPill}>
          <Ionicons name="eye-off" size={16} color={colors.textMuted} />
          <Text style={styles.hiddenText}>{t(hidden === 'reported' ? 'rp.hiddenMine' : 'rp.hiddenReview')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start' }} {...pan.panHandlers}>
      <Animated.View style={[styles.replyHint, { opacity: x.interpolate({ inputRange: [0, 56], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale: x.interpolate({ inputRange: [0, 56], outputRange: [0.5, 1], extrapolate: 'clamp' }) }] }]} pointerEvents="none">
        <Ionicons name="arrow-undo" size={18} color={th.accent} />
      </Animated.View>
      <Animated.View style={[styles.replyHint, { left: undefined, right: 6, opacity: x.interpolate({ inputRange: [-56, 0], outputRange: [1, 0], extrapolate: 'clamp' }), transform: [{ scale: x.interpolate({ inputRange: [-56, 0], outputRange: [1, 0.5], extrapolate: 'clamp' }) }] }]} pointerEvents="none">
        <Ionicons name="arrow-undo" size={18} color={th.accent} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }], maxWidth: '84%' }}>
        <Pressable
          onLongPress={onLongPress}
          onPress={state === 'FAILED' ? onRetry : undefined}
          style={[styles.bubble, mine ? [styles.mine, { backgroundColor: th.accent }] : styles.theirs, state === 'FAILED' && styles.failed, state === 'SENDING' && { opacity: 0.7 }, highlight && { borderWidth: 2, borderColor: th.accent2 }]}
        >
          {!mine && !!author && (
            <Pressable onPress={onAuthorPress} disabled={!onAuthorPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={author} style={styles.authorRow}>
              <Avatar name={author} size={22} userId={authorPhotoId ?? null} />
              <Text style={[styles.author, { color: authorIsTeacher ? '#FF9500' : authorIsAssistant ? '#1D9BF0' : nameColor(author) }]} numberOfLines={1}>{author}{authorIsTeacher ? `  ·  ${t('role.TEACHER')}` : authorIsAssistant ? `  ·  ${t('helper.assistant')}` : ''}</Text>
            </Pressable>
          )}
          {!!reports && reports > 0 && (
            <View style={styles.reportChip}><Ionicons name="warning" size={13} color="#fff" /><Text style={styles.reportChipText}>{t('rp.count', { n: reports })}</Text></View>
          )}
          {!!replyTo && <ReplyQuote reply={replyTo} accent={th.accent} onDark={mine} onPress={replyTo.deleted ? undefined : onQuotePress} />}
          {file && (file.image ? <ImageThumb token={token} file={file} onDark={mine} onLongPress={onLongPress} locked={locked} /> : <FileChip token={token} file={file} onDark={mine} onLongPress={onLongPress} locked={locked} />)}
          {!!body && <Text style={[styles.text, { color: fg }]}>{body}</Text>}
          {state === 'FAILED' && <Text style={styles.failedText}>{t('chat.failed')}</Text>}
          <View style={styles.meta}>
            {pinned && <Ionicons name="pin" size={11} color={mine ? 'rgba(255,255,255,0.8)' : colors.textMuted} />}
            <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.8)' }]}>{fmtTime(at)}</Text>
            {mine && <Ticks state={state} onDark />}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Message box with a "+" to attach a photo or a file (uploaded in parts, then sent as a message) and a round send button. */
export function Composer({ token, placeholder, onSend, onAttached, disabled, keyboardOpen, reply, onCancelReply, accent, wall }: {
  wall?: string; reply?: ReplyInfo | null; onCancelReply?: () => void; accent?: string;
  token: string; placeholder: string; onSend: (text: string) => void; onAttached: (fileId: string) => Promise<void>; disabled?: boolean; keyboardOpen?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef({ cancelled: false });

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setError(null);
    setText(''); // cleared at once; the screen shows the message as "sending" and retries it if the connection drops
    onSend(v);
  };
  const attach = async (uri: string, name: string, mime: string) => {
    cancel.current = { cancelled: false };
    setError(null);
    setProgress(0);
    try {
      const { fileId } = await uploadFile({ token, uri, name, mime, purpose: 'MESSAGE_ATTACHMENT', onProgress: setProgress, signal: cancel.current });
      await onAttached(fileId);
    } catch (e) {
      if (!(e instanceof UploadError && e.code === 'CANCELLED')) setError(uploadErrorText(e));
    } finally {
      setProgress(null);
    }
  };
  const photo = async () => {
    setMenu(false);
    const IP = imagePicker();
    if (!IP) return;
    const perm = await IP.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('attach.permission'));
    const r = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const a = r.canceled ? null : r.assets[0];
    if (a) await attach(a.uri, a.fileName || 'photo.jpg', a.mimeType || 'image/jpeg');
  };
  const pdf = async () => {
    setMenu(false);
    const DP = documentPicker();
    if (!DP) return;
    const r = await DP.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (a) await attach(a.uri, a.name || 'file', a.mimeType || 'application/octet-stream');
  };

  return (
    <View style={[styles.composerWrap, { ...(wall ? { backgroundColor: wall } : null), paddingBottom: spacing.sm + (keyboardOpen ? 0 : insets.bottom) }]}>
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      {progress !== null && (
        <View style={styles.progress}>
          <Text style={{ color: colors.text, flex: 1 }}>{t('attach.uploading', { pct: Math.round(progress * 100) })}</Text>
          <Pressable onPress={() => { cancel.current.cancelled = true; }} hitSlop={10}><Text style={{ color: colors.danger, fontWeight: '700' }}>{t('common.cancel')}</Text></Pressable>
        </View>
      )}
      {menu && (
        <View style={styles.menu}>
          <Pressable style={styles.menuItem} onPress={photo}><Ionicons name="image" size={22} color={colors.primary} /><Text style={styles.menuText}>{t('attach.photo')}</Text></Pressable>
          <Pressable style={styles.menuItem} onPress={pdf}><Ionicons name="document" size={22} color={colors.primary} /><Text style={styles.menuText}>{t('attach.pdf')}</Text></Pressable>
        </View>
      )}
      {!!reply && <ReplyQuote reply={reply} accent={accent ?? colors.primary} onClose={onCancelReply} />}
      <View style={styles.composer}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('attach.add')} onPress={() => setMenu(!menu)} disabled={disabled || progress !== null} style={styles.plus} hitSlop={6}>
          <Ionicons name={menu ? 'close' : 'add'} size={26} color={colors.primary} />
        </Pressable>
        <TextInput accessibilityLabel={placeholder} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={styles.input} multiline maxLength={2000} editable={!disabled} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} onPress={send} disabled={disabled || !text.trim()} style={[styles.send, accent ? { backgroundColor: accent } : null, !text.trim() && { opacity: 0.4 }]}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 20, gap: 5, marginVertical: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  mine: { borderBottomRightRadius: 6 },
  hiddenPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.neutralSoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginVertical: 3, maxWidth: '84%' },
  hiddenText: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  reportChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  reportChipText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  replyHint: { position: 'absolute', left: 6, top: '40%', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 6, paddingRight: 8, paddingLeft: 6, minWidth: 140 },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  quoteAuthor: { fontSize: 12, fontWeight: '800' },
  quoteText: { fontSize: 13, lineHeight: 17 },
  failed: { backgroundColor: '#D9534F' },
  failedText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  author: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  text: { fontSize: 16, lineHeight: 22, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  time: { fontSize: 11, color: colors.textMuted },
  thumb: { width: 220, height: 160, borderRadius: 12, backgroundColor: colors.neutralSoft },
  thumbWait: { alignItems: 'center', justifyContent: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, minWidth: 200 },
  fileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { backgroundColor: colors.background, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, minHeight: 44, maxHeight: 130, fontSize: 16, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', gap: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  menuText: { color: colors.text, fontWeight: '600' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 10 },
  error: { color: colors.danger, paddingHorizontal: 6 },
});
