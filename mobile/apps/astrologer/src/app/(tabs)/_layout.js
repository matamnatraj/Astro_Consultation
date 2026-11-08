import { Text, Pressable, View } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { router } from 'expo-router';
import { useTheme, useUnreadNotifications } from '@astro/mobile-core';

const icon = (glyph) => ({ color }) => <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;

function Bell() {
  const c = useTheme();
  const [count] = useUnreadNotifications();
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={{ marginRight: 16 }} accessibilityRole="button" accessibilityLabel={`Notifications, ${count} unread`}>
      <Text style={{ fontSize: 20, color: c.text }}>🔔</Text>
      {count > 0 ? <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: c.live, borderRadius: 9, minWidth: 18, paddingHorizontal: 4 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{count > 9 ? '9+' : count}</Text></View> : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' }, headerRight: () => <Bell />,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="consultations" options={{ title: 'Consultations', tabBarLabel: 'Sessions', tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="availability" options={{ title: 'Availability', tabBarLabel: 'Slots', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarLabel: 'Earnings', tabBarIcon: icon('₹') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: icon('☉') }} />
    </Tabs>
  );
}
