import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, ConsentGate, LoginScreen, useAuth, useTheme, onNotificationTap } from '@astro/mobile-core';
import { api, routeFor } from '../lib/api.js';

function Gate() {
  const { me } = useAuth();
  const c = useTheme();
  useEffect(() => onNotificationTap((data) => { const to = routeFor({ data, type: data.type }); if (to) router.push(to); }), []);
  if (!me) return <LoginScreen api={api} role="customer" title="Jyotish Connect" tagline="Consult verified astrologers with your saved birth chart." />;
  return (
    <ConsentGate>
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: c.bg }, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="astrologer/[id]" options={{ title: 'Astrologer' }} />
        <Stack.Screen name="book/[astrologerId]" options={{ title: 'Book a consultation' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="consultation/[id]" options={{ title: 'Consultation' }} />
        <Stack.Screen name="birth-profile/[id]" options={{ title: 'Birth details', presentation: 'modal' }} />
        <Stack.Screen name="chart/[birthProfileId]" options={{ title: 'Birth chart' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="assistant" options={{ title: 'Help assistant' }} />
        <Stack.Screen name="payment-result" options={{ headerShown: false }} />
      </Stack>
    </ConsentGate>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider api={api} role="customer" app="customer">
      <StatusBar style="auto" />
      <Gate />
    </AuthProvider>
  );
}
