import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { imagePicker } from '../../src/lib/native';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { UploadError, uploadFile } from '../../src/market/uploader';
import { uploadErrorText } from '../../src/market/AttachBar';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { Avatar } from '../../src/ui';
import { useRoundPhotoPicker } from '../../src/ui/CircleCrop';
import { KeyboardScroll } from '../../src/ui/KeyboardScroll';

const BIO_MAX = 200;

/** Edit profile, iOS style: a big photo with "Change photo", then one grouped card with name, @username and a short bio. */
export default function EditProfileScreen() {
  const { token, refreshUser } = useAuth();
  const router = useRouter();
  const me = useAsync(() => market.me(token as string), [token]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoV, setPhotoV] = useState(0);
  const [unState, setUnState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'bad'>('idle');
  const [dmReq, setDmReq] = useState(false);
  const [disc, setDisc] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (me.data && !loaded) { setName(me.data.name ?? ''); setUsername(me.data.username ?? ''); setBio(me.data.bio ?? ''); setDmReq(!!me.data.dmRequests); setDisc(me.data.phoneDiscoverable !== false); setLoaded(true); }
  }, [me.data, loaded]);

  useEffect(() => {
    if (!loaded || !username || username === (me.data?.username ?? '')) { setUnState('idle'); return; }
    if (username.length < 3) { setUnState('bad'); return; }
    setUnState('checking');
    const h = setTimeout(async () => {
      try { const r = await market.usernameCheck(token as string, username); setUnState(r.ok ? 'ok' : r.reason === 'TAKEN' ? 'taken' : 'bad'); } catch { setUnState('idle'); }
    }, 400);
    return () => clearTimeout(h);
  }, [username, loaded]);

  const roundPicker = useRoundPhotoPicker();
  const changePhoto = async () => {
    const a = await roundPicker.pick();
    if (!a) return;
    try {
      setBusy(true);
      const up = await uploadFile({ token: token as string, uri: a.uri, name: a.name, mime: a.mime, purpose: 'AVATAR' });
      await market.setAvatar(token as string, up.fileId);
      setPhotoV(Date.now());
      me.reload();
    } catch (e) {
      Alert.alert(t('profile.photoFailed'), uploadErrorText(e) + (e instanceof UploadError || e instanceof ApiError ? `\n(${e.code ?? ''} ${e.message})` : ''));
    } finally {
      setBusy(false);
    }
  };
  const toggleDm = async (v: boolean) => {
    setDmReq(v);
    try { await market.updateMe(token as string, { dmRequests: v }); } catch { setDmReq(!v); Alert.alert(t('common.error'), t('state.error')); }
  };
  const toggleDisc = async (v: boolean) => {
    setDisc(v);
    try { await market.updateMe(token as string, { phoneDiscoverable: v }); } catch { setDisc(!v); Alert.alert(t('common.error'), t('state.error')); }
  };
  const save = async () => {
    setBusy(true);
    try {
      await market.updateMe(token as string, { name: name.trim(), username: username.trim() || undefined, bio: bio.trim() });
      await refreshUser();
      router.back();
    } catch (e) {
      const m: Record<string, string> = { USERNAME_TAKEN: 'auth.usernameTaken', BAD_USERNAME: 'auth.usernameBad', RESERVED_USERNAME: 'auth.usernameTaken', CONTACT_INFO_NOT_ALLOWED: 'bio.noContacts' };
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code && m[e.code] ? t(m[e.code]) : e.message) : t('state.error'));
    } finally {
      setBusy(false);
    }
  };
  const ready = name.trim().length >= 2 && (username === '' || username.length >= 3) && unState !== 'taken' && unState !== 'bad';

  return (
    <View style={styles.root}>
      {roundPicker.node}
      <Stack.Screen options={{
        headerShown: true, title: t('profile.edit'), headerBackTitle: t('common.back'),
        headerRight: () => <Pressable accessibilityRole="button" onPress={save} disabled={busy || !ready} hitSlop={10}><Text style={[styles.save, (busy || !ready) && { opacity: 0.4 }]}>{t('common.save')}</Text></Pressable>,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        <KeyboardScroll contentContainerStyle={styles.body}>
          <View style={styles.photoBlock}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('profile.photoChange')} onPress={changePhoto} disabled={busy}>
              <Avatar name={name} size={112} userId={me.data?.hasPhoto ? me.data.id : null} v={photoV} />
              <View style={styles.cam}><Ionicons name="camera" size={18} color="#fff" /></View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={changePhoto} disabled={busy} hitSlop={8}><Text style={styles.change}>{t('profile.photoChange')}</Text></Pressable>
          </View>

          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.name')}</Text>
              <TextInput value={name} onChangeText={setName} maxLength={100} style={styles.input} accessibilityLabel={t('profile.name')} placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.sep} />
            <View style={styles.row}>
              <Text style={styles.label}>@</Text>
              <TextInput value={username} onChangeText={(v) => setUsername(v.replace(/[^A-Za-z0-9_]/g, '').toLowerCase())} autoCapitalize="none" autoCorrect={false} maxLength={20} style={styles.input} accessibilityLabel={t('auth.username')} placeholder="aziz_tursunov" placeholderTextColor={colors.textMuted} />
            </View>
          </View>
          <Text style={[styles.hint, unState === 'taken' || unState === 'bad' ? { color: colors.danger } : unState === 'ok' ? { color: colors.success } : null]}>
            {unState === 'taken' ? t('auth.usernameTaken') : unState === 'ok' ? t('auth.usernameFree') : unState === 'bad' ? t('auth.usernameBad') : t('auth.usernameRules')}
          </Text>

          <View style={[styles.group, { marginTop: spacing.md }]}>
            <TextInput value={bio} onChangeText={(v) => setBio(v.slice(0, BIO_MAX))} multiline placeholder={t('bio.placeholder')} placeholderTextColor={colors.textMuted} style={styles.bio} accessibilityLabel={t('bio.title')} />
          </View>
          <Text style={[styles.hint, { textAlign: 'right' }]}>{bio.length}/{BIO_MAX}</Text>
          <Text style={styles.hint}>{t('bio.hint')}</Text>

          <View style={[styles.group, { marginTop: spacing.lg, padding: spacing.md, gap: spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={styles.dmIcon}><Ionicons name="shield-checkmark" size={20} color="#fff" /></View>
              <Text style={[styles.dmTitle, { flex: 1 }]}>{t('dm.reqSwitch')}</Text>
              <Switch value={dmReq} onValueChange={toggleDm} trackColor={{ true: colors.success }} />
            </View>
            <Text style={styles.dmText}>{t('dm.reqSwitchHint')}</Text>
            {[['people', 'dm.reqPoint1'], ['chatbubbles', 'dm.reqPoint2'], ['school', 'dm.reqPoint3']].map(([ic, k]) => (
              <View key={k} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Ionicons name={ic as any} size={18} color={colors.primary} style={{ marginTop: 1 }} />
                <Text style={[styles.dmText, { flex: 1 }]}>{t(k)}</Text>
              </View>
            ))}
          </View>
          {me.data?.hasPhone && (
            <View style={[styles.group, { marginTop: spacing.md, padding: spacing.md, gap: spacing.xs }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={[styles.dmTitle, { flex: 1 }]}>{t('contacts.discover')}</Text>
                <Switch value={disc} onValueChange={toggleDisc} trackColor={{ true: colors.success }} />
              </View>
              <Text style={styles.dmText}>{t('contacts.discoverHint')}</Text>
            </View>
          )}
        </KeyboardScroll>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: spacing.sm },
  save: { color: colors.primary, fontWeight: '800', fontSize: 17 },
  photoBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
  change: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  group: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, minHeight: 54 },
  label: { width: 78, color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  input: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 12 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.md },
  bio: { minHeight: 110, padding: spacing.md, fontSize: 17, color: colors.text, textAlignVertical: 'top' },
  dmIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dmTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  dmText: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 6 },
});
