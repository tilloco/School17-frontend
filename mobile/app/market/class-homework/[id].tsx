import React, { useState } from 'react';
import { fmtDateTime } from '../../../src/ui/format';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams } from 'expo-router';
import { imagePicker } from '../../../src/lib/native';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { Celebrate } from '../../../src/ui/Celebrate';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { uploadErrorText } from '../../../src/market/AttachBar';
import { HomeworkDetail, HomeworkItem, market } from '../../../src/market/marketApi';
import { uploadFile } from '../../../src/market/uploader';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

/** Class homework. Teacher: assign (title, text, deadline in days), review submissions and mark 0-100 with a comment. Pupil: submit text and/or a photo; late submissions are flagged. */
export default function ClassHomeworkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const me = useAsync(() => market.me(token as string), [token]);
  const list = useAsync(() => market.homeworkList(token as string, id), [token, id]);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useAsync<HomeworkDetail | null>(async () => (open ? market.homeworkDetail(token as string, id, open) : null), [token, id, open]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [days, setDays] = useState('3');
  const [answer, setAnswer] = useState('');
  const [win, setWin] = useState(false);
  const [score, setScore] = useState<Record<string, string>>({});
  const teacher = me.data?.role === 'TEACHER';
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'ALREADY_MARKED' ? t('hw.alreadyMarked') : e.code === 'CONTACT_INFO_NOT_ALLOWED' ? t('cchat.contact') : e.message) : uploadErrorText(e));

  const create = () => {
    const d = Number(days);
    if (!title.trim() || !(d >= 1 && d <= 180)) return Alert.alert(t('hw.invalid'));
    market.createHomework(token as string, id, { title: title.trim(), text: text.trim(), dueAt: new Date(Date.now() + d * 86_400_000).toISOString() }).then(() => { setTitle(''); setText(''); list.reload(); }).catch(fail);
  };
  const submit = async (hw: HomeworkItem, fileId?: string) => {
    try {
      await market.submitHomework(token as string, id, hw.id, { text: answer.trim() || undefined, fileId });
      setAnswer('');
      setWin(true);
      detail.reload();
      list.reload();
    } catch (e) {
      fail(e);
    }
  };
  const photo = async (hw: HomeworkItem) => {
    const IP = imagePicker();
    if (!IP) return;
    const perm = await IP.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('attach.permission'));
    const r = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    try {
      const { fileId } = await uploadFile({ token: token as string, uri: a.uri, name: a.fileName || 'homework.jpg', mime: a.mimeType || 'image/jpeg', purpose: 'HOMEWORK' });
      await submit(hw, fileId);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('hw.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        {teacher && (
          <View style={styles.card}>
            <Text style={styles.strong}>{t('hw.assign')}</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={200} placeholderTextColor={colors.textMuted} placeholder={t('hw.fTitle')} accessibilityLabel={t('hw.fTitle')} style={styles.input} />
            <TextInput value={text} onChangeText={setText} multiline maxLength={4000} placeholderTextColor={colors.textMuted} placeholder={t('hw.fText')} accessibilityLabel={t('hw.fText')} style={styles.input} />
            <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3} placeholderTextColor={colors.textMuted} placeholder={t('hw.fDays')} accessibilityLabel={t('hw.fDays')} style={styles.input} />
            <PrimaryButton title={t('hw.assign')} onPress={create} />
          </View>
        )}
        {list.state !== 'ready' || !list.data ? (
          <StateView state={list.state === 'ready' ? 'loading' : list.state} onRetry={list.reload} />
        ) : list.data.length === 0 ? (
          <Text style={styles.help}>{t('hw.none')}</Text>
        ) : (
          list.data.map((h) => (
            <View key={h.id} style={styles.card}>
              <Text style={styles.strong}>{h.title}</Text>
              {!!h.text && <Text>{h.text}</Text>}
              <Text style={styles.help}>{t('hw.due', { time: fmtDateTime(new Date(h.dueAt)) })}{h.overdue ? ` · ${t('hw.overdue')}` : ''}</Text>
              {teacher && <Text style={styles.help}>{t('hw.counts', { s: h.submitted ?? 0, m: h.marked ?? 0 })}</Text>}
              {!teacher && h.mine?.map((s) => <Text key={s.id}>{s.marked ? t('hw.score', { score: s.score ?? 0 }) : t('hw.submitted')}{s.late ? ` · ${t('hw.late')}` : ''}{s.comment ? ` — ${s.comment}` : ''}</Text>)}
              <PrimaryButton title={open === h.id ? t('hw.close') : t('hw.open')} variant="outline" onPress={() => setOpen(open === h.id ? null : h.id)} />
              {open === h.id && detail.data && (
                <View style={{ gap: spacing.xs }}>
                  {teacher ? (
                    detail.data.pupils?.map((p) => (
                      <View key={p.pupilId} style={styles.sub}>
                        <Text style={styles.strong}>{p.name}</Text>
                        {p.submission ? (
                          <>
                            <Text>{p.submission.text}</Text>
                            {p.submission.fileId && <Text style={styles.help}>{t('hw.hasFile')}</Text>}
                            <Text style={styles.help}>{p.submission.late ? t('hw.late') : t('hw.onTime')}{p.submission.marked ? ` · ${t('hw.score', { score: p.submission.score ?? 0 })}` : ''}</Text>
                            {!p.submission.marked && (
                              <View style={styles.row}>
                                <TextInput value={score[p.pupilId] ?? ''} onChangeText={(v) => setScore((s) => ({ ...s, [p.pupilId]: v }))} keyboardType="number-pad" maxLength={3} placeholderTextColor={colors.textMuted} placeholder={t('hw.scorePlaceholder')} accessibilityLabel={t('hw.scorePlaceholder')} style={[styles.input, { flex: 1 }]} />
                                <PrimaryButton title={t('hw.mark')} onPress={() => { const n = Number(score[p.pupilId]); if (!(n >= 0 && n <= 100)) return Alert.alert(t('hw.invalid')); market.markHomework(token as string, id, h.id, p.pupilId, n).then(() => detail.reload()).catch(fail); }} />
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={styles.help}>{t('hw.notSubmitted')}</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <>
                      <TextInput value={answer} onChangeText={setAnswer} multiline maxLength={4000} placeholderTextColor={colors.textMuted} placeholder={t('hw.yourAnswer')} accessibilityLabel={t('hw.yourAnswer')} style={styles.input} />
                      <View style={styles.row}>
                        <PrimaryButton title={t('hw.send')} disabled={!answer.trim()} onPress={() => submit(h)} />
                        <PrimaryButton title={t('hw.sendPhoto')} variant="outline" onPress={() => photo(h)} />
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
      <Celebrate visible={win} title={t('cel.hwTitle')} text={t('cel.hwText')} icon="checkmark-done" onClose={() => setWin(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  sub: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs, gap: 2 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
