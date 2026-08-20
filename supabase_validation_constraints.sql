-- ================================================================
-- UNIMARMARA - VERİTABANI SUNUCU TARAFI KISITLAMALARI (CHECK CONSTRAINTS)
-- ================================================================

-- 1. COURSES KISITLAMALARI
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_credit_check;
ALTER TABLE courses ADD CONSTRAINT courses_credit_check 
  CHECK (credit >= 0 AND credit <= 30);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_attendance_limit_check;
ALTER TABLE courses ADD CONSTRAINT courses_attendance_limit_check 
  CHECK (attendance_limit >= 0 AND attendance_limit <= 100);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_absent_count_check;
ALTER TABLE courses ADD CONSTRAINT courses_absent_count_check 
  CHECK (absent_count >= 0 AND absent_count <= 200);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_name_length_check;
ALTER TABLE courses ADD CONSTRAINT courses_name_length_check 
  CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

-- 2. STUDY SESSIONS KISITLAMALARI
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_duration_check;
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_duration_check 
  CHECK (duration >= 1 AND duration <= 86400);

-- 3. ASSIGNMENTS KISITLAMALARI
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_title_length_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_title_length_check 
  CHECK (char_length(title) >= 1 AND char_length(title) <= 120);

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_grade_range_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_grade_range_check 
  CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100));

-- 4. COURSE GRADES KISITLAMALARI
ALTER TABLE course_grades DROP CONSTRAINT IF EXISTS course_grades_grade_check;
ALTER TABLE course_grades ADD CONSTRAINT course_grades_grade_check 
  CHECK (grade >= 0 AND grade <= 100);

ALTER TABLE course_grades DROP CONSTRAINT IF EXISTS course_grades_weight_check;
ALTER TABLE course_grades ADD CONSTRAINT course_grades_weight_check 
  CHECK (weight >= 0 AND weight <= 100);

-- 5. CHALLENGES KISITLAMALARI
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_target_hours_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_target_hours_check 
  CHECK (target_hours >= 1 AND target_hours <= 500);

ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_date_order_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_date_order_check 
  CHECK (end_date >= start_date);

-- 6. PROFILES TABLOSUNDA XP VE SEVİYE MANİPÜLASYONU KORUMASI
-- Kullanıcıların doğrudan .update({ total_xp: 99999, level: 99 }) yapmasını engelleyen trigger:
CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer istek doğrudan bir istemci oturumundan geliyorsa (auth.uid() mevcutsa ve security definer değilse)
  -- total_xp ve level alanlarının istemciden güncellenmesini engelle (eski değerleri koru)
  IF current_user != 'postgres' AND (OLD.total_xp IS DISTINCT FROM NEW.total_xp OR OLD.level IS DISTINCT FROM NEW.level) THEN
    -- Sadece admin/RPC (add_user_xp, award_duel_xp) fonksiyonları XP değiştirebilir
    IF pg_trigger_depth() = 1 THEN
      NEW.total_xp := OLD.total_xp;
      NEW.level := OLD.level;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_sensitive_fields();
