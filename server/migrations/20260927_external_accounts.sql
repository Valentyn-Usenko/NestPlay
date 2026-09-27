CREATE TABLE IF NOT EXISTS user_external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  provider TEXT NOT NULL,

  external_user_id TEXT NOT NULL,

  display_name TEXT,

  activity_sharing_enabled BOOLEAN
    NOT NULL
    DEFAULT FALSE,

  connected_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  last_synced_at TIMESTAMPTZ,

  CONSTRAINT user_external_accounts_provider_not_blank
    CHECK (BTRIM(provider) <> ''),

  CONSTRAINT user_external_accounts_external_id_not_blank
    CHECK (BTRIM(external_user_id) <> ''),

  CONSTRAINT user_external_accounts_provider_normalized
    CHECK (
      provider = LOWER(provider)
      AND provider ~ '^[a-z0-9_-]+$'
    ),

  CONSTRAINT user_external_accounts_user_provider_unique
    UNIQUE (user_id, provider),

  CONSTRAINT user_external_accounts_provider_external_unique
    UNIQUE (provider, external_user_id)
);


CREATE INDEX IF NOT EXISTS idx_external_accounts_activity_sync
  ON user_external_accounts (
    provider,
    last_synced_at
  )
  WHERE activity_sharing_enabled = TRUE;


CREATE TABLE IF NOT EXISTS external_account_link_states (
  state_hash TEXT PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  provider TEXT NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  expires_at TIMESTAMPTZ
    NOT NULL,

  used_at TIMESTAMPTZ,

  CONSTRAINT external_account_link_provider_not_blank
    CHECK (BTRIM(provider) <> ''),

  CONSTRAINT external_account_link_provider_normalized
    CHECK (
      provider = LOWER(provider)
      AND provider ~ '^[a-z0-9_-]+$'
    ),

  CONSTRAINT external_account_link_expiry_valid
    CHECK (expires_at > created_at)
);


CREATE INDEX IF NOT EXISTS idx_external_account_link_states_cleanup
  ON external_account_link_states (
    expires_at
  );


CREATE INDEX IF NOT EXISTS idx_external_account_link_states_user_provider
  ON external_account_link_states (
    user_id,
    provider
  );