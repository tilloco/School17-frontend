import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, isDarkTheme } from '../src/theme/colors';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth-context';
import { LocaleProvider, useLocale } from '../src/i18n/LocaleProvider';
import { PushBootstrap } from '../src/notifications/PushBootstrap';
import { ConnectionProvider } from '../src/lib/connection';
import { DialogHost, installDialog } from '../src/ui/Dialog';

installDialog();
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';

/** After sign-in, use the language stored on the account unless this device already has its own choice. */
function LocaleSync() {
  const { user } = useAuth();
  const { adoptServerLocale } = useLocale();
  useEffect(() => adoptServerLocale(user?.locale), [user?.locale, adoptServerLocale]);
  return null;
}

/** Sends signed-out people (or people whose saved sign-in expired) to the welcome screen, from whatever screen they are on. */
function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  useEffect(() => {
    const open = segments.length === 0 || segments[0] === '(auth)' || segments[0] === 'join' || segments[0] === 'index';
    if (!isLoading && !user && !open) router.replace('/(auth)/welcome' as never);
  }, [user, isLoading, segments, router]);
  return null;
}

export default function RootLayout() {
  const [fontsReady] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocaleProvider>
          <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
          <LocaleSync />
          <AuthGate />
          <DialogHost />
          <PushBootstrap />
          <ConnectionProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerShadowVisible: false, headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 18 }, headerBackButtonDisplayMode: 'minimal', animation: 'ios_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          </ConnectionProvider>
        </LocaleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
