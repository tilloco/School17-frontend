import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '../../../src/ui/Text';
import { StateView } from '../../../src/components/StateView';
import { API_URL, ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { t } from '../../../src/i18n';
import { market } from '../../../src/market/marketApi';
import { useAsync } from '../../../src/market/useAsync';
import { colors, spacing } from '../../../src/theme/colors';
import { fmtDayTime, fmtMoney } from '../../../src/ui/format';
import { AuthImage } from '../../../src/ui';

type Tab = 'requests' | 'payments' | 'helpers';

/** The desk of a closed class: who is asking to join (with the payment photo), which payments to check, and who helps the teacher. */
export default function ClassDeskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const cls = useAsync(() => market.classDetail(token as string, id), [token, id]);
  const teacher = cls.data?.role === 'teacher';
  const perms = cls.data?.perms;
  const can = { members: teacher || !!perms?.canMembers, payments: teacher || !!perms?.canPayments };
  const tabs: Tab[] = [...(can.members ? ['requests' as const] : []), ...(can.payments ? ['payments' as const] : []), ...(teacher ? ['helpers' as const] : [])];
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab && tabs.includes(tab) ? tab : tabs[0];
  const [zoom, setZoom] = useState<string | null>(null);

  const reqs = useAsync(() => (can.members ? market.classRequests(token as string, id) : Promise.resolve([])), [token, id, can.members]);
  const money = useAsync(() => (can.payments ? market.classMoney(token as string, id) : Promise.resolve(null)), [token, id, can.payments]);
  const helpers = useAsync(() => (teacher ? market.classHelpers(token as string, id) : Promise.resolve([])), [token, id, teacher]);
  const [username, setUsername] = useState('');
  const [perm, setPerm] = useState({ canPayments: true, canMembers: true, canChat: true });

  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? (e.code === 'CLASS_FULL' ? t('class.full') : e.code === 'USER_NOT_FOUND' ? t('desk.noUser') : e.code === 'HELPER_MUST_BE_ADULT' ? t('desk.adultOnly') : e.code === 'TOO_MANY_HELPERS' ? t('desk.tooMany') : e.message) : t('state.error'));
  const decide = (eid: string, ok: boolean) => market.decideRequest(token as string, id, eid, ok).then(() => { reqs.reload(); cls.reload(); }).catch(fail);
  const mark = (pid: string, received: boolean) => (received ? market.classMarkReceived(token as string, id, [pid]) : market.classMarkNotReceived(token as string, id, [pid])).then(money.reload).catch(fail);
  const addHelper = () => market.addClassHelper(token as string, id, { username: username.trim(), ...perm }).then(() => { setUsername(''); helpers.reload(); }).catch(fail);
  const removeHelper = (uid: string) => Alert.alert(t('desk.removeHelper'), undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('desk.removeHelper'), style: 'destructive', onPress: () => void market.removeClassHelper(token as string, id, uid).then(helpers.reload).catch(fail) }]);

  const header = <Stack.Screen options={{ headerShown: true, title: t('desk.title'), headerBackTitle: t('common.back') }} />;
  if (cls.state !== 'ready' || !cls.data) return <View style={styles.root}>{header}<StateView state={cls.state === 'ready' ? 'loading' : cls.state} onRetry={cls.reload} /></View>;
  if (!tabs.length) return <View style={styles.root}>{header}<Text style={styles.empty}>{t('desk.nothing')}</Text></View>;

  const badge = (n: number) => (n > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{n}</Text></View> : null);
  const toCheck = (money.data?.rows ?? []).filter((r) => r.status === 'PUPIL_MARKED_PAID');
  const others = (money.data?.rows ?? []).filter((r) => r.status !== 'PUPIL_MARKED_PAID');

  return (
    <View style={styles.root}>
      {header}
      <Text style={styles.classTitle} numberOfLines={1}>{cls.data.title}</Text>
      <View style={styles.seg}>
        {tabs.map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: active === k }} onPress={() => setTab(k)} style={[styles.segItem, active === k && styles.segOn]}>
            <Text style={[styles.segText, active === k && { color: '#fff' }]}>{t(`desk.${k}`)}</Text>
            {k === 'requests' && badge(reqs.data?.length ?? 0)}
            {k === 'payments' && badge(toCheck.length)}
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: spacing.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {active === 'requests' && (reqs.state !== 'ready' ? <StateView state={reqs.state === 'loading' ? 'loading' : reqs.state} onRetry={reqs.reload} /> : reqs.data!.length === 0 ? (
          <View style={styles.emptyBox}><Ionicons name="checkmark-done-circle" size={44} color="#2ED573" /><Text style={styles.empty}>{t('desk.noRequests')}</Text></View>
        ) : reqs.data!.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHead}><Text style={styles.name} numberOfLines={1}>{r.name}</Text><Text style={styles.when}>{fmtDayTime(r.at)}</Text></View>
            {r.byGuardian && <Text style={styles.sub}>{t('desk.byGuardian')}</Text>}
            {!!r.note && <Text style={styles.note}>“{r.note}”</Text>}
            {r.hasProof ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('desk.proof')} onPress={() => setZoom(r.id)} style={styles.proof}>
                <AuthImage url={`${API_URL}/class-staff/${id}/requests/${r.id}/proof`} token={token as string} style={styles.proofImg} onFail={() => undefined} />
                <View style={styles.zoomTag}><Ionicons name="expand" size={14} color="#fff" /></View>
              </Pressable>
            ) : <Text style={styles.sub}>{t('desk.noProof')}</Text>}
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => void decide(r.id, true)} style={[styles.btn, { backgroundColor: '#2ED573' }]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.btnText}>{t('desk.approve')}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void decide(r.id, false)} style={[styles.btn, { backgroundColor: colors.neutralSoft }]}><Ionicons name="close" size={18} color={colors.text} /><Text style={[styles.btnText, { color: colors.text }]}>{t('desk.decline')}</Text></Pressable>
            </View>
          </View>
        )))}

        {active === 'payments' && (money.state !== 'ready' || !money.data ? <StateView state={money.state === 'loading' ? 'loading' : money.state === 'ready' ? 'loading' : money.state} onRetry={money.reload} /> : (<>
          <Text style={styles.section}>{t('desk.toCheck')} ({toCheck.length})</Text>
          {toCheck.length === 0 && <Text style={styles.empty}>{t('desk.nothingToCheck')}</Text>}
          {toCheck.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHead}><Text style={styles.name} numberOfLines={1}>{r.name}</Text><Text style={styles.amount}>{fmtMoney(r.amountMinor)}</Text></View>
              <Text style={styles.sub}>{t('desk.markedPaid')}{r.pupilMarkedAt ? ` · ${fmtDayTime(r.pupilMarkedAt)}` : ''}</Text>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" onPress={() => void mark(r.id, true)} style={[styles.btn, { backgroundColor: '#2ED573' }]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.btnText}>{t('desk.received')}</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => void mark(r.id, false)} style={[styles.btn, { backgroundColor: colors.neutralSoft }]}><Ionicons name="close" size={18} color={colors.text} /><Text style={[styles.btnText, { color: colors.text }]}>{t('desk.notReceived')}</Text></Pressable>
              </View>
            </View>
          ))}
          {others.length > 0 && <Text style={styles.section}>{t('desk.others')}</Text>}
          {others.map((r) => (
            <View key={r.id} style={styles.line}><Text style={styles.name} numberOfLines={1}>{r.name}</Text><Text style={styles.stat}>{t(`desk.st.${r.status}`)}</Text></View>
          ))}
        </>))}

        {active === 'helpers' && (<>
          <Text style={styles.sub}>{t('desk.helperHint')}</Text>
          {(helpers.data ?? []).map((h) => (
            <View key={h.userId} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}><Text style={styles.name}>{h.name}</Text><Text style={styles.sub}>@{h.username}</Text></View>
                <Pressable accessibilityRole="button" onPress={() => removeHelper(h.userId)} hitSlop={8}><Text style={styles.del}>{t('common.delete')}</Text></Pressable>
              </View>
              <View style={styles.perms}>
                {(['canPayments', 'canMembers', 'canChat'] as const).map((k) => <View key={k} style={[styles.pill, !h[k] && { opacity: 0.35 }]}><Text style={styles.pillText}>{t(`desk.perm.${k}`)}</Text></View>)}
              </View>
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.name}>{t('desk.addHelper')}</Text>
            <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="@username" placeholderTextColor={colors.textMuted} accessibilityLabel={t('desk.addHelper')} style={styles.input} />
            {(['canPayments', 'canMembers', 'canChat'] as const).map((k) => (
              <View key={k} style={styles.permRow}><Text style={styles.permText}>{t(`desk.permLong.${k}`)}</Text><Switch value={perm[k]} onValueChange={(v) => setPerm({ ...perm, [k]: v })} trackColor={{ true: colors.success }} /></View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => void addHelper()} disabled={username.trim().length < 3} style={[styles.btn, { backgroundColor: colors.primary, opacity: username.trim().length < 3 ? 0.4 : 1 }]}><Ionicons name="person-add" size={18} color="#fff" /><Text style={styles.btnText}>{t('desk.addHelperBtn')}</Text></Pressable>
          </View>
        </>)}
      </ScrollView>

      <Modal visible={!!zoom} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBack} onPress={() => setZoom(null)} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          {zoom && <AuthImage url={`${API_URL}/class-staff/${id}/requests/${zoom}/proof`} token={token as string} style={styles.zoomImg} onFail={() => setZoom(null)} />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  classTitle: { fontSize: 20, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  seg: { flexDirection: 'row', backgroundColor: colors.neutralSoft, borderRadius: 999, padding: 4, margin: spacing.md },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  segText: { fontWeight: '800', color: colors.text, fontSize: 13 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  body: { paddingHorizontal: spacing.md, gap: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, padding: spacing.md },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  when: { fontSize: 12, color: colors.textMuted },
  amount: { fontWeight: '800', color: colors.primary },
  sub: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 14, color: colors.text, fontStyle: 'italic' },
  proof: { height: 230, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.neutralSoft },
  proofImg: { width: '100%', height: '100%', resizeMode: 'contain' },
  zoomTag: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 5 },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1, flexDirection: 'row', gap: 6, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stat: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  del: { color: colors.danger, fontWeight: '700' },
  perms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 14, padding: spacing.sm, minHeight: 46, fontSize: 16, color: colors.text },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permText: { flex: 1, color: colors.text, fontSize: 14 },
  zoomBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  zoomImg: { width: '100%', height: '85%', resizeMode: 'contain' },
});
