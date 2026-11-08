import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL, in order of precedence:
 *  1. EXPO_PUBLIC_API_URL (set per build profile in eas.json, or in .env)
 *  2. app.json → expo.extra.apiUrl
 *  3. Development: the machine running `expo start` (works for phones on the same Wi-Fi)
 */
function devHost() {
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  if (hostUri) return `http://${hostUri.split(':')[0]}:4000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000'; // Android emulator → host machine
  return 'http://localhost:4000';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || devHost()).replace(/\/$/, '');
export const absoluteUrl = (u) => (/^[a-z]+:\/\//i.test(u) ? u : `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`);
