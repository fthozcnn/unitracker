-- ================================================
-- Global Chat Schema
-- Run this once in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Anonim',
    content      TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
DROP POLICY IF EXISTS "Anyone authenticated can read chat" ON chat_messages;
CREATE POLICY "Anyone authenticated can read chat" ON chat_messages
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can insert their own messages
DROP POLICY IF EXISTS "Users insert own messages" ON chat_messages;
CREATE POLICY "Users insert own messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast time-sorted fetches
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- Enable Realtime for the table (run in SQL editor)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
