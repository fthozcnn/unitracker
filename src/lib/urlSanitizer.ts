/**
 * ================================================================
 * UNIMARMARA - GÜVENLİ URL VE BAĞLANTI TEMİZLEME MODÜLÜ (XSS KORUMASI)
 * ================================================================
 */

// İzin verilmeyen / tehlikeli URL protokolleri
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Genel URL Temizleyici (javascript: / data: enjeksiyonunu engeller)
 */
export function sanitizeUrl(url: string | null | undefined, fallback = '/'): string {
    if (!url || typeof url !== 'string') return fallback
    const trimmed = url.trim()

    // Tehlikeli şema kontrolü
    const lower = trimmed.toLowerCase()
    for (const protocol of DANGEROUS_PROTOCOLS) {
        if (lower.startsWith(protocol)) {
            console.warn(`[Güvenlik Uyarısı] Tehlikeli protokol engellendi: ${protocol}`)
            return fallback
        }
    }

    // Yalnızca göreceli yollar (/path) veya https:// izin verilir
    if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        return trimmed
    }

    return fallback
}

/**
 * Müzik Çalar Embed URL Doğrulayıcısı (Sadece Spotify ve YouTube Beyaz Listesi)
 */
export function sanitizeEmbedUrl(url: string, provider: 'youtube' | 'spotify'): string | null {
    if (!url || typeof url !== 'string') return null
    const trimmed = url.trim()

    try {
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
        const hostname = parsed.hostname.toLowerCase()

        if (provider === 'spotify') {
            // Yalnızca spotify.com veya open.spotify.com
            if (hostname === 'open.spotify.com' || hostname === 'spotify.com') {
                let path = parsed.pathname
                if (!path.startsWith('/embed/')) {
                    path = `/embed${path}`
                }
                return `https://open.spotify.com${path}${parsed.search}`
            }
            return null
        }

        if (provider === 'youtube') {
            // Yalnızca youtube.com, www.youtube.com, youtu.be
            if (
                hostname === 'www.youtube.com' ||
                hostname === 'youtube.com' ||
                hostname === 'youtu.be'
            ) {
                let videoId = ''
                if (hostname === 'youtu.be') {
                    videoId = parsed.pathname.slice(1)
                } else if (parsed.pathname.includes('/embed/')) {
                    videoId = parsed.pathname.replace('/embed/', '')
                } else {
                    videoId = parsed.searchParams.get('v') || ''
                }

                if (!videoId || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
                    return null
                }

                return `https://www.youtube.com/embed/${videoId}?autoplay=1`
            }
            return null
        }
    } catch {
        return null
    }

    return null
}
