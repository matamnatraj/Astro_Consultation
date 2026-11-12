# Astrology Consultation Platform

A working MVP of everything in the *Astrology Consultation Platform — Detailed DPR*: the three applications (customer, astrologer, admin web) and the shared backend that supports them.

| App | Path | Dev URL | Who |
|---|---|---|---|
| Backend API + real-time | `server/` | http://localhost:4000 | — |
| Customer app (responsive web / PWA-ready) | `apps/customer` | http://localhost:5173 | Customers |
| Astrologer app (responsive web) | `apps/astrologer` | http://localhost:5174 | Astrologers |
| Admin web console | `apps/admin` | http://localhost:5175 | Support, finance, content, super-admins |
| Shared UI, API client, chart renderer, chat | `packages/shared` | — | — |
| **Customer mobile app** (Android + iOS) | `mobile/apps/customer` | Expo Go / store builds | Customers |
| **Astrologer mobile app** (Android + iOS) | `mobile/apps/astrologer` | Expo Go / store builds | Astrologers |

## Mobile apps (Play Store & App Store)

Native Android and iOS apps for customers and astrologers live in [`mobile/`](mobile/README.md) and are built with React Native + Expo. They use the same backend as the web apps. See [`mobile/README.md`](mobile/README.md) to run them on your phone and to publish to the stores.

## Languages and Kundli matching

All five apps (customer, astrologer and admin websites, and the two mobile apps) have an app-language picker with English, Hindi, Telugu, Tamil, Kannada, Marathi and Bengali. Customers and astrologers have their choice saved to their account, so it follows them across the website and the phone; the admin console remembers it per browser. Shared strings and the picker live in `packages/shared/src/i18n.jsx` (web) and `mobile/packages/core/src/i18n.js` (mobile); each app's own strings are in its `src/i18n.js` or `src/lib/i18n.js`. The translations need a native-speaker review before launch.

Kundli matching (Ashtakoota guna milan out of 36, with doshas and Manglik for both people) is in the customer website (**Kundli Matching** in the menu) and the customer mobile app. Matches are saved under Recent matches and shared between the two.

## Quick start

Requirements: Node 22+, PostgreSQL 14+ (or Docker).

```bash
npm install
# PostgreSQL: either your own (set DATABASE_URL) or:
docker compose up -d db
npm run db:seed          # migrates + seeds policies, FAQs, commission rule, demo users
npm run dev:server       # API on :4000 (runs migrations on boot)
npm run dev:customer     # :5173
npm run dev:astrologer   # :5174
npm run dev:admin        # :5175
npm test                 # backend unit + end-to-end API tests (needs a database `astro_test`)
```

Login is by OTP. In development the code is returned by the API and pre-filled in the login screen.

| Role | Login |
|---|---|
| Customer (has a saved birth profile) | `+919900000001` — or any new number to register |
| Astrologers (approved) | `+919800000001` … `+919800000005` |
| Astrologer awaiting verification | `+919800000009` |
| Admins | `admin@astro.local` (super admin), `support@astro.local`, `finance@astro.local`, `content@astro.local` |

**Try the core journey:** log in as astrologer `+919800000001` and go **Online** → in the customer app pick *Acharya Raghav Sharma* → *Chat now* → pay on the MockPay test page → accept in the astrologer app → the workspace opens with the client's chart beside the chat → *Start session* → chat → end → see the ledger entry in Admin → Bookings.

## Architecture

Modular monolith (DPR §7) — one Node.js/Express service with domain modules, PostgreSQL as the system of record, WebSockets for real-time.

```
Customer app ─┐                       ┌─ auth (OTP, JWT + rotating refresh tokens, roles)
Astrologer app ├─ REST /v1 + WS /v1/realtime ─┤  clients / birth profiles (versioned) / charts (versioned, provider-based)
Admin web ─────┘                       ├─ astrologers (discovery, onboarding, documents, availability)
                                       ├─ bookings → payments (gateway adapter, signed webhooks) → consultations (state machine)
                                       ├─ messages (durable, sequenced, resumable) · notifications (after-commit delivery)
                                       ├─ commission ledger · payouts · refunds
                                       ├─ content / policies / consent · support tickets · assistant
                                       └─ admin (RBAC) · reports · audit
                                         │
                       PostgreSQL · encrypted object storage · scheduler (advisory-locked jobs)
                       External adapters: OTP/SMS/email/push · payment gateway · astrology engine · geocoding
```

Key design rules from the DPR that the code enforces:

- **Server-side money and time.** Price, timer, billable minutes, commission and authorization are all computed on the server. Billing is per started minute, capped at the booked duration; the server ends the session automatically at the limit.
- **Separate state machines** for booking (`pending_payment → confirmed → completed/cancelled/expired`), consultation (`requested → accepted → ready → in_progress → completed`, plus rejected/cancelled/expired/failed), payment (`created → authorized → captured/voided → refunded`) and payout ledger (`pending → eligible → in_payout → paid`).
- **Idempotency.** Booking creation takes an idempotency key, webhook events are deduplicated by gateway event ID, chat messages by client message ID, and payment checkout reuses the open order.
- **Notifications can't roll anything back.** They're written inside the transaction, but delivery happens only after commit.
- **Ledger, not a balance.** Refunds after capture create negative adjustment entries; history is never edited.
- **Object-level authorization for charts.** Only the assigned astrologer, only during an accepted/ready/in-progress consultation (plus a 60-minute post-session wrap-up), and every view or denial is written to `audit_events`.

## DPR traceability

| DPR item | Where |
|---|---|
| **U1** Permanent, editable client data | `client_profiles`, `birth_profiles` + immutable `birth_profile_versions`; export (`GET /clients/me/export`) and tracked deletion requests |
| **U2** Astrologer selection | Discovery with filters (language, specialty, rating, price, online) → profile → instant or scheduled booking |
| **U3** Saved birth details & chart | Birth profile with exact/approximate/unknown time, place → coordinates + IANA zone (historical offset resolved server-side); chart generated and stored with input snapshot, config and engine version |
| **U4** Astrologer chart access | `GET /consultations/:id/client-chart` — assignment and status checked, audited; missing/stale charts flagged with a regenerate action |
| **U5** Birth Chart button | Dedicated button in the astrologer workspace header |
| **U6** Chat + chart together | Desktop split view; mobile Chat/Birth Chart tabs with both panes kept mounted (timer, connection, unread and billing preserved) |
| Chart staleness/versioning (§5) | Editing date/time/place marks charts `stale`; regeneration creates a new version; history kept |
| Consent & disclaimers | Versioned `policy_documents`; consent gate on login; cancellation-policy version stored per booking; consent records in admin |
| AI chatbot (§12) | Labelled as automated; FAQ answers only from approved content; booking/payment/price facts fetched live; refuses predictions; human handoff creates a ticket (transcript shared only with consent) |
| Notifications | In-app + realtime push; channel adapters for push/email/SMS; no birth details or message text in previews |
| Payments (§11) | Hosted checkout, HMAC-verified idempotent webhooks, authorize → capture actual usage → release the rest, refunds, cancellation fees per policy, no card data stored |
| Commission & payouts | Effective-dated rules (astrologer › mode › default), hold period, payout batches with minimum threshold, reconciliation (paid with UTR, or failed → back to eligible) |
| Admin (§3) | Dashboard + alerts, astrologer verification with signed short-lived document links, customers, bookings/disputes (transcripts need a stated, audited purpose), payments/refunds, content, support with SLA, reviews moderation, 8 reports with CSV export, admin users/roles, audit log |
| Security (§10) | RBAC (customer, astrologer, super_admin, support, finance, content), OTP rate limits, refresh-token rotation, account suspension revokes sessions, AES-256-GCM encryption for documents at rest, CSV-injection guard, secrets via env only |
| Testing (§14) | `server/test/unit.test.js` (billing, commission, state machine, cancellation, historical time zones, chart reference case), `server/test/journey.test.js` (end-to-end release-acceptance journeys against PostgreSQL) |

## Decisions taken for this build (DPR §18 — confirm before launch)

These are working defaults, all configurable, that stand in for decisions the DPR says the business must make:

| Decision | Default used | Where to change |
|---|---|---|
| Geography / currency | India, INR, `+91` default prefix | `config.js`, auth normalization |
| Consultation modes | **Chat only** at launch (voice/video modelled but not bookable) | `ENABLED_MODES` |
| Pricing | Per-minute, authorize booked duration, charge per started minute | bookings/consultations services |
| Commission | 30% default platform fee | Admin → Commission rules |
| Payout | 7-day hold, ₹500 minimum, manual batch + reconciliation | env + Admin → Payouts |
| Cancellation | Free until accepted; scheduled ≥2h before = free; later or instant-after-accept = 50% fee; astrologer decline/no-show = free | Admin → Policies (versioned rules JSON) |
| Astrology system | Vedic sidereal (Lahiri), whole-sign houses, Vimshottari dasha; Western tropical also available | `providers/astrology` |
| AI scope | Support-only assistant (retrieval + live lookups) | `modules/assistant` |

## What is a stand-in, and what's needed for production

The code is structured so each of these is an adapter swap, not a rewrite:

- **Payment gateway:** `MockPay` simulates a hosted gateway (authorize/capture/void/refund, HMAC webhooks). Plug a real provider (e.g. Razorpay/Cashfree) into `providers/payments/` and point its webhooks at `/v1/payments/webhook`.
- **OTP/SMS/email/push:** codes and messages are logged in development. Wire real providers into `modules/notifications/service.js` and the OTP request handler.
- **Astrology engine:** the built-in engine uses `astronomy-engine` (high-precision ephemeris) with a Lahiri approximation. It is regression-tested against a well-known published chart. Per DPR §5 it still needs validation against domain-expert-approved reference cases, or replacement with a procured provider behind the same `calculate()` contract.
- **Geocoding:** a built-in gazetteer of about 70 cities plus manual coordinates. Swap in a geocoding provider for full coverage.
- **Voice/video:** modes, rates and the state machine support them, but no RTC SDK is integrated.
- **Mobile apps:** the customer and astrologer apps are responsive web apps (mobile layouts included). Native or Flutter/React Native shells are a later step if required.
- **Scale and ops:** rate limiting is in-memory (use Redis when running multiple instances), file storage is encrypted local disk (use S3/GCS), and jobs run in-process under a Postgres advisory lock. Add monitoring, backups and CI/CD per DPR §13.
- **Legal:** the seeded policy texts are marked DRAFT and need review by qualified counsel (privacy, consumer, tax/invoicing).
