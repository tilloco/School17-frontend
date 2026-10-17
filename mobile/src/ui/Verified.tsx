import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { t } from '../i18n';

export const VERIFIED_BLUE = '#1D9BF0';

/** The blue tick next to a verified teacher's name (like Instagram's). Only teachers a moderator checked get it. */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return <Ionicons name="checkmark-circle" size={size} color={VERIFIED_BLUE} accessibilityLabel={t('verified.label')} />;
}

/** "Verified teacher" pill with the tick, for the profile header. */
export function VerifiedPill({ since }: { since?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29,155,240,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
      <Ionicons name="shield-checkmark" size={15} color={VERIFIED_BLUE} />
      <Text style={{ color: VERIFIED_BLUE, fontWeight: '800', fontSize: 13 }}>{since ? t('verified.since', { date: since }) : t('verified.label')}</Text>
    </View>
  );
}
