import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';
import { Text } from '../src/ui/Text';

/** Local testing only (EXPO_PUBLIC_DEV_LOGIN=1): sign in with a token passed in the link, so a tester can switch between demo accounts. */
export default function DevSwitch() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { signIn } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_DEV_LOGIN !== '1' || !token) { router.replace('/'); return; }
    void signIn(String(token)).then(() => router.replace('/(tabs)/home'));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>…</Text></View>;
}
