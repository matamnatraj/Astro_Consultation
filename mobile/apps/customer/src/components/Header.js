import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { astrovedas as c } from '../lib/theme.js';
import { Txt } from './brand.js';

export const goBack = (fallback = '/') => (router.canGoBack() ? router.back() : router.replace(fallback));

export function BackButton({ fallback, icon = 'arrow-back' }) {
  return (
    <Pressable onPress={() => goBack(fallback)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={24} color={c.text} />
    </Pressable>
  );
}

export function TitleBar({ title, right, fallback }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
      <BackButton fallback={fallback} />
      <Txt w="s" size={19} style={{ flex: 1 }}>{title}</Txt>
      {right}
    </View>
  );
}
