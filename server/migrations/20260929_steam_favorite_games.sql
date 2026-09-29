CREATE TABLE user_steam_favorite_games (
  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  steam_app_id BIGINT NOT NULL,

  sort_order SMALLINT NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT user_steam_favorite_games_pkey
    PRIMARY KEY (
      user_id,
      steam_app_id
    ),

  CONSTRAINT user_steam_favorite_games_order_unique
    UNIQUE (
      user_id,
      sort_order
    ),

  CONSTRAINT user_steam_favorite_games_app_id_valid
    CHECK (
      steam_app_id > 0
    ),

  CONSTRAINT user_steam_favorite_games_sort_order_valid
    CHECK (
      sort_order BETWEEN 1 AND 6
    )
);

CREATE INDEX idx_user_steam_favorite_games_user_order
  ON user_steam_favorite_games (
    user_id,
    sort_order
  );