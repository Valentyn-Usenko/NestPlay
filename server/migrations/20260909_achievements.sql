BEGIN;

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (
    rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
  ),
  icon TEXT NOT NULL DEFAULT '◆',
  requirement_type TEXT,
  requirement_value BIGINT,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  manual_only BOOLEAN NOT NULL DEFAULT FALSE,
  auto_evaluable BOOLEAN NOT NULL DEFAULT FALSE,
  game_id TEXT,
  hub_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_definitions_category
  ON achievement_definitions(category);

CREATE INDEX IF NOT EXISTS idx_achievement_definitions_game_id
  ON achievement_definitions(game_id)
  WHERE game_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id BIGINT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked
  ON user_achievements(user_id, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS achievement_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id BIGINT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  current_value BIGINT NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  target_value BIGINT CHECK (target_value IS NULL OR target_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS featured_achievements (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id BIGINT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id),
  UNIQUE (user_id, display_order)
);

CREATE TABLE IF NOT EXISTS user_achievement_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_posts BIGINT NOT NULL DEFAULT 0 CHECK (total_posts >= 0),
  accepted_friend_count BIGINT NOT NULL DEFAULT 0 CHECK (accepted_friend_count >= 0),
  joined_hub_count BIGINT NOT NULL DEFAULT 0 CHECK (joined_hub_count >= 0),
  total_upvotes_received BIGINT NOT NULL DEFAULT 0 CHECK (total_upvotes_received >= 0),
  total_comments BIGINT NOT NULL DEFAULT 0 CHECK (total_comments >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lifetime record of distinct Game Hubs the user has joined. This lets Hub Explorer
-- stay correct even if a user later leaves a community.
CREATE TABLE IF NOT EXISTS achievement_hub_history (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  game_name TEXT,
  game_art_url TEXT,
  first_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_hub_history_user
  ON achievement_hub_history(user_id);

-- post_id is stored as text intentionally so this migration does not assume whether
-- the existing posts.id column is UUID, integer, or another type.
CREATE TABLE IF NOT EXISTS post_achievement_stats (
  post_id TEXT PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reply_count BIGINT NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_achievement_stats_owner
  ON post_achievement_stats(owner_user_id, reply_count DESC);

CREATE TABLE IF NOT EXISTS achievement_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id BIGINT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievement_notifications_pending
  ON achievement_notifications(user_id, created_at)
  WHERE delivered_at IS NULL;

COMMIT;
