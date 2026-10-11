import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { colors } from '../../src/theme/colors';
import { t } from '../../src/i18n';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft: () => (
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 32, height: 32, marginLeft: 16, resizeMode: 'contain' }}
          />
        ),
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="dashboard" options={{
        title: 'Bosh sahifa',
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="exam" options={{
        title: 'Mock',
        tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="market" options={{
        title: t('market.tab'),
        tabBarIcon: ({ color, size }) => <Ionicons name="school-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profil',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />

      {/* Hidden from the tab bar */}
      <Tabs.Screen name="modules" options={{ href: null }} />
      <Tabs.Screen name="exam-result" options={{ href: null }} />
    </Tabs>
  );
}