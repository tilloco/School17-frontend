import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TextInput } from '../../../src/ui/Text';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { colors, spacing } from '../../../src/theme/colors';

const LANGS = ['uz', 'ru', 'en'] as const;

/** A verified teacher adds a link to a YouTube or Vimeo video for this topic. Nothing is copied: the video stays where it is. */
export default function TopicAddScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState<(typeof LANGS)[number]>('uz');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await market.addTopicVideo(token as string, slug, { url: url.trim(), title: title.trim(), lang });
      router.back();
    } catch (e) {
      const msg = e instanceof ApiError
        ? (e.code === 'VIDEO_URL_NOT_ALLOWED' ? t('topic.urlBad') : e.code === 'DUPLICATE_VIDEO' ? t('topic.dup') : e.code === 'TOO_MANY_VIDEOS' ? t('topic.tooMany') : e.code === 'CONTACT_INFO_NOT_ALLOWED' ? t('comment.noContacts') : e.statusCode === 403 ? t('topic.verifiedOnly') : e.message)
        : t('state.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('topic.addVideo'), headerBackTitle: t('common.back') }} />
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
        <Text style={styles.help}>{t('topic.addHelp')}</Text>
        <Text style={styles.label}>{t('topic.url')}</Text>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://youtu.be/…" placeholderTextColor={colors.textMuted} accessibilityLabel={t('topic.url')} style={styles.input} />
        <Text style={styles.label}>{t('topic.vTitle')}</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder={t('topic.vTitleHint')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('topic.vTitle')} style={styles.input} />
        <Text style={styles.label}>{t('topic.vLang')}</Text>
        <View style={styles.row}>
          {LANGS.map((l) => <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => setLang(l)} style={[styles.chip, lang === l && { backgroundColor: colors.primary }]}><Text style={[styles.chipText, lang === l && { color: '#fff' }]}>{l.toUpperCase()}</Text></Pressable>)}
        </View>
        <PrimaryButton title={t('common.save')} onPress={save} loading={busy} disabled={url.trim().length < 10 || title.trim().length < 3} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  label: { fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 48, fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: 20, height: 42, borderRadius: 21, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontWeight: '800', color: colors.text },
});
