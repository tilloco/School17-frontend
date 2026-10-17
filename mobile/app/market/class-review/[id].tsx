import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';
import { Action, Stars } from '../../../src/ui';

/** Rate a class: stars and a few words. Possible after you attended at least two finished lessons, once per class. The stars are real: nobody can hide them. */
export default function ClassReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const st = useAsync(() => market.classReviewState(token as string, id), [token, id]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await market.createClassReview(token as string, id, rating, text.trim());
      Alert.alert(t('rev.thanks'));
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'NOT_ENOUGH_LESSONS' ? t('rev.needLessons') : e.message) : t('state.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: t('rev.rateClass'), headerBackTitle: t('common.back') }} />
      {st.state !== 'ready' || !st.data ? <StateView state={st.state === 'ready' ? 'loading' : st.state} onRetry={st.reload} /> : st.data.review ? (
        <View style={styles.body}>
          <Text style={styles.h}>{t('rev.already')}</Text>
          <Stars value={st.data.review.rating} size={30} />
          {!!st.data.review.text && <Text style={styles.text}>{st.data.review.text}</Text>}
        </View>
      ) : !st.data.canReview ? (
        <View style={styles.body}>
          <Ionicons name="lock-closed" size={44} color={colors.textMuted} />
          <Text style={styles.h}>{t('rev.needLessons')}</Text>
          <Text style={styles.text}>{t('rev.attended', { n: st.data.attended })}</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.h}>{t('rev.howWas')}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}`} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={44} color="#F5B301" />
              </Pressable>
            ))}
          </View>
          <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder={t('rev.placeholder')} placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel={t('rev.placeholder')} />
          <Text style={styles.note}>{t('rev.honest')}</Text>
          <Action label={busy ? t('state.loading') : t('rev.save')} kind="accent" onPress={save} disabled={rating < 1 || busy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.md, alignItems: 'stretch' },
  h: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  text: { color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.md, minHeight: 110, textAlignVertical: 'top', fontSize: 16, color: colors.text },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
