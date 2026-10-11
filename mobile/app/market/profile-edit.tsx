import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market, OwnProfile } from '../../src/market/marketApi';
import { UploadError, uploadFile } from '../../src/market/uploader';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} style={[styles.chip, on && styles.chipOn]}>
            <Text style={on ? { color: colors.white } : undefined}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const cat = useAsync(() => market.catalogFull(token as string), [token]);
  const prof = useAsync(() => market.ownProfile(token as string).catch((e) => { if (e instanceof ApiError && e.statusCode === 404) return null; throw e; }), [token]);
  const [f, setF] = useState({ headline: '', bio: '', subjects: [] as string[], levels: [] as string[], languages: [] as string[], price: '', introVideoUrl: '', instantBooking: false, paymentTiming: 'PAY_AFTER' as 'PAY_BEFORE' | 'PAY_AFTER' });
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [photoState, setPhotoState] = useState<string | null>(null);

  useEffect(() => {
    const p: OwnProfile | null = prof.data;
    if (p) setF({ headline: p.headline, bio: p.bio, subjects: p.subjects, levels: p.levels, languages: p.languages, price: p.priceMinor ? String(Math.round(p.priceMinor / 100)) : '', introVideoUrl: p.introVideoUrl ?? '', instantBooking: p.instantBooking, paymentTiming: p.paymentTiming });
  }, [prof.data]);

  const header = <Stack.Screen options={{ headerShown: true, title: t('profile.title'), headerBackTitle: t('common.back') }} />;
  if (prof.state === 'loading' || cat.state === 'loading') return <Screen>{header}<StateView state="loading" /></Screen>;
  if (prof.state === 'offline' || prof.state === 'error') return <Screen>{header}<StateView state={prof.state} onRetry={prof.reload} /></Screen>;
  const status = prof.data?.verificationStatus ?? 'DRAFT';

  const body = () => ({
    headline: f.headline.trim(), bio: f.bio.trim(), subjects: f.subjects, levels: f.levels, languages: f.languages,
    ...(f.price ? { priceMinor: Math.round(Number(f.price.replace(/\s/g, '')) * 100) } : {}),
    introVideoUrl: f.introVideoUrl.trim() || null, instantBooking: f.instantBooking, paymentTiming: f.paymentTiming,
  });
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
  const save = async () => {
    setBusy(true);
    try {
      await market.saveProfile(token as string, body());
      prof.reload();
      Alert.alert(t('profile.saved'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    setMissing([]);
    try {
      await market.saveProfile(token as string, body());
      await market.submitProfile(token as string);
      prof.reload();
      Alert.alert(t('profile.submitted'));
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.missing)) setMissing(e.details.missing as string[]);
      else fail(e);
    } finally {
      setBusy(false);
    }
  };
  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      setPhotoState('0%');
      const up = await uploadFile({ token: token as string, uri: a.uri, name: a.fileName ?? 'photo.jpg', mime: a.mimeType ?? 'image/jpeg', purpose: 'AVATAR', onProgress: (x) => setPhotoState(`${Math.round(x * 100)}%`) });
      await market.setPhoto(token as string, up.fileId);
      setPhotoState(t('profile.photoSet'));
      prof.reload();
    } catch (e) {
      setPhotoState(null);
      Alert.alert(t('common.error'), e instanceof UploadError ? e.message : t('state.error'));
    }
  };

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={styles.status} accessibilityLiveRegion="polite">{t(`profile.status.${status}`)}</Text>
        {status !== 'VERIFIED' && <Text style={styles.help}>{t('profile.unverified')}</Text>}
        {prof.data?.rejectionReason && status === 'REJECTED' && <Text style={styles.err}>{t('profile.reason', { reason: prof.data.rejectionReason })}</Text>}
        {missing.length > 0 && <Text style={styles.err} accessibilityRole="alert">{t('profile.missing', { items: missing.join(', ') })}</Text>}

        <Text style={styles.label}>{t('profile.photo')}</Text>
        <PrimaryButton title={t('profile.photoChange')} variant="outline" onPress={pickPhoto} />
        {photoState && <Text style={styles.help}>{photoState}</Text>}

        <Text style={styles.label}>{t('profile.headline')}</Text>
        <TextInput accessibilityLabel={t('profile.headline')} value={f.headline} onChangeText={(v) => setF({ ...f, headline: v })} maxLength={120} style={styles.input} />
        <Text style={styles.label}>{t('profile.bio')}</Text>
        <TextInput accessibilityLabel={t('profile.bio')} value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} multiline maxLength={2000} style={[styles.input, { minHeight: 110 }]} />
        <Text style={styles.label}>{t('profile.subjects')}</Text>
        <Chips options={cat.data?.subjects ?? []} value={f.subjects} onChange={(v) => setF({ ...f, subjects: v })} />
        <Text style={styles.label}>{t('profile.levels')}</Text>
        <Chips options={cat.data?.levels ?? []} value={f.levels} onChange={(v) => setF({ ...f, levels: v })} />
        <Text style={styles.label}>{t('profile.languages')}</Text>
        <Chips options={cat.data?.languages ?? []} value={f.languages} onChange={(v) => setF({ ...f, languages: v })} />
        <Text style={styles.label}>{t('profile.price')}</Text>
        <TextInput accessibilityLabel={t('profile.price')} value={f.price} onChangeText={(v) => setF({ ...f, price: v.replace(/[^\d ]/g, '') })} keyboardType="number-pad" style={styles.input} />
        <Text style={styles.label}>{t('profile.timing')}</Text>
        <Chips options={['PAY_BEFORE', 'PAY_AFTER']} value={[f.paymentTiming]} onChange={(v) => v.length && setF({ ...f, paymentTiming: v[v.length - 1] as 'PAY_BEFORE' | 'PAY_AFTER' })} />
        <Text style={styles.help}>{t(`timing.${f.paymentTiming}`)}</Text>
        <View style={styles.row}>
          <Text style={{ flex: 1 }}>{t('profile.instant')}</Text>
          <Switch accessibilityLabel={t('profile.instant')} value={f.instantBooking} onValueChange={(v) => setF({ ...f, instantBooking: v })} />
        </View>
        <Text style={styles.label}>{t('profile.video')}</Text>
        <TextInput accessibilityLabel={t('profile.video')} value={f.introVideoUrl} onChangeText={(v) => setF({ ...f, introVideoUrl: v })} autoCapitalize="none" keyboardType="url" style={styles.input} />

        <PrimaryButton title={t('profile.save')} onPress={save} loading={busy} />
        <PrimaryButton title={t('profile.submit')} variant="outline" onPress={submit} disabled={busy || status === 'PENDING' || status === 'VERIFIED'} />
        <PrimaryButton title={t('market.card')} variant="outline" onPress={() => router.push('/market/card' as never)} />
        <PrimaryButton title={t('setup.availability')} variant="outline" onPress={() => router.push('/market/availability' as never)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 18, fontWeight: '800', color: colors.primary },
  help: { color: colors.textMuted, fontSize: 13 },
  err: { color: colors.danger },
  label: { fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minHeight: 48, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
