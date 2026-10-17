import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { documentPicker, imagePicker } from '../lib/native';
import { PrimaryButton } from '../components/PrimaryButton';
import { ApiError } from '../lib/api';
import { t } from '../i18n';
import { colors, spacing } from '../theme/colors';
import { UploadError, uploadFile } from './uploader';

interface Picked { uri: string; name: string; mime: string }

export function uploadErrorText(e: unknown): string {
  const code = e instanceof UploadError ? e.code : e instanceof ApiError ? e.code : undefined;
  if (code === 'FILE_TOO_LARGE') {
    const lim = e instanceof ApiError ? Number(e.details?.limitBytes) : NaN;
    return Number.isFinite(lim) ? t('attach.tooLargeMb', { mb: Math.round(lim / 1048576) }) : t('attach.tooLarge');
  }
  if (code === 'TYPE_NOT_ALLOWED') return t('attach.type');
  if (code === 'QUOTA_EXCEEDED') return t('attach.quota');
  if (code === 'CANCELLED') return t('attach.cancelled');
  if (code && /REJECT|INFECTED|UNSAFE|CORRUPT|MIME|EXT/i.test(code)) return t('attach.rejected');
  if (code === 'CHUNK_FAILED') return t('attach.interrupted');
  return t('attach.failed');
}

/**
 * Photo / PDF picker with chunked upload, progress, retry (resumes missing parts) and cancel.
 * Calls onUploaded(fileId) when the file is READY; the caller then sends the message.
 * STATUS: not run on a device (backend flow is tested).
 */
export function AttachBar({ token, disabled, onUploaded }: { token: string; disabled?: boolean; onUploaded: (fileId: string, name: string) => Promise<void> }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ picked: Picked; fileId?: string } | null>(null);
  const cancel = useRef({ cancelled: false });

  const run = async (picked: Picked, resumeFileId?: string) => {
    cancel.current = { cancelled: false };
    setError(null);
    setRetry(null);
    setProgress(0);
    try {
      const { fileId } = await uploadFile({ token, uri: picked.uri, name: picked.name, mime: picked.mime, purpose: 'MESSAGE_ATTACHMENT', onProgress: setProgress, signal: cancel.current, resumeFileId });
      await onUploaded(fileId, picked.name);
    } catch (e) {
      setError(uploadErrorText(e));
      const resumable = e instanceof UploadError && (e.code === 'CHUNK_FAILED' || e.code === 'COMPLETE_FAILED') ? e.fileId : undefined;
      if (!(e instanceof UploadError && e.code === 'CANCELLED')) setRetry({ picked, fileId: resumable });
    } finally {
      setProgress(null);
    }
  };

  const pickPhoto = async () => {
    const IP = imagePicker();
    if (!IP) return;
    const perm = await IP.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('attach.permission'));
    const r = await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const a = r.canceled ? null : r.assets[0];
    if (a) await run({ uri: a.uri, name: a.fileName || 'photo.jpg', mime: a.mimeType || 'image/jpeg' });
  };
  const pickPdf = async () => {
    const DP = documentPicker();
    if (!DP) return;
    const r = await DP.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const a = r.canceled ? null : r.assets[0];
    if (a) await run({ uri: a.uri, name: a.name || 'file', mime: a.mimeType || 'application/octet-stream' });
  };

  const busy = progress !== null;
  return (
    <View style={styles.box}>
      {busy ? (
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityLiveRegion="polite">{t('attach.uploading', { pct: Math.round((progress ?? 0) * 100) })}</Text>
          <PrimaryButton title={t('common.cancel')} variant="outline" onPress={() => { cancel.current.cancelled = true; }} />
        </View>
      ) : (
        <View style={styles.row}>
          <PrimaryButton title={t('attach.photo')} variant="outline" disabled={disabled} onPress={pickPhoto} />
          <PrimaryButton title={t('attach.pdf')} variant="outline" disabled={disabled} onPress={pickPdf} />
        </View>
      )}
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      {retry && !busy && <PrimaryButton title={t('attach.retry')} onPress={() => run(retry.picked, retry.fileId)} />}
      <Text style={styles.help}>{t('attach.limits')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger ?? '#b00020' },
  help: { color: colors.textMuted, fontSize: 12 },
});
