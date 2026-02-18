-- Course Grades & GPA Tracking
-- Run this in Supabase SQL Editor

-- Course Grades table
CREATE TABLE IF NOT EXISTS course_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses ON DELETE CASCADE NOT NULL,
  exam_type TEXT NOT NULL, -- 'vize', 'final', 'odev', 'quiz', 'proje'
  grade NUMERIC(5,2),
  weight NUMERIC(5,2) DEFAULT 0, -- percentage weight (e.g. 30 for 30%)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id, exam_type)
);

-- Enable RLS
ALTER TABLE course_grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own grades" ON course_grades;
DROP POLICY IF EXISTS "Users can insert own grades" ON course_grades;
DROP POLICY IF EXISTS "Users can update own grades" ON course_grades;
DROP POLICY IF EXISTS "Users can delete own grades" ON course_grades;

CREATE POLICY "Users can view own grades" ON course_grades FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own grades" ON course_grades FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grades" ON course_grades FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grades" ON course_grades FOR DELETE
  USING (auth.uid() = user_id);

-- Add XP and Level columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Add absent_count to courses (if not already present)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS absent_count INTEGER DEFAULT 0;

-- User Presence table for live study rooms
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT DEFAULT 'idle', -- 'idle', 'studying', 'pomodoro', 'break'
  current_course TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view presence" ON user_presence;
DROP POLICY IF EXISTS "Users can update own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can modify own presence" ON user_presence;

CREATE POLICY "Anyone can view presence" ON user_presence FOR SELECT USING (true);
CREATE POLICY "Users can update own presence" ON user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can modify own presence" ON user_presence FOR UPDATE
  USING (auth.uid() = user_id);

-- Upsert function for presence
CREATE OR REPLACE FUNCTION update_user_presence(
  p_status TEXT,
  p_course TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, current_course, started_at, updated_at)
  VALUES (auth.uid(), p_status, p_course, NOW(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = p_status,
    current_course = p_course,
    started_at = CASE WHEN p_status != user_presence.status THEN NOW() ELSE user_presence.started_at END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for presence (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
