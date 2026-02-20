-- 1. 'library_study' yerine 'Odak Ustası'
UPDATE badges 
SET name = 'Odak Ustası', 
    description = 'Toplam 10 kesintisiz Pomodoro (en az 25dk) tamamladın.', 
    icon = 'Brain', 
    color = 'emerald', 
    criteria_type = 'focus_master', 
    criteria_value = 10 
WHERE criteria_type = 'library_study';

-- 2. 'share_stats' yerine 'Tam Gaz'
UPDATE badges 
SET name = 'Tam Gaz', 
    description = 'Bir hafta içinde (7 gün) toplam 20 saat çalıştın!', 
    icon = 'Rocket', 
    color = 'blue', 
    criteria_type = 'weekly_marathon', 
    criteria_value = 20 
WHERE criteria_type = 'share_stats';

-- 3. 'diverse_study' için kriteri 5'ten 3'e düşür, ismi değiştir
UPDATE badges 
SET name = 'Çok Yönlü', 
    description = 'Aynı gün içinde 3 farklı derse çalıştın.', 
    criteria_value = 3 
WHERE criteria_type = 'diverse_study';

-- 4. 'weights_complete' yerine 'Not Avcısı' (Not girilmiş 3 ödev/sınav)
UPDATE badges 
SET name = 'Not Avcısı', 
    description = 'Sistemde en az 3 farklı sınav/ödev notu kaydettin.', 
    criteria_type = 'grades_logged', 
    criteria_value = 3 
WHERE criteria_type = 'weights_complete';

-- Yinelenen rozetleri temizleme (Eğer node script'i tam silemediyse garanti olsun diye)
DELETE FROM badges a USING badges b 
WHERE a.created_at > b.created_at 
AND a.criteria_type = b.criteria_type 
AND a.criteria_value = b.criteria_value;
