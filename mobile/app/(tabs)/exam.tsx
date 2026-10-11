import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ErrorText } from '../../src/components/ErrorText';
import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { colors, radius, spacing, shadow } from '../../src/theme/colors';
import type { ExamQuestion, ExamSessionPayload } from '../../src/types/api';
const PREMIUM_ENABLED = false; // set to true when we add payments back

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExamScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<ExamSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { chosenIndex?: number; partAText?: string; partBText?: string }>>({});
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await api.startExam(token);
      setSession(data);
      const initial: typeof answers = {};
      data.questions.forEach((q) => {
        initial[q.answerId] = {
          chosenIndex: q.savedChosenIndex ?? undefined,
          partAText: q.savedPartAText ?? undefined,
          partBText: q.savedPartBText ?? undefined,
        };
      });
      setAnswers(initial);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PREMIUM_REQUIRED') {
        setPremiumRequired(true);
      } else {
        setError(e instanceof ApiError ? e.message : "Sinov imtihonini yuklab bo'lmadi");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const onChangeAnswer = (q: ExamQuestion, data: { chosenIndex?: number; partAText?: string; partBText?: string }) => {
    if (!token || !session) return;
    setAnswers((prev) => ({ ...prev, [q.answerId]: { ...prev[q.answerId], ...data } }));

    clearTimeout(saveTimers.current[q.answerId]);
    saveTimers.current[q.answerId] = setTimeout(() => {
      api.saveExamAnswer(token, session.sessionId, q.answerId, data).catch(() => undefined);
    }, 500);
  };
const onSubmit = async () => {
    if (!token || !session) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitExam(token, session.sessionId);
      router.push({ pathname: '/(tabs)/exam-result', params: { sessionId: session.sessionId } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Topshirishda xatolik yuz berdi");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

if (PREMIUM_ENABLED && premiumRequired) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.paywallTitle}>Sinov imtihoni</Text>
        <Text style={styles.paywallBody}>
          To'liq formatdagi sinov imtihoni (35 yopiq + 10 ochiq savol, 90 daqiqa) faqat Premium foydalanuvchilar uchun mavjud.
        </Text>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen style={styles.center}>
        <ErrorText message={error} />
      </Screen>
    );
  }

  const remainingMs = new Date(session.expiresAt).getTime() - now;
  const isExpired = remainingMs <= 0;
  const answeredCount = session.questions.filter((q) => {
    const a = answers[q.answerId];
    if (!a) return false;
    if (q.questionType === 'CLOSED') return a.chosenIndex !== undefined;
    return !!(a.partAText?.trim() || a.partBText?.trim());
  }).length;
  return (
    <Screen>
            <View style={styles.timerBar}>
        <Text style={styles.timerText}>{isExpired ? "Vaqt tugadi" : formatTime(remainingMs)}</Text>
        <Text style={styles.timerProgress}>{answeredCount}/{session.questions.length} javob berildi</Text>
      </View>
  
      <ScrollView contentContainerStyle={styles.scroll}>
        <ErrorText message={error} />

        {session.questions.map((q, index) => (
          <View key={q.answerId} style={styles.card}>
            <Text style={styles.qNumber}>{index + 1}-savol</Text>
            <Text style={styles.qText}>{q.text}</Text>

            {q.questionType === 'CLOSED' && q.options && (
              <View style={styles.optionsWrap}>
                {q.options.map((opt, i) => {
                  const selected = answers[q.answerId]?.chosenIndex === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => onChangeAnswer(q, { chosenIndex: i })}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.questionType === 'OPEN' && (
              <View style={styles.openWrap}>
                <Text style={styles.partLabel}>A qism: {q.partAPrompt}</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  value={answers[q.answerId]?.partAText ?? ''}
                  onChangeText={(text) => onChangeAnswer(q, { partAText: text })}
                  placeholder="Javobingizni yozing..."
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.partLabel}>B qism: {q.partBPrompt}</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  value={answers[q.answerId]?.partBText ?? ''}
                  onChangeText={(text) => onChangeAnswer(q, { partBText: text })}
                  placeholder="Javobingizni yozing..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
          </View>
        ))}

        <PrimaryButton title="Imtihonni topshirish" onPress={onSubmit} loading={submitting} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
   timerBar: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  timerProgress: { color: colors.white, fontSize: 13, opacity: 0.9 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  qNumber: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  qText: { fontSize: 16, color: colors.text, marginBottom: spacing.md },
  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.background },
  optionText: { fontSize: 14, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  openWrap: { gap: spacing.sm },
  partLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 80,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  paywallTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  paywallBody: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
});