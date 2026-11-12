import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { absoluteUrl } from '@astro/mobile-core';

/**
 * Opens the payment gateway's hosted checkout in a secure in-app browser and
 * returns 'success' | 'failure' | 'dismissed'. Card details never touch the app.
 * (For a production gateway, its native SDK can replace this behind the same function.)
 */
export async function payInBrowser(api, bookingId) {
  if (Platform.OS === 'web') {
    const co = await api.post('/payments/checkout', { bookingId, returnUrl: `${window.location.origin}/booking/${bookingId}` });
    window.location.assign(absoluteUrl(co.checkoutUrl));
    return 'redirected';
  }
  const returnUrl = Linking.createURL('payment-result', { queryParams: { bookingId } });
  const co = await api.post('/payments/checkout', { bookingId, returnUrl });
  const result = await WebBrowser.openAuthSessionAsync(absoluteUrl(co.checkoutUrl), returnUrl);
  if (result.type !== 'success') return 'dismissed';
  return Linking.parse(result.url).queryParams?.payment === 'success' ? 'success' : 'failure';
}

/** Wallet recharge through the gateway's hosted checkout. Returns 'success' | 'failure' | 'dismissed' | 'redirected'. */
export async function payRecharge(api, amountPaise) {
  if (Platform.OS === 'web') {
    const r = await api.post('/wallet/recharge', { amountPaise, returnUrl: `${window.location.origin}/wallet` });
    window.location.assign(absoluteUrl(r.checkoutUrl));
    return 'redirected';
  }
  const returnUrl = Linking.createURL('wallet');
  const r = await api.post('/wallet/recharge', { amountPaise, returnUrl });
  const result = await WebBrowser.openAuthSessionAsync(absoluteUrl(r.checkoutUrl), returnUrl);
  if (result.type !== 'success') return 'dismissed';
  return Linking.parse(result.url).queryParams?.payment === 'success' ? 'success' : 'failure';
}
