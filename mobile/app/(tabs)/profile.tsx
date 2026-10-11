import React, { useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/lib/auth-context';
import { colors, radius, spacing } from '../../src/theme/colors';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTitleTap = () => {
    tapCount.current += 1;
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      router.push('/admin');
      return;
    }
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 2000);
  };

  const onLogout = () => {
    Alert.alert('Chiqish', 'Hisobdan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={onTitleTap}>
          <Text style={styles.title}>Profil</Text>
        </Pressable>

        <View style={styles.card}>
          <Row label="Ism" value={user?.name || '-'} />
     <Row label="Imtihon sanasi" value={formatDate(user?.examDate)} last />
        </View>

        <Pressable onPress={onLogout} style={styles.logout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
          <Text style={styles.logoutText}>Chiqish</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  logoutText: { fontSize: 13, color: colors.textMuted },
});