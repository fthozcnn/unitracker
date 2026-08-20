/**
 * ================================================================
 * UNIMARMARA - HASSAS VERİ MASKELEME VE GÜVENLİ LOGLAMA KATMANI
 * ================================================================
 */

/**
 * Genel Dize Maskeleme (İlk 4 karakter + ...)
 * Örnek: "eyJhbGciOiJSUzI1NiIsInR5cCI..." -> "eyJh..."
 */
export function maskSensitiveString(value: string | null | undefined, visibleChars = 4): string {
    if (!value) return ''
    const str = String(value)
    if (str.length <= visibleChars) return '***'
    return `${str.substring(0, visibleChars)}...`
}

/**
 * E-Posta Adresi Maskeleme
 * Örnek: "mehmetfetih@gmail.com" -> "mehm***@gmail.com"
 */
export function maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) return '***@***.***'
    const [local, domain] = email.split('@')
    const visibleLocal = local.length > 4 ? local.substring(0, 4) : local.substring(0, 1)
    return `${visibleLocal}***@${domain}`
}

/**
 * Telefon / TC / Kimlik Numarası Maskeleme
 * Örnek: "12345678901" -> "1234...01"
 */
export function maskIdentity(idStr: string | null | undefined): string {
    if (!idStr) return '***'
    const clean = String(idStr).trim()
    if (clean.length <= 4) return '***'
    return `${clean.substring(0, 4)}...${clean.substring(clean.length - 2)}`
}

const SENSITIVE_KEYS = new Set([
    'password',
    'pass',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'apikey',
    'api_key',
    'anon_key',
    'service_role',
    'email',
    'mail',
    'phone',
    'tel',
    'tc',
    'tckn',
    'identity',
    'card',
    'cvv',
    'cardnumber',
    'credit_card'
])

/**
 * Nesne / İstek Gövdesi / Yanıt Gövdesini Özyinelemeli (Recursive) Maskeleme
 */
export function maskSensitiveData(data: any): any {
    if (data === null || data === undefined) return data

    if (typeof data === 'string') {
        if (data.includes('@') && data.includes('.')) {
            return maskEmail(data)
        }
        return data
    }

    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item))
    }

    if (typeof data === 'object') {
        const maskedObj: Record<string, any> = {}
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '')
            if (SENSITIVE_KEYS.has(lowerKey)) {
                if (typeof value === 'string' && value.includes('@')) {
                    maskedObj[key] = maskEmail(value)
                } else if (typeof value === 'string') {
                    maskedObj[key] = maskSensitiveString(value, 4)
                } else {
                    maskedObj[key] = '***'
                }
            } else if (typeof value === 'object' && value !== null) {
                maskedObj[key] = maskSensitiveData(value)
            } else {
                maskedObj[key] = value
            }
        }
        return maskedObj
    }

    return data
}
