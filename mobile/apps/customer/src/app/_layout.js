import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { AuthProvider, ConsentGate, useAuth, ThemeContext, onNotificationTap } from '@astro/mobile-core';
import { api, routeFor } from '../lib/api.js';
import { astrovedas as c } from '../lib/theme.js';
import { BrandLogin } from '../components/BrandLogin.js';

function Gate() {
  const { me } = useAuth();
  useEffect(() => onNotificationTap((data) => { const to = routeFor({ data, type: data.type }); if (to) router.push(to); }), []);
  if (!me) return <BrandLogin api={api} />;
  return (
    <ConsentGate>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: c.bg }, headerShadowVisible: false, headerTintColor: c.text,
        headerTitleStyle: { fontFamily: c.fonts.semibold, fontSize: 18 }, contentStyle: { backgroundColor: c.bg }, headerBackTitle: 'Back',
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="astrologer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="consult/[astrologerId]" options={{ headerShown: false }} />
        <Stack.Screen name="filters" options={{ title: 'Search Filters', presentation: 'modal' }} />
        <Stack.Screen name="consultation/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="rate/[id]" options={{ title: 'Rate Your Consultation' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="sessions" options={{ title: 'My Consultations' }} />
        <Stack.Screen name="birth-profile/[id]" options={{ title: 'Birth details', presentation: 'modal' }} />
        <Stack.Screen name="chart/[birthProfileId]" options={{ title: 'Kundli' }} />
        <Stack.Screen name="predictions" options={{ title: 'Your Predictions' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="assistant" options={{ title: 'Help assistant' }} />
        <Stack.Screen name="support" options={{ title: 'Help & Support' }} />
        <Stack.Screen name="favorites" options={{ title: 'Favourite Astrologers' }} />
        <Stack.Screen name="account" options={{ title: 'Account & Privacy' }} />
        <Stack.Screen name="payment-result" options={{ headerShown: false }} />
      </Stack>
    </ConsentGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.primary} /></View>;
  return (
    <ThemeContext.Provider value={c}>
      <AuthProvider api={api} role="customer" app="customer">
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
