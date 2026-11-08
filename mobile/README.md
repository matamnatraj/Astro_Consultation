# Mobile apps (Android & iOS)

Native mobile apps for the Astrology Consultation Platform, built with **React Native + Expo (SDK 58)**. One codebase per app produces both the Google Play (Android) and Apple App Store (iOS) builds. The web apps in `../apps/` are unchanged, and all apps share the same backend (`../server`).

| App | Folder | Store name | Android package / iOS bundle ID | Deep-link scheme |
|---|---|---|---|---|
| Customer | `apps/customer` | **Jyotish Connect** | `com.jyotishconnect.customer` | `astrocustomer://` |
| Astrologer | `apps/astrologer` | **Jyotish Partner** | `com.jyotishconnect.astrologer` | `astroastrologer://` |
| Shared code | `packages/core` | — | — | — |

`packages/core` holds what both apps share: the API client (tokens in the iOS Keychain / Android Keystore via `expo-secure-store`), the real-time connection (auto-reconnect, and re-sync when the app returns to the foreground), the native chart renderer (`react-native-svg`), the chat and session timer, push-notification registration, the login and consent screens, support, the assistant, notifications, and the UI kit with light and dark themes.

## What's in each app

**Customer (Jyotish Connect):** OTP login → notice acceptance → home (banners, active sessions, top astrologers) → search and filter astrologers → profile and reviews → book now or schedule (slot, duration, whose chart, price and policy) → pay in a secure in-app browser → live status → consultation room (chat + **My chart** tab) → receipt, review, cancel. Also: birth profiles (place search, time accuracy, versioning), chart view (North/South Indian, wheel, planets, dasha) with regeneration and history, profile and privacy (export data, deletion request), support tickets, help assistant, and notifications.

**Astrologer (Jyotish Partner):** OTP login → dashboard with an **Online** switch and live request queue (accept/decline with countdown) → **consultation workspace** with a dedicated **☉ Birth Chart** button and Chat / Birth Chart tabs. Both panes stay mounted, so switching never interrupts the chat, timer or billing, and an unread badge shows new messages while the chart is open. The workspace also has a client summary, start/end controls and private notes. Plus: consultation history, availability slots, earnings ledger and payouts, profile onboarding (rates, ID upload from the phone, bank details, submit for verification), support and notifications.

## Run on your phone (development)

1. Install **Expo Go** from the Play Store or App Store.
2. Start the backend (`npm run dev:server` in the repository root) so it's reachable from your phone.
3. In this folder:

   ```bash
   npm install
   ```

   ```bash
   npm run customer      # or: npm run astrologer
   ```

4. Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android).

When the phone and computer are on the same Wi-Fi, the app finds the API automatically (`http://<your computer's IP>:4000`). Elsewhere, for example in GitHub Codespaces:

- make port 4000 public in the **Ports** tab;
- start with the API address and a tunnel:

  ```bash
  EXPO_PUBLIC_API_URL=https://<your-codespace>-4000.app.github.dev npx expo start --tunnel
  ```

  Run this inside `apps/customer` or `apps/astrologer`.

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
