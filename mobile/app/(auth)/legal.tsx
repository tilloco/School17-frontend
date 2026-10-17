import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateView } from '../../src/components/StateView';
import { getLocale, t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, spacing } from '../../src/theme/colors';
import { Card, Page } from '../../src/ui';

/** Public terms and privacy text (no sign-in needed), shown before someone accepts them. */
export default function LegalScreen() {
  const router = useRouter();
  const [which, setWhich] = useState<'terms' | 'privacy'>('terms');
  const doc = useAsync(() => (which === 'terms' ? market.terms(getLocale()) : market.privacy(getLocale())), [which]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        {(['terms', 'privacy'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: which === k }} onPress={() => setWhich(k)} style={[styles.tab, which === k && styles.tabOn]}>
            <Text style={[styles.tabText, which === k && { color: '#fff' }]}>{t(`auth.legal.${k}`)}</Text>
          </Pressable>
        ))}
      </View>
      <Page edges={[]}>
        {doc.state !== 'ready' || !doc.data ? (
          <StateView state={doc.state === 'ready' ? 'loading' : doc.state} onRetry={doc.reload} />
        ) : (
          <>
            <Text style={styles.draft}>{doc.data.draftBanner}</Text>
            <Text style={styles.title}>{doc.data.title}</Text>
            {doc.data.sections.map((s, i) => (
              <Card key={i} style={{ gap: 4 }}>
                <Text style={styles.h}>{s.heading}</Text>
                <Text style={styles.p}>{s.body}</Text>
              </Card>
            ))}
          </>
        )}
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontWeight: '600', color: colors.text },
  draft: { backgroundColor: colors.warningSoft, color: colors.warningText, padding: spacing.sm, borderRadius: 10, fontSize: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  h: { fontWeight: '700', color: colors.text },
  p: { color: colors.text, lineHeight: 20 },
});
