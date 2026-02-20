// Update script to patch unachievable badges
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
    envFile.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function updateBadges() {
    // 1. Replace 'library_study' (requires session.note, doesn't exist)
    // New badge: 'Odak Ustasý' - 10 tane kesintisiz(25dk) oturum yapmak.
    await supabase.from('badges').update({
        name: 'Odak Ustası',
        description: 'Toplam 10 kesintisiz Pomodoro (en az 25dk) tamamladın.',
        icon: 'Brain',
        color: 'emerald',
        criteria_type: 'focus_master',
        criteria_value: 10
    }).eq('criteria_type', 'library_study');

    // 2. Replace 'share_stats' (no share tracking)
    // New badge: 'Popülerlik Yolunda' - 5 veya daha fazla arka arkaya gün çalıþmak
    await supabase.from('badges').update({
        name: 'Tam Gaz',
        description: 'Bir hafta içinde (7 gün) toplam 20 saat çalıştın!',
        icon: 'Rocket',
        color: 'blue',
        criteria_type: 'weekly_marathon',
        criteria_value: 20
    }).eq('criteria_type', 'share_stats');

    // 3. 'diverse_study' (5 farkli ders ayni gun) -> Çok zor, genelde ogrenciler 2-3 ders calisir
    await supabase.from('badges').update({
        name: 'Çok Yönlü',
        description: 'Aynı gün içinde 3 farklı derse çalıştın.',
        criteria_value: 3
    }).eq('criteria_type', 'diverse_study');

    // 4. 'weights_complete' -> 'Not Avcisi'
    // Make it simpler: have added grades for at least 3 assignments/exams
    await supabase.from('badges').update({
        name: 'Not Avcısı',
        description: 'Sistemde en az 3 farklı sınav/ödev notu kaydettin.',
        criteria_type: 'grades_logged',
        criteria_value: 3
    }).eq('criteria_type', 'weights_complete');

    console.log("Badges updated in database!");
}

updateBadges();
