BEGIN;

ALTER TABLE posts
  ALTER COLUMN game_id TYPE text
  USING game_id::text;

UPDATE posts
SET game_id = 'rawg:' || game_id
WHERE
  game_id IS NOT NULL
  AND game_id ~ '^[0-9]+$';

UPDATE game_hub_members
SET game_id = 'rawg:' || game_id
WHERE
  game_id ~ '^[0-9]+$';

UPDATE achievement_hub_history
SET game_id = 'rawg:' || game_id
WHERE
  game_id ~ '^[0-9]+$';

COMMIT;
