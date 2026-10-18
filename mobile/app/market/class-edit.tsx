import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { inviteLink } from '../../src/lib/pending-join';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { colors, radius, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Starting a class takes a name and a subject; everything else is optional. Without an end-user limit on pupils and without a fixed schedule: lessons are added later. */
export default function ClassEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [more, setMore] = useState(!!id);
  const [description, setDescription] = useState('');
  const [limit, setLimit] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [protect, setProtect] = useState(false);
  const [approval, setApproval] = useState(false);
  const [proof, setProof] = useState(false);

  useEffect(() => {
    if (!id) return;
    market.classDetail(token as string, id).then((c) => {
      setTitle(c.title); setSubject(c.subject); setDescription(c.description);
      setProtect(!!c.protectContent); setApproval(!!c.joinApproval); setProof(!!c.requireProof); setLimit(c.capacity >= 500 ? '' : String(c.capacity)); setPrice(c.priceMinor ? String(Math.round(c.priceMinor / 100)) : '');
    }).catch(() => undefined);
  }, [id, token]);

  const save = async () => {
    const cap = limit.trim() ? num(limit) : undefined;
    const p = price.trim() ? num(price) : 0;
    if (title.trim().length < 2 || subject.trim().length < 2 || (cap !== undefined && !(cap >= 1)) || Number.isNaN(p)) return Alert.alert(t('common.error'), t('class.formInvalid'));
    setBusy(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), subject: subject.trim(), description: description.trim(), priceMinor: p * 100, protectContent: protect, joinApproval: approval, requireProof: approval && proof, ...(cap ? { capacity: cap } : {}) };
      if (id) {
        await market.updateClass(token as string, id, body);
        router.back();
      } else {
        const made = await market.createClass(token as string, body);
        router.replace(`/market/class/${made.id}` as never);
        Alert.alert(t('class.createdTitle'), t('class.createdText'), [
          { text: t('common.later'), style: 'cancel' },
          { text: t('invite.share'), onPress: () => Share.share({ message: t('invite.message', { title: title.trim(), link: inviteLink(API_URL, made.inviteToken), code: made.joinCode }) }) },
        ]);
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, extra: object = {}) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={set} accessibilityLabel={label} placeholderTextColor={colors.textMuted} style={styles.input} {...extra} />
    </View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={undefined}>
      <Stack.Screen options={{ headerShown: true, title: t(id ? 'class.edit' : 'class.create'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!id && <Text style={styles.lead}>{t('class.createLead')}</Text>}
        {field(t('class.fTitle'), title, setTitle, { maxLength: 100, placeholder: t('class.fTitleHint'), autoFocus: !id })}
        {field(t('class.fSubject'), subject, setSubject, { maxLength: 60, placeholder: t('class.fSubjectHint') })}
        {!id && (
          <Pressable onPress={() => setMore(!more)} accessibilityRole="button" style={{ paddingVertical: 4 }}>
            <Text style={styles.link}>{more ? t('class.lessOptions') : t('class.moreOptions')}</Text>
          </Pressable>
        )}
        {more && (
          <>
            {field(t('class.fDescription'), description, setDescription, { multiline: true, maxLength: 2000 })}
            {field(t('class.fLimit'), limit, setLimit, { keyboardType: 'number-pad', maxLength: 3, placeholder: t('class.noLimit') })}
            {field(t('class.fPrice'), price, setPrice, { keyboardType: 'number-pad', maxLength: 9, placeholder: t('class.free') })}
            <Text style={styles.help}>{t('class.priceNote')}</Text>
          </>
        )}
        <View style={styles.protect}>
          <Pressable accessibilityRole="switch" onPress={() => setProtect(!protect)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="lock-closed" size={20} color={colors.primary} />
            <Text style={[styles.label, { flex: 1 }]}>{t('protect.title')}</Text>
            <Switch value={protect} onValueChange={setProtect} trackColor={{ true: colors.success }} />
          </Pressable>
          <Text style={styles.help}>{t('protect.text')}</Text>
          <Text style={styles.help}>{t('protect.limit')}</Text>
        </View>
        <View style={styles.protect}>
          <Pressable accessibilityRole="switch" onPress={() => setApproval(!approval)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.label, { flex: 1 }]}>{t('class.approval')}</Text>
            <Switch value={approval} onValueChange={setApproval} trackColor={{ true: colors.success }} />
          </Pressable>
          <Text style={styles.help}>{t('class.approvalHint')}</Text>
          {approval && (
            <Pressable accessibilityRole="switch" onPress={() => setProof(!proof)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
              <Ionicons name="camera" size={20} color={colors.primary} />
              <Text style={[styles.label, { flex: 1 }]}>{t('class.requireProof')}</Text>
              <Switch value={proof} onValueChange={setProof} trackColor={{ true: colors.success }} />
            </Pressable>
          )}
        </View>
        <Action label={busy ? t('state.loading') : t(id ? 'common.save' : 'class.create')} kind="accent" onPress={save} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  protect: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.md, gap: 6 },
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  label: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  link: { color: colors.primaryLight, fontWeight: '700' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, minHeight: 50, fontSize: 16, color: colors.text, backgroundColor: colors.surface },
});
