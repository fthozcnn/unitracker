-- Attendance Tracking: Add absent_count column
-- Run this in Supabase SQL Editor

ALTER TABLE courses ADD COLUMN IF NOT EXISTS absent_count INTEGER DEFAULT 0;
