import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { AuthProvider, ConsentGate, useAuth, ThemeContext, onNotificationTap } from '@astro/mobile-core';
import { api, routeFor } from '../lib/api.js';
import { astrovedas as c } from '../lib/theme.js';
import { BrandLogin } from '../components/BrandLogin.js';
import { I18nProvider, useI18n } from '../lib/i18n.js';

// Adopt the account's saved language on a new device, and save changes back to the account.
function LanguageSync() {
  const { api } = useAuth();
  const { lang, setLang, onChange, hasLocalChoice } = useI18n();
  useEffect(() => {
    let live = true;
    hasLocalChoice().then((local) => { if (!local) api.get('/clients/me').then((p) => { if (live && p.preferredLanguage && p.preferredLanguage !== lang) setLang(p.preferredLanguage, { persistRemote: false }); }).catch(() => {}); });
    const off = onChange((code) => api.patch('/clients/me/language', { language: code }).catch(() => {}));
    return () => { live = false; off(); };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Gate() {
  const { me } = useAuth();
  const { t } = useI18n();
  useEffect(() => onNotificationTap((data) => { const to = routeFor({ data, type: data.type }); if (to) router.push(to); }), []);
  if (!me) return <BrandLogin api={api} />;
  return (
    <ConsentGate>
      <LanguageSync />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: c.bg }, headerShadowVisible: false, headerTintColor: c.text,
        headerTitleStyle: { fontFamily: c.fonts.semibold, fontSize: 18 }, contentStyle: { backgroundColor: c.bg }, headerBackTitle: 'Back',
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="astrologer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="consult/[astrologerId]" options={{ headerShown: false }} />
        <Stack.Screen name="filters" options={{ title: t('filters.title'), presentation: 'modal' }} />
        <Stack.Screen name="consultation/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="rate/[id]" options={{ title: t('chat.rate') }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
        <Stack.Screen name="sessions" options={{ title: t('profile.consultations') }} />
        <Stack.Screen name="birth-profile/[id]" options={{ title: 'Birth details', presentation: 'modal' }} />
        <Stack.Screen name="chart/[birthProfileId]" options={{ title: t('kundli.title') }} />
        <Stack.Screen name="predictions" options={{ title: 'Your Predictions' }} />
        <Stack.Screen name="notifications" options={{ title: t('profile.notifications') }} />
        <Stack.Screen name="assistant" options={{ title: 'Help assistant' }} />
        <Stack.Screen name="support" options={{ title: t('profile.support') }} />
        <Stack.Screen name="favorites" options={{ title: t('profile.favorites') }} />
        <Stack.Screen name="account" options={{ title: 'Account & Privacy' }} />
        <Stack.Screen name="payment-result" options={{ headerShown: false }} />
        <Stack.Screen name="matching/index" options={{ title: t('match.title') }} />
        <Stack.Screen name="matching/[id]" options={{ title: t('match.title') }} />
      </Stack>
    </ConsentGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.primary} /></View>;
  return (
    <ThemeContext.Provider value={c}>
      <I18nProvider>
        <AuthProvider api={api} role="customer" app="customer">
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </I18nProvider>
    </ThemeContext.Provider>
  );
}
