-- Fix: Add 'review' to the allowed types in assignments table
-- Run this in Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_type_check;

-- Add updated constraint with 'review' included
ALTER TABLE assignments
    ADD CONSTRAINT assignments_type_check
    CHECK (type IN ('exam', 'homework', 'project', 'quiz', 'review', 'other'));
