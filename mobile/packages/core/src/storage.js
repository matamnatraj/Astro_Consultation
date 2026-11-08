import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Session tokens live in the Keychain (iOS) / Keystore-backed storage (Android).
export const secureStorage = {
  async get(key) {
    if (Platform.OS === 'web') { try { return localStorage.getItem(key); } catch { return null; } }
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    if (Platform.OS === 'web') { try { localStorage.setItem(key, value); } catch { /* unavailable */ } return; }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    if (Platform.OS === 'web') { try { localStorage.removeItem(key); } catch { /* unavailable */ } return; }
    await SecureStore.deleteItemAsync(key);
  },
};
