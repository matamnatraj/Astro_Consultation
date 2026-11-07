-- Astrology Consultation Platform — initial schema (DPR §8 logical data model)
-- Money is stored as integer paise. Timestamps are timestamptz (UTC); birth-place
-- time zone context is retained separately on birth profiles.

-- ───────────────────────── Identity ─────────────────────────
CREATE TABLE user_accounts (
  user_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role           text NOT NULL CHECK (role IN ('customer','astrologer','admin')),
  admin_role     text CHECK (admin_role IN ('super_admin','support','finance','content')),
  phone          text UNIQUE,
  email          text UNIQUE,
  display_name   text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CHECK ((role = 'admin') = (admin_role IS NOT NULL))
);

CREATE TABLE otp_challenges (
  challenge_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    text NOT NULL,
  role          text NOT NULL,
  code_hash     text NOT NULL,
  attempts      int NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_identifier_idx ON otp_challenges (identifier, created_at DESC);

CREATE TABLE auth_sessions (
  session_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES user_accounts(user_id),
  refresh_hash  text NOT NULL UNIQUE,
  user_agent    text,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Customer ─────────────────────────
CREATE TABLE client_profiles (
  client_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES user_accounts(user_id),
  full_name           text,
  gender              text,
  contact_email       text,
  contact_phone       text,
  preferred_language  text DEFAULT 'en',
  notification_prefs  jsonb NOT NULL DEFAULT '{"push":true,"email":true,"sms":false}',
  marketing_opt_in    boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE birth_profiles (
  birth_profile_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES client_profiles(client_id),
  label              text NOT NULL DEFAULT 'Self',
  full_name          text NOT NULL,
  gender             text,
  birth_date         date NOT NULL,
  birth_time         time,
  time_accuracy      text NOT NULL CHECK (time_accuracy IN ('exact','approximate','unknown')),
  time_source        text,
  place_name         text NOT NULL,
  latitude           numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude          numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  tz_name            text NOT NULL,
  tz_offset_minutes  int NOT NULL,
  place_confirmed    boolean NOT NULL DEFAULT false,
  is_primary         boolean NOT NULL DEFAULT false,
  version            int NOT NULL DEFAULT 1,
  archived_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (time_accuracy = 'unknown' OR birth_time IS NOT NULL)
);
CREATE INDEX birth_profiles_client_idx ON birth_profiles (client_id);

-- Immutable history of every birth-profile version (never silently overwritten)
CREATE TABLE birth_profile_versions (
  birth_profile_id  uuid NOT NULL REFERENCES birth_profiles(birth_profile_id),
  version           int NOT NULL,
  snapshot          jsonb NOT NULL,
  changed_by        uuid REFERENCES user_accounts(user_id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (birth_profile_id, version)
);

CREATE TABLE birth_charts (
  chart_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL REFERENCES client_profiles(client_id),
  birth_profile_id       uuid NOT NULL REFERENCES birth_profiles(birth_profile_id),
  birth_profile_version  int NOT NULL,
  input_snapshot         jsonb NOT NULL,
  config                 jsonb NOT NULL,
  engine_name            text NOT NULL,
  engine_version         text NOT NULL,
  output                 jsonb,
  warnings               jsonb NOT NULL DEFAULT '[]',
  status                 text NOT NULL CHECK (status IN ('current','stale','failed')),
  error                  text,
  generated_at           timestamptz NOT NULL DEFAULT now(),
  stale_at               timestamptz
);
CREATE INDEX birth_charts_profile_idx ON birth_charts (birth_profile_id, generated_at DESC);

-- ───────────────────────── Astrologers ─────────────────────────
CREATE TABLE astrologer_profiles (
  astrologer_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES user_accounts(user_id),
  display_name         text NOT NULL,
  bio                  text NOT NULL DEFAULT '',
  experience_years     int NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  languages            text[] NOT NULL DEFAULT '{}',
  specialties          text[] NOT NULL DEFAULT '{}',
  services             text[] NOT NULL DEFAULT '{}',
  modes                text[] NOT NULL DEFAULT '{chat}',
  chat_rate_paise      int NOT NULL DEFAULT 0 CHECK (chat_rate_paise >= 0),
  voice_rate_paise     int NOT NULL DEFAULT 0 CHECK (voice_rate_paise >= 0),
  video_rate_paise     int NOT NULL DEFAULT 0 CHECK (video_rate_paise >= 0),
  timezone             text NOT NULL DEFAULT 'Asia/Kolkata',
  working_hours        jsonb NOT NULL DEFAULT '[]',
  verification_status  text NOT NULL DEFAULT 'draft'
                       CHECK (verification_status IN ('draft','submitted','approved','rejected','suspended')),
  verification_notes   text,
  verified_at          timestamptz,
  is_online            boolean NOT NULL DEFAULT false,
  rating_avg           numeric(3,2) NOT NULL DEFAULT 0,
  rating_count         int NOT NULL DEFAULT 0,
  payout_details       jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE astrologer_documents (
  document_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  astrologer_id  uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  doc_type       text NOT NULL,
  file_name      text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     int NOT NULL,
  storage_key    text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE availability_slots (
  slot_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  astrologer_id  uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  time_zone      text NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','held','booked','blocked')),
  held_until     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);
CREATE INDEX availability_astrologer_idx ON availability_slots (astrologer_id, start_at);

-- ───────────────────────── Content / consent ─────────────────────────
CREATE TABLE policy_documents (
  policy_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_type   text NOT NULL,
  version       int NOT NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  audience      text NOT NULL DEFAULT 'all' CHECK (audience IN ('customers','astrologers','all')),
  config        jsonb NOT NULL DEFAULT '{}',
  is_current    boolean NOT NULL DEFAULT false,
  published_at  timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES user_accounts(user_id),
  UNIQUE (notice_type, version)
);
CREATE UNIQUE INDEX policy_current_idx ON policy_documents (notice_type) WHERE is_current;

CREATE TABLE consent_records (
  consent_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_accounts(user_id),
  notice_type     text NOT NULL,
  notice_version  int NOT NULL,
  context         text NOT NULL,
  ip_address      text,
  user_agent      text,
  accepted_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_user_idx ON consent_records (user_id, notice_type);

CREATE TABLE announcements (
  announcement_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL DEFAULT 'announcement' CHECK (kind IN ('announcement','banner','policy_update')),
  title            text NOT NULL,
  body             text NOT NULL,
  audience         text NOT NULL CHECK (audience IN ('customers','astrologers','all')),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at     timestamptz,
  expires_at       timestamptz,
  created_by       uuid REFERENCES user_accounts(user_id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faqs (
  faq_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question    text NOT NULL,
  answer      text NOT NULL,
  keywords    text[] NOT NULL DEFAULT '{}',
  audience    text NOT NULL DEFAULT 'all' CHECK (audience IN ('customers','astrologers','all')),
  link        text,
  sort_order  int NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Booking / consultation ─────────────────────────
CREATE TABLE bookings (
  booking_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES client_profiles(client_id),
  astrologer_id         uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  birth_profile_id      uuid NOT NULL REFERENCES birth_profiles(birth_profile_id),
  mode                  text NOT NULL CHECK (mode IN ('chat','voice','video')),
  booking_type          text NOT NULL CHECK (booking_type IN ('instant','scheduled')),
  slot_id               uuid REFERENCES availability_slots(slot_id),
  scheduled_at          timestamptz,
  duration_minutes      int NOT NULL CHECK (duration_minutes BETWEEN 5 AND 120),
  rate_paise            int NOT NULL,
  quoted_amount_paise   int NOT NULL,
  currency              text NOT NULL DEFAULT 'INR',
  status                text NOT NULL CHECK (status IN ('pending_payment','confirmed','completed','cancelled','expired')),
  policy_version        int NOT NULL,
  topic                 text,
  cancel_reason         text,
  cancelled_by          uuid REFERENCES user_accounts(user_id),
  idempotency_key       text NOT NULL,
  payment_expires_at    timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, idempotency_key)
);
CREATE INDEX bookings_client_idx ON bookings (client_id, created_at DESC);
CREATE INDEX bookings_astrologer_idx ON bookings (astrologer_id, created_at DESC);

CREATE TABLE consultations (
  consultation_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL UNIQUE REFERENCES bookings(booking_id),
  client_id            uuid NOT NULL REFERENCES client_profiles(client_id),
  astrologer_id        uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  status               text NOT NULL CHECK (status IN
                        ('requested','accepted','ready','in_progress','completed','rejected','cancelled','expired','failed')),
  accept_deadline      timestamptz,
  accepted_at          timestamptz,
  ready_at             timestamptz,
  started_at           timestamptz,
  ended_at             timestamptz,
  ended_by             text,
  end_reason           text,
  duration_seconds     int,
  billable_seconds     int,
  max_billable_seconds int NOT NULL,
  final_amount_paise   int,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consultations_astrologer_idx ON consultations (astrologer_id, status);
CREATE INDEX consultations_client_idx ON consultations (client_id, status);

CREATE TABLE messages (
  message_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq              bigserial UNIQUE,
  consultation_id  uuid NOT NULL REFERENCES consultations(consultation_id),
  sender_user_id   uuid REFERENCES user_accounts(user_id),
  sender_role      text NOT NULL CHECK (sender_role IN ('customer','astrologer','system')),
  kind             text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system')),
  content          text NOT NULL,
  client_msg_id    text,
  delivered_at     timestamptz,
  read_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultation_id, sender_user_id, client_msg_id)
);
CREATE INDEX messages_consultation_idx ON messages (consultation_id, seq);

CREATE TABLE consultation_notes (
  note_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id  uuid NOT NULL REFERENCES consultations(consultation_id),
  astrologer_id    uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  review_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id  uuid NOT NULL UNIQUE REFERENCES consultations(consultation_id),
  client_id        uuid NOT NULL REFERENCES client_profiles(client_id),
  astrologer_id    uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  rating           int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          text,
  status           text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Payments / ledger ─────────────────────────
CREATE TABLE payment_transactions (
  transaction_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES bookings(booking_id),
  gateway             text NOT NULL,
  gateway_order_id    text NOT NULL UNIQUE,
  gateway_payment_id  text,
  amount_paise        int NOT NULL CHECK (amount_paise > 0),
  captured_paise      int NOT NULL DEFAULT 0,
  refunded_paise      int NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL CHECK (status IN
                        ('created','authorized','captured','failed','refunded','partially_refunded','voided')),
  failure_reason      text,
  idempotency_key     text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON payment_transactions (booking_id);

CREATE TABLE refunds (
  refund_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id     uuid NOT NULL REFERENCES payment_transactions(transaction_id),
  amount_paise       int NOT NULL CHECK (amount_paise > 0),
  reason             text NOT NULL,
  gateway_refund_id  text,
  status             text NOT NULL DEFAULT 'processed' CHECK (status IN ('pending','processed','failed')),
  initiated_by       uuid REFERENCES user_accounts(user_id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_webhook_events (
  gateway_event_id  text PRIMARY KEY,
  event_type        text NOT NULL,
  payload           jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  outcome           text
);

CREATE TABLE commission_rules (
  rule_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope            text NOT NULL CHECK (scope IN ('default','mode','astrologer')),
  astrologer_id    uuid REFERENCES astrologer_profiles(astrologer_id),
  mode             text,
  platform_fee_bps int NOT NULL CHECK (platform_fee_bps BETWEEN 0 AND 10000),
  effective_from   timestamptz NOT NULL DEFAULT now(),
  effective_to     timestamptz,
  note             text,
  created_by       uuid REFERENCES user_accounts(user_id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  payout_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  astrologer_id  uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  amount_paise   int NOT NULL,
  entry_count    int NOT NULL,
  status         text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','paid','failed')),
  reference      text,
  failure_reason text,
  created_by     uuid REFERENCES user_accounts(user_id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);

CREATE TABLE commission_ledger (
  ledger_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     uuid NOT NULL REFERENCES consultations(consultation_id),
  astrologer_id       uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  entry_type          text NOT NULL DEFAULT 'earning' CHECK (entry_type IN ('earning','adjustment')),
  gross_paise         int NOT NULL,
  platform_fee_paise  int NOT NULL,
  adjustments_paise   int NOT NULL DEFAULT 0,
  payable_paise       int NOT NULL,
  rule_id             uuid REFERENCES commission_rules(rule_id),
  fee_bps             int NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','eligible','in_payout','paid','reversed')),
  eligible_at         timestamptz NOT NULL,
  payout_id           uuid REFERENCES payouts(payout_id),
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_astrologer_idx ON commission_ledger (astrologer_id, status);

-- ───────────────────────── Notifications / support / audit ─────────────────────────
CREATE TABLE notifications (
  notification_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES user_accounts(user_id),
  type             text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  data             jsonb NOT NULL DEFAULT '{}',
  channels         text[] NOT NULL DEFAULT '{in_app}',
  delivery         jsonb NOT NULL DEFAULT '{}',
  announcement_id  uuid REFERENCES announcements(announcement_id),
  read_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE support_tickets (
  ticket_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       bigserial UNIQUE,
  requester_user_id   uuid NOT NULL REFERENCES user_accounts(user_id),
  booking_id          uuid REFERENCES bookings(booking_id),
  category            text NOT NULL CHECK (category IN
                        ('booking','payment','refund','consultation_quality','technical','account','complaint','other')),
  subject             text NOT NULL,
  description         text NOT NULL,
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','escalated','resolved','closed')),
  source              text NOT NULL DEFAULT 'user' CHECK (source IN ('user','assistant_handoff','admin')),
  assignee_user_id    uuid REFERENCES user_accounts(user_id),
  resolution          text,
  sla_due_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_messages (
  ticket_message_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id          uuid NOT NULL REFERENCES support_tickets(ticket_id),
  author_user_id     uuid REFERENCES user_accounts(user_id),
  author_kind        text NOT NULL CHECK (author_kind IN ('requester','staff','assistant','system')),
  body               text NOT NULL,
  internal           boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id  uuid REFERENCES user_accounts(user_id),
  actor_role     text,
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text,
  purpose        text,
  context        jsonb NOT NULL DEFAULT '{}',
  outcome        text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','denied','failure')),
  ip_address     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_target_idx ON audit_events (target_type, target_id);
CREATE INDEX audit_created_idx ON audit_events (created_at DESC);
