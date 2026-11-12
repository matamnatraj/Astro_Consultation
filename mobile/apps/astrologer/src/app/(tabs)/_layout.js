import { Text, Pressable, View } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { router } from 'expo-router';
import { useTheme, useUnreadNotifications, useT, LanguageButton } from '@astro/mobile-core';

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
  const t = useT();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' }, headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><LanguageButton /><Bell /></View>,
    }}>
      <Tabs.Screen name="index" options={{ title: t('tab.dashboard'), tabBarLabel: t('tab.home'), tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="consultations" options={{ title: t('tab.consultations'), tabBarLabel: t('tab.sessions'), tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="availability" options={{ title: t('tab.availability'), tabBarLabel: t('tab.slots'), tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="earnings" options={{ title: t('tab.earnings'), tabBarLabel: t('tab.earnings'), tabBarIcon: icon('₹') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarLabel: t('tab.profile'), tabBarIcon: icon('☉') }} />
    </Tabs>
  );
}
