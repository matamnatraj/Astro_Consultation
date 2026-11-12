import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { secureStorage } from './storage.js';
import { useTheme } from './theme.js';

// App languages shared by both apps. Translations should be reviewed by native speakers before launch.
export const LANGS = [
  { code: 'en', native: 'English', label: 'English', short: 'ENG' },
  { code: 'hi', native: 'हिंदी', label: 'Hindi' },
  { code: 'te', native: 'తెలుగు', label: 'Telugu' },
  { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
  { code: 'kn', native: 'ಕನ್ನಡ', label: 'Kannada' },
  { code: 'mr', native: 'मराठी', label: 'Marathi' },
  { code: 'bn', native: 'বাংলা', label: 'Bengali' },
];

// Strings used by the shared screens in this package (login, consent, language picker).
const CORE = {
  en: {
    'core.mobile': 'Mobile number', 'core.sendCode': 'Send one-time code', 'core.codeSent': 'Enter the 6-digit code sent by SMS to', 'core.devCode': 'Development mode: code {code} filled in.',
    'core.otp': 'One-time code', 'core.yourName': 'Your name', 'core.verify': 'Verify & continue', 'core.changeNumber': 'Change number', 'core.resend': 'Resend code',
    'core.agree': 'I agree', 'core.beforeContinue': 'Before you continue', 'core.reviewNotices': 'Please review and accept these notices. We record the version and time of your acceptance.',
    'core.accept': 'I have read and accept the', 'core.hideText': 'Hide text', 'core.read': 'Read',
    'lang.choose': 'Choose your app language', 'lang.apply': 'APPLY', 'lang.note': 'Profiles and chats stay in the language they were written in.', 'lang.title': 'App language',
  },
  hi: {
    'core.mobile': 'मोबाइल नंबर', 'core.sendCode': 'वन-टाइम कोड भेजें', 'core.codeSent': 'SMS से भेजा गया 6 अंकों का कोड दर्ज करें:', 'core.devCode': 'डेवलपमेंट मोड: कोड {code} भरा गया।',
    'core.otp': 'वन-टाइम कोड', 'core.yourName': 'आपका नाम', 'core.verify': 'सत्यापित करें और आगे बढ़ें', 'core.changeNumber': 'नंबर बदलें', 'core.resend': 'कोड फिर भेजें',
    'core.agree': 'मैं सहमत हूँ', 'core.beforeContinue': 'आगे बढ़ने से पहले', 'core.reviewNotices': 'कृपया ये सूचनाएँ पढ़ें और स्वीकार करें। हम आपकी स्वीकृति का संस्करण और समय दर्ज करते हैं।',
    'core.accept': 'मैंने पढ़ लिया है और स्वीकार करता/करती हूँ:', 'core.hideText': 'पाठ छिपाएँ', 'core.read': 'पढ़ें',
    'lang.choose': 'अपनी ऐप भाषा चुनें', 'lang.apply': 'लागू करें', 'lang.note': 'प्रोफ़ाइल और चैट उसी भाषा में रहेंगे जिसमें लिखे गए।', 'lang.title': 'ऐप की भाषा',
  },
  te: {
    'core.mobile': 'మొబైల్ నంబర్', 'core.sendCode': 'వన్-టైమ్ కోడ్ పంపండి', 'core.codeSent': 'SMS ద్వారా పంపిన 6 అంకెల కోడ్ నమోదు చేయండి:', 'core.devCode': 'డెవలప్‌మెంట్ మోడ్: కోడ్ {code} నింపబడింది.',
    'core.otp': 'వన్-టైమ్ కోడ్', 'core.yourName': 'మీ పేరు', 'core.verify': 'ధృవీకరించి కొనసాగండి', 'core.changeNumber': 'నంబర్ మార్చండి', 'core.resend': 'కోడ్ మళ్లీ పంపండి',
    'core.agree': 'నేను అంగీకరిస్తున్నాను', 'core.beforeContinue': 'కొనసాగే ముందు', 'core.reviewNotices': 'దయచేసి ఈ నోటీసులను చదివి అంగీకరించండి. మీ అంగీకార సంస్కరణ, సమయం నమోదు చేస్తాం.',
    'core.accept': 'నేను చదివి అంగీకరిస్తున్నాను:', 'core.hideText': 'దాచు', 'core.read': 'చదవండి',
    'lang.choose': 'మీ యాప్ భాషను ఎంచుకోండి', 'lang.apply': 'వర్తింపజేయి', 'lang.note': 'ప్రొఫైళ్లు, చాట్‌లు రాసిన భాషలోనే ఉంటాయి.', 'lang.title': 'యాప్ భాష',
  },
  ta: {
    'core.mobile': 'மொபைல் எண்', 'core.sendCode': 'ஒருமுறை குறியீடு அனுப்பு', 'core.codeSent': 'SMS மூலம் அனுப்பிய 6 இலக்கக் குறியீட்டை உள்ளிடுக:', 'core.devCode': 'டெவலப்மென்ட் முறை: குறியீடு {code} நிரப்பப்பட்டது.',
    'core.otp': 'ஒருமுறை குறியீடு', 'core.yourName': 'உங்கள் பெயர்', 'core.verify': 'சரிபார்த்துத் தொடர்க', 'core.changeNumber': 'எண்ணை மாற்று', 'core.resend': 'மீண்டும் அனுப்பு',
    'core.agree': 'ஒப்புக்கொள்கிறேன்', 'core.beforeContinue': 'தொடர்வதற்கு முன்', 'core.reviewNotices': 'இந்த அறிவிப்புகளைப் படித்து ஏற்கவும். உங்கள் ஒப்புதலின் பதிப்பு, நேரத்தைப் பதிவு செய்கிறோம்.',
    'core.accept': 'படித்து ஏற்கிறேன்:', 'core.hideText': 'மறை', 'core.read': 'படி',
    'lang.choose': 'உங்கள் செயலி மொழியைத் தேர்வுசெய்க', 'lang.apply': 'பயன்படுத்து', 'lang.note': 'சுயவிவரங்களும் அரட்டைகளும் எழுதிய மொழியிலேயே இருக்கும்.', 'lang.title': 'செயலி மொழி',
  },
  kn: {
    'core.mobile': 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', 'core.sendCode': 'ಒನ್-ಟೈಮ್ ಕೋಡ್ ಕಳುಹಿಸಿ', 'core.codeSent': 'SMS ಮೂಲಕ ಕಳುಹಿಸಿದ 6 ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ:', 'core.devCode': 'ಡೆವಲಪ್‌ಮೆಂಟ್ ಮೋಡ್: ಕೋಡ್ {code} ತುಂಬಲಾಗಿದೆ.',
    'core.otp': 'ಒನ್-ಟೈಮ್ ಕೋಡ್', 'core.yourName': 'ನಿಮ್ಮ ಹೆಸರು', 'core.verify': 'ಪರಿಶೀಲಿಸಿ ಮುಂದುವರಿಯಿರಿ', 'core.changeNumber': 'ಸಂಖ್ಯೆ ಬದಲಿಸಿ', 'core.resend': 'ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ',
    'core.agree': 'ನಾನು ಒಪ್ಪುತ್ತೇನೆ', 'core.beforeContinue': 'ಮುಂದುವರಿಯುವ ಮೊದಲು', 'core.reviewNotices': 'ದಯವಿಟ್ಟು ಈ ಸೂಚನೆಗಳನ್ನು ಓದಿ ಒಪ್ಪಿಕೊಳ್ಳಿ. ನಿಮ್ಮ ಒಪ್ಪಿಗೆಯ ಆವೃತ್ತಿ ಮತ್ತು ಸಮಯವನ್ನು ದಾಖಲಿಸುತ್ತೇವೆ.',
    'core.accept': 'ನಾನು ಓದಿ ಒಪ್ಪುತ್ತೇನೆ:', 'core.hideText': 'ಮರೆಮಾಡಿ', 'core.read': 'ಓದಿ',
    'lang.choose': 'ನಿಮ್ಮ ಆ್ಯಪ್ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ', 'lang.apply': 'ಅನ್ವಯಿಸಿ', 'lang.note': 'ಪ್ರೊಫೈಲ್‌ಗಳು ಮತ್ತು ಚಾಟ್‌ಗಳು ಬರೆದ ಭಾಷೆಯಲ್ಲೇ ಇರುತ್ತವೆ.', 'lang.title': 'ಆ್ಯಪ್ ಭಾಷೆ',
  },
  mr: {
    'core.mobile': 'मोबाइल नंबर', 'core.sendCode': 'वन-टाइम कोड पाठवा', 'core.codeSent': 'SMS ने पाठवलेला 6 अंकी कोड टाका:', 'core.devCode': 'डेव्हलपमेंट मोड: कोड {code} भरला.',
    'core.otp': 'वन-टाइम कोड', 'core.yourName': 'तुमचे नाव', 'core.verify': 'सत्यापित करा आणि पुढे जा', 'core.changeNumber': 'नंबर बदला', 'core.resend': 'कोड पुन्हा पाठवा',
    'core.agree': 'मी सहमत आहे', 'core.beforeContinue': 'पुढे जाण्यापूर्वी', 'core.reviewNotices': 'कृपया या सूचना वाचा आणि स्वीकारा. तुमच्या स्वीकृतीची आवृत्ती आणि वेळ आम्ही नोंदवतो.',
    'core.accept': 'मी वाचले आणि स्वीकारतो/स्वीकारते:', 'core.hideText': 'मजकूर लपवा', 'core.read': 'वाचा',
    'lang.choose': 'तुमची अ‍ॅप भाषा निवडा', 'lang.apply': 'लागू करा', 'lang.note': 'प्रोफाइल आणि चॅट ज्या भाषेत लिहिले त्याच भाषेत राहतील.', 'lang.title': 'अ‍ॅपची भाषा',
  },
  bn: {
    'core.mobile': 'মোবাইল নম্বর', 'core.sendCode': 'ওয়ান-টাইম কোড পাঠান', 'core.codeSent': 'SMS-এ পাঠানো ৬ অঙ্কের কোড লিখুন:', 'core.devCode': 'ডেভেলপমেন্ট মোড: কোড {code} বসানো হয়েছে।',
    'core.otp': 'ওয়ান-টাইম কোড', 'core.yourName': 'আপনার নাম', 'core.verify': 'যাচাই করে এগিয়ে যান', 'core.changeNumber': 'নম্বর বদলান', 'core.resend': 'আবার কোড পাঠান',
    'core.agree': 'আমি সম্মত', 'core.beforeContinue': 'এগোনোর আগে', 'core.reviewNotices': 'অনুগ্রহ করে এই বিজ্ঞপ্তিগুলি পড়ে গ্রহণ করুন। আমরা আপনার সম্মতির সংস্করণ ও সময় নথিভুক্ত করি।',
    'core.accept': 'আমি পড়েছি এবং গ্রহণ করছি:', 'core.hideText': 'লুকান', 'core.read': 'পড়ুন',
    'lang.choose': 'আপনার অ্যাপের ভাষা বেছে নিন', 'lang.apply': 'প্রয়োগ করুন', 'lang.note': 'প্রোফাইল ও চ্যাট যে ভাষায় লেখা, সেই ভাষাতেই থাকবে।', 'lang.title': 'অ্যাপের ভাষা',
  },
};

function format(s, vars) {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
const makeT = (dicts, lang) => (key, vars) => format(dicts[lang]?.[key] ?? dicts.en?.[key] ?? key, vars);
const merge = (extra = {}) => Object.fromEntries(LANGS.map(({ code }) => [code, { ...CORE[code], ...(extra[code] || {}) }]));

const I18nContext = createContext({ lang: 'en', t: makeT(merge(), 'en'), setLang: async () => {}, onChange: () => () => {}, hasLocalChoice: async () => false });
export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

/**
 * Holds the app language. Each app passes its own `dictionaries` ({ en: {...}, hi: {...} }) and a
 * `storageKey`; the strings of this package's shared screens are merged in.
 */
export function I18nProvider({ dictionaries, storageKey, children }) {
  const dicts = useMemo(() => merge(dictionaries), [dictionaries]);
  const [lang, setLangState] = useState('en');
  const [listeners] = useState(() => new Set());
  useEffect(() => { secureStorage.get(storageKey).then((v) => { if (v && dicts[v]) setLangState(v); }).catch(() => {}); }, [storageKey, dicts]);
  const setLang = useCallback(async (code, { persistRemote = true } = {}) => {
    if (!dicts[code]) return;
    setLangState(code);
    await secureStorage.set(storageKey, code).catch(() => {});
    if (persistRemote) listeners.forEach((l) => l(code));
  }, [dicts, listeners, storageKey]);
  const value = useMemo(() => ({
    lang,
    setLang,
    t: makeT(dicts, lang),
    hasLocalChoice: () => secureStorage.get(storageKey).then(Boolean).catch(() => false),
    onChange: (l) => { listeners.add(l); return () => listeners.delete(l); },
  }), [lang, setLang, dicts, listeners, storageKey]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Keeps the language in step with the signed-in account: on a device with no saved choice it adopts
 * the account's language (`load` resolves to a code), and every change in the app is sent to `save`.
 */
export function LanguageSync({ load, save }) {
  const { lang, setLang, onChange, hasLocalChoice } = useI18n();
  useEffect(() => {
    let live = true;
    hasLocalChoice().then((local) => {
      if (!local) load().then((code) => { if (live && code && code !== lang) setLang(code, { persistRemote: false }); }).catch(() => {});
    });
    const off = onChange((code) => { save(code).catch(() => {}); });
    return () => { live = false; off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Bottom sheet with a two-column grid of languages and an APPLY button (default app styling). */
export function LanguagePicker({ visible, onClose }) {
  const c = useTheme();
  const { lang, setLang, t } = useI18n();
  const [pick, setPick] = useState(lang);
  useEffect(() => { if (visible) setPick(lang); }, [visible, lang]);
  const apply = async () => { await setLang(pick); onClose?.(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, gap: 16 }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: c.text }}>{t('lang.choose')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close language picker"><Text style={{ fontSize: 22, color: c.muted }}>✕</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {LANGS.map((l) => {
            const active = pick === l.code;
            return (
              <Pressable key={l.code} onPress={() => setPick(l.code)} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={l.label}
                style={{ width: '47.5%', borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 2, backgroundColor: active ? c.primarySoft : c.bg, borderWidth: 1.5, borderColor: active ? c.primary : c.border }}>
                {active ? <Text style={{ position: 'absolute', top: 6, right: 10, color: c.primary, fontWeight: '700' }}>✓</Text> : null}
                <Text style={{ fontSize: 20, fontWeight: '700', color: active ? c.primary : c.text }}>{l.short || l.native}</Text>
                <Text style={{ fontSize: 13, color: c.muted }}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ fontSize: 12, color: c.muted }}>{t('lang.note')}</Text>
        <Pressable onPress={apply} accessibilityRole="button" accessibilityLabel={t('lang.apply')} style={({ pressed }) => ({ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: c.onPrimary, fontWeight: '700', fontSize: 16 }}>{t('lang.apply')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Compact button showing the current language code; opens the picker. */
export function LanguageButton({ style }) {
  const c = useTheme();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`App language: ${cur?.label}`} hitSlop={8}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.surface }, style]}>
        <Text style={{ fontSize: 14, color: c.primary }}>文A</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>{lang.toUpperCase()}</Text>
      </Pressable>
      <LanguagePicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
