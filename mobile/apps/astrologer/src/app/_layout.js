import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, ConsentGate, LoginScreen, useAuth, useTheme, onNotificationTap, useT, LanguageSync } from '@astro/mobile-core';
import { api, routeFor } from '../lib/api.js';
import { I18nProvider } from '../lib/i18n.js';

function Gate() {
  const { me } = useAuth();
  const c = useTheme();
  const t = useT();
  useEffect(() => onNotificationTap((data) => { const to = routeFor({ data, type: data.type }); if (to) router.push(to); }), []);
  if (!me) return <LoginScreen api={api} role="astrologer" title="Jyotish Partner" tagline={t('login.tagline')} />;
  return (
    <ConsentGate>
      <LanguageSync load={() => api.get('/astrologer/me').then((a) => a.appLanguage)} save={(code) => api.patch('/astrologer/me/app-language', { language: code })} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: c.bg }, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="consultation/[id]" options={{ title: t('nav.consultation') }} />
        <Stack.Screen name="support" options={{ title: t('nav.support') }} />
        <Stack.Screen name="assistant" options={{ title: t('nav.assistant') }} />
        <Stack.Screen name="notifications" options={{ title: t('nav.notifications') }} />
      </Stack>
    </ConsentGate>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider api={api} role="astrologer" app="astrologer">
        <StatusBar style="auto" />
        <Gate />
      </AuthProvider>
    </I18nProvider>
  );
}
