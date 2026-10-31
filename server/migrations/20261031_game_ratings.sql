-- NestPlay Community Rating
-- One 1-5 star rating per user per provider-qualified game ID.

BEGIN;

CREATE TABLE IF NOT EXISTS public.game_ratings (
    user_id uuid NOT NULL,
    game_id text NOT NULL,
    rating smallint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT game_ratings_pkey
        PRIMARY KEY (user_id, game_id),

    CONSTRAINT game_ratings_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT game_ratings_rating_valid
        CHECK (rating >= 1 AND rating <= 5),

    CONSTRAINT game_ratings_game_id_not_blank
        CHECK (btrim(game_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_game_ratings_game_id
    ON public.game_ratings (game_id);

COMMIT;
