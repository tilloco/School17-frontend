import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market, OwnReview, PendingReview, ReviewList } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PrimaryButton key={n} title={String(n)} variant={value === n ? 'primary' : 'outline'} onPress={() => onChange(n)} />
      ))}
    </View>
  );
}

/** Pupil / guardian: write a review after a completed lesson, edit within the allowed window. */
function ReviewForm({ initial, onSave }: { initial?: { rating: number; text: string }; onSave: (rating: number, text: string) => Promise<void> }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <StarPicker value={rating} onChange={setRating} />
      <TextInput value={text} onChangeText={setText} maxLength={1000} multiline placeholder={t('rev.placeholder')} accessibilityLabel={t('rev.placeholder')} style={styles.input} />
      <PrimaryButton
        title={t('rev.save')}
        disabled={rating < 1 || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onSave(rating, text.trim());
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

function PupilReviews({ token }: { token: string }) {
  const pending = useAsync(() => market.pendingReviews(token), [token]);
  const mine = useAsync(() => market.myReviews(token), [token]);
  const [editing, setEditing] = useState<string | null>(null);
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
  const reload = () => {
    pending.reload();
    mine.reload();
    setEditing(null);
  };
  if (pending.state !== 'ready' || mine.state !== 'ready' || !pending.data || !mine.data) {
    const s = pending.state !== 'ready' ? pending.state : mine.state;
    return <StateView state={s === 'ready' ? 'loading' : s} onRetry={() => { pending.reload(); mine.reload(); }} />;
  }
  return (
    <>
      <Text style={styles.h2}>{t('rev.toWrite')}</Text>
      {pending.data.length === 0 && <Text style={styles.help}>{t('rev.nonePending')}</Text>}
      {pending.data.map((p: PendingReview) => (
        <View key={p.bookingId} style={styles.card}>
          <Text style={styles.strong}>{p.teacher.name}</Text>
          {editing === p.bookingId ? (
            <ReviewForm onSave={async (r, x) => { try { await market.createReview(token, p.bookingId, r, x); reload(); } catch (e) { fail(e); } }} />
          ) : (
            <PrimaryButton title={t('rev.write')} variant="outline" onPress={() => setEditing(p.bookingId)} />
          )}
        </View>
      ))}
      <Text style={styles.h2}>{t('rev.mine')}</Text>
      {mine.data.length === 0 && <Text style={styles.help}>{t('rev.noneMine')}</Text>}
      {mine.data.map((r: OwnReview) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.strong}>{stars(r.rating)}</Text>
          {!!r.text && <Text>{r.text}</Text>}
          {r.reply && <Text style={styles.help}>{t('rev.reply')}: {r.reply.text}</Text>}
          {editing === r.id ? (
            <ReviewForm initial={{ rating: r.rating, text: r.text ?? '' }} onSave={async (x, y) => { try { await market.updateReview(token, r.id, x, y); reload(); } catch (e) { fail(e); } }} />
          ) : (
            new Date(r.canEditUntil).getTime() > Date.now() && <PrimaryButton title={t('rev.edit')} variant="outline" onPress={() => setEditing(r.id)} />
          )}
        </View>
      ))}
    </>
  );
}

/** Teacher: read own reviews and reply once. */
function TeacherReviews({ token }: { token: string }) {
  const profile = useAsync(() => market.ownProfile(token), [token]);
  const list = useAsync<ReviewList | null>(async () => (profile.data ? market.reviewsPage(token, profile.data.id) : null), [token, profile.data?.id]);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [text, setText] = useState('');
  if (profile.state !== 'ready' || list.state !== 'ready' || !list.data) {
    const s = profile.state !== 'ready' ? profile.state : list.state;
    return <StateView state={s === 'ready' ? 'loading' : s} onRetry={() => { profile.reload(); list.reload(); }} />;
  }
  const send = async (id: string) => {
    try {
      await market.replyReview(token, id, text.trim());
      setReplyFor(null);
      setText('');
      list.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  return (
    <>
      {list.data.items.length === 0 && <Text style={styles.help}>{t('rev.noneMine')}</Text>}
      {list.data.items.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.strong}>{stars(r.rating)} · {r.author}</Text>
          {!!r.text && <Text>{r.text}</Text>}
          {r.reply ? (
            <Text style={styles.help}>{t('rev.reply')}: {r.reply.text}</Text>
          ) : replyFor === r.id ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput value={text} onChangeText={setText} maxLength={1000} multiline placeholder={t('rev.replyPlaceholder')} accessibilityLabel={t('rev.replyPlaceholder')} style={styles.input} />
              <PrimaryButton title={t('rev.send')} disabled={!text.trim()} onPress={() => send(r.id)} />
            </View>
          ) : (
            <PrimaryButton title={t('rev.replyOnce')} variant="outline" onPress={() => setReplyFor(r.id)} />
          )}
        </View>
      ))}
    </>
  );
}

export default function ReviewsScreen() {
  const { token } = useAuth();
  const me = useAsync(() => market.me(token as string), [token]);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('rev.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        {me.state !== 'ready' || !me.data ? (
          <StateView state={me.state === 'ready' ? 'loading' : me.state} onRetry={me.reload} />
        ) : me.data.role === 'TEACHER' ? (
          <TeacherReviews token={token as string} />
        ) : (
          <PupilReviews token={token as string} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing.xs ?? 4, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 80, color: colors.text, backgroundColor: colors.surface, textAlignVertical: 'top' },
});
