-- Study Duel v2: Endurance Mode
-- Run this in Supabase SQL Editor

-- Add loser_stopped_at to track when the loser gave up
ALTER TABLE study_duels
    ADD COLUMN IF NOT EXISTS loser_stopped_at TIMESTAMPTZ;

-- Remove duration_minutes NOT NULL constraint if it exists (it's no longer required)
-- (safe to ignore if it doesn't exist or has no constraint)
ALTER TABLE study_duels ALTER COLUMN duration_minutes SET DEFAULT 0;
