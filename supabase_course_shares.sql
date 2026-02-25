-- ================================================
-- Course Shares Schema
-- Run this once in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS course_shares (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_name  TEXT NOT NULL,
    course_code  TEXT,
    course_color TEXT DEFAULT '#6366f1',
    course_credit INT DEFAULT 3,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT course_shares_status_check CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- Row Level Security
ALTER TABLE course_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own course shares"
    ON course_shares FOR ALL
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert course shares they send"
    ON course_shares FOR INSERT
    WITH CHECK (sender_id = auth.uid());
