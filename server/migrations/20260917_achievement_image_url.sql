BEGIN;

ALTER TABLE achievement_definitions
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMIT;
