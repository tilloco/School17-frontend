import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorText } from '../../src/components/ErrorText';
import { SkeletonBlock } from '../../src/components/Skeleton';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { colors, radius, spacing, shadow } from '../../src/theme/colors';
import type { DashboardData } from '../../src/types/api';
import { ProgressBar } from '../../src/components/ProgressBar';

const EXAM_DATE = new Date(2026, 11, 23); // 23 December 2026

function daysLeft(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((EXAM_DATE.getTime() - today.getTime()) / 86400000));
}

export default function DashboardScreen() {
  const router = useRouter();
  const { token, user, refreshUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [dashboard] = await Promise.all([api.getDashboard(token), refreshUser()]);
      setData(dashboard);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const taken = data?.examsTaken ?? 0;
  const goal = data?.examsGoal ?? 10;
  const percent = Math.min(100, Math.round((taken / goal) * 100));

  if (loading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SkeletonBlock style={{ height: 64, marginBottom: spacing.md }} />
          <SkeletonBlock style={{ height: 110, marginBottom: spacing.md }} />
          <SkeletonBlock style={{ height: 90, marginBottom: spacing.md }} />
          <SkeletonBlock style={{ height: 90 }} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>Salom, {user?.name || ''}!</Text>
          <Text style={styles.heroSubtext}>Bugun ham davom etamizmi?</Text>
        </View>

        <ErrorText message={error} />

        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.mockCard}
          onPress={() => router.push('/(tabs)/exam')}
        >
          <View style={styles.mockGlow} />
          <View style={styles.mockIcon}>
            <Ionicons name="document-text" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mockTitle}>Mock imtihon</Text>
            <Text style={styles.mockSub}>Savollarni yechib, bilimingizni sinab ko'ring</Text>
          </View>
          <View style={styles.mockArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>

           <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardLabel}>Streak</Text>
            <Text style={styles.progressPercent}>{data?.streakCurrent ?? 0} kun</Text>
          </View>
          <Text style={styles.cardSub}>
            {data?.streakCurrent
              ? "Zo'r, davom eting! Ertaga ham kiring."
              : "Bugun mock yechib streak boshlang."}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Mock testlar</Text>
            <Text style={styles.value}>{taken}/{goal}</Text>
            <ProgressBar percent={percent} />
            <Text style={styles.cardSub}>{Math.max(0, goal - taken)} ta qoldi</Text>
          </View>

          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Milliy sertifikatgacha</Text>
            <Text style={styles.value}>{daysLeft()}</Text>
            <Text style={styles.cardSub}>kun qoldi</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  heroGreeting: { fontSize: 19, fontWeight: '700', color: colors.heroText },
  heroSubtext: { fontSize: 13, color: colors.heroText, opacity: 0.75, marginTop: 2 },
  mockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow,
  },
  mockGlow: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mockIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockTitle: { fontSize: 19, fontWeight: '700', color: colors.white },
  mockSub: { fontSize: 13, color: colors.white, opacity: 0.85, marginTop: 2 },
  mockArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPercent: { fontSize: 16, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  cardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  value: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
});