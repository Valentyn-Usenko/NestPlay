BEGIN;

CREATE TABLE IF NOT EXISTS user_current_games (
  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  game_art_url TEXT,

  position SMALLINT NOT NULL,

  source TEXT NOT NULL
    DEFAULT 'manual',

  source_ref TEXT,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  PRIMARY KEY (
    user_id,
    source,
    game_id
  ),

  UNIQUE (
    user_id,
    source,
    position
  ),

  CHECK (
    position BETWEEN 1 AND 3
  ),

  CHECK (
    LENGTH(BTRIM(game_id))
      BETWEEN 1 AND 200
  ),

  CHECK (
    LENGTH(BTRIM(game_name))
      BETWEEN 1 AND 240
  ),

  CHECK (
    LENGTH(BTRIM(source))
      BETWEEN 1 AND 40
  )
);

CREATE INDEX IF NOT EXISTS
  idx_user_current_games_user_position
ON user_current_games (
  user_id,
  position
);

COMMIT;
