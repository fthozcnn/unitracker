import { z } from 'zod'

/**
 * ================================================================
 * UNIMARMARA - PAYLAŞILAN GİRDİ DOĞRULAMA ŞEMALARI (ZOD)
 * ================================================================
 * Bu şemalar istemcide ve uç noktalarda (API/Edge Functions/Server Actions)
 * tüm verilerin tip, uzunluk, aralık ve format kurallarına uygunluğunu denetler.
 */

// 1. DERS (COURSE) DOĞRULAMA ŞEMASI
export const CourseInputSchema = z.object({
    name: z.string().trim()
        .min(1, 'Ders adı zorunludur')
        .max(100, 'Ders adı en fazla 100 karakter olabilir'),
    code: z.string().trim()
        .max(20, 'Ders kodu en fazla 20 karakter olabilir')
        .optional()
        .nullable(),
    color: z.string().trim()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Geçersiz HEX renk kodu')
        .default('#3b82f6'),
    credit: z.number().int('Kredi tam sayı olmalıdır')
        .min(0, 'Kredi 0 veya daha büyük olmalıdır')
        .max(30, 'Kredi en fazla 30 olabilir')
        .default(3),
    attendance_limit: z.number().int('Devamsızlık limiti tam sayı olmalıdır')
        .min(0, 'Devamsızlık limiti negatif olamaz')
        .max(100, 'Devamsızlık limiti en fazla 100 saat olabilir')
        .default(14),
    absent_count: z.number().int('Devamsızlık sayısı tam sayı olmalıdır')
        .min(0, 'Devamsızlık sayısı negatif olamaz')
        .max(200, 'Devamsızlık sayısı en fazla 200 olabilir')
        .default(0),
    syllabus: z.array(z.object({
        week: z.number().int().min(1).max(30),
        topic: z.string().trim().min(1).max(200),
        isCompleted: z.boolean().default(false)
    })).max(30, 'En fazla 30 haftalık müfredat eklenebilir').default([])
})

// 2. ÇALIŞMA OTURUMU (STUDY SESSION) ŞEMASI
export const StudySessionInputSchema = z.object({
    course_id: z.string().uuid('Geçersiz ders ID formatı').optional().nullable(),
    start_time: z.string().datetime({ message: 'Geçersiz başlangıç zamanı formatı' }),
    end_time: z.string().datetime({ message: 'Geçersiz bitiş zamanı formatı' }).optional().nullable(),
    duration: z.number().int('Süre tam saniye olmalıdır')
        .min(1, 'Çalışma süresi en az 1 saniye olmalıdır')
        .max(86400, 'Tek bir oturum en fazla 24 saat (86400 sn) olabilir'),
    note: z.string().trim()
        .max(500, 'Oturum notu en fazla 500 karakter olabilir')
        .optional()
        .nullable()
})

// 3. GÖREV / SINAV / ETKİNLİK (ASSIGNMENT) ŞEMASI
export const AssignmentInputSchema = z.object({
    course_id: z.string().uuid('Geçersiz ders ID formatı').optional().nullable(),
    title: z.string().trim()
        .min(1, 'Görev başlığı zorunludur')
        .max(120, 'Başlık en fazla 120 karakter olabilir'),
    type: z.enum(['exam', 'homework', 'project', 'quiz', 'review', 'other'], {
        errorMap: () => ({ message: 'Geçersiz etkinlik türü' })
    }),
    due_date: z.string().datetime({ message: 'Geçersiz teslim tarihi formatı' }),
    description: z.string().trim()
        .max(1000, 'Açıklama en fazla 1000 karakter olabilir')
        .optional()
        .nullable(),
    is_completed: z.boolean().default(false),
    grade: z.number()
        .min(0, 'Not 0 veya üzeri olmalıdır')
        .max(100, 'Not 100 veya altı olmalıdır')
        .optional()
        .nullable()
})

// 4. NOT HESAPLAMA (COURSE GRADE) ŞEMASI
export const CourseGradeInputSchema = z.object({
    course_id: z.string().uuid('Geçersiz ders ID formatı'),
    exam_type: z.enum(['vize', 'final', 'odev', 'quiz', 'proje'], {
        errorMap: () => ({ message: 'Geçersiz sınav/değerlendirme türü' })
    }),
    grade: z.number()
        .min(0, 'Sınav notu 0\'dan küçük olamaz')
        .max(100, 'Sınav notu 100\'den büyük olamaz'),
    weight: z.number()
        .min(0, 'Yüzdelik ağırlık 0\'dan küçük olamaz')
        .max(100, 'Yüzdelik ağırlık 100\'den büyük olamaz')
})

// 5. MEYDAN OKUMA (CHALLENGE) ŞEMASI
export const ChallengeInputSchema = z.object({
    title: z.string().trim()
        .min(3, 'Başlık en az 3 karakter olmalıdır')
        .max(100, 'Başlık en fazla 100 karakter olabilir'),
    description: z.string().trim()
        .max(500, 'Açıklama en fazla 500 karakter olabilir')
        .optional()
        .nullable(),
    target_hours: z.number().int('Hedef saat tam sayı olmalıdır')
        .min(1, 'Hedef süre en az 1 saat olmalıdır')
        .max(500, 'Hedef süre en fazla 500 saat olabilir'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatında olmalıdır'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatında olmalıdır'),
    is_group: z.boolean().default(false)
}).refine(data => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'Bitiş tarihi başlangıç tarihinden önce olamaz',
    path: ['end_date']
})

// 6. KULLANICI PROFİLİ GÜNCELLEME ŞEMASI (GÜVENLİ ALANLAR)
// NOT: total_xp ve level gibi alanlar istemciden ASLA kabul edilmez!
export const ProfileUpdateSchema = z.object({
    display_name: z.string().trim()
        .min(2, 'Görünen ad en az 2 karakter olmalıdır')
        .max(50, 'Görünen ad en fazla 50 karakter olabilir'),
    bio: z.string().trim()
        .max(250, 'Biyografi en fazla 250 karakter olabilir')
        .optional()
        .nullable(),
    avatar_url: z.string().url('Geçersiz avatar URL formatı').optional().nullable()
})

// 7. SOHBET MESAJI (CHAT MESSAGE) ŞEMASI
export const ChatMessageInputSchema = z.object({
    content: z.string().trim()
        .min(1, 'Mesaj boş olamaz')
        .max(500, 'Mesaj en fazla 500 karakter olabilir')
})

// 8. DÜRLME / TEBRİK REAKSİYON ŞEMASI
export const SocialReactionSchema = z.object({
    target_user_id: z.string().uuid('Geçersiz hedef kullanıcı ID formatı'),
    reaction_type: z.enum(['nudge', 'cheer'], {
        errorMap: () => ({ message: 'Geçersiz tepki türü' })
    })
})

/**
 * Güvenli Doğrulama Yardımcı Fonksiyonu
 */
export function validatePayload<T>(schema: z.ZodSchema<T>, payload: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(payload)
    if (!result.success) {
        const errorMsg = result.error.errors.map(e => e.message).join(', ')
        return { success: false, error: errorMsg }
    }
    return { success: true, data: result.data }
}
