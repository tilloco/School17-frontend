import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

const mins = (sec: number) => Math.round(sec / 60);

/** Session recap. Teacher: full attendance, unanswered questions (with late answers) and the lesson note. Pupil / guardian: own attendance, answered Q&A, files, note. */
export default function RecapScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const { token } = useAuth();
  const r = useAsync(() => market.classRecap(token as string, sid), [token, sid]);
  const [note, setNote] = useState({ topic: '', homework: '', nextStep: '' });
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'EDIT_WINDOW_CLOSED' ? t('recap.editClosed') : e instanceof ApiError && e.code === 'CONTACT_INFO_NOT_ALLOWED' ? t('cchat.contact') : e instanceof ApiError ? e.message : t('state.error'));

  if (r.state !== 'ready' || !r.data) return <Screen><Stack.Screen options={{ headerShown: true, title: t('recap.title'), headerBackTitle: t('common.back') }} /><StateView state={r.state === 'ready' ? 'loading' : r.state} onRetry={r.reload} /></Screen>;
  const d = r.data;
  const teacher = d.role === 'teacher';
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('recap.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <View style={styles.card}>
          <Text style={styles.strong}>{new Date(d.startAt).toLocaleString()}</Text>
          <Text>{t('recap.duration', { min: mins(d.durationSec) })}</Text>
          <Text style={styles.help}>{t('recap.questions', { asked: d.questions.asked, answered: d.questions.answered })}</Text>
        </View>

        <Text style={styles.h2}>{t('recap.attendance')}</Text>
        {d.attendance.map((a) => (
          <View key={a.pupilId} style={styles.card}>
            <Text style={styles.strong}>{teacher ? a.name : t('recap.you')}</Text>
            <Text>{a.attended ? t('recap.present', { min: mins(a.totalSeconds) }) : t('recap.absent')}{a.joinedLate ? ` · ${t('recap.late')}` : ''}</Text>
          </View>
        ))}

        {d.files.length > 0 && (
          <>
            <Text style={styles.h2}>{t('recap.files')}</Text>
            {d.files.map((f, i) => <Text key={i}>• {f.name}</Text>)}
          </>
        )}

        {d.questions.answeredList.length > 0 && (
          <>
            <Text style={styles.h2}>{t('recap.qa')}</Text>
            {d.questions.answeredList.map((q, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.strong}>{q.text}</Text>
                {!!q.reply && <Text>{q.reply}</Text>}
              </View>
            ))}
          </>
        )}

        {teacher && (d.questions.unanswered?.length ?? 0) > 0 && (
          <>
            <Text style={styles.h2}>{t('recap.unanswered')}</Text>
            {d.questions.unanswered!.map((q) => (
              <View key={q.id} style={styles.card}>
                <Text style={styles.strong}>{q.text}</Text>
                <TextInput value={answer[q.id] ?? ''} onChangeText={(v) => setAnswer((a) => ({ ...a, [q.id]: v }))} multiline maxLength={1500} placeholder={t('recap.lateAnswer')} accessibilityLabel={t('recap.lateAnswer')} style={styles.input} />
                <PrimaryButton title={t('recap.postAnswer')} variant="outline" disabled={!(answer[q.id] ?? '').trim()} onPress={() => market.classLateAnswer(token as string, sid, q.id, answer[q.id].trim()).then(() => { setAnswer((a) => ({ ...a, [q.id]: '' })); r.reload(); }).catch(fail)} />
              </View>
            ))}
          </>
        )}

        <Text style={styles.h2}>{t('recap.note')}</Text>
        {d.note && !teacher && (
          <View style={styles.card}>
            {!!d.note.topic && <Text>{t('feed.topic')}: {d.note.topic}</Text>}
            {!!d.note.homework && <Text>{t('feed.homework')}: {d.note.homework}</Text>}
            {!!d.note.nextStep && <Text>{t('feed.nextStep')}: {d.note.nextStep}</Text>}
          </View>
        )}
        {!d.note && !teacher && <Text style={styles.help}>{t('recap.noNote')}</Text>}
        {teacher && (
          <View style={styles.card}>
            {(['topic', 'homework', 'nextStep'] as const).map((k) => (
              <TextInput key={k} value={note[k] || (d.note?.[k] ?? '')} onChangeText={(v) => setNote((n) => ({ ...n, [k]: v }))} multiline maxLength={k === 'homework' ? 1000 : 500} placeholder={t(`feed.${k}`)} accessibilityLabel={t(`feed.${k}`)} style={styles.input} />
            ))}
            <Text style={styles.help}>{t('recap.noteHint')}</Text>
            <PrimaryButton title={t('common.save')} onPress={() => market.classNote(token as string, sid, { topic: note.topic || d.note?.topic || '', homework: note.homework || d.note?.homework || '', nextStep: note.nextStep || d.note?.nextStep || '' }).then(() => { Alert.alert(t('common.ok')); r.reload(); }).catch(fail)} />
          </View>
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
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
