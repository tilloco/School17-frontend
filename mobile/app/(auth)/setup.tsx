import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRoundPhotoPicker } from '../../src/ui/CircleCrop';
import { KeyboardScroll } from '../../src/ui/KeyboardScroll';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { imagePicker } from '../../src/lib/native';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { uploadErrorText } from '../../src/market/AttachBar';
import { uploadFile } from '../../src/market/uploader';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

/** First run for a new teacher: a photo, what they teach and one line about themselves. Everything can be changed later in My profile. */
export default function TeacherSetupScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const cat = useAsync(() => market.catalogFull(token as string), [token]);
  const [photo, setPhoto] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const roundPicker = useRoundPhotoPicker();
  const pick = async () => {
    const a = await roundPicker.pick();
    if (a) setPhoto(a);
  };
  const toggle = (s: string) => setSubjects((x) => (x.includes(s) ? x.filter((y) => y !== s) : x.length < 5 ? [...x, s] : x));

  const finish = async () => {
    if (!subjects.length) return Alert.alert(t('setup2.needSubject'));
    setBusy(true);
    try {
      await market.saveProfile(token as string, { subjects, headline: headline.trim() });
      if (photo) {
        try {
          const up = await uploadFile({ token: token as string, uri: photo.uri, name: photo.name, mime: photo.mime, purpose: 'AVATAR' });
          await market.setAvatar(token as string, up.fileId);
        } catch (e) {
          Alert.alert(t('setup2.photoFailed'), uploadErrorText(e));
        }
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {roundPicker.node}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        <KeyboardScroll contentContainerStyle={styles.body}>
          <Text style={styles.title}>{t('setup2.title', { name: (user?.name ?? '').split(' ')[0] })}</Text>
          <Text style={styles.lead}>{t('setup2.lead')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('profile.photoChange')} onPress={pick} style={styles.photoWrap}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : <View style={[styles.photo, styles.photoEmpty]}><Ionicons name="person" size={54} color={colors.textMuted} /></View>}
            <View style={styles.cam}><Ionicons name="camera" size={18} color="#fff" /></View>
          </Pressable>
          <Text style={styles.hint}>{t('setup2.photoHint')}</Text>

          <Text style={styles.label}>{t('setup2.teach')}</Text>
          <View style={styles.chips}>
            {(cat.data?.subjects ?? []).map((s) => (
              <Pressable key={s} accessibilityRole="checkbox" accessibilityState={{ checked: subjects.includes(s) }} onPress={() => toggle(s)} style={[styles.chip, subjects.includes(s) && styles.chipOn]}>
                <Text style={[styles.chipText, subjects.includes(s) && { color: '#fff' }]}>{t(`subj.${s}`)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('setup2.about')}</Text>
          <TextInput value={headline} onChangeText={setHeadline} placeholder={t('setup2.aboutHint')} placeholderTextColor={colors.textMuted} maxLength={120} style={styles.input} accessibilityLabel={t('setup2.about')} />

          <Action label={busy ? t('state.loading') : t('setup2.done')} kind="accent" onPress={finish} disabled={busy} />
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/home')} style={{ alignItems: 'center', padding: 12 }}>
            <Text style={styles.skip}>{t('setup2.skip')}</Text>
          </Pressable>
        </KeyboardScroll>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginBottom: spacing.sm },
  photoWrap: { alignSelf: 'center', marginVertical: spacing.sm },
  photo: { width: 128, height: 128, borderRadius: 64 },
  photoEmpty: { backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: 2, bottom: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: 13 },
  label: { fontWeight: '700', color: colors.text, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '600', color: colors.text },
  input: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52, fontSize: 16, color: colors.text },
  skip: { color: colors.textMuted, fontWeight: '600' },
});
