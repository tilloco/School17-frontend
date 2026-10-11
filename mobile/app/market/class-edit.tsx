import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { colors, radius, spacing } from '../../src/theme/colors';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Teacher: create a class, or edit title / description / capacity / price when ?id= is given. */
export default function ClassEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [price, setPrice] = useState('0');
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    market.classDetail(token as string, id).then((c) => {
      setTitle(c.title); setSubject(c.subject); setDescription(c.description); setCapacity(String(c.capacity)); setPrice(String(Math.round(c.priceMinor / 100)));
    }).catch(() => undefined);
  }, [id, token]);

  const save = async () => {
    const cap = num(capacity);
    const priceNum = num(price);
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!title.trim() || !subject.trim() || !(cap >= 1) || Number.isNaN(priceNum) || (!id && (!days.length || !m))) return Alert.alert(t('common.error'), t('class.formInvalid'));
    setBusy(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), subject: subject.trim(), description: description.trim(), capacity: cap, priceMinor: priceNum * 100 };
      if (id) await market.updateClass(token as string, id, body);
      else {
        const made = await market.createClass(token as string, { ...body, weekdays: days, startMinute: Number(m![1]) * 60 + Number(m![2]), durationMin: num(duration) || 60 });
        Alert.alert(t('class.codeTitle'), t('class.codeShown', { code: made.joinCode }));
      }
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, extra: object = {}) => (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={set} accessibilityLabel={label} style={styles.input} {...extra} />
    </View>
  );
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t(id ? 'class.edit' : 'class.create'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        {field(t('class.fTitle'), title, setTitle, { maxLength: 100 })}
        {field(t('class.fSubject'), subject, setSubject, { maxLength: 60 })}
        {field(t('class.fDescription'), description, setDescription, { multiline: true, maxLength: 2000 })}
        {field(t('class.fCapacity'), capacity, setCapacity, { keyboardType: 'number-pad', maxLength: 2 })}
        {field(t('class.fPrice'), price, setPrice, { keyboardType: 'number-pad', maxLength: 9 })}
        <Text style={styles.help}>{t('class.priceNote')}</Text>
        {!id && (
          <>
            <Text style={styles.label}>{t('class.fDays')}</Text>
            <View style={styles.row}>
              {DAYS.map((d) => (
                <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: days.includes(d) }} onPress={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))} style={[styles.chip, days.includes(d) && styles.chipOn]}>
                  <Text style={{ color: days.includes(d) ? '#fff' : colors.text }}>{t(`class.day${d}`)}</Text>
                </Pressable>
              ))}
            </View>
            {field(t('class.fTime'), time, setTime, { maxLength: 5, placeholder: '18:00' })}
            {field(t('class.fDuration'), duration, setDuration, { keyboardType: 'number-pad', maxLength: 3 })}
          </>
        )}
        <PrimaryButton title={t('common.save')} onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
