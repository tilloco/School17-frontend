import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../src/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateView } from '../../src/components/StateView';
import { ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { savePendingJoin } from '../../src/lib/pending-join';
import { t } from '../../src/i18n';
import { market } from '../../src/market/marketApi';
import { colors, spacing } from '../../src/theme/colors';
import { Action } from '../../src/ui';

/** Opened from a teacher's invite link (school17://join/<token>): joins the class and lands on it, where the live lesson room is. */
export default function JoinScreen() {
  const { token: invite } = useLocalSearchParams<{ token: string }>();
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'error' | 'pick'>('loading');
  const [message, setMessage] = useState('');
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);

  const join = useCallback(async (studentId?: string) => {
    setState('loading');
    try {
      const c = await market.joinClass(token as string, { token: invite, studentId });
      router.replace(`/market/class/${c.id}` as never);
    } catch (e) {
      // Already in the class: just open it
      if (e instanceof ApiError && e.code === 'ALREADY_ENROLLED') return router.replace('/(tabs)/learning' as never);
      const map: Record<string, string> = { CLASS_NOT_FOUND: 'join.notFound', REMOVED: 'join.removed', JOIN_LIMIT: 'auth.tooMany', CLASS_FULL: 'join.full' };
      setMessage(e instanceof ApiError ? (e.code && map[e.code] ? t(map[e.code]) : e.message) : t('state.error'));
      setState('error');
    }
  }, [token, invite, router]);

  useEffect(() => {
    if (isLoading) return;
    if (!token || !user) {
      // Not signed in yet: remember the invite, sign in or register, and the home screen finishes the join
      savePendingJoin(String(invite)).then(() => router.replace('/(auth)/welcome' as never));
      return;
    }
    if (user.role === 'TEACHER') {
      setMessage(t('join.teacher'));
      setState('error');
    } else if (user.role === 'GUARDIAN') {
      market.learning(token).then((d) => {
        const kids = d.children ?? [];
        if (kids.length === 1) join(kids[0].id);
        else if (kids.length === 0) { setMessage(t('join.noChild')); setState('error'); }
        else { setChildren(kids); setState('pick'); }
      }).catch(() => { setMessage(t('state.error')); setState('error'); });
    } else join();
  }, [isLoading, token, user, invite, join, router]);

  return (
    <SafeAreaView style={styles.safe}>
      {state === 'loading' && <StateView state="loading" />}
      {state === 'error' && (
        <View style={styles.box}>
          <Text style={styles.title}>{t('join.title')}</Text>
          <Text style={styles.text}>{message}</Text>
          <Action label={t('common.back')} onPress={() => router.replace('/(tabs)/home' as never)} />
        </View>
      )}
      {state === 'pick' && (
        <View style={styles.box}>
          <Text style={styles.title}>{t('join.who')}</Text>
          {children.map((c) => <Action key={c.id} label={c.name} kind="outline" onPress={() => join(c.id)} />)}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  box: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  text: { color: colors.textMuted, fontSize: 16 },
});
