import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/auth-context';
import { t } from '../../src/i18n';
import { colors, isDarkTheme } from '../../src/theme/colors';
import { TopBar } from '../../src/ui/TopBar';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: Icon, focused: Icon) => ({ color, size, focused: f }: { color: import("react-native").ColorValue; size: number; focused: boolean }) => <Ionicons name={f ? focused : name} size={size} color={color as string} />;

/** Bottom tabs depend on the role: teachers manage students and classes, pupils and guardians learn and find teachers. */
export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const teacher = user?.role === 'TEACHER';
  const insets = useSafeAreaInsets();
  if (!isLoading && !user) return <Redirect href="/(auth)/welcome" />; // signed out, or the saved sign-in is no longer valid
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        tabBarStyle: { ...(Platform.OS === 'ios' ? { position: 'absolute' as const, backgroundColor: 'transparent' } : { backgroundColor: colors.surface }), borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, height: 58 + insets.bottom, paddingBottom: 6 + insets.bottom, paddingTop: 6 },
        tabBarBackground: Platform.OS === 'ios' ? () => <BlurView intensity={70} tint={isDarkTheme ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : undefined,
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tab.home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="students" options={{ title: t('tab.students'), tabBarIcon: icon('people-outline', 'people'), href: teacher ? undefined : null }} />
      <Tabs.Screen name="classes" options={{ title: t('tab.classes'), tabBarIcon: icon('easel-outline', 'easel'), href: teacher ? undefined : null }} />
      <Tabs.Screen name="learning" options={{ title: t('tab.learning'), tabBarIcon: icon('book-outline', 'book'), href: teacher ? null : undefined }} />
      <Tabs.Screen name="find" options={{ title: t('tab.find'), tabBarIcon: icon('search-outline', 'search'), href: teacher ? null : undefined }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ title: t('tab.settings'), tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
