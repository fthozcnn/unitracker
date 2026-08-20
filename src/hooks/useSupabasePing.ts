import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Supabase free tier projesini aktif tutmak için periyodik ping
// Her 4 günde bir (veya uygulama açıldığında) basit bir sorgu gönderir
const PING_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000 // 4 gün
const LAST_PING_KEY = 'supabase_last_ping'

async function pingSupabase() {
    try {
        // Basit ve hafif bir sorgu - sadece 1 satır çeker
        const { error } = await supabase
            .from('courses')
            .select('id')
            .limit(1)

        if (!error) {
            localStorage.setItem(LAST_PING_KEY, Date.now().toString())
            console.log('[Ping] Supabase aktif tutuldu:', new Date().toLocaleString('tr-TR'))
        }
    } catch (err) {
        // Sessizce başarısız ol, kullanıcıyı rahatsız etme
        console.warn('[Ping] Supabase ping başarısız:', err)
    }
}

export function useSupabasePing() {
    useEffect(() => {
        // Uygulama açıldığında son ping'i kontrol et
        const lastPing = localStorage.getItem(LAST_PING_KEY)
        const now = Date.now()

        if (!lastPing || now - parseInt(lastPing) > PING_INTERVAL_MS) {
            // Son ping çok eskiyse veya hiç ping atılmamışsa hemen at
            pingSupabase()
        }

        // Periyodik interval kur (uygulama açık kaldığı sürece)
        const interval = setInterval(pingSupabase, PING_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [])
}
