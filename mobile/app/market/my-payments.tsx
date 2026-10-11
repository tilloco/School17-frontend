import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
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
  const res = useAsync(() => market.myPayments(token as string), [token], (d) => d.length === 0);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: t('mypay.title'), headerBackTitle: t('common.back') }} />
      {res.state !== 'ready' || !res.data ? (
        <StateView state={res.state === 'ready' ? 'loading' : res.state} onRetry={res.reload} />
      ) : (
        <FlatList
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
