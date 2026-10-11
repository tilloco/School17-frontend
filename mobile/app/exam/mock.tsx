import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { api, ApiError } from '../../src/lib/api';
import type { ExamSessionPayload, ExamResult } from '../../src/types/api';
import { colors, spacing, radius, shadow } from '../../src/theme/colors';

const LETTERS = ['A', 'B', 'C', 'D'];

// light tint of primary for selected states (hex + alpha)
const primaryTint = `${colors.primary}1A`;

export default function MockExamScreen() {
  // TODO: confirm this matches wherever your login screen actually stores the token
  const TOKEN_KEY = 'accessToken';

  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<ExamSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const [localAnswers, setLocalAnswers] = useState<
    Record<string, { chosenIndex?: number; partAText?: string; partBText?: string }>
  >({});

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoSubmitted = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((t) => setToken(t));
  }, []);

  useEffect(() => {
    if (token) startOrResumeExam(token);
  }, [token]);

  async function startOrResumeExam(authToken: string) {
    try {
      setLoading(true);
      const data = await api.startExam(authToken);
      setSession(data);

      const seeded: typeof localAnswers = {};
      data.questions.forEach((q) => {
        seeded[q.answerId] = {
          chosenIndex: q.savedChosenIndex ?? undefined,
          partAText: q.savedPartAText ?? undefined,
          partBText: q.savedPartBText ?? undefined,
        };
      });
      setLocalAnswers(seeded);

      const firstUnanswered = data.questions.findIndex((q) => {
        if (q.questionType === 'CLOSED') return q.savedChosenIndex === null;
        return !q.savedPartAText && !q.savedPartBText;
      });
      setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PREMIUM_REQUIRED') {
        Alert.alert('Premium kerak', 'Sinov imtihoni faqat Premium foydalanuvchilar uchun mavjud.');
      } else {
        Alert.alert('Xatolik', "Imtihonni yuklab bo'lmadi. Qaytadan urinib ko'ring.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS') return;

    const tick = () => {
      const msLeft = new Date(session.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(msLeft / 1000));
      setSecondsLeft(secs);
      if (secs <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        handleSubmit(true);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(12);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [currentIndex]);

  useEffect(() => {
    if (!session) return;
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / session.questions.length,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, session]);

  const scheduleSave = useCallback(
    (answerId: string, patch: { chosenIndex?: number; partAText?: string; partBText?: string }) => {
      if (!session || !token) return;

      setSaveStatus((prev) => ({ ...prev, [answerId]: 'saving' }));

      if (saveTimers.current[answerId]) {
        clearTimeout(saveTimers.current[answerId]);
      }
      saveTimers.current[answerId] = setTimeout(async () => {
        try {
          await api.saveExamAnswer(token, session.sessionId, answerId, patch);
          setSaveStatus((prev) => ({ ...prev, [answerId]: 'saved' }));
        } catch {
          setSaveStatus((prev) => ({ ...prev, [answerId]: 'idle' }));
        }
      }, 600);
    },
    [session, token],
  );

  function selectOption(answerId: string, index: number) {
    setLocalAnswers((prev) => ({ ...prev, [answerId]: { ...prev[answerId], chosenIndex: index } }));
    scheduleSave(answerId, { chosenIndex: index });
  }

  function updateOpenText(answerId: string, field: 'partAText' | 'partBText', text: string) {
    setLocalAnswers((prev) => ({ ...prev, [answerId]: { ...prev[answerId], [field]: text } }));
    scheduleSave(answerId, { [field]: text });
  }

  function goToIndex(i: number) {
    if (!session) return;
    setCurrentIndex(Math.max(0, Math.min(session.questions.length - 1, i)));
  }

  async function handleSubmit(auto = false) {
    if (!session || !token) return;

    const doSubmit = async () => {
      try {
        setSubmitting(true);
        const data = await api.submitExam(token, session.sessionId);
        setResult(data);
      } catch {
        Alert.alert('Xatolik', "Yuborishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
      } finally {
        setSubmitting(false);
      }
    };

    if (auto) {
      Alert.alert('Vaqt tugadi', 'Imtihon vaqti tugadi, javoblaringiz avtomatik yuborildi.', [
        { text: 'OK', onPress: doSubmit },
      ]);
      return;
    }

    Alert.alert('Imtihonni yakunlash', "Javoblaringizni yakunlashga aminmisiz? Keyin o'zgartira olmaysiz.", [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Yakunlash', style: 'destructive', onPress: doSubmit },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.subtext}>Imtihon yuklanmoqda...</Text>
      </View>
    );
  }

  if (result) {
    return <ResultView result={result} />;
  }

  if (!session || session.questions.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.subtext}>Savollar topilmadi.</Text>
      </View>
    );
  }

  const question = session.questions[currentIndex];
  const answer = localAnswers[question.answerId] ?? {};
  const isLast = currentIndex === session.questions.length - 1;
  const isAnswered =
    question.questionType === 'CLOSED'
      ? answer.chosenIndex !== undefined
      : !!(answer.partAText || answer.partBText);

  const timeStr =
    secondsLeft !== null
      ? `${Math.floor(secondsLeft / 60)
          .toString()
          .padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`
      : '--:--';
  const timeIsLow = secondsLeft !== null && secondsLeft < 5 * 60;

  const status = saveStatus[question.answerId] ?? 'idle';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.progressText}>
            Savol {currentIndex + 1} / {session.questions.length}
          </Text>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
        <View style={[styles.timerPill, timeIsLow && styles.timerPillDanger]}>
          <Ionicons name="time-outline" size={14} color={timeIsLow ? colors.danger : colors.textMuted} />
          <Text style={[styles.timerText, timeIsLow && styles.timerTextDanger]}>{timeStr}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.questionText}>{question.text}</Text>

          {question.questionType === 'CLOSED' ? (
            <View style={{ marginTop: spacing.lg - 6 }}>
              {question.options?.map((opt, i) => {
                const selected = answer.chosenIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => selectOption(question.answerId, i)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.optionBadge, selected && styles.optionBadgeSelected]}>
                      <Text style={[styles.optionBadgeText, selected && styles.optionBadgeTextSelected]}>
                        {LETTERS[i] ?? i + 1}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ marginTop: spacing.lg - 6, gap: spacing.lg - 6 }}>
              <View>
                <Text style={styles.partLabel}>{question.partAPrompt}</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Javobingizni shu yerga yozing..."
                  placeholderTextColor={colors.textMuted}
                  value={answer.partAText ?? ''}
                  onChangeText={(t) => updateOpenText(question.answerId, 'partAText', t)}
                  maxLength={2000}
                />
              </View>
              <View>
                <Text style={styles.partLabel}>{question.partBPrompt}</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Javobingizni shu yerga yozing..."
                  placeholderTextColor={colors.textMuted}
                  value={answer.partBText ?? ''}
                  onChangeText={(t) => updateOpenText(question.answerId, 'partBText', t)}
                  maxLength={2000}
                />
              </View>
            </View>
          )}

          <View style={styles.saveRow}>
            {status === 'saving' && <ActivityIndicator size="small" color={colors.textMuted} />}
            {status === 'saving' && <Text style={styles.saveText}>Saqlanmoqda...</Text>}
            {status === 'saved' && <Ionicons name="checkmark" size={14} color={colors.success} />}
            {status === 'saved' && <Text style={[styles.saveText, { color: colors.success }]}>Saqlandi</Text>}
          </View>
        </Animated.View>

        <View style={styles.dotsRow}>
          {session.questions.map((q, i) => {
            const a = localAnswers[q.answerId] ?? {};
            const answered =
              q.questionType === 'CLOSED' ? a.chosenIndex !== undefined : !!(a.partAText || a.partBText);
            return (
              <Pressable
                key={q.answerId}
                onPress={() => goToIndex(i)}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                  answered && i !== currentIndex && styles.dotAnswered,
                ]}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.navRow}>
        <Pressable
          disabled={currentIndex === 0}
          onPress={() => goToIndex(currentIndex - 1)}
          style={[styles.navButton, styles.navButtonSecondary, currentIndex === 0 && styles.navButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={styles.navButtonSecondaryText}>Orqaga</Text>
        </Pressable>

        {isLast ? (
          <Pressable disabled={submitting} onPress={() => handleSubmit(false)} style={[styles.navButton, styles.navButtonPrimary]}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.navButtonPrimaryText}>Yakunlash</Text>
                <Ionicons name="checkmark-done" size={18} color={colors.white} />
              </>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={() => goToIndex(currentIndex + 1)} style={[styles.navButton, styles.navButtonPrimary]}>
            <Text style={styles.navButtonPrimaryText}>{isAnswered ? 'Keyingi' : "O'tkazib yuborish"}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ResultView({ result }: { result: ExamResult }) {
  const passed = (result.grade ?? '').length > 0;
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg - 4 }}>
      <View style={[styles.card, styles.resultHero]}>
        <View style={[styles.gradeCircle, { borderColor: passed ? colors.primary : colors.border }]}>
          <Text style={[styles.gradeText, !passed && { color: colors.textMuted }]}>{result.grade ?? '—'}</Text>
        </View>
        <Text style={styles.subtext}>
          {(result.totalScore ?? 0).toFixed(1)} / {(result.maxScore ?? 0).toFixed(1)} ball
          {result.percentage !== null ? ` (${result.percentage.toFixed(1)}%)` : ''}
        </Text>
      </View>

      <View style={[styles.card, { marginTop: spacing.md }]}>
        <View style={styles.resultRow}>
          <Ionicons name="list-outline" size={18} color={colors.textMuted} />
          <Text style={styles.resultLine}>
            Yopiq savollar: <Text style={{ fontWeight: '700' }}>{result.closedCorrect} / {result.closedTotal}</Text> to'g'ri
          </Text>
        </View>
        <View style={styles.resultRow}>
          <Ionicons name="create-outline" size={18} color={colors.textMuted} />
          <Text style={styles.resultLine}>
            Ochiq savollar: <Text style={{ fontWeight: '700' }}>{result.openFullyCorrect} / {result.openTotal}</Text> to'liq to'g'ri
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  subtext: { color: colors.textMuted, fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: '500' },
  progressBarTrack: { height: 6, borderRadius: radius.sm / 2, backgroundColor: colors.border, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.sm / 2 },

  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
  },
  timerPillDanger: { borderColor: colors.danger, backgroundColor: `${colors.danger}14` },
  timerText: { fontSize: 13, fontWeight: '600', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  timerTextDanger: { color: colors.danger },

  scrollContent: { padding: spacing.lg - 4, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg - 4,
    ...shadow,
  },
  questionText: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 24 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    marginBottom: spacing.sm + 2,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: primaryTint },
  optionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeSelected: { backgroundColor: colors.primary },
  optionBadgeText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  optionBadgeTextSelected: { color: colors.white },
  optionText: { fontSize: 15, color: colors.text, flex: 1 },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },

  partLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  textArea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md - 4,
    minHeight: 90,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },

  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md - 2, height: 16 },
  saveText: { fontSize: 12, color: colors.textMuted },

  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg - 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  dotAnswered: { backgroundColor: colors.accent },

  navRow: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    padding: spacing.lg - 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: { backgroundColor: colors.primary },
  navButtonPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  navButtonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  navButtonSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  navButtonDisabled: { opacity: 0.4 },

  resultHero: { alignItems: 'center', paddingVertical: spacing.xl },
  gradeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md - 2,
  },
  gradeText: { fontSize: 32, fontWeight: '800', color: colors.primary },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, marginBottom: spacing.sm + 2 },
  resultLine: { fontSize: 15, color: colors.text },
});