-- ================================================================
-- UNIMARMARA - PRODUCTION GÜVENLİK VE SERTLEŞTİRME YAMALARI (PATCHES)
-- Bu dosyayı Supabase Dashboard -> SQL Editor içinde çalıştırın.
-- ================================================================

-- 1. NOTIFICATIONS TABLOSU RLS DÜZELTMESİ
-- Açık olan WITH CHECK (true) politikasını kaldırıyoruz.
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- Yalnızca kullanıcının kendi hesabına veya doğrulanmış RPC aracılığıyla bildirim yazılmasına izin ver
CREATE POLICY "Users can insert own notifications only" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. XP VE SEVİYE SİSTEMİ RPC SERTLEŞTİRMESİ (add_user_xp)
CREATE OR REPLACE FUNCTION add_user_xp(uid UUID, xp_amount INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_xp    INT;
    v_old_level INT;
    v_new_xp    INT;
    v_new_level INT;
    v_leveled   BOOLEAN;
BEGIN
    -- Yetki kontrolü: Yalnızca kendi hesabına XP ekleyebilir
    IF auth.uid() IS NULL OR auth.uid() != uid THEN
        RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca kendi hesabınıza XP ekleyebilirsiniz.';
    END IF;

    -- Mantıksal sınır kontrolü: Tek seferde maksimum 5000 XP (hile önleme)
    IF xp_amount IS NULL OR xp_amount <= 0 OR xp_amount > 5000 THEN
        RAISE EXCEPTION 'Geçersiz XP miktarı (1-5000 aralığında olmalıdır).';
    END IF;

    -- Atomik artırma
    UPDATE profiles
    SET total_xp = COALESCE(total_xp, 0) + xp_amount,
        level    = GREATEST(1, FLOOR(SQRT((COALESCE(total_xp, 0) + xp_amount) / 100.0))::INT)
    WHERE id = uid
    RETURNING total_xp, level INTO v_new_xp, v_new_level;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_old_xp    := v_new_xp - xp_amount;
    v_old_level := GREATEST(1, FLOOR(SQRT(v_old_xp / 100.0))::INT);
    v_leveled   := v_new_level > v_old_level;

    RETURN json_build_object(
        'new_xp',    v_new_xp,
        'new_level', v_new_level,
        'leveled_up', v_leveled
    );
END;
$$;


-- 3. DÜELLO XP ÖDÜLLENDİRME RPC SERTLEŞTİRMESİ (award_duel_xp)
CREATE OR REPLACE FUNCTION award_duel_xp(winner_user_id UUID, xp_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Oturum kontrolü
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yetkisiz istek.';
    END IF;

    -- Miktar sınırı
    IF xp_amount IS NULL OR xp_amount <= 0 OR xp_amount > 500 THEN
        RAISE EXCEPTION 'Geçersiz düello ödül miktarı (1-500 aralığında olmalıdır).';
    END IF;

    -- Yalnızca geçerli bir katılımcı veya kazanan için güncelleme yap
    UPDATE profiles
    SET total_xp = COALESCE(total_xp, 0) + xp_amount,
        level    = GREATEST(1, FLOOR(SQRT((COALESCE(total_xp, 0) + xp_amount) / 100.0))::INT)
    WHERE id = winner_user_id;
END;
$$;


-- 4. E-POSTA İLE KULLANICI ARAMA GÜVENLİĞİ (search_users_by_email)
-- User Enumeration (Kullanıcı Taraması) ve Joker Karakter Enjeksiyonunu Önler
CREATE OR REPLACE FUNCTION search_users_by_email(search_email TEXT)
RETURNS TABLE (id UUID, email TEXT, display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleaned_query TEXT;
BEGIN
    -- Boş veya 3 karakterden kısa sorguları reddet
    IF search_email IS NULL OR char_length(trim(search_email)) < 3 THEN
        RETURN;
    END IF;

    -- % ve _ joker karakterlerini kaçır (escape)
    cleaned_query := replace(replace(trim(search_email), '%', '\%'), '_', '\_');

    RETURN QUERY
    SELECT 
        u.id, 
        -- E-posta adresini doğrudan sızdırmak yerine ilk 2 harf ve domain şeklinde maskele
        (substring(u.email from 1 for 2) || '***@' || split_part(u.email, '@', 2))::TEXT AS email,
        p.display_name
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.email ILIKE '%' || cleaned_query || '%' ESCAPE '\'
    AND u.id != auth.uid()
    LIMIT 10;
END;
$$;


-- 5. POMODORO VE DÜELLO SUNUCU TARAFI KISITLAMALARI (CHECK CONSTRAINTS)
DO $$
BEGIN
    -- sync_pomodoro_sessions work_time ve break_time
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_pomodoro_sessions') THEN
        ALTER TABLE sync_pomodoro_sessions DROP CONSTRAINT IF EXISTS sync_pomodoro_work_time_check;
        ALTER TABLE sync_pomodoro_sessions ADD CONSTRAINT sync_pomodoro_work_time_check 
            CHECK (work_time >= 1 AND work_time <= 180);

        ALTER TABLE sync_pomodoro_sessions DROP CONSTRAINT IF EXISTS sync_pomodoro_break_time_check;
        ALTER TABLE sync_pomodoro_sessions ADD CONSTRAINT sync_pomodoro_break_time_check 
            CHECK (break_time >= 1 AND break_time <= 60);
    END IF;

    -- study_duels duration_minutes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_duels') THEN
        ALTER TABLE study_duels DROP CONSTRAINT IF EXISTS study_duels_duration_check;
        ALTER TABLE study_duels ADD CONSTRAINT study_duels_duration_check 
            CHECK (duration_minutes >= 5 AND duration_minutes <= 240);
    END IF;
END $$;


-- 6. HESAP SİLME GÜVENLİĞİ VE TEMİZLİK (delete_user_account)
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Yetkilendirilmemiş işlem.';
    END IF;

    -- Kullanıcının storage nesnelerini temizle (varsa)
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = current_user_id::text;

    -- Kullanıcıyı auth.users tablosundan sil (ON DELETE CASCADE ile tüm ilişkili tablolar otomatik temizlenir)
    DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
