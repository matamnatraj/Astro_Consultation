-- Mobile devices registered for push notifications (Expo push tokens → FCM/APNs)
CREATE TABLE device_tokens (
  token        text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES user_accounts(user_id),
  platform     text NOT NULL CHECK (platform IN ('android','ios','web')),
  app          text NOT NULL CHECK (app IN ('customer','astrologer')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user_idx ON device_tokens (user_id);
