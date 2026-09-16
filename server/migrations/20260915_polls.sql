-- ==================================================
-- NESTPLAY POLLS
-- 2026-09-15
--
-- Polls are native post content.
--
-- posts.title   = post title / poll question
-- posts.content = post body / optional poll context
-- ==================================================


-- --------------------------------------------------
-- POST CONTENT TYPE
-- --------------------------------------------------

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS content_type TEXT
NOT NULL
DEFAULT 'post';


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conname = 'posts_content_type_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_content_type_check
    CHECK (
      content_type IN (
        'post',
        'poll'
      )
    );
  END IF;
END
$$;


-- --------------------------------------------------
-- POLLS
--
-- post_id is both the poll identifier and its
-- one-to-one relationship with posts.
--
-- closes_at NULL = no automatic expiration
-- closed_at      = manually closed early
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS polls (
  post_id UUID PRIMARY KEY
    REFERENCES posts(id)
    ON DELETE CASCADE,

  closes_at TIMESTAMPTZ,

  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT polls_closes_after_creation_check
    CHECK (
      closes_at IS NULL
      OR closes_at > created_at
    ),

  CONSTRAINT polls_closed_after_creation_check
    CHECK (
      closed_at IS NULL
      OR closed_at >= created_at
    )
);


-- --------------------------------------------------
-- POLL OPTIONS
--
-- Positions 0-5 enforce the maximum of six choices.
-- The backend will enforce a minimum of two choices.
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),

  poll_id UUID NOT NULL
    REFERENCES polls(post_id)
    ON DELETE CASCADE,

  option_text TEXT NOT NULL,

  position SMALLINT NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT poll_options_text_check
    CHECK (
      LENGTH(
        BTRIM(option_text)
      ) BETWEEN 1 AND 200
    ),

  CONSTRAINT poll_options_position_check
    CHECK (
      position BETWEEN 0 AND 5
    ),

  CONSTRAINT poll_options_poll_position_key
    UNIQUE (
      poll_id,
      position
    ),

  CONSTRAINT poll_options_poll_id_id_key
    UNIQUE (
      poll_id,
      id
    )
);


-- Prevent choices such as:
--
-- "Minecraft"
-- " minecraft "
--
-- from being separate options in the same poll.

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_poll_options_unique_text
ON poll_options (
  poll_id,
  LOWER(
    BTRIM(option_text)
  )
);


-- --------------------------------------------------
-- POLL VOTES
--
-- PRIMARY KEY (poll_id, user_id)
-- guarantees one active choice per user per poll.
--
-- The composite FK guarantees option_id actually
-- belongs to the same poll.
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id UUID NOT NULL,

  option_id UUID NOT NULL,

  user_id UUID NOT NULL
    REFERENCES profiles(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT poll_votes_pkey
    PRIMARY KEY (
      poll_id,
      user_id
    ),

  CONSTRAINT poll_votes_option_fkey
    FOREIGN KEY (
      poll_id,
      option_id
    )
    REFERENCES poll_options(
      poll_id,
      id
    )
    ON DELETE CASCADE
);


-- Efficient result aggregation.

CREATE INDEX IF NOT EXISTS
  idx_poll_votes_poll_option
ON poll_votes (
  poll_id,
  option_id
);


-- Useful for future user activity / achievement queries.

CREATE INDEX IF NOT EXISTS
  idx_poll_votes_user
ON poll_votes (
  user_id
);


-- Useful if NestPlay later runs expiration/background jobs.

CREATE INDEX IF NOT EXISTS
  idx_polls_open_closes_at
ON polls (
  closes_at
)
WHERE
  closed_at IS NULL
  AND closes_at IS NOT NULL;
