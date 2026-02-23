-- ================================================
-- Study Duel (Ders Savaşı) Schema
-- Run this once in Supabase SQL Editor
-- ================================================

-- Create the study_duels table
CREATE TABLE IF NOT EXISTS study_duels (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenger_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opponent_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'pending', -- pending | active | finished | declined
    duration_minutes  INTEGER NOT NULL DEFAULT 25,     -- Chosen duel duration
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    winner_id         UUID REFERENCES auth.users(id),
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE study_duels ENABLE ROW LEVEL SECURITY;

-- Users can read duels they participate in
DROP POLICY IF EXISTS "Users see own duels" ON study_duels;
CREATE POLICY "Users see own duels" ON study_duels
    FOR ALL USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_study_duels_challenger ON study_duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_study_duels_opponent   ON study_duels(opponent_id);
CREATE INDEX IF NOT EXISTS idx_study_duels_status     ON study_duels(status);

-- ================================================
-- RPC: Award XP to the duel winner
-- ================================================
CREATE OR REPLACE FUNCTION award_duel_xp(winner_user_id UUID, xp_amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET total_xp = total_xp + xp_amount
    WHERE id = winner_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
