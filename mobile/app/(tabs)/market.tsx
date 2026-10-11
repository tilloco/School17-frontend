import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StateView } from '../../src/components/StateView';
import { useAuth } from '../../src/lib/auth-context';
import { t, setLocale } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { useAsync } from '../../src/market/useAsync';
import { colors, radius, spacing } from '../../src/theme/colors';

export default function MarketHome() {
  const router = useRouter();
  const { token } = useAuth();
  const me = useAsync(() => market.me(token as string), [token]);
  const unread = useAsync(() => market.unreadCount(token as string), [token]);

  // Interfeys tili foydalanuvchi sozlamasidan (uz standart)
  useEffect(() => {
    if (me.data) setLocale(me.data.locale);
  }, [me.data]);

  if (me.state === 'loading') return <Screen><StateView state="loading" /></Screen>;
  if (me.state === 'offline' || me.state === 'error') return <Screen><StateView state={me.state} onRetry={me.reload} /></Screen>;

  const items: { label: string; to: string; badge?: number }[] = [
    { label: t('market.find'), to: '/market/search' },
    { label: t('market.lessons'), to: '/market/lessons' },
    { label: t('market.messages'), to: '/market/threads' },
    { label: t('market.notifications'), to: '/market/notifications', badge: unread.data?.unread },
    { label: t('market.safety'), to: '/market/safety' },
  ];
  return (
    <Screen>
      <Text style={styles.h1}>{t('market.title')}</Text>
      <View style={styles.list}>
        {items.map((i) => (
          <Pressable key={i.to} accessibilityRole="button" accessibilityLabel={i.label} onPress={() => router.push(i.to as never)} style={styles.item}>
            <Text style={styles.itemText}>{i.label}</Text>
            {!!i.badge && <Text style={styles.badge}>{i.badge}</Text>}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700', color: colors.text, marginVertical: spacing.md },
  list: { gap: spacing.sm },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
  itemText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  badge: { backgroundColor: colors.danger, color: colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', fontWeight: '700' },
});
