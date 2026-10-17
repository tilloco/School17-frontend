import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { useAuth } from '../lib/auth-context';
import { market } from '../market/marketApi';
import { colors, radius, spacing } from '../theme/colors';
import { Avatar } from './index';

export interface Person { userId: string | null; name: string | null; username: string | null; hasPhoto: boolean; teacher?: boolean }

/** A small profile card that slides up when you tap someone in a group: photo, name, @username, and a button to write to them directly. */
export function PersonSheet({ person, onClose, onMessage, extra }: {
  person: Person | null; onClose: () => void; onMessage: (userId: string) => void; extra?: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    setBio(null);
    setUsername(person?.username ?? null);
    if (!person?.userId || !token) return;
    let live = true;
    market.userCard(token, person.userId).then((c) => { if (live) { setBio(c.bio); setUsername(c.username ?? person.username); } }).catch(() => undefined);
    return () => { live = false; };
  }, [person?.userId, token]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal visible={!!person} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')}>
        <Pressable style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} onPress={() => undefined}>
          <View style={styles.grip} />
          {person && (
            <>
              <Avatar name={person.name} size={92} userId={person.hasPhoto ? person.userId : null} />
              <Text style={styles.name}>{person.name}</Text>
              {!!username && <Text style={styles.username}>@{username}</Text>}
              {!!bio && <Text style={styles.bio}>{bio}</Text>}
              {person.teacher && <Text style={styles.role}>{t('role.TEACHER')}</Text>}
              <View style={styles.actions}>
                {!!person.userId && (
                  <Pressable accessibilityRole="button" onPress={() => { onClose(); onMessage(person.userId as string); }} style={[styles.btn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="chatbubble" size={18} color="#fff" /><Text style={styles.btnText}>{t('dm.write')}</Text>
                  </Pressable>
                )}
                {extra && (
                  <Pressable accessibilityRole="button" onPress={() => { onClose(); extra.onPress(); }} style={[styles.btn, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name={extra.icon} size={18} color={colors.primary} /><Text style={[styles.btnText, { color: colors.primary }]}>{extra.label}</Text>
                  </Pressable>
                )}
              </View>
              {!person.userId && <Text style={styles.note}>{t('dm.hiddenMinor')}</Text>}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'center', gap: 4 },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  username: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  bio: { fontSize: 15, color: colors.text, textAlign: 'center', lineHeight: 21, marginTop: 6, paddingHorizontal: spacing.md },
  role: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
