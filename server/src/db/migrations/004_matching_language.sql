-- Kundli matching results (recent matches per customer)
CREATE TABLE kundli_matches (
  match_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES client_profiles(client_id),
  boy         jsonb NOT NULL,
  girl        jsonb NOT NULL,
  total       numeric(4,1) NOT NULL,
  result      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kundli_matches_client_idx ON kundli_matches (client_id, created_at DESC);
