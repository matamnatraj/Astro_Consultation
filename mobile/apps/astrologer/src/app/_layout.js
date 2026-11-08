import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, ConsentGate, LoginScreen, useAuth, useTheme, onNotificationTap } from '@astro/mobile-core';
import { api, routeFor } from '../lib/api.js';

function Gate() {
  const { me } = useAuth();
  const c = useTheme();
  useEffect(() => onNotificationTap((data) => { const to = routeFor({ data, type: data.type }); if (to) router.push(to); }), []);
  if (!me) return <LoginScreen api={api} role="astrologer" title="Jyotish Partner" tagline="Manage consultations, availability and earnings." />;
  return (
    <ConsentGate>
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: c.bg }, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="consultation/[id]" options={{ title: 'Consultation' }} />
        <Stack.Screen name="support" options={{ title: 'Help & support' }} />
        <Stack.Screen name="assistant" options={{ title: 'Help assistant' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </ConsentGate>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider api={api} role="astrologer" app="astrologer">
      <StatusBar style="auto" />
      <Gate />
    </AuthProvider>
  );
}
