-- Wallet (ledger), wallet-paid bookings with welcome gift, favorites, review tags, chat attachments.

-- Wallet ledger: balance = SUM(amount_paise). Credits are positive, debits negative.
CREATE TABLE wallet_transactions (
  wallet_txn_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES user_accounts(user_id),
  type                   text NOT NULL CHECK (type IN ('recharge','bonus','hold','release','refund','adjustment')),
  amount_paise           int NOT NULL CHECK (amount_paise <> 0),
  balance_after_paise    int NOT NULL CHECK (balance_after_paise >= 0),
  booking_id             uuid REFERENCES bookings(booking_id),
  payment_transaction_id uuid,
  description            text NOT NULL,
  created_by             uuid REFERENCES user_accounts(user_id),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_txn_user_idx ON wallet_transactions (user_id, created_at DESC);
CREATE INDEX wallet_txn_booking_idx ON wallet_transactions (booking_id);

-- Gateway payments can now also be wallet recharges.
ALTER TABLE payment_transactions ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE payment_transactions ADD COLUMN purpose text NOT NULL DEFAULT 'booking' CHECK (purpose IN ('booking','wallet_recharge'));
ALTER TABLE payment_transactions ADD COLUMN user_id uuid REFERENCES user_accounts(user_id);
ALTER TABLE payment_transactions ADD COLUMN bonus_paise int NOT NULL DEFAULT 0;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_purpose_target CHECK ((purpose = 'booking') = (booking_id IS NOT NULL));

-- Bookings record how they are paid and any promotional discount (platform-funded).
ALTER TABLE bookings ADD COLUMN payment_method text NOT NULL DEFAULT 'gateway' CHECK (payment_method IN ('gateway','wallet'));
ALTER TABLE bookings ADD COLUMN discount_paise int NOT NULL DEFAULT 0 CHECK (discount_paise >= 0);
ALTER TABLE bookings ADD COLUMN discount_label text;
ALTER TABLE consultations ADD COLUMN charged_paise int;

-- Favorites
CREATE TABLE favorite_astrologers (
  client_id      uuid NOT NULL REFERENCES client_profiles(client_id),
  astrologer_id  uuid NOT NULL REFERENCES astrologer_profiles(astrologer_id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, astrologer_id)
);

-- Review tags (e.g. Knowledgeable, Helpful, Polite)
ALTER TABLE reviews ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

-- Chat attachments (images / PDFs), stored encrypted in object storage
ALTER TABLE messages DROP CONSTRAINT messages_kind_check;
ALTER TABLE messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text','system','file'));
ALTER TABLE messages ADD COLUMN attachment jsonb;
