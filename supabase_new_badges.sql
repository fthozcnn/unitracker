-- Yeni rozetleri ekle (mevcut rozetleri silmeden)
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- Sosyal Rozetler
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value) VALUES
('Sosyal Kelebek', '10 arkadaş edindin! Popülersin.', 'Users', 'pink', 'friends_count', 10),
('Challenge Kralı', '5 farklı challenge''a katıldın.', 'Crown', 'orange', 'first_challenge', 5),
('İlk Adım', 'İlk çalışma oturumunu tamamladın!', 'Footprints', 'green', 'first_session', 1)
ON CONFLICT DO NOTHING;

-- Zaten var olan rozetlere yeni seviyeler
INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value) VALUES
('Beş Yüzler Kulübü', 'Toplamda 500 saat çalışma süresine ulaştın!', 'Crown', 'amber', 'study_hours', 500),
('Yıldırım Seri', '100 gün üst üste çalışma kaydettin!', 'Zap', 'red', 'streak', 100)
ON CONFLICT DO NOTHING;
