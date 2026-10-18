import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TextInput } from '../../src/ui/Text';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { imagePicker } from '../../src/lib/native';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { UploadError, uploadFile } from '../../src/market/uploader';
import { colors, spacing } from '../../src/theme/colors';

/** A closed class asks for a photo of the payment: the pupil sends it with a short note, and the teacher or a helper lets them in. */
export default function JoinRequestScreen() {
  const { code, token: invite, studentId } = useLocalSearchParams<{ code?: string; token?: string; studentId?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [photo, setPhoto] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pick = async () => {
    const IP = imagePicker();
    if (!IP) return;
    const res = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, name: a.fileName ?? 'payment.jpg', mime: a.mimeType ?? 'image/jpeg' });
  };
  const send = async () => {
    if (!photo) return Alert.alert(t('join.photoNeeded'));
    setBusy(true);
    try {
      const up = await uploadFile({ token: token as string, uri: photo.uri, name: photo.name, mime: photo.mime, purpose: 'PAYMENT_PROOF' });
      await market.joinClass(token as string, { code: code || undefined, token: invite || undefined, studentId: studentId || undefined, proofFileId: up.fileId, note: note.trim() || undefined });
      setSent(true);
    } catch (e) {
      const msg = e instanceof ApiError ? (e.code === 'ALREADY_REQUESTED' ? t('join.alreadyRequested') : e.code === 'CLASS_NOT_FOUND' ? t('class.notFound') : e.code === 'REMOVED' ? t('join.removed') : e.message) : e instanceof UploadError ? e.message : t('state.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: 14 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.doneIcon}><Ionicons name="hourglass" size={40} color="#fff" /></View>
        <Text style={styles.title}>{t('join.sentTitle')}</Text>
        <Text style={[styles.text, { textAlign: 'center' }]}>{t('join.sentText')}</Text>
        <PrimaryButton title={t('common.ok')} onPress={() => router.replace('/(tabs)/learning' as never)} />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: t('join.requestTitle'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.text}>{t('join.requestText')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('join.photo')} onPress={pick} style={styles.photoBox}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" /> : (
            <View style={{ alignItems: 'center', gap: 8 }}><Ionicons name="camera" size={34} color={colors.primary} /><Text style={styles.pickText}>{t('join.photo')}</Text></View>
          )}
        </Pressable>
        {photo && <Pressable onPress={pick} accessibilityRole="button"><Text style={styles.link}>{t('join.photoChange')}</Text></Pressable>}
        <Text style={styles.label}>{t('join.note')}</Text>
        <TextInput value={note} onChangeText={setNote} maxLength={300} multiline placeholder={t('join.noteHint')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('join.note')} style={styles.input} />
        <PrimaryButton title={t('join.send')} onPress={send} loading={busy} disabled={!photo} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  text: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  photoBox: { height: 220, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  pickText: { color: colors.primary, fontWeight: '800' },
  link: { color: colors.primaryLight, fontWeight: '700', textAlign: 'center' },
  label: { fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 80, fontSize: 16, textAlignVertical: 'top' },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
