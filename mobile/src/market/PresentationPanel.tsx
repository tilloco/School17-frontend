import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui/Text';
import { PrimaryButton } from '../components/PrimaryButton';
import { API_URL, ApiError } from '../lib/api';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';
import { ClassFileItem, ClassRoomState, market } from './marketApi';

/**
 * PDF presenter. The teacher picks a file and flips pages; pupils follow the teacher's page and may browse on their own
 * (one tap returns them). Pages are images served by the backend; the next two pages are preloaded. A data-saver switch uses the smaller image.
 * STATUS: type-checked only; the laser pointer needs the media data channel (blocked, see BLOCKED.md).
 */
export function PresentationPanel({ token, classId, sessionId, state, teacher, onChanged }: { token: string; classId: string; sessionId: string; state: ClassRoomState; teacher: boolean; onChanged: () => void }) {
  const pres = state.presentation;
  const [files, setFiles] = useState<ClassFileItem[]>([]);
  const [own, setOwn] = useState<number | null>(null); // pupil's own page while browsing
  const [saver, setSaver] = useState(false);

  useEffect(() => {
    if (teacher) market.classFiles(token, classId).then(setFiles).catch(() => undefined);
  }, [teacher, token, classId, state.status, pres?.renderedPages]);
  useEffect(() => setOwn(null), [pres?.fileId]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError && e.code === 'PAGE_NOT_READY' ? t('pres.notReady') : e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  const url = (fileId: string, page: number) => `${API_URL}/classes/${classId}/files/${fileId}/pages/${page}?size=${saver ? 'small' : 'full'}`;
  const headers = { Authorization: `Bearer ${token}` };

  if (!pres) {
    if (!teacher) return null;
    const ready = files.filter((f) => f.renderedPages > 0);
    return (
      <View style={styles.card}>
        <Text style={styles.strong}>{t('pres.title')}</Text>
        {ready.length === 0 && <Text style={styles.help}>{t('pres.noFiles')}</Text>}
        {ready.map((f) => (
          <PrimaryButton key={f.id} title={`${f.name}${f.renderStatus === 'PREPARING' ? ` (${t('pres.preparing')})` : ''}`} variant="outline" onPress={() => act(() => market.present(token, sessionId, f.id, 1))} />
        ))}
      </View>
    );
  }
  const page = teacher ? pres.page : own ?? pres.page;
  const browsing = !teacher && own !== null && own !== pres.page;
  const maxPage = Math.max(1, pres.renderedPages);
  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), maxPage);
    if (teacher) void act(() => market.present(token, sessionId, pres.fileId, next));
    else setOwn(next);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.strong}>{pres.name}</Text>
      {pres.renderStatus === 'PREPARING' && <Text style={styles.help}>{t('pres.preparingPages', { n: pres.renderedPages, total: pres.pageCount || '?' })}</Text>}
      <Image accessibilityLabel={t('pres.pageLabel', { n: page })} source={{ uri: url(pres.fileId, page), headers }} style={styles.page} resizeMode="contain" />
      {/* Next two pages are fetched in advance (hidden, 1 px) */}
      {[1, 2].map((d) => (page + d <= pres.renderedPages ? <Image key={d} source={{ uri: url(pres.fileId, page + d), headers }} style={styles.hidden} /> : null))}
      <Text style={styles.help}>{t('pres.pageOf', { n: page, total: pres.pageCount || pres.renderedPages })}</Text>
      <View style={styles.row}>
        <PrimaryButton title={t('pres.prev')} variant="outline" disabled={page <= 1} onPress={() => go(page - 1)} />
        <PrimaryButton title={t('pres.next')} variant="outline" disabled={page >= maxPage} onPress={() => go(page + 1)} />
        {teacher && <PrimaryButton title={t('pres.stop')} variant="outline" onPress={() => act(() => market.presentStop(token, sessionId))} />}
        {browsing && <PrimaryButton title={t('pres.backToTeacher')} onPress={() => setOwn(null)} />}
      </View>
      <View style={styles.row}>
        <Switch value={saver} onValueChange={setSaver} accessibilityLabel={t('pres.saver')} />
        <Text>{t('pres.saver')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  page: { width: '100%', aspectRatio: 1.4, backgroundColor: '#fff' },
  hidden: { width: 1, height: 1, opacity: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
});
