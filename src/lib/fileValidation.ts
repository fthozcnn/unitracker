/**
 * ================================================================
 * UNIMARMARA - GÜVENLİ DOSYA DOĞRULAMA VE İŞLEME YARDIMCISI
 * ================================================================
 */

export interface FileValidationOptions {
    maxSizeBytes: number
    allowedMimeTypes: string[]
    allowedExtensions: string[]
}

// Dosya Türü Varsayılan Limitleri
export const FILE_LIMITS = {
    JSON_BACKUP: {
        maxSizeBytes: 5 * 1024 * 1024, // 5 MB
        allowedMimeTypes: ['application/json', 'text/plain'],
        allowedExtensions: ['.json']
    },
    CSV_IMPORT: {
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
        allowedExtensions: ['.csv']
    },
    IMAGE_AVATAR: {
        maxSizeBytes: 5 * 1024 * 1024, // 5 MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp']
    }
}

/**
 * Dosya boyutu, uzantısı ve MIME tipini sıkı kontrolden geçirir
 */
export function validateUploadedFile(
    file: File,
    options: FileValidationOptions
): { valid: boolean; error?: string } {
    if (!file) {
        return { valid: false, error: 'Dosya seçilmedi.' }
    }

    // 1. Boyut Denetimi (DoS & Bellek Şişirme Koruması)
    if (file.size <= 0) {
        return { valid: false, error: 'Dosya boş olamaz.' }
    }
    if (file.size > options.maxSizeBytes) {
        const maxMB = (options.maxSizeBytes / (1024 * 1024)).toFixed(1)
        return {
            valid: false,
            error: `Dosya boyutu çok büyük. Maksimum izin verilen boyut: ${maxMB} MB.`
        }
    }

    // 2. Uzantı Denetimi
    const fileName = file.name.toLowerCase()
    const hasValidExtension = options.allowedExtensions.some(ext => fileName.endsWith(ext))
    if (!hasValidExtension) {
        return {
            valid: false,
            error: `Geçersiz dosya türü. Yalnızca ${options.allowedExtensions.join(', ')} dosyaları kabul edilir.`
        }
    }

    // 3. MIME Türü Denetimi
    if (file.type && !options.allowedMimeTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Geçersiz içerik türü (${file.type}). Lütfen geçerli bir dosya yükleyin.`
        }
    }

    return { valid: true }
}

/**
 * Güvenli Rastgele Dosya Adı Üretici (Yol Kaçışı / Path Traversal Önleyici)
 * Kullanıcının gönderdiği dosya adı doğrudan sunucuda kullanılmaz;
 * onun yerine UUID + güvenli uzantı oluşturulur.
 */
export function generateSafeFileName(originalName: string, userId: string): string {
    const extension = originalName.slice(originalName.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9.]/g, '')
    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
    return `${userId}/${randomId}${extension}`
}
