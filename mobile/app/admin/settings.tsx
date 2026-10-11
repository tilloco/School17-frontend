import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAdmin } from '../../src/lib/admin-context';
import { colors, radius, spacing, shadow } from '../../src/theme/colors';

export default function AdminSettings() {
  const router = useRouter();
  const { adminKey, saveKey, clearKey, error } = useAdmin();
  const [value, setValue] = useState(adminKey || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const onSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveKey(value.trim());
      setMsg({ text: 'Saqlandi va ulanish tekshirildi.', ok: true });
    } catch (e: any) {
      setMsg({ text: e.message || 'Xatolik', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Ionicons name="key" size={26} color={colors.primary} />
        </View>

        <Text style={styles.title}>Admin kirish</Text>
        <Text style={styles.subtitle}>Kalitni kiriting va ulanishni tasdiqlang</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Admin kaliti</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="x-admin-key"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton title="Saqlash" onPress={onSave} loading={saving} disabled={!value.trim()} />
        </View>

        {msg && (
          <View style={[styles.msgBox, { backgroundColor: msg.ok ? '#DCFCE7' : '#FEE2E2' }]}>
            <Ionicons
              name={msg.ok ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={msg.ok ? colors.success : colors.danger}
            />
            <Text style={[styles.msgText, { color: msg.ok ? colors.success : colors.danger }]}>{msg.text}</Text>
          </View>
        )}
        {!msg && error && (
          <View style={[styles.msgBox, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.msgText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {adminKey && (
          <PrimaryButton
            title="Kalitni o'chirish"
            onPress={async () => {
              await clearKey();
              setValue('');
              router.back();
            }}
            variant="outline"
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow,
  },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.text,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  msgText: { fontSize: 13, flex: 1 },
});