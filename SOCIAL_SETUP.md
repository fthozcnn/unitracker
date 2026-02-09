# Sosyal Özellikler Kurulum Rehberi

## Adım 1: Supabase Dashboard'a Giriş

1. [https://app.supabase.com](https://app.supabase.com) adresine gidin
2. Projenizi seçin
3. Sol menüden **SQL Editor** seçeneğine tıklayın

## Adım 2: Database Schema'yı Yükleyin

1. **New Query** butonuna tıklayın
2. `supabase_social_schema.sql` dosyasının içeriğini kopyalayın
3. SQL Editor'e yapıştırın
4. Sağ üstteki **Run** (Çalıştır) butonuna tıklayın

### Beklenen Sonuç
Aşağıdaki tablolar oluşturulacak:
- ✅ `profiles` - Kullanıcı profilleri
- ✅ `friendships` - Arkadaşlık ilişkileri
- ✅ `challenges` - Challenge'lar
- ✅ `challenge_participants` - Challenge katılımcıları
- ✅ `notifications` - Bildirimler

## Adım 3: Realtime'ı Etkinleştirin (Opsiyonel)

Gerçek zamanlı güncellemeler için:

1. Sol menüden **Database** > **Replication** seçeneğine gidin
2. Aşağıdaki tabloları bulun ve **Enable** (Etkinleştir) yapın:
   - `profiles`
   - `friendships`
   - `challenges`
   - `challenge_participants`
   - `notifications`

## Adım 4: Uygulamayı Test Edin

1. Uygulamanızı çalıştırın: `npm run dev`
2. Sol sidebar'dan **Sosyal** seçeneğine tıklayın
3. E-posta ile arkadaş arama özelliğini test edin
4. **Challenge'lar** sayfasını açın ve yeni bir challenge oluşturun

## Sorun Giderme

### Hata: "relation does not exist"
- SQL script'in tamamen çalıştırıldığından emin olun
- Supabase Dashboard > Database > Tables bölümünden tabloların oluştuğunu kontrol edin

### Hata: "permission denied"
- RLS (Row Level Security) politikalarının doğru kurulduğundan emin olun
- SQL Editor'de tüm script'i tekrar çalıştırın

### Arkadaş arama çalışmıyor
- `search_users_by_email` fonksiyonunun oluştuğunu kontrol edin
- SQL Editor > Functions bölümünde görebilirsiniz

## İpuçları

- **İki hesapla test edin**: Sosyal özellikleri test etmek için farklı e-postalarla iki hesap oluşturun
- **Liderboard için veri**: Liderlik tablosunun görünmesi için önceden çalışma kayıtları ve arkadaş ilişkileri gerekir
- **Challenge ilerleme**: Challenge'lar sadece belirtilen tarih aralığındaki çalışma seanslarını sayar

## Sonraki Adımlar

✅ Temel sosyal özellikler hazır!

İsteğe bağlı iyileştirmeler:
- [ ] Bildirim sistemi UI (push notifications)
- [ ] Challenge davet sistemi (arkadaşları challenge'a davet et)
- [ ] Profil sayfası düzenleyici
- [ ] Avatar yükleme
