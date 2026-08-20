/**
 * ================================================================
 * UNIMARMARA - MERKEZİ VE GÜVENLİ HATA YÖNETİM MODÜLÜ
 * ================================================================
 * 1. Teknik detayları (SQL sorguları, tablo adları, stack trace) kullanıcıdan gizler.
 * 2. Her hata için destek ekibine iletilebilecek benzersiz bir Referans Kodu üretir.
 * 3. Kullanıcıya sade, anlaşılır ve güvenli Türkçe mesaj sunar.
 * 4. Geliştirici loglarına ve telemetriye tam hata detayını kaydeder.
 */

import { maskSensitiveData } from './masking'

export interface SafeErrorResult {
    userMessage: string
    errorCode: string
    isAuthError?: boolean
}

/**
 * Rastgele 6 karakterlik Referans Kodu üretir (Örn: ERR-9F2B7A)
 */
export function generateErrorCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `ERR-${code}`
}

/**
 * Bilinen sistem/veritabanı hatalarını güvenli kullanıcı mesajlarına çevirir
 */
export function handleSafeError(error: unknown, contextDescription?: string): SafeErrorResult {
    const errorCode = generateErrorCode()
    const rawError = error as any
    const rawMessage = (rawError?.message || rawError?.error_description || String(error || '')).toLowerCase()

    // 1. Geliştirici Konsoluna / Loguna Maskelenmiş Güvenli Bilgiyi Yaz
    console.error(`[${errorCode}] 🚨 Güvenlik & Sistem Hatası [${contextDescription || 'Genel'}]:`, {
        error: maskSensitiveData(error),
        stack: rawError?.stack,
        details: maskSensitiveData(rawError?.details),
        hint: rawError?.hint,
        timestamp: new Date().toISOString()
    })

    // 2. Kimlik Doğrulama Hataları (Kullanıcı Sayımı / User Enumeration Önleme)
    if (
        rawMessage.includes('invalid login credentials') ||
        rawMessage.includes('invalid_grant') ||
        rawMessage.includes('user not found') ||
        rawMessage.includes('wrong password') ||
        rawMessage.includes('invalid credentials')
    ) {
        return {
            errorCode,
            userMessage: 'E-posta adresi veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.',
            isAuthError: true
        }
    }

    if (rawMessage.includes('user already registered') || rawMessage.includes('already exists')) {
        return {
            errorCode,
            userMessage: 'Bu e-posta adresiyle kayıtlı bir hesap bulunmaktadır.',
            isAuthError: true
        }
    }

    if (rawMessage.includes('rate limit') || rawMessage.includes('too many requests')) {
        return {
            errorCode,
            userMessage: 'Çok fazla deneme yaptınız. Lütfen birkaç dakika bekleyip tekrar deneyin.',
            isAuthError: true
        }
    }

    // 3. Ağ & Bağlantı Hataları
    if (rawMessage.includes('failed to fetch') || rawMessage.includes('network') || rawMessage.includes('offline')) {
        return {
            errorCode,
            userMessage: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.'
        }
    }

    // 4. Yetkilendirme & RLS Hataları
    if (rawMessage.includes('row-level security') || rawMessage.includes('permission denied') || rawMessage.includes('forbidden') || rawMessage.includes('42501')) {
        return {
            errorCode,
            userMessage: 'Bu işlem için yetkiniz bulunmamaktadır.'
        }
    }

    // 5. Doğrulama ve Kısıt Hataları
    if (rawMessage.includes('violates check constraint') || rawMessage.includes('invalid input')) {
        return {
            errorCode,
            userMessage: 'Girilen veriler geçerli sınırlar içinde değil. Lütfen alanları kontrol edin.'
        }
    }

    // 6. Varsayılan Güvenli Hata Mesajı (Teknik Sızıntı Yapmaz)
    return {
        errorCode,
        userMessage: `İşlem sırasında beklenmeyen bir hata oluştu. Sorun devam ederse lütfen "${errorCode}" referans kodu ile destek ekibine iletin.`
    }
}
