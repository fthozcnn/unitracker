-- ================================================================
-- UNIMARMARA - SUPABASE STORAGE GÜVENLİK VE İZOLASYON POLİTİKALARI
-- ================================================================

-- 1. AVATARS VE USER ATTACHMENTS İÇİN İZOLE STORAGE KOVALARI (BUCKETS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('course_attachments', 'course_attachments', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. STORAGE RLS POLİTİKALARI

-- A. AVATAR KOVASI:
-- Herkes okuyabilir (CDN üzerinden kamuya açık)
CREATE POLICY "Public Avatar Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Yalnızca oturum açmış kullanıcı kendi klasörüne (user_id/...) dosya yükleyebilir
CREATE POLICY "Users can upload own avatar only"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Yalnızca kendi avatarını güncelleyebilir veya silebilir
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
