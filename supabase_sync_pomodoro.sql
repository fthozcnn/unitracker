-- Synchronized Pomodoro Sessions
-- Run this in Supabase SQL Editor

-- Sync Pomodoro sessions table
CREATE TABLE IF NOT EXISTS sync_pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting', -- 'waiting', 'active', 'paused', 'completed'
  work_time INTEGER DEFAULT 25, -- minutes
  break_time INTEGER DEFAULT 5, -- minutes
  current_phase TEXT DEFAULT 'work', -- 'work', 'break'
  phase_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants table
CREATE TABLE IF NOT EXISTS sync_pomodoro_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sync_pomodoro_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE sync_pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_pomodoro_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DROP POLICY IF EXISTS "Anyone can view sessions" ON sync_pomodoro_sessions;
DROP POLICY IF EXISTS "Host can create sessions" ON sync_pomodoro_sessions;
DROP POLICY IF EXISTS "Host can update sessions" ON sync_pomodoro_sessions;
DROP POLICY IF EXISTS "Host can delete sessions" ON sync_pomodoro_sessions;

CREATE POLICY "Anyone can view sessions" ON sync_pomodoro_sessions FOR SELECT USING (true);
CREATE POLICY "Host can create sessions" ON sync_pomodoro_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update sessions" ON sync_pomodoro_sessions FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Host can delete sessions" ON sync_pomodoro_sessions FOR DELETE USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Anyone can view participants" ON sync_pomodoro_participants;
DROP POLICY IF EXISTS "Users can join" ON sync_pomodoro_participants;
DROP POLICY IF EXISTS "Users can leave" ON sync_pomodoro_participants;

CREATE POLICY "Anyone can view participants" ON sync_pomodoro_participants FOR SELECT USING (true);
CREATE POLICY "Users can join" ON sync_pomodoro_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave" ON sync_pomodoro_participants FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_pomodoro_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_pomodoro_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
