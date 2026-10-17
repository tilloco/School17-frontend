import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { t } from '../i18n';
import { subjectStyle } from '../theme/subjects';

/** A subject as a small coloured chip with its own icon. */
export function SubjectPill({ id, size = 'sm' }: { id: string; size?: 'sm' | 'md' }) {
  const s = subjectStyle(id);
  const big = size === 'md';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: s.color + '26', paddingHorizontal: big ? 12 : 10, paddingVertical: big ? 7 : 5, borderRadius: 999 }}>
      <Ionicons name={s.icon} size={big ? 16 : 14} color={s.color} />
      <Text style={{ color: s.color, fontWeight: '800', fontSize: big ? 14 : 12 }}>{t(`subj.${id}`)}</Text>
    </View>
  );
}
