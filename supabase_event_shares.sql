-- ================================================
-- Event Shares Schema
-- Run this once in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS event_shares (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'other',
    due_date     TIMESTAMPTZ NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT event_shares_status_check CHECK (status IN ('pending', 'accepted', 'declined')),
    CONSTRAINT event_shares_type_check   CHECK (type IN ('exam', 'homework', 'project', 'quiz', 'review', 'other'))
);

-- Row Level Security
ALTER TABLE event_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own shares"
    ON event_shares FOR ALL
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert shares they send"
    ON event_shares FOR INSERT
    WITH CHECK (sender_id = auth.uid());
