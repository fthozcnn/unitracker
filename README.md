# 🎓 UniTracker - Akıllı Üniversite Asistanı

UniTracker, üniversite öğrencilerinin akademik hayatını organize etmesi, çalışma motivasyonunu artırması ve sosyal etkileşim kurması için geliştirilmiş kapsamlı bir PWA (Progressive Web App) uygulamasıdır.

![UniTracker Banner](public/logo.png)

## 🚀 Öne Çıkan Özellikler

### 📚 Akademik Yönetim
- **Ders Programı:** Haftalık ders çizelgesi oluşturma, CSV ile toplu yükleme ve JSON olarak paylaşma.
- **Not Takibi:** Vize/Final notlarını girme, ağırlıklı ortalama ve GPA simülasyonu.
- **Devamsızlık Takibi:** Her ders için devamsızlık sınırlarını belirleme ve takip etme.
- **Takvim:** Sınav, ödev ve proje tarihlerini aylık görünümde takip etme ve JSON olarak indirme.

### 🍅 Çalışma Odası & Odaklanma
- **Pomodoro Sayacı:** Özelleştirilebilir çalışma/mola süreleri.
- **Ambient Sesler:** Lo-fi, yağmur, doğa ve kafe sesleri ile odaklanma modu.
- **Birlikte Çalış (Sync):** Arkadaşlarınla senkronize kronometre başlatma.

### 🎮 Oyunlaştırma (Gamification)
- **XP & Seviye Sistemi:** Çalıştıkça XP kazan, seviye atla.
- **Rozetler:** 30+ farklı başarı rozeti (örn: "Sabah Kuşu", "Haftasonu Savaşçısı").
- **Liderlik Tablosu:** Arkadaşlarınla haftalık çalışma sürelerini kıyasla.

### 👥 Sosyal Özellikler
- **Arkadaş Sistemi:** Arkadaş ekle, ne çalıştıklarını canlı gör.
- **Mücadeleler (Challenges):** "Bu hafta 10 saat çalışalım" gibi hedefler koy ve yarış.
- **Etkileşim:** Çalışan arkadaşını "dürt" veya "tezahürat" gönder.

### 🛠️ Araçlar & Ayarlar
- **Veri Yedekleme:** Tüm verileri JSON olarak içe/dışa aktar (Cihazlar arası taşıma).
- **Onboarding:** Yeni kullanıcılar için adım adım rehber.
- **Karanlık Mod:** Göz yormayan modern arayüz.
- **PWA Desteği:** Mobil cihazlara uygulama olarak yüklenebilir.

## 📦 Kurulum

1. **Repoyu klonlayın:**
   ```bash
   git clone https://github.com/fthozcnn/unitracker.git
   cd unitracker
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenler:**
   `.env.local` dosyasını oluşturun ve Supabase bilgilerinizi girin:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Uygulamayı başlatın:**
   ```bash
   npm run dev
   ```

## 🗄️ Veritabanı Kurulumu (Supabase)

Projenin tam fonksiyonlu çalışması için aşağıdaki SQL dosyalarını Supabase SQL Editor'de çalıştırın:

- `supabase_schema.sql` (Temel tablolar)
- `supabase_social_schema.sql` (Sosyal özellikler ve rozetler)
- `supabase_social_reactions.sql` (Tepki sistemi)
- `supabase_reset_progress.sql` (İlerleme sıfırlama fonksiyonu)

## 📱 Teknolojiler

- **Frontend:** React, TypeScript, Vite
- **Stil:** Tailwind CSS, Headless UI
- **State Yönetimi:** TanStack Query (React Query)
- **Backend:** Supabase (Auth, Database, Realtime)
- **İkonlar:** Lucide React
- **Tarih:** date-fns

## 🤝 Katkıda Bulunma

1. Forklayın
2. Feature branch oluşturun (`git checkout -b feature/yeniozellik`)
3. Commit atın (`git commit -m 'feat: yeni özellik eklendi'`)
4. Pushlayın (`git push origin feature/yeniozellik`)
5. Pull Request açın

---
Geliştirici: [fthozcnn](https://github.com/fthozcnn)
