import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { astrovedas as c } from '../lib/theme.js';
import { LANGS, useI18n } from '../lib/i18n.js';
import { Txt, GradientButton } from './brand.js';

/** Bottom sheet with a two-column grid of languages and an APPLY button. */
export function LanguagePicker({ visible, onClose }) {
  const { lang, setLang, t } = useI18n();
  const [pick, setPick] = useState(lang);
  useEffect(() => { if (visible) setPick(lang); }, [visible, lang]);
  const apply = async () => { await setLang(pick); onClose?.(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(30,15,5,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 30, gap: 16 }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#E6D5C4' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt w="s" size={18} style={{ flex: 1 }}>{t('lang.choose')}</Txt>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close language picker"><Ionicons name="close" size={24} color={c.text2} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {LANGS.map((l) => {
            const active = pick === l.code;
            return (
              <Pressable key={l.code} onPress={() => setPick(l.code)} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={l.label}
                style={{ width: '47.5%', borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 2, backgroundColor: active ? c.primarySoft : c.surface, borderWidth: 1.5, borderColor: active ? c.primary : c.border }}>
                {active ? <View style={{ position: 'absolute', top: 8, right: 8 }}><Ionicons name="checkmark-circle" size={18} color={c.primary} /></View> : null}
                <Txt w="b" size={20} color={active ? c.pricePillText : c.text}>{l.short || l.native}</Txt>
                <Txt size={13} color={c.text2}>{l.label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt size={12} color={c.muted}>{t('lang.note')}</Txt>
        <GradientButton title={t('lang.apply')} trailing="" onPress={apply} />
      </View>
    </Modal>
  );
}

/** Small header button showing the current language; opens the picker. */
export function LanguageButton({ style }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`App language: ${cur?.label}`} hitSlop={6}
        style={[{ height: 42, minWidth: 42, paddingHorizontal: 10, borderRadius: 21, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }, style]}>
        <Ionicons name="language" size={18} color={c.primary} />
        <Txt w="s" size={12} color={c.text2}>{lang.toUpperCase()}</Txt>
      </Pressable>
      <LanguagePicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
