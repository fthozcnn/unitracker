-- =========================================
-- Badge Fixes — Run in Supabase SQL Editor
-- =========================================

-- 1. Remove badges that require unimplemented features
DELETE FROM badges WHERE criteria_type IN (
    'set_goal',          -- hedef sistemi yok
    'syllabus_add',      -- tetikleyici yok
    'weekend_warrior',   -- haftalık hedef sistemi yok
    'planned_study',     -- karmaşık sorgu
    'last_minute',       -- sınava yakın çalışma tespiti yok
    'attendance_survival', -- devamsızlık+not combo yok
    'exam_week_streak'   -- vize haftası tespiti yok
);

-- 2. Add new achievable badges

-- Zaman ve İstikrar
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value, xp_reward)
VALUES
    ('50 Saat Kulübü', 'Toplamda 50 saat çalışmayı başardın.', 'Timer', 'orange', 'study_hours', 50, 200),
    ('100 Saat Efsanesi', 'Toplamda 100 saat çalışmayı başardın.', 'Hourglass', 'red', 'study_hours', 100, 400),
    ('Haftalık Kahraman', 'Bir haftada 10+ saat çalıştın.', 'Rocket', 'blue', 'weekly_marathon', 10, 150)
ON CONFLICT DO NOTHING;

-- Çalışma Tarzı
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value, xp_reward)
VALUES
    ('Pomodoro Ustası', '25 pomodoro seansı tamamladın (20-35 dk).', 'Coffee', 'red', 'pomodoro_count', 25, 150),
    ('Odak Canavarı', '10 uzun odak seansı (25+ dk) tamamladın.', 'Target', 'purple', 'focus_master', 10, 150),
    ('100 Seans', '100 çalışma seansı başlattın.', 'Activity', 'green', 'sessions_count', 100, 300)
ON CONFLICT DO NOTHING;

-- Sosyal
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value, xp_reward)
VALUES
    ('Sosyal Kelebek', '3 arkadaş edinin.', 'Users', 'pink', 'friends_count', 3, 100),
    ('Meydan Okuyucu', 'İlk yarışmaya katıldın.', 'Swords', 'indigo', 'first_challenge', 1, 100)
ON CONFLICT DO NOTHING;
