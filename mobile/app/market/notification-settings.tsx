import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../src/ui/Text';
import { Stack } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market, NotifPrefs } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { PushStatus, pushStatus, registerPush } from '../../src/notifications/push';
import { colors, radius, spacing } from '../../src/theme/colors';

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Notification settings: device permission, which topics may send a push, quiet hours, and a test push. Everything stays visible in the in-app inbox either way. */
export default function NotificationSettingsScreen() {
  const { token } = useAuth();
  const prefs = useAsync(() => market.notifPrefs(token as string), [token]);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [quietOn, setQuietOn] = useState(false);
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('07:00');

  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);
  useEffect(() => {
    if (!prefs.data) return;
    setQuietOn(!!prefs.data.quiet);
    if (prefs.data.quiet) {
      setStart(prefs.data.quiet.start);
      setEnd(prefs.data.quiet.end);
    }
  }, [prefs.data]);

  const fail = (e: unknown) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
  const save = async (disabled: string[], quiet: { start: string; end: string } | null) => {
    try {
      await market.setNotifPrefs(token as string, { disabled, quietStart: quiet?.start ?? null, quietEnd: quiet?.end ?? null });
      prefs.reload();
    } catch (e) {
      fail(e);
    }
  };
  const disabledNow = () => (prefs.data?.categories ?? []).filter((c) => !c.enabled).map((c) => c.id);

  if (prefs.state !== 'ready' || !prefs.data) return <Screen><Stack.Screen options={{ headerShown: true, title: t('ns.title'), headerBackTitle: t('common.back') }} /><StateView state={prefs.state === 'ready' ? 'loading' : prefs.state} onRetry={prefs.reload} /></Screen>;
  const p = prefs.data;
  const statusKey = status ?? 'error';
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('ns.title'), headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <View style={styles.card}>
          <Text style={styles.strong}>{t('ns.device')}</Text>
          <Text>{t(`ns.status.${statusKey}`)}</Text>
          {status !== 'ok' && status !== 'expo-go' && status !== 'no-module' && <PrimaryButton title={t('ns.enable')} onPress={async () => setStatus(await registerPush(token as string, { ask: true }))} />}
          {!p.pushOnServer && <Text style={styles.help}>{t('ns.serverOff')}</Text>}
        </View>

        <Text style={styles.h2}>{t('ns.topics')}</Text>
        <Text style={styles.help}>{t('ns.topicsHelp')}</Text>
        {p.categories.map((c) => (
          <View key={c.id} style={[styles.card, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.strong}>{t(`ns.cat.${c.id}`)}</Text>
              <Text style={styles.help}>{t(`ns.cat.${c.id}.help`)}</Text>
            </View>
            <Switch
              value={c.enabled}
              disabled={!c.canDisable}
              accessibilityLabel={t(`ns.cat.${c.id}`)}
              onValueChange={(on) => save(on ? disabledNow().filter((x) => x !== c.id) : [...disabledNow(), c.id], p.quiet)}
            />
          </View>
        ))}

        <Text style={styles.h2}>{t('ns.quiet')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.strong, { flex: 1 }]}>{t('ns.quietOn')}</Text>
            <Switch value={quietOn} accessibilityLabel={t('ns.quietOn')} onValueChange={(on) => { setQuietOn(on); if (!on) void save(disabledNow(), null); }} />
          </View>
          {quietOn && (
            <>
              <View style={styles.row}>
                <TextInput value={start} onChangeText={setStart} maxLength={5} placeholderTextColor={colors.textMuted} placeholder="22:00" accessibilityLabel={t('ns.from')} style={[styles.input, { flex: 1 }]} />
                <Text>–</Text>
                <TextInput value={end} onChangeText={setEnd} maxLength={5} placeholderTextColor={colors.textMuted} placeholder="07:00" accessibilityLabel={t('ns.to')} style={[styles.input, { flex: 1 }]} />
              </View>
              <PrimaryButton title={t('common.save')} disabled={!HM.test(start) || !HM.test(end) || start === end} onPress={() => save(disabledNow(), { start, end })} />
              <Text style={styles.help}>{t('ns.quietHelp')}</Text>
            </>
          )}
        </View>

        <PrimaryButton title={t('ns.test')} variant="outline" onPress={() => market.testPush(token as string).then(() => Alert.alert(t('ns.testSent'))).catch((e) => (e instanceof ApiError && e.statusCode === 429 ? Alert.alert(t('ns.testLimit')) : fail(e)))} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 16, padding: spacing.sm, minHeight: 44, color: colors.text, backgroundColor: colors.surface, textAlign: 'center' },
});
