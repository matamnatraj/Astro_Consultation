import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// App languages shared by the three web apps (same set as the mobile apps).
// Translations should be reviewed by native speakers before launch.
export const LANGS = [
  { code: 'en', native: 'English', label: 'English', short: 'ENG' },
  { code: 'hi', native: 'हिंदी', label: 'Hindi' },
  { code: 'te', native: 'తెలుగు', label: 'Telugu' },
  { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
  { code: 'kn', native: 'ಕನ್ನಡ', label: 'Kannada' },
  { code: 'mr', native: 'मराठी', label: 'Marathi' },
  { code: 'bn', native: 'বাংলা', label: 'Bengali' },
];

// Strings used by this package's shared components (login, consent, notifications, assistant, chat).
const CORE = {
  en: {
    'core.identifier': 'Mobile number or email', 'core.sendCode': 'Send one-time code', 'core.codeSent': 'Enter the 6-digit code sent to', 'core.devCode': 'Development mode: code {code} pre-filled.',
    'core.otp': 'One-time code', 'core.yourName': 'Your name', 'core.verify': 'Verify & continue', 'core.changeNumber': 'Change number', 'core.resend': 'Resend code',
    'core.agree': 'I agree', 'core.beforeContinue': 'Before you continue', 'core.reviewNotices': 'Please review and accept the following notices. We record the version and time of your acceptance.', 'core.accept': 'I have read and accept the',
    'core.signOut': 'Sign out', 'core.notifications': 'Notifications', 'core.markAll': 'Mark all read', 'core.caughtUp': "You're all caught up.",
    'core.help': 'Help', 'core.ai': 'Automated assistant (AI)', 'core.loading': 'Loading…', 'core.open': 'Open →', 'core.human': 'Talk to a human', 'core.share': 'Share this conversation with the support agent',
    'core.createTicket': 'Create support ticket', 'core.cancel': 'Cancel', 'core.askPh': 'Ask about bookings, payments, the app…', 'core.ask': 'Ask',
    'core.typeMsg': 'Type a message…', 'core.reconnecting': 'Reconnecting… messages will sync automatically.', 'core.failed': 'Failed — tap to retry', 'core.sending': 'Sending…', 'core.chatOpens': 'Chat opens when the session starts', 'core.send': 'Send', 'core.retry': 'Retry',
    'lang.choose': 'Choose your app language', 'lang.apply': 'APPLY', 'lang.note': 'Profiles and chats stay in the language they were written in.', 'lang.title': 'App language',
  },
  hi: {
    'core.identifier': 'मोबाइल नंबर या ईमेल', 'core.sendCode': 'वन-टाइम कोड भेजें', 'core.codeSent': 'यहाँ भेजा गया 6 अंकों का कोड दर्ज करें:', 'core.devCode': 'डेवलपमेंट मोड: कोड {code} पहले से भरा गया।',
    'core.otp': 'वन-टाइम कोड', 'core.yourName': 'आपका नाम', 'core.verify': 'सत्यापित करें और आगे बढ़ें', 'core.changeNumber': 'नंबर बदलें', 'core.resend': 'कोड फिर भेजें',
    'core.agree': 'मैं सहमत हूँ', 'core.beforeContinue': 'आगे बढ़ने से पहले', 'core.reviewNotices': 'कृपया ये सूचनाएँ पढ़ें और स्वीकार करें। हम आपकी स्वीकृति का संस्करण और समय दर्ज करते हैं।', 'core.accept': 'मैंने पढ़ लिया है और स्वीकार करता/करती हूँ:',
    'core.signOut': 'साइन आउट', 'core.notifications': 'सूचनाएँ', 'core.markAll': 'सभी पढ़े गए', 'core.caughtUp': 'कोई नई सूचना नहीं।',
    'core.help': 'सहायता', 'core.ai': 'स्वचालित सहायक (AI)', 'core.loading': 'लोड हो रहा है…', 'core.open': 'खोलें →', 'core.human': 'किसी व्यक्ति से बात करें', 'core.share': 'यह बातचीत सहायता एजेंट के साथ साझा करें',
    'core.createTicket': 'सहायता टिकट बनाएँ', 'core.cancel': 'रद्द करें', 'core.askPh': 'बुकिंग, भुगतान, ऐप के बारे में पूछें…', 'core.ask': 'पूछें',
    'core.typeMsg': 'संदेश लिखें…', 'core.reconnecting': 'फिर से कनेक्ट हो रहा है… संदेश अपने आप सिंक होंगे।', 'core.failed': 'विफल — फिर से भेजने के लिए टैप करें', 'core.sending': 'भेजा जा रहा है…', 'core.chatOpens': 'सत्र शुरू होने पर चैट खुलेगी', 'core.send': 'भेजें', 'core.retry': 'फिर कोशिश करें',
    'lang.choose': 'अपनी ऐप भाषा चुनें', 'lang.apply': 'लागू करें', 'lang.note': 'प्रोफ़ाइल और चैट उसी भाषा में रहेंगे जिसमें लिखे गए।', 'lang.title': 'ऐप की भाषा',
  },
  te: {
    'core.identifier': 'మొబైల్ నంబర్ లేదా ఈమెయిల్', 'core.sendCode': 'వన్-టైమ్ కోడ్ పంపండి', 'core.codeSent': 'ఇక్కడికి పంపిన 6 అంకెల కోడ్ నమోదు చేయండి:', 'core.devCode': 'డెవలప్‌మెంట్ మోడ్: కోడ్ {code} ముందే నింపబడింది.',
    'core.otp': 'వన్-టైమ్ కోడ్', 'core.yourName': 'మీ పేరు', 'core.verify': 'ధృవీకరించి కొనసాగండి', 'core.changeNumber': 'నంబర్ మార్చండి', 'core.resend': 'కోడ్ మళ్లీ పంపండి',
    'core.agree': 'నేను అంగీకరిస్తున్నాను', 'core.beforeContinue': 'కొనసాగే ముందు', 'core.reviewNotices': 'దయచేసి ఈ నోటీసులను చదివి అంగీకరించండి. మీ అంగీకార సంస్కరణ, సమయం నమోదు చేస్తాం.', 'core.accept': 'నేను చదివి అంగీకరిస్తున్నాను:',
    'core.signOut': 'సైన్ అవుట్', 'core.notifications': 'నోటిఫికేషన్లు', 'core.markAll': 'అన్నీ చదివినట్లు గుర్తించు', 'core.caughtUp': 'కొత్తవి ఏవీ లేవు.',
    'core.help': 'సహాయం', 'core.ai': 'ఆటోమేటెడ్ సహాయకుడు (AI)', 'core.loading': 'లోడ్ అవుతోంది…', 'core.open': 'తెరువు →', 'core.human': 'మనిషితో మాట్లాడండి', 'core.share': 'ఈ సంభాషణను సహాయ ఏజెంట్‌తో పంచుకోండి',
    'core.createTicket': 'సహాయ టికెట్ సృష్టించండి', 'core.cancel': 'రద్దు', 'core.askPh': 'బుకింగ్‌లు, చెల్లింపులు, యాప్ గురించి అడగండి…', 'core.ask': 'అడగండి',
    'core.typeMsg': 'సందేశం టైప్ చేయండి…', 'core.reconnecting': 'మళ్లీ కనెక్ట్ అవుతోంది… సందేశాలు ఆటోమేటిక్‌గా సింక్ అవుతాయి.', 'core.failed': 'విఫలమైంది — మళ్లీ ప్రయత్నించడానికి నొక్కండి', 'core.sending': 'పంపుతోంది…', 'core.chatOpens': 'సెషన్ ప్రారంభమయ్యాక చాట్ తెరుచుకుంటుంది', 'core.send': 'పంపు', 'core.retry': 'మళ్లీ ప్రయత్నించు',
    'lang.choose': 'మీ యాప్ భాషను ఎంచుకోండి', 'lang.apply': 'వర్తింపజేయి', 'lang.note': 'ప్రొఫైళ్లు, చాట్‌లు రాసిన భాషలోనే ఉంటాయి.', 'lang.title': 'యాప్ భాష',
  },
  ta: {
    'core.identifier': 'மொபைல் எண் அல்லது மின்னஞ்சல்', 'core.sendCode': 'ஒருமுறை குறியீடு அனுப்பு', 'core.codeSent': 'இங்கு அனுப்பிய 6 இலக்கக் குறியீட்டை உள்ளிடுக:', 'core.devCode': 'டெவலப்மென்ட் முறை: குறியீடு {code} முன்பே நிரப்பப்பட்டது.',
    'core.otp': 'ஒருமுறை குறியீடு', 'core.yourName': 'உங்கள் பெயர்', 'core.verify': 'சரிபார்த்துத் தொடர்க', 'core.changeNumber': 'எண்ணை மாற்று', 'core.resend': 'மீண்டும் அனுப்பு',
    'core.agree': 'ஒப்புக்கொள்கிறேன்', 'core.beforeContinue': 'தொடர்வதற்கு முன்', 'core.reviewNotices': 'இந்த அறிவிப்புகளைப் படித்து ஏற்கவும். உங்கள் ஒப்புதலின் பதிப்பு, நேரத்தைப் பதிவு செய்கிறோம்.', 'core.accept': 'படித்து ஏற்கிறேன்:',
    'core.signOut': 'வெளியேறு', 'core.notifications': 'அறிவிப்புகள்', 'core.markAll': 'அனைத்தையும் படித்ததாகக் குறி', 'core.caughtUp': 'புதிய அறிவிப்புகள் இல்லை.',
    'core.help': 'உதவி', 'core.ai': 'தானியங்கி உதவியாளர் (AI)', 'core.loading': 'ஏற்றுகிறது…', 'core.open': 'திற →', 'core.human': 'ஒருவரிடம் பேசுங்கள்', 'core.share': 'இந்த உரையாடலை உதவி முகவருடன் பகிர்',
    'core.createTicket': 'உதவிச் சீட்டு உருவாக்கு', 'core.cancel': 'ரத்து', 'core.askPh': 'பதிவுகள், கட்டணங்கள், செயலி பற்றிக் கேளுங்கள்…', 'core.ask': 'கேள்',
    'core.typeMsg': 'செய்தி தட்டச்சு செய்க…', 'core.reconnecting': 'மீண்டும் இணைக்கிறது… செய்திகள் தானாக ஒத்திசைக்கப்படும்.', 'core.failed': 'தோல்வி — மீண்டும் முயல தட்டவும்', 'core.sending': 'அனுப்புகிறது…', 'core.chatOpens': 'அமர்வு தொடங்கியதும் அரட்டை திறக்கும்', 'core.send': 'அனுப்பு', 'core.retry': 'மீண்டும் முயல்',
    'lang.choose': 'உங்கள் செயலி மொழியைத் தேர்வுசெய்க', 'lang.apply': 'பயன்படுத்து', 'lang.note': 'சுயவிவரங்களும் அரட்டைகளும் எழுதிய மொழியிலேயே இருக்கும்.', 'lang.title': 'செயலி மொழி',
  },
  kn: {
    'core.identifier': 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಇಮೇಲ್', 'core.sendCode': 'ಒನ್-ಟೈಮ್ ಕೋಡ್ ಕಳುಹಿಸಿ', 'core.codeSent': 'ಇಲ್ಲಿಗೆ ಕಳುಹಿಸಿದ 6 ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ:', 'core.devCode': 'ಡೆವಲಪ್‌ಮೆಂಟ್ ಮೋಡ್: ಕೋಡ್ {code} ಮೊದಲೇ ತುಂಬಲಾಗಿದೆ.',
    'core.otp': 'ಒನ್-ಟೈಮ್ ಕೋಡ್', 'core.yourName': 'ನಿಮ್ಮ ಹೆಸರು', 'core.verify': 'ಪರಿಶೀಲಿಸಿ ಮುಂದುವರಿಯಿರಿ', 'core.changeNumber': 'ಸಂಖ್ಯೆ ಬದಲಿಸಿ', 'core.resend': 'ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ',
    'core.agree': 'ನಾನು ಒಪ್ಪುತ್ತೇನೆ', 'core.beforeContinue': 'ಮುಂದುವರಿಯುವ ಮೊದಲು', 'core.reviewNotices': 'ದಯವಿಟ್ಟು ಈ ಸೂಚನೆಗಳನ್ನು ಓದಿ ಒಪ್ಪಿಕೊಳ್ಳಿ. ನಿಮ್ಮ ಒಪ್ಪಿಗೆಯ ಆವೃತ್ತಿ ಮತ್ತು ಸಮಯವನ್ನು ದಾಖಲಿಸುತ್ತೇವೆ.', 'core.accept': 'ನಾನು ಓದಿ ಒಪ್ಪುತ್ತೇನೆ:',
    'core.signOut': 'ಸೈನ್ ಔಟ್', 'core.notifications': 'ಅಧಿಸೂಚನೆಗಳು', 'core.markAll': 'ಎಲ್ಲವನ್ನೂ ಓದಿದ್ದು ಎಂದು ಗುರುತಿಸಿ', 'core.caughtUp': 'ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.',
    'core.help': 'ಸಹಾಯ', 'core.ai': 'ಸ್ವಯಂಚಾಲಿತ ಸಹಾಯಕ (AI)', 'core.loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…', 'core.open': 'ತೆರೆಯಿರಿ →', 'core.human': 'ವ್ಯಕ್ತಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ', 'core.share': 'ಈ ಸಂಭಾಷಣೆಯನ್ನು ಸಹಾಯ ಏಜೆಂಟ್‌ನೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ',
    'core.createTicket': 'ಸಹಾಯ ಟಿಕೆಟ್ ರಚಿಸಿ', 'core.cancel': 'ರದ್ದು', 'core.askPh': 'ಬುಕಿಂಗ್, ಪಾವತಿ, ಆ್ಯಪ್ ಬಗ್ಗೆ ಕೇಳಿ…', 'core.ask': 'ಕೇಳಿ',
    'core.typeMsg': 'ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ…', 'core.reconnecting': 'ಮರುಸಂಪರ್ಕಿಸುತ್ತಿದೆ… ಸಂದೇಶಗಳು ಸ್ವಯಂ ಸಿಂಕ್ ಆಗುತ್ತವೆ.', 'core.failed': 'ವಿಫಲ — ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಒತ್ತಿ', 'core.sending': 'ಕಳುಹಿಸುತ್ತಿದೆ…', 'core.chatOpens': 'ಸೆಷನ್ ಆರಂಭವಾದಾಗ ಚಾಟ್ ತೆರೆಯುತ್ತದೆ', 'core.send': 'ಕಳುಹಿಸಿ', 'core.retry': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    'lang.choose': 'ನಿಮ್ಮ ಆ್ಯಪ್ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ', 'lang.apply': 'ಅನ್ವಯಿಸಿ', 'lang.note': 'ಪ್ರೊಫೈಲ್‌ಗಳು ಮತ್ತು ಚಾಟ್‌ಗಳು ಬರೆದ ಭಾಷೆಯಲ್ಲೇ ಇರುತ್ತವೆ.', 'lang.title': 'ಆ್ಯಪ್ ಭಾಷೆ',
  },
  mr: {
    'core.identifier': 'मोबाइल नंबर किंवा ईमेल', 'core.sendCode': 'वन-टाइम कोड पाठवा', 'core.codeSent': 'येथे पाठवलेला 6 अंकी कोड टाका:', 'core.devCode': 'डेव्हलपमेंट मोड: कोड {code} आधीच भरला.',
    'core.otp': 'वन-टाइम कोड', 'core.yourName': 'तुमचे नाव', 'core.verify': 'सत्यापित करा आणि पुढे जा', 'core.changeNumber': 'नंबर बदला', 'core.resend': 'कोड पुन्हा पाठवा',
    'core.agree': 'मी सहमत आहे', 'core.beforeContinue': 'पुढे जाण्यापूर्वी', 'core.reviewNotices': 'कृपया या सूचना वाचा आणि स्वीकारा. तुमच्या स्वीकृतीची आवृत्ती आणि वेळ आम्ही नोंदवतो.', 'core.accept': 'मी वाचले आणि स्वीकारतो/स्वीकारते:',
    'core.signOut': 'साइन आउट', 'core.notifications': 'सूचना', 'core.markAll': 'सर्व वाचले म्हणून चिन्हांकित करा', 'core.caughtUp': 'नवीन सूचना नाहीत.',
    'core.help': 'मदत', 'core.ai': 'स्वयंचलित सहाय्यक (AI)', 'core.loading': 'लोड होत आहे…', 'core.open': 'उघडा →', 'core.human': 'व्यक्तीशी बोला', 'core.share': 'हे संभाषण सहाय्य एजंटसोबत शेअर करा',
    'core.createTicket': 'सहाय्य तिकीट तयार करा', 'core.cancel': 'रद्द करा', 'core.askPh': 'बुकिंग, पेमेंट, अ‍ॅपबद्दल विचारा…', 'core.ask': 'विचारा',
    'core.typeMsg': 'संदेश लिहा…', 'core.reconnecting': 'पुन्हा कनेक्ट होत आहे… संदेश आपोआप सिंक होतील.', 'core.failed': 'अयशस्वी — पुन्हा प्रयत्नासाठी टॅप करा', 'core.sending': 'पाठवत आहे…', 'core.chatOpens': 'सत्र सुरू झाल्यावर चॅट उघडेल', 'core.send': 'पाठवा', 'core.retry': 'पुन्हा प्रयत्न करा',
    'lang.choose': 'तुमची अ‍ॅप भाषा निवडा', 'lang.apply': 'लागू करा', 'lang.note': 'प्रोफाइल आणि चॅट ज्या भाषेत लिहिले त्याच भाषेत राहतील.', 'lang.title': 'अ‍ॅपची भाषा',
  },
  bn: {
    'core.identifier': 'মোবাইল নম্বর বা ইমেল', 'core.sendCode': 'ওয়ান-টাইম কোড পাঠান', 'core.codeSent': 'এখানে পাঠানো ৬ অঙ্কের কোড লিখুন:', 'core.devCode': 'ডেভেলপমেন্ট মোড: কোড {code} আগেই বসানো হয়েছে।',
    'core.otp': 'ওয়ান-টাইম কোড', 'core.yourName': 'আপনার নাম', 'core.verify': 'যাচাই করে এগিয়ে যান', 'core.changeNumber': 'নম্বর বদলান', 'core.resend': 'আবার কোড পাঠান',
    'core.agree': 'আমি সম্মত', 'core.beforeContinue': 'এগোনোর আগে', 'core.reviewNotices': 'অনুগ্রহ করে এই বিজ্ঞপ্তিগুলি পড়ে গ্রহণ করুন। আমরা আপনার সম্মতির সংস্করণ ও সময় নথিভুক্ত করি।', 'core.accept': 'আমি পড়েছি এবং গ্রহণ করছি:',
    'core.signOut': 'সাইন আউট', 'core.notifications': 'বিজ্ঞপ্তি', 'core.markAll': 'সব পড়া হয়েছে', 'core.caughtUp': 'কোনো নতুন বিজ্ঞপ্তি নেই।',
    'core.help': 'সাহায্য', 'core.ai': 'স্বয়ংক্রিয় সহকারী (AI)', 'core.loading': 'লোড হচ্ছে…', 'core.open': 'খুলুন →', 'core.human': 'একজন মানুষের সঙ্গে কথা বলুন', 'core.share': 'এই কথোপকথন সহায়তা এজেন্টের সঙ্গে শেয়ার করুন',
    'core.createTicket': 'সহায়তা টিকিট তৈরি করুন', 'core.cancel': 'বাতিল', 'core.askPh': 'বুকিং, পেমেন্ট, অ্যাপ সম্পর্কে জিজ্ঞাসা করুন…', 'core.ask': 'জিজ্ঞাসা',
    'core.typeMsg': 'বার্তা লিখুন…', 'core.reconnecting': 'আবার সংযোগ হচ্ছে… বার্তা নিজে থেকে সিঙ্ক হবে।', 'core.failed': 'ব্যর্থ — আবার চেষ্টা করতে ট্যাপ করুন', 'core.sending': 'পাঠানো হচ্ছে…', 'core.chatOpens': 'সেশন শুরু হলে চ্যাট খুলবে', 'core.send': 'পাঠান', 'core.retry': 'আবার চেষ্টা',
    'lang.choose': 'আপনার অ্যাপের ভাষা বেছে নিন', 'lang.apply': 'প্রয়োগ করুন', 'lang.note': 'প্রোফাইল ও চ্যাট যে ভাষায় লেখা, সেই ভাষাতেই থাকবে।', 'lang.title': 'অ্যাপের ভাষা',
  },
};

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* unavailable */ } };
function format(s, vars) {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
const makeT = (dicts, lang) => (key, vars) => format(dicts[lang]?.[key] ?? dicts.en?.[key] ?? key, vars);
const merge = (extra = {}) => Object.fromEntries(LANGS.map(({ code }) => [code, { ...CORE[code], ...(extra[code] || {}) }]));

const I18nContext = createContext({ lang: 'en', t: makeT(merge(), 'en'), setLang: () => {}, onChange: () => () => {}, hasLocalChoice: () => false });
export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

/** Holds the app language for one web app: its own `dictionaries` plus this package's shared strings. */
export function I18nProvider({ dictionaries, storageKey, children }) {
  const dicts = useMemo(() => merge(dictionaries), [dictionaries]);
  const [lang, setLangState] = useState(() => { const v = read(storageKey); return v && dicts[v] ? v : 'en'; });
  const [listeners] = useState(() => new Set());
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((code, { persistRemote = true } = {}) => {
    if (!dicts[code]) return;
    setLangState(code);
    write(storageKey, code);
    if (persistRemote) listeners.forEach((l) => l(code));
  }, [dicts, listeners, storageKey]);
  const value = useMemo(() => ({
    lang, setLang, t: makeT(dicts, lang),
    hasLocalChoice: () => Boolean(read(storageKey)),
    onChange: (l) => { listeners.add(l); return () => listeners.delete(l); },
  }), [lang, setLang, dicts, listeners, storageKey]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Adopts the account's language on a browser with no saved choice, and sends every change to `save`. */
export function LanguageSync({ load, save }) {
  const { lang, setLang, onChange, hasLocalChoice } = useI18n();
  useEffect(() => {
    let live = true;
    if (!hasLocalChoice() && load) load().then((code) => { if (live && code && code !== lang) setLang(code, { persistRemote: false }); }).catch(() => {});
    const off = save ? onChange((code) => { save(code).catch(() => {}); }) : () => {};
    return () => { live = false; off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Dialog with a grid of languages and an APPLY button. */
export function LanguagePicker({ open, onClose }) {
  const { lang, setLang, t } = useI18n();
  const [pick, setPick] = useState(lang);
  useEffect(() => { if (open) setPick(lang); }, [open, lang]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal lang-modal" role="dialog" aria-modal="true" aria-label={t('lang.choose')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{t('lang.choose')}</h3><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="lang-grid" role="radiogroup">
            {LANGS.map((l) => (
              <button key={l.code} type="button" role="radio" aria-checked={pick === l.code} aria-label={l.label} className={`lang-tile${pick === l.code ? ' active' : ''}`} onClick={() => setPick(l.code)}>
                <span className="lang-native" lang={l.code}>{l.short || l.native}</span>
                <span className="lang-label">{l.label}</span>
              </button>
            ))}
          </div>
          <p className="muted small">{t('lang.note')}</p>
        </div>
        <div className="modal-foot"><button type="button" className="btn btn-primary btn-block" onClick={() => { setLang(pick); onClose(); }}>{t('lang.apply')}</button></div>
      </div>
    </div>
  );
}

/** Compact header button showing the current language; opens the picker. */
export function LanguageButton({ className = '' }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.code === lang);
  return (
    <>
      <button type="button" className={`lang-btn ${className}`} aria-label={`App language: ${cur?.label}`} onClick={() => setOpen(true)}>
        <span aria-hidden="true">文A</span> {lang.toUpperCase()}
      </button>
      <LanguagePicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}
