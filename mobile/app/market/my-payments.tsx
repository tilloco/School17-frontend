import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { ApiError } from '../../src/lib/api';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

/** Pupil / guardian: payment marks for their own lessons. */
export default function MyPaymentsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const res = useAsync(() => market.myPayments(token as string), [token]);
  const cls = useAsync(() => market.classPayMine(token as string), [token]);
  const paid = async (id: string) => {
    try {
      await market.classPaid(token as string, id);
      cls.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  const card = async (teacherId: string) => {
    try {
      const c = await market.revealCard(token as string, teacherId);
      Alert.alert(t('cpay.card'), `${c.cardNumber}\n${c.holderName}`);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('state.error'));
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('mypay.title'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: spacing.sm }}>
              {(cls.data ?? []).map((p) => (
                <View key={p.id} style={styles.card}>
                  <Text style={styles.strong}>{p.classTitle} · {p.teacher.name}</Text>
                  <Text>{p.periodKey.startsWith('M:') ? p.periodKey.slice(2) : t('cpay.session')} · {Math.round(p.amountMinor / 100).toLocaleString()}</Text>
                  <Text style={styles.help}>{t(`cmoney.status.${p.status}`)}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    <PrimaryButton title={t('cpay.showCard')} variant="outline" onPress={() => card(p.teacher.id)} />
                    {(p.status === 'UNPAID' || p.status === 'NOT_RECEIVED') && <PrimaryButton title={t('cpay.iPaid')} onPress={() => paid(p.id)} />}
                  </View>
                </View>
              ))}
            </View>
          }
          data={res.data}
          keyExtractor={(r) => r.bookingId}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <Text style={styles.strong}>{r.teacher.name}</Text>
              <Text>{new Date(r.startAt).toLocaleString()} · {Math.round(r.amountMinor / 100).toLocaleString()}</Text>
              <Text style={styles.help}>{r.status}</Text>
              <PrimaryButton title={t('mypay.open')} variant="outline" onPress={() => router.push(`/market/pay/${r.bookingId}` as never)} />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 4 },
  strong: { fontWeight: '700', color: colors.text },
  help: { color: colors.textMuted, fontSize: 13 },
});
