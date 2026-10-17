import React, { useState } from 'react';
import { Alert, DevSettings, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../src/lib/api';
import { imagePicker } from '../../src/lib/native';
import { UploadError, uploadFile } from '../../src/market/uploader';
import { uploadErrorText } from '../../src/market/AttachBar';
import { useAuth } from '../../src/lib/auth-context';
import { LOCALES, Locale, t } from '../../src/i18n';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, saveThemeMode, spacing, themeMode, ThemeMode } from '../../src/theme/colors';
import { Avatar, Card, Group, ListRow, Page, Pill, SectionTitle } from '../../src/ui';

const LANG_NAMES: Record<Locale, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

/** Profile, language, notifications, role tools and sign out, grouped like a normal phone app's settings. */
export default function MoreScreen() {
  const { token, signOut, user } = useAuth();
  const router = useRouter();
  const { locale, setLanguage } = useLocale();
  const me = useAsync(() => market.me(token as string), [token]);
  const unread = useAsync(() => market.unreadCount(token as string), [token]);
  const [busy, setBusy] = useState(false);
  const [photoV, setPhotoV] = useState(0);
  const prof = useAsync(() => (user?.role === 'TEACHER' ? market.ownProfile(token as string).catch(() => null) : Promise.resolve(null)), [token, user?.role]);

  // Teachers tap their picture to set a photo (it shows in search and on their page). Without a profile yet, go and create it first.
  const changePhoto = async () => {
    const IP = imagePicker();
    if (!IP) return;
    const res = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      setBusy(true);
      const up = await uploadFile({ token: token as string, uri: a.uri, name: a.fileName ?? 'photo.jpg', mime: a.mimeType ?? 'image/jpeg', purpose: 'AVATAR' });
      await market.setAvatar(token as string, up.fileId);
      setPhotoV(Date.now());
      me.reload();
    } catch (e) {
      Alert.alert(t('profile.photoFailed'), `${uploadErrorText(e)}
(${e instanceof UploadError || e instanceof ApiError ? `${e.code ?? ''} ${e.message}` : String((e as Error)?.message ?? e)})`);
    } finally {
      setBusy(false);
    }
  };
  const role = me.data?.role ?? user?.role;
  const go = (p: string) => router.push(p as never);

  const pickLanguage = async (l: Locale) => {
    if (l === locale || busy) return;
    setBusy(true);
    try {
      await market.updateMe(token as string, { locale: l }).catch(() => undefined); // saved on the server too, so other devices and notifications use it
      await setLanguage(l);
    } finally {
      setBusy(false);
    }
  };
  // The palette is read when the app starts, so the new look needs a restart; in development builds the app restarts itself.
  const pickTheme = (m: ThemeMode) => {
    if (m === themeMode) return;
    saveThemeMode(m);
    if (__DEV__) DevSettings.reload();
    else Alert.alert(t('theme.restartTitle'), t('theme.restartText'));
  };
  return (
    <Page>
      <Card style={styles.profile}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.photoChange')} onPress={() => go('/market/edit-profile')}>
          <Avatar name={me.data?.name ?? user?.name} size={72} userId={me.data?.hasPhoto ? user?.id : null} v={photoV} />
          <View style={styles.cam}><Ionicons name="camera" size={14} color="#fff" /></View>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>{me.data?.name ?? user?.name ?? '-'}</Text>
          <Pressable accessibilityRole="button" onPress={() => go('/market/edit-profile')}><Text style={styles.username} numberOfLines={1}>{me.data?.username ? `@${me.data.username}` : t('auth.usernameSet')}</Text></Pressable>
          <Pill label={t(`role.${role ?? 'STUDENT'}`)} tone="primary" icon={role === 'TEACHER' ? 'school' : role === 'GUARDIAN' ? 'shield-checkmark' : 'person'} />
        </View>
      </Card>

      <SectionTitle title={t('more.language')} />
      <View style={styles.langs}>
        {LOCALES.map((l) => (
          <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: l === locale }} onPress={() => pickLanguage(l)} style={[styles.lang, l === locale && styles.langOn]}>
            <Text style={[styles.langText, l === locale && { color: colors.primary }]}>{LANG_NAMES[l]}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title={t('theme.title')} />
      <View style={styles.langs}>
        {(['auto', 'light', 'dark', 'evening'] as ThemeMode[]).map((m) => (
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: m === themeMode }} onPress={() => pickTheme(m)} style={[styles.lang, m === themeMode && styles.langOn]}>
            <Text style={[styles.langText, m === themeMode && { color: colors.primary }]}>{t(`theme.${m}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.themeHint}>{t(`theme.hint.${themeMode}`)}</Text>

      {role === 'TEACHER' && (
        <>
          <SectionTitle title={t('more.teaching')} />
          <Group>
            <ListRow icon="calendar" title={t('setup.today')} onPress={() => go('/market/today')} />
            <ListRow icon="mail-unread" title={t('setup.requests')} onPress={() => go('/market/requests')} />
            <ListRow icon="person-circle" title={t('setup.profile')} onPress={() => go('/market/profile-edit')} />
            <ListRow icon="time" title={t('setup.availability')} onPress={() => go('/market/availability')} />
            <ListRow icon="cash" title={t('money.menu')} onPress={() => go('/market/money')} />
            <ListRow icon="card" title={t('market.card')} onPress={() => go('/market/card')} />
            <ListRow icon="star" title={t('rev.title')} onPress={() => go('/market/reviews')} />
          </Group>
        </>
      )}
      {role !== 'TEACHER' && (
        <>
          <SectionTitle title={t('more.learning')} />
          <Group>
            <ListRow icon="calendar" title={t('market.lessons')} onPress={() => go('/market/lessons')} />
            <ListRow icon="people" title={t('class.titlePupil')} onPress={() => go('/market/classes')} />
            <ListRow icon="cash" title={t('mypay.menu')} onPress={() => go('/market/my-payments')} />
            <ListRow icon="star" title={t('rev.title')} onPress={() => go('/market/reviews')} />
          </Group>
        </>
      )}

      <SectionTitle title={t('more.account')} />
      <Group>
        <ListRow icon="notifications" title={t('notif.title')} badge={unread.data?.unread} onPress={() => go('/market/notifications')} />
        <ListRow icon="options" title={t('ns.title')} onPress={() => go('/market/notification-settings')} />
        <ListRow icon="person-circle" title={t('acct.title')} subtitle={t('acct.hint')} onPress={() => go('/market/account')} />
        <ListRow icon="shield-checkmark" title={t('market.safety')} subtitle={t('more.safetyHint')} onPress={() => go('/market/safety')} />
      </Group>

      <Text style={styles.foot}>{t('free.notice')}</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  themeHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: -4 },
  username: { fontSize: 14, color: colors.primaryLight, fontWeight: '700' },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.textMuted },
  langs: { flexDirection: 'row', gap: 4, backgroundColor: colors.neutralSoft, borderRadius: 14, padding: 3 },
  lang: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  langOn: { backgroundColor: colors.surface },
  langText: { fontWeight: '700', color: colors.text },
  foot: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.md },
});
