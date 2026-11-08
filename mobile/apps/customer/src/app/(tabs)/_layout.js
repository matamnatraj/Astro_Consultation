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
      <Tabs.Screen name="index" options={{ title: 'Jyotish Connect', tabBarLabel: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="astrologers" options={{ title: 'Astrologers', tabBarLabel: 'Explore', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="sessions" options={{ title: 'My sessions', tabBarLabel: 'Sessions', tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile & charts', tabBarLabel: 'Profile', tabBarIcon: icon('☉') }} />
      <Tabs.Screen name="support" options={{ title: 'Help & support', tabBarLabel: 'Help', tabBarIcon: icon('?') }} />
    </Tabs>
  );
}
