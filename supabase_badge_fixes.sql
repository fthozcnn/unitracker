-- =========================================
-- Badge Fixes — Run in Supabase SQL Editor
-- =========================================

-- 1. Remove badges that require unimplemented features
DELETE FROM badges WHERE criteria_type IN (
    'set_goal',
    'syllabus_add',
    'weekend_warrior',
    'planned_study',
    'last_minute',
    'attendance_survival',
    'exam_week_streak'
);

-- 2. Add new achievable badges (only columns that exist in your schema)
-- If this still errors, run: \d badges  in psql to see columns, then tell me.

INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value)
VALUES
    ('50 Saat Kulübü',    'Toplamda 50 saat çalışmayı başardın.',         'Timer',    'orange',  'study_hours',    50),
    ('100 Saat Efsanesi', 'Toplamda 100 saat çalışmayı başardın.',        'Hourglass','red',     'study_hours',   100),
    ('Haftalık Kahraman', 'Bir haftada 10+ saat çalıştın.',               'Rocket',   'blue',    'weekly_marathon', 10),
    ('Pomodoro Ustası',   '25 pomodoro seansı (20-35 dk) tamamladın.',    'Coffee',   'red',     'pomodoro_count',  25),
    ('Odak Canavarı',     '10 uzun odak seansı (25+ dk) tamamladın.',     'Target',   'purple',  'focus_master',    10),
    ('100 Seans',         '100 çalışma seansı başlattın.',                'Activity', 'green',   'sessions_count', 100),
    ('Sosyal Kelebek',    '3 arkadaş edinin.',                            'Users',    'pink',    'friends_count',    3),
    ('Meydan Okuyucu',    'İlk yarışmaya katıldın.',                      'Swords',   'indigo',  'first_challenge',  1)
ON CONFLICT DO NOTHING;
