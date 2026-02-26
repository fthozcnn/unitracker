-- =========================================
-- Daily Quest Fix: completed_at trigger
-- Run this once in Supabase SQL Editor
-- =========================================

-- 1. Add completed_at column to assignments (if not exists)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Auto-set completed_at when is_completed becomes true
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        NEW.completed_at = now();
    END IF;
    IF NEW.is_completed = false THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_completed_at ON assignments;
CREATE TRIGGER trigger_set_completed_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION set_completed_at();
