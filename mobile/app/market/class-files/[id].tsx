import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../src/ui/Text';
import { Stack, useLocalSearchParams } from 'expo-router';
import { documentPicker } from '../../../src/lib/native';
import { Screen } from '../../../src/components/Screen';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { useClassProtect } from '../../../src/lib/protect';
import { t } from '../../../src/i18n';
import { uploadErrorText } from '../../../src/market/AttachBar';
import { market } from '../../../src/market/marketApi';
import { uploadFile } from '../../../src/market/uploader';
import { useAsync } from '../../../src/market/useAsync';
import { colors, radius, spacing } from '../../../src/theme/colors';

function fmtBytes(n?: number | null) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

/** Class library: PDF files with search. Teacher: upload (chunked, resumable), delete, allow/deny download. Members: open download (if allowed) and report. */
export default function ClassFilesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  useClassProtect(id);
  const [q, setQ] = useState('');
  const me = useAsync(() => market.me(token as string), [token]);
  const files = useAsync(() => market.classFiles(token as string, id, q), [token, id, q]);
  const [progress, setProgress] = useState<number | null>(null);
  const teacher = me.data?.role === 'TEACHER';
  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : uploadErrorText(e));

  const upload = async () => {
    const DP = documentPicker();
    if (!DP) return;
    const r = await DP.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    setProgress(0);
    try {
      const { fileId } = await uploadFile({ token: token as string, uri: a.uri, name: a.name || 'file', mime: a.mimeType || 'application/octet-stream', purpose: 'CLASS_FILE', onProgress: setProgress });
      await market.addClassFile(token as string, id, fileId);
      files.reload();
    } catch (e) {
      fail(e);
    } finally {
      setProgress(null);
    }
  };
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      files.reload();
    } catch (e) {
      fail(e);
    }
  };
  const download = (fid: string) => run(async () => {
    const r = await market.classFileDownload(token as string, id, fid);
    await Linking.openURL(r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url);
  });
  const report = (fid: string) => Alert.alert(t('cfile.report'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('cfile.reportCopyright'), onPress: () => void market.classFileReport(token as string, id, fid, 'COPYRIGHT').then(() => Alert.alert(t('common.ok'))).catch(fail) },
    { text: t('cfile.reportOther'), onPress: () => void market.classFileReport(token as string, id, fid, 'INAPPROPRIATE').then(() => Alert.alert(t('common.ok'))).catch(fail) },
  ]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('cfile.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <TextInput value={q} onChangeText={setQ} placeholderTextColor={colors.textMuted} placeholder={t('cfile.search')} accessibilityLabel={t('cfile.search')} style={styles.input} />
        {teacher && (progress === null ? <PrimaryButton title={t('cfile.upload')} onPress={upload} /> : <Text accessibilityLiveRegion="polite">{t('attach.uploading', { pct: Math.round(progress * 100) })}</Text>)}
        {files.state !== 'ready' || !files.data ? (
          <StateView state={files.state === 'ready' ? 'loading' : files.state} onRetry={files.reload} />
        ) : files.data.length === 0 ? (
          <Text style={styles.help}>{t('cfile.none')}</Text>
        ) : (
          files.data.map((f) => (
            <View key={f.id} style={styles.card}>
              <Text style={styles.strong}>{f.name}</Text>
              <Text style={styles.help}>
                {f.mime && f.mime !== 'application/pdf' ? fmtBytes(f.sizeBytes) : f.renderStatus === 'READY' ? t('cfile.pages', { n: f.pageCount }) : f.renderStatus === 'PREPARING' ? t('cfile.preparing', { n: f.renderedPages, total: f.pageCount || '?' }) : t('cfile.failed')}
                {f.sizeBytes ? ` · ${(f.sizeBytes / 1048576).toFixed(1)} MB` : ''}
              </Text>
              <View style={styles.row}>
                {(teacher || f.allowDownload) && <PrimaryButton title={t('cfile.download')} variant="outline" onPress={() => download(f.id)} />}
                {teacher ? (
                  <>
                    <PrimaryButton title={t(f.allowDownload ? 'cfile.denyDownload' : 'cfile.allowDownload')} variant="outline" onPress={() => run(() => market.setClassFileDownload(token as string, id, f.id, !f.allowDownload))} />
                    <PrimaryButton title={t('cfile.delete')} variant="outline" onPress={() => Alert.alert(t('cfile.delete'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), style: 'destructive', onPress: () => void run(() => market.deleteClassFile(token as string, id, f.id)) }])} />
                  </>
                ) : (
                  <PrimaryButton title={t('cfile.report')} variant="outline" onPress={() => report(f.id)} />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface },
});
