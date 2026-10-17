import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
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

function ImageThumb({ token, file, onDark }: { token: string; file: ChatFile; onDark: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    market.fileUrl(token, file.id).then((r) => live && setUri(r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url)).catch(() => live && setBad(true));
    return () => { live = false; };
  }, [token, file.id]);
  if (bad) return <FileChip token={token} file={file} onDark={onDark} />;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={() => uri && Linking.openURL(uri)}>
      {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setBad(true)} /> : <View style={[styles.thumb, styles.thumbWait]}><ActivityIndicator color={colors.textMuted} /></View>}
    </Pressable>
  );
}

function FileChip({ token, file, onDark }: { token: string; file: ChatFile; onDark: boolean }) {
  const fg = onDark ? '#fff' : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('attach.open', { name: file.name })} onPress={() => openUrl(token, file.id).catch(() => undefined)} style={[styles.file, { backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.neutralSoft }]}>
      <View style={[styles.fileIcon, { backgroundColor: onDark ? 'rgba(255,255,255,0.25)' : colors.primarySoft }]}><Ionicons name="document-text" size={22} color={onDark ? '#fff' : colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: fg, fontWeight: '600' }} numberOfLines={1}>{file.name}</Text>
        {!!file.size && <Text style={{ color: fg, opacity: 0.7, fontSize: 12 }}>{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</Text>}
      </View>
    </Pressable>
  );
}

/** One chat bubble. `author` is shown above other people's messages in group chats (class channel). */
export function Bubble({ token, mine, body, at, file, state, author, authorIsTeacher, onLongPress, onAuthorPress, authorPhotoId, onRetry, pinned, highlight }: {
  pinned?: boolean; highlight?: boolean;
  token: string; mine: boolean; body: string; at: string; file?: ChatFile | null; state?: DeliveryState; author?: string | null; authorIsTeacher?: boolean; onLongPress?: () => void; onAuthorPress?: () => void; authorPhotoId?: string | null; onRetry?: () => void;
}) {
  return (
    <Pressable onLongPress={onLongPress} onPress={state === 'FAILED' ? onRetry : undefined} style={[styles.bubble, mine ? styles.mine : styles.theirs, state === 'FAILED' && styles.failed, state === 'SENDING' && { opacity: 0.7 }, highlight && styles.highlight]}>
      {!mine && !!author && (
        <Pressable onPress={onAuthorPress} disabled={!onAuthorPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={author} style={styles.authorRow}>
          <Avatar name={author} size={22} userId={authorPhotoId ?? null} />
          <Text style={[styles.author, { color: authorIsTeacher ? '#FF9500' : nameColor(author) }]} numberOfLines={1}>{author}{authorIsTeacher ? `  ·  ${t('role.TEACHER')}` : ''}</Text>
        </Pressable>
      )}
      {file && (file.image ? <ImageThumb token={token} file={file} onDark={mine} /> : <FileChip token={token} file={file} onDark={mine} />)}
      {!!body && <Text style={[styles.text, mine && { color: '#fff' }]}>{body}</Text>}
      {state === 'FAILED' && <Text style={styles.failedText}>{t('chat.failed')}</Text>}
      <View style={styles.meta}>
        {pinned && <Ionicons name="pin" size={11} color={mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} />}
        <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.75)' }]}>{fmtTime(at)}</Text>
        {mine && <Ticks state={state} onDark />}
      </View>
    </Pressable>
  );
}

/** Message box with a "+" to attach a photo or a file (uploaded in parts, then sent as a message) and a round send button. */
export function Composer({ token, placeholder, onSend, onAttached, disabled, keyboardOpen }: {
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
    <View style={[styles.composerWrap, { paddingBottom: spacing.sm + (keyboardOpen ? 0 : insets.bottom) }]}>
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
      <View style={styles.composer}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('attach.add')} onPress={() => setMenu(!menu)} disabled={disabled || progress !== null} style={styles.plus} hitSlop={6}>
          <Ionicons name={menu ? 'close' : 'add'} size={26} color={colors.primary} />
        </Pressable>
        <TextInput accessibilityLabel={placeholder} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={styles.input} multiline maxLength={2000} editable={!disabled} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} onPress={send} disabled={disabled || !text.trim()} style={[styles.send, !text.trim() && { opacity: 0.4 }]}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 18, gap: 4, marginVertical: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  failed: { backgroundColor: '#D9534F' },
  failedText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  author: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  text: { fontSize: 16, lineHeight: 22, color: colors.text },
  highlight: { borderWidth: 2, borderColor: colors.primary },
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
