-- İlerleme sıfırlama fonksiyonu
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

CREATE OR REPLACE FUNCTION reset_user_progress()
RETURNS void AS $$
BEGIN
    -- Rozetleri sil
    DELETE FROM user_badges WHERE user_id = auth.uid();
    
    -- Çalışma oturumlarını sil
    DELETE FROM study_sessions WHERE user_id = auth.uid();
    
    -- Ders notlarını sil
    DELETE FROM course_grades WHERE user_id = auth.uid();
    
    -- Görevleri sil
    DELETE FROM assignments WHERE user_id = auth.uid();
    
    -- XP ve seviye sıfırla
    UPDATE profiles SET total_xp = 0, level = 1 WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
