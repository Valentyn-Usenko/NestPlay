BEGIN;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS presence_connections (
  connection_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gateway_domain TEXT NOT NULL,
  gateway_stage TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_presence_connections_user_active
ON presence_connections (
  user_id,
  expires_at DESC
);

CREATE INDEX IF NOT EXISTS idx_presence_connections_expiry
ON presence_connections (
  expires_at
);

COMMIT;
