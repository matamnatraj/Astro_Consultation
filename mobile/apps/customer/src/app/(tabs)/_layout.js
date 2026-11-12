import { Tabs } from 'expo-router/tabs';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { astrovedas as c } from '../../lib/theme.js';

const icon = (name) => ({ color, size }) => <MCI name={name} size={size ?? 26} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: '#B49A86',
      tabBarLabelStyle: { fontFamily: c.fonts.medium, fontSize: 12 },
      tabBarStyle: {
        backgroundColor: '#FFFFFF', borderTopWidth: 0, height: 72, paddingTop: 8, paddingBottom: 10,
        borderTopLeftRadius: 26, borderTopRightRadius: 26, position: 'absolute', ...c.shadow, shadowOpacity: 0.1,
      },
      sceneStyle: { backgroundColor: c.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="astrologers" options={{ title: 'Astrologers', tabBarIcon: icon('meditation') }} />
      <Tabs.Screen name="kundli" options={{ title: 'Kundli', tabBarIcon: icon('dharmachakra') }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account') }} />
    </Tabs>
  );
}
