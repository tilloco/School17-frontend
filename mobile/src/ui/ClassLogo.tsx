import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { API_URL } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { themeOf } from '../theme/chatThemes';
import { AuthImage } from './index';

/** A class channel's round logo: the picture the teacher uploaded, or the first letter on the channel's colour. */
export function ClassLogo({ classId, size = 40, hasLogo, title, theme, v }: { classId: string; size?: number; hasLogo?: boolean; title?: string | null; theme?: string | null; v?: number }) {
  const { token } = useAuth();
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [v, hasLogo]);
  const th = themeOf(theme);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (hasLogo && token && !failed) {
    return <AuthImage url={`${API_URL}/classes/${classId}/channel/logo?v=${v ?? 0}`} token={token} style={[box, { backgroundColor: th.accent }]} onFail={() => setFailed(true)} />;
  }
  return (
    <View style={[box, { backgroundColor: th.accent, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{(title ?? '?').trim().slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}
