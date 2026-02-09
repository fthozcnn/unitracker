-- Social & Competition Features - COMPLETE & FINAL SCHEMA
-- This script merges with existing profiles table and sets up all features.

-- 1. Update Profiles Table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 2. Friendships Table
DROP TABLE IF EXISTS friendships CASCADE;
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 3. Challenges Table
DROP TABLE IF EXISTS challenges CASCADE;
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_hours INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Challenge Participants Table
DROP TABLE IF EXISTS challenge_participants CASCADE;
CREATE TABLE challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- 5. Notifications Table
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for Friendships
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendships" ON friendships FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update received friend requests" ON friendships FOR UPDATE 
  USING (auth.uid() = friend_id);

-- RLS Policies for Challenges
CREATE POLICY "Users can view public challenges and own challenges" ON challenges FOR SELECT 
  USING (is_public = true OR creator_id = auth.uid());
CREATE POLICY "Users can create challenges" ON challenges FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update own challenges" ON challenges FOR UPDATE 
  USING (auth.uid() = creator_id);


-- RLS Policies for Challenge Participants (FIXED - no recursion)
CREATE POLICY "Users can view their own participations" ON challenge_participants FOR SELECT 
  USING (user_id = auth.uid());
CREATE POLICY "Users can join challenges" ON challenge_participants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger for Friend Request Notifications
CREATE OR REPLACE FUNCTION handle_friend_request_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.friend_id, 'friend_request', 'Yeni Arkadaşlık İsteği', 'Sizi arkadaş olarak eklemek istiyor.', '/social');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'friend_request_accepted', 'İstek Kabul Edildi', 'Arkadaşlık isteğiniz kabul edildi!', '/social');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friend_request
  AFTER INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION handle_friend_request_notification();

-- Function to search users by email
CREATE OR REPLACE FUNCTION search_users_by_email(search_email TEXT)
RETURNS TABLE (id UUID, email TEXT, display_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::TEXT, p.display_name
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE u.email ILIKE '%' || search_email || '%'
  AND u.id != auth.uid()
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard (Includes current user + friends)
CREATE OR REPLACE FUNCTION get_leaderboard(timeframe TEXT DEFAULT 'weekly')
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  total_minutes INTEGER,
  rank BIGINT
) AS $$
DECLARE
  start_date TIMESTAMP;
BEGIN
  IF timeframe = 'weekly' THEN
    start_date := NOW() - INTERVAL '7 days';
  ELSE
    start_date := NOW() - INTERVAL '30 days';
  END IF;

  RETURN QUERY
  WITH relevant_users AS (
    SELECT f.friend_id as u_id FROM friendships f WHERE f.user_id = auth.uid() AND f.status = 'accepted'
    UNION
    SELECT f.user_id as u_id FROM friendships f WHERE f.friend_id = auth.uid() AND f.status = 'accepted'
    UNION
    SELECT auth.uid() as u_id
  )
  SELECT 
    ru.u_id as user_id,
    COALESCE(p.display_name, 'İsimsiz Kullanıcı') as display_name,
    COALESCE(SUM(ss.duration / 60), 0)::INTEGER as total_minutes,
    RANK() OVER (ORDER BY COALESCE(SUM(ss.duration), 0) DESC) as rank
  FROM relevant_users ru
  LEFT JOIN profiles p ON ru.u_id = p.id
  LEFT JOIN study_sessions ss ON ss.user_id = ru.u_id AND ss.start_time >= start_date
  GROUP BY ru.u_id, p.display_name
  ORDER BY total_minutes DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unified Trigger to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Badges Table
DROP TABLE IF EXISTS badges CASCADE;
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- Lucide icon name
  color TEXT DEFAULT 'amber',
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. User Badges Junction Table
DROP TABLE IF EXISTS user_badges CASCADE;
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Users can view own earned badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);

-- Seed Initial Badges
-- Seed 30 Achievement Badges
TRUNCATE TABLE badges CASCADE;
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value) VALUES
-- 1. Onboarding
('Kampüse Giriş', 'İlk dersini başarıyla oluşturdun!', 'GraduationCap', 'blue', 'first_course', 1),
('Hesap Kitap İşleri', 'İlk kez Not Hesaplama aracını kullandın.', 'Calculator', 'indigo', 'gpa_calc', 1),
('Yoklama Alındı', 'İlk kez bir ders için devamsızlık durumu güncelledin.', 'UserCheck', 'emerald', 'absenteeism_update', 1),
('Syllabus Kaşifi', 'Bir dersin konu başlıklarını (müfredatını) ekledin.', 'BookOpen', 'cyan', 'syllabus_add', 1),
('Hedef Belirlendi', 'Kendine ilk çalışma hedefini koydun.', 'Target', 'red', 'set_goal', 1),
('Profil Tamam', 'Profil bilgilerini eksiksiz doldurdun.', 'User', 'teal', 'profile_complete', 1),

-- 2. Zaman ve İstikrar (Streak & Duration)
('Isınma Turu', '3 gün üst üste çalışma kaydettin.', 'Flame', 'orange', 'streak', 3),
('Zinciri Kırma', '7 gün üst üste çalışma kaydettin.', 'Zap', 'amber', 'streak', 7),
('İstikrar Abidesi', '30 gün boyunca her gün en az 1 oturum tamamladın.', 'Trophy', 'yellow', 'streak', 30),
('Maraton Koşucusu', 'Tek seferde 3 saat ve üzeri çalışma kaydettin.', 'Timer', 'purple', 'marathon', 3),
('Yüzler Kulübü', 'Toplamda 100 saat çalışma süresine ulaştın.', 'Award', 'blue', 'study_hours', 100),
('Hafta Sonu Savaşçısı', 'Hafta sonu hedeflenen çalışma süresini tamamladın.', 'Shield', 'rose', 'weekend_warrior', 1),

-- 3. Çalışma Tarzı (Habits)
('Erkenci Kuş', 'Sabah 05:00 - 08:00 saatleri arasında çalışma başlattın.', 'Sunrise', 'orange', 'early_bird', 1),
('Gece Bekçisi', 'Gece 00:00 - 04:00 saatleri arasında çalışma tamamladın.', 'Moon', 'indigo', 'night_owl', 1),
('Pomodoro Ustası', 'Toplam 50 Pomodoro döngüsü tamamladın.', 'Clock', 'red', 'pomodoro_count', 50),
('Son Dakikacı', 'Sınav tarihine 24 saatten az kala 5 saat çalıştın.', 'AlertTriangle', 'yellow', 'last_minute', 5),
('Planlı Öğrenci', 'Sınavdan en az 2 hafta önce o ders için çalışmaya başladın.', 'Calendar', 'emerald', 'planned_study', 1),
('Tam Odak', 'Bir oturumu hiç duraklatmadan bitirdin.', 'Eye', 'blue', 'uninterrupted', 1),

-- 4. Akademik Başarı ve Kurtuluş (Grades & Survival)
('Çan Eğrisi Bükücü', 'Bir dersten AA veya BA harf notu aldın.', 'TrendingUp', 'emerald', 'high_grade', 1),
('Büte Kalmadım', 'Dönem sonu tüm dersleri başarıyla geçtin.', 'CheckCircle', 'green', 'no_fail', 1),
('Kıl Payı', 'Bir dersi tam geçme sınırında (DD veya 50) geçtin.', 'ZapOff', 'orange', 'barely_pass', 1),
('Vize Gazisi', 'Vize haftası boyunca her gün çalıştın.', 'Activity', 'red', 'exam_week_streak', 7),
('Final Haftası Survivor''ı', 'Final haftasında toplam 40 saat çalışma barajını aştın.', 'LifeBuoy', 'blue', 'final_marathon', 40),
('Devamsızlık Sınırında', 'Devamsızlık sınırındayken dersi geçmeyi başardın.', 'AlertCircle', 'rose', 'attendance_survival', 1),

-- 5. Sosyal ve Özel (Extra & Fun)
('Paylaşımcı', 'Çalışma istatistiğini bir platformda paylaştın.', 'Share2', 'blue', 'share_stats', 1),
('Kütüphane Müdavimi', 'Kütüphanede çalışma oturumu gerçekleştirdin.', 'Library', 'amber', 'library_study', 1),
('Geri Dönüş', 'Uygulamayı 1 hafta sonra tekrar kullandın.', 'RefreshCw', 'cyan', 'return_user', 1),
('Ders Kurdu', 'Bir gün içinde 5 farklı ders için çalışma kaydettin.', 'Book', 'purple', 'diverse_study', 5),
('Not Avcısı', 'Tüm derslerin not ağırlıklarını eksiksiz girdin.', 'FileText', 'indigo', 'weights_complete', 1),
('Efsanevi Dönem', 'Dönem ortalamasını (GPA) 3.50 ve üzerine çıkardın.', 'Star', 'yellow', 'gpa_legend', 3.5);

-- 8. Weekly Schedule Table
DROP TABLE IF EXISTS weekly_schedule CASCADE;
CREATE TABLE weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0: Sunday, 1: Monday...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE weekly_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own schedule" ON weekly_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own schedule" ON weekly_schedule FOR ALL USING (auth.uid() = user_id);
