import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../theme/colors';

/** A bank-card picture (not a real card: no expiry, no CVV). The number is masked unless `number` is given. */
export function BankCard({ last4, number, holder, verifiedName }: { last4?: string | null; number?: string | null; holder?: string | null; verifiedName?: boolean }) {
  const shown = number ? number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim() : `••••  ••••  ••••  ${last4 ?? '••••'}`;
  return (
    <View style={styles.card} accessibilityLabel={number ? 'Card number shown' : 'Card number hidden'}>
      <View style={styles.top}>
        <Ionicons name="card" size={26} color="rgba(255,255,255,0.9)" />
        {verifiedName && <View style={styles.verified}><Ionicons name="shield-checkmark" size={14} color="#fff" /><Text style={styles.verifiedText}>School17</Text></View>}
      </View>
      <Text style={styles.number} selectable={!!number}>{shown}</Text>
      <Text style={styles.holder} numberOfLines={1}>{holder ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1F2A5A', borderRadius: 22, padding: spacing.lg, gap: spacing.md, minHeight: 170, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  verifiedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  number: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 1.5 },
  holder: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
});
