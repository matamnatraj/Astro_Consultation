# Mobile apps (Android & iOS)

Native mobile apps for the Astrology Consultation Platform, built with **React Native + Expo (SDK 58)**. One codebase per app produces both the Google Play (Android) and Apple App Store (iOS) builds. The web apps in `../apps/` are unchanged, and all apps share the same backend (`../server`).

| App | Folder | Store name | Android package / iOS bundle ID | Deep-link scheme |
|---|---|---|---|---|
| Customer | `apps/customer` | **Astrovedas** | `com.astrovedas.app` | `astrocustomer://` |
| Astrologer | `apps/astrologer` | **Jyotish Partner** | `com.jyotishconnect.astrologer` | `astroastrologer://` |
| Shared code | `packages/core` | — | — | — |

`packages/core` holds what both apps share: the API client (tokens in the iOS Keychain / Android Keystore via `expo-secure-store`), the real-time connection (auto-reconnect, and re-sync when the app returns to the foreground), the native chart renderer (`react-native-svg`), the chat and session timer, push-notification registration, the login and consent screens, support, the assistant, notifications, and the UI kit with light and dark themes.

## What's in each app

**Customer (Astrovedas)** follows the designer's Figma: cream and saffron theme, Poppins type, and bottom tabs **Home · Astrologers · Kundli · Wallet · Profile**.
- **Home:** greeting, **VEDA Wallet** pill, search with filters, promo carousel (Free Kundli, Predictions, Welcome Gift), Chat / Call / Kundli shortcuts, astrology categories, online astrologers, recent sessions.
- **Astrologers:** All / Chat / Call tabs, search, an **Online Only** switch, sort, favourites (♥). The **Search Filters** screen offers language, experience, a price-range slider, speciality and mode.
- **Astrologer profile:** stats tiles plus About, Reviews (with top tags) and Services.
- **Consultation setup:** mode cards, duration chips, price breakdown with a **Welcome Gift (2 min free)**, the wallet balance, and **Confirm & Start Chat**. It is paid from the wallet: the amount is held and only used minutes are charged.
- **Chat:** timer and amount bar, file attachments, extending the session from the wallet, viewing your kundli mid-chat, and ending the session; then the **Rate Your Consultation** screen with tags.
- **Wallet:** recharge packs with bonus, amount entry, gateway checkout, transaction history.
- **Kundli:** saved charts, Create New Kundli, basic details, chart styles, planets and dasha. **Predictions:** today's transits over your chart and the current dasha.
- **Kundli Matching:** Ashtakoota guna milan out of 36 for a boy and a girl, each from a saved kundli or entered by hand (name, date, time or "don't know", city search). Results show a score ring, the verdict, all 8 kootas, doshas (Nadi, Bhakoot, Gana), Manglik for both, and a shortcut to marriage astrologers. Matches are saved under Recent Matches.
- **App language:** English, Hindi, Telugu, Tamil, Kannada, Marathi and Bengali. Change it from the login screen, the Home header or Profile → App language; the choice is saved to the account. Have native speakers review the translations (`src/lib/i18n.js`) before launch. Astrologer profiles, chats and the detailed astrology explanations from the server stay in English.
- **Profile:** consultations, favourites, support, help assistant, account and privacy, sign out.
- **Audio call:** the screen is built as designed, but switched off until a voice provider is integrated (set `ENABLED_MODES=chat,voice` on the server once it is).

**Astrologer (Jyotish Partner):** OTP login → dashboard with an **Online** switch and live request queue (accept/decline with countdown) → **consultation workspace** with a dedicated **☉ Birth Chart** button and Chat / Birth Chart tabs. Both panes stay mounted, so switching never interrupts the chat, timer or billing, and an unread badge shows new messages while the chart is open. The workspace also has a client summary, start/end controls and private notes. Plus: consultation history, availability slots, earnings ledger and payouts, profile onboarding (rates, ID upload from the phone, bank details, submit for verification), support and notifications.

## Run on your phone (development)

1. Install **Expo Go** from the Play Store or App Store.
2. Open the project in **GitHub Codespaces** (or on a computer) and make sure the backend is running. In Codespaces it starts automatically; otherwise run `npm run dev:all` in the repository root.
3. In a terminal, go to the mobile folder:

   ```bash
   cd mobile
   ```

4. Start the customer app (or the astrologer app with `npm run phone:astrologer`):

   ```bash
   npm run phone:customer
   ```

5. Open the app on your phone:
   - If the terminal is on another screen, scan the QR code with Expo Go (Android) or the Camera app (iPhone).
   - If the terminal is on the same phone, copy the `exp://…` link shown under **OPEN ON YOUR PHONE**. In Expo Go, tap **Enter URL manually** and paste it.

The launcher installs dependencies on first run and starts a public tunnel so your phone can reach the app from anywhere. In Codespaces, it also makes the API (port 4000) public and points the app at it automatically.

Demo logins are the same as the web apps: customer `+919900000001`, astrologer `+919800000001`. In development the one-time code is filled in automatically.

> Expo Go can't receive push notifications on Android. Use a build from EAS (below) to test push.

## Build for the Play Store and App Store (EAS Build — no Mac needed)

Builds run in Expo's cloud, which handles Android signing keys and iOS certificates for you.

1. **Accounts:** a free [Expo account](https://expo.dev), a [Google Play Console](https://play.google.com/console) account (one-time US$25 fee), and the [Apple Developer Program](https://developer.apple.com/programs/) (US$99 a year).
2. **Production backend:** store apps can't reach `localhost`. Deploy the server with HTTPS, then put its URL in `EXPO_PUBLIC_API_URL` under `build.production.env` in each app's `eas.json` (they currently hold placeholders).
3. **Link each app to Expo:** this sets the EAS project ID, which push notifications need.

   ```bash
   cd apps/customer && npx eas-cli@latest login && npx eas-cli@latest init
   ```

   Repeat in `apps/astrologer`.
4. **Test build:** an installable Android APK to share with testers.

   ```bash
   npm run build:preview
   ```

5. **Store builds:** an Android App Bundle and an iOS archive. Version numbers increment automatically.

   ```bash
   npm run build:android
   ```

   ```bash
   npm run build:ios
   ```

6. **Submit to the stores:** Android goes to the Play internal testing track as a draft; iOS goes to App Store Connect / TestFlight.

   ```bash
   npm run submit:android
   ```

   ```bash
   npm run submit:ios
   ```

7. **Store listings:** add screenshots, a description, the privacy policy URL, the data-safety form (Play) and privacy "nutrition labels" (Apple), and age rating, then send for review.

Push notifications work once the app is linked to EAS (step 3). Add FCM credentials for Android and an APNs key for iOS with `npx eas-cli@latest credentials`. The server sends through Expo's push service, and notifications never contain birth details or chat text.

## Store-review notes

- **Payments.** Consultations are real-time services delivered by a person, so they're paid through the payment gateway (hosted checkout in a secure in-app browser), not app-store in-app purchase. Apple's and Google's guidelines allow this for person-to-person services. The `MockPay` test gateway must be replaced with a real provider (for example Razorpay) before submission.
- **Astrology content.** Show the astrology disclaimer (already part of the consent screen) and keep claims to guidance and entertainment.
- **Account deletion.** Both stores require in-app account deletion. Customers can request it under **Profile → Request account deletion**.
- **Reviewer access.** Give reviewers a demo phone number with a fixed OTP, or enable a review-only login, so they can sign in.

## Checks

```bash
npx expo export --platform android --platform ios
```

This compiles the native JavaScript bundles; run it inside an app folder. Both apps compile; in this environment, 18 of 20 `expo-doctor` checks pass, and the other two need Expo's online services. `expo prebuild` generates valid Android and iOS projects. Both apps were also exercised end to end at phone size through Expo's web renderer against the real API: booking, payment, accepting, chatting, the Birth Chart button during a live session, ending the session, and adding a birth profile.
