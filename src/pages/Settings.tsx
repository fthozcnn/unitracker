import { useState, useEffect } from 'react'
import { Card, Button, Input } from '../components/ui-base'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, Download, Upload, Trash2, Moon, Sun, Bell, BellOff, Shield, FileText, Info, ExternalLink, HelpCircle } from 'lucide-react'
import {
    requestNotificationPermission,
    isNotificationSupported,
    getNotificationPermission,
    sendLocalNotification
} from '../lib/pushNotifications'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import LegalModal from '../components/LegalModal'
import FAQModal from '../components/FAQModal'

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth()
    useDocumentTitle('Profil & Ayarlar', {
        description: 'Hesap bilgileri, bildirim izinleri, tema tercihleri ve veri yedekleme.'
    })
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState(profile?.display_name || user?.user_metadata?.full_name || '')

    const [pushSupported, setPushSupported] = useState(false)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [legalModalOpen, setLegalModalOpen] = useState(false)
    const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms'>('privacy')
    const [faqModalOpen, setFaqModalOpen] = useState(false)

    useEffect(() => {
        const supported = isNotificationSupported()
        setPushSupported(supported)
        getNotificationPermission().then(setNotificationPermission)
    }, [])

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Update Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            })
            if (authError) throw authError

            // Update Profiles Table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ display_name: fullName })
                .eq('id', user?.id)

            if (profileError) throw profileError

            await refreshProfile()
            alert('Profil güncellendi!')
        } catch (error) {
            console.error('Error updating profile:', error)
            alert('Hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const handleExportData = async () => {
        setLoading(true)
        try {
            // Fetch all user data
            const [courses, sessions, assignments] = await Promise.all([
                supabase.from('courses').select('*').eq('user_id', user?.id),
                supabase.from('study_sessions').select('*').eq('user_id', user?.id),
                supabase.from('assignments').select('*').eq('user_id', user?.id)
            ])

            const backup = {
                timestamp: new Date().toISOString(),
                user_email: user?.email,
                data: {
                    courses: courses.data,
                    study_sessions: sessions.data,
                    assignments: assignments.data
                }
            }

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `unitracker-backup-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Export error:', error)
            alert('Yedekleme sırasında hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        setLoading(true)
        try {
            const text = await file.text()
            const backup = JSON.parse(text)

            if (!backup.data) {
                alert('Geçersiz yedek dosyası.')
                return
            }

            const { courses: importCourses, study_sessions: importSessions, assignments: importAssignments } = backup.data

            // Track old → new course ID mapping
            const courseIdMap: Record<string, string> = {}

            // Import courses
            if (importCourses?.length > 0) {
                for (const course of importCourses) {
                    const oldId = course.id
                    const { id, created_at, ...courseData } = course
                    const { data: inserted, error } = await supabase
                        .from('courses')
                        .insert({ ...courseData, user_id: user.id })
                        .select('id')
                        .single()
                    if (!error && inserted) {
                        courseIdMap[oldId] = inserted.id
                    }
                }
            }

            // Import study sessions with mapped course IDs
            if (importSessions?.length > 0) {
                const mappedSessions = importSessions.map((s: any) => {
                    const { id, created_at, ...sessionData } = s
                    return {
                        ...sessionData,
                        user_id: user.id,
                        course_id: courseIdMap[s.course_id] || s.course_id
                    }
                })
                await supabase.from('study_sessions').insert(mappedSessions)
            }

            // Import assignments with mapped course IDs
            if (importAssignments?.length > 0) {
                const mappedAssignments = importAssignments.map((a: any) => {
                    const { id, created_at, ...assignmentData } = a
                    return {
                        ...assignmentData,
                        user_id: user.id,
                        course_id: courseIdMap[a.course_id] || a.course_id
                    }
                })
                await supabase.from('assignments').insert(mappedAssignments)
            }

            const totalImported = (importCourses?.length || 0) + (importSessions?.length || 0) + (importAssignments?.length || 0)
            alert(`✅ Veri yükleme başarılı!\n\n${importCourses?.length || 0} ders\n${importSessions?.length || 0} çalışma oturumu\n${importAssignments?.length || 0} görev/sınav\n\nToplam ${totalImported} kayıt yüklendi.`)
        } catch (error) {
            console.error('Import error:', error)
            alert('Veri yükleme sırasında hata oluştu. Dosya formatını kontrol edin.')
        } finally {
            setLoading(false)
            e.target.value = '' // Reset file input
        }
    }

    const handleResetProgress = async () => {
        if (!user) return

        const confirmed = window.confirm(
            '⚠️ DİKKAT: Bu işlem geri alınamaz!\n\n' +
            'Silinecekler:\n' +
            '• Tüm çalışma oturumları\n' +
            '• Tüm rozetler ve ilerleme\n' +
            '• XP ve seviye\n' +
            '• Ders notları ve sınav kayıtları\n\n' +
            'Korunacaklar:\n' +
            '• Dersler ve ders programı\n' +
            '• Arkadaş listesi\n' +
            '• Profil bilgileri\n\n' +
            'Devam etmek istiyor musunuz?'
        )

        if (!confirmed) return

        const doubleConfirm = window.confirm('Son kez onaylayın: Tüm ilerleme verileriniz silinecek. Emin misiniz?')
        if (!doubleConfirm) return

        setLoading(true)
        try {
            // Use RPC function that runs as SECURITY DEFINER to bypass RLS
            const { error } = await supabase.rpc('reset_user_progress')

            if (error) {
                console.error('Reset error:', error.message, error.details)
                alert('⚠️ Sıfırlama hatası: ' + error.message)
            } else {
                alert('✅ İlerleme başarıyla sıfırlandı! Sayfa yenilenecek.')
            }

            // Force full page reload to clear all cached data
            window.location.reload()
        } catch (error) {
            console.error('Reset error:', error)
            alert('Sıfırlama sırasında hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil ve Ayarlar</h1>

            {/* Profile Settings */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Profil Bilgileri</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-posta</label>
                        <Input value={user?.email} disabled className="bg-gray-100 dark:bg-gray-700" />
                    </div>

                    <Input
                        label="Ad Soyad"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Adınız..."
                    />

                    <div className="flex justify-end">
                        <Button type="submit" disabled={loading}>
                            <Save className="h-4 w-4 mr-2" />
                            Kaydet
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Data Management */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Veri Yönetimi</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Verilerinizi JSON formatında yedekleyebilir veya daha önce aldığınız yedeği geri yükleyebilirsiniz.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={handleExportData} disabled={loading}>
                        <Download className="h-4 w-4 mr-2" />
                        Verileri İndir (Yedekle)
                    </Button>
                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImportData}
                            disabled={loading}
                        />
                        <div className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" />
                            {loading ? 'Yükleniyor...' : 'Veri Yükle (Geri Yükle)'}
                        </div>
                    </label>
                </div>
            </Card>

            {/* Bildirimler */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bildirimler</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Sınav hatırlatmaları ve çalışma bildirimleri
                        </p>
                    </div>
                    {notificationPermission === 'granted' ? (
                        <Bell className="h-6 w-6 text-blue-600" />
                    ) : (
                        <BellOff className="h-6 w-6 text-gray-400" />
                    )}
                </div>

                {!pushSupported ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            ⚠️ Bu tarayıcı masaüstü bildirimlerini desteklemiyor.
                        </p>
                    </div>
                ) : notificationPermission === 'denied' ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            🚫 <strong>Bildirimler Engellendi:</strong> Tarayıcı ayarlarından bildirim iznini etkinleştirmeniz gerekiyor.
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-2">
                            Adres çubuğundaki 🔒 simgesine tıklayıp "Bildirimler" iznini "İzin Ver" olarak değiştirin.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {notificationPermission === 'granted' ? '✅ Bildirimler aktif' : 'Bildirimler kapalı'}
                            </span>
                            {notificationPermission !== 'granted' ? (
                                <Button
                                    variant="primary"
                                    onClick={async () => {
                                        setLoading(true)
                                        try {
                                            const result = await requestNotificationPermission()
                                            const perm = await getNotificationPermission()
                                            setNotificationPermission(perm)
                                            if (result === 'granted') {
                                                alert('Bildirimler aktif edildi! 🔔')
                                            } else {
                                                alert('Bildirim izni verilmedi')
                                            }
                                        } catch (error) {
                                            console.error(error)
                                            alert('Bir hata oluştu')
                                        } finally {
                                            setLoading(false)
                                        }
                                    }}
                                    disabled={loading}
                                >
                                    <Bell className="h-4 w-4 mr-2" /> Bildirimleri Aç
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        sendLocalNotification(
                                            '🔔 Test Bildirimi',
                                            'UniMarmara bildirimleri çalışıyor!',
                                            { tag: 'test' }
                                        )
                                    }}
                                >
                                    🔔 Test Bildirimi Gönder
                                </Button>
                            )}
                        </div>

                        {notificationPermission === 'granted' && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                <p className="text-xs text-green-800 dark:text-green-200">
                                    ✅ Pomodoro bitişi, çalışma tamamlanması ve sınav hatırlatmaları için bildirim alacaksınız.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Appearance */}
            <Card className="p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <Sun className="h-6 w-6 text-blue-500 hidden dark:block" />
                        <Moon className="h-6 w-6 text-blue-500 block dark:hidden" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Görünüm Seçenekleri</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            UniMarmara'nın renk teması, işletim sisteminizin temasına göre (Aydınlık/Karanlık) otomatik olarak ayarlanmaktadır.
                        </p>
                    </div>
                </div>
            </Card>

            {/* About & Legal Information */}
            <Card className="p-6">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Info className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hakkında & Yasal Bilgiler</h2>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                Sürüm 1.2.0
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            UniMarmara; öğrencilerin verilerini korumayı taahhüt eder. Verileriniz KVKK/GDPR uyumlu şekilde Supabase RLS ile güvence altındadır.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => setFaqModalOpen(true)}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left transition-colors border border-gray-200/60 dark:border-slate-700/60"
                    >
                        <div className="flex items-center gap-2.5">
                            <HelpCircle className="w-4 h-4 text-blue-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">SSS & Yardım</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Merak edilen sorular</p>
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => { setLegalModalTab('privacy'); setLegalModalOpen(true); }}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left transition-colors border border-gray-200/60 dark:border-slate-700/60"
                    >
                        <div className="flex items-center gap-2.5">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Gizlilik Politikası</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">KVKK aydınlatma metni</p>
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </button>

                    <button
                        type="button"
                        onClick={() => { setLegalModalTab('terms'); setLegalModalOpen(true); }}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-left transition-colors border border-gray-200/60 dark:border-slate-700/60"
                    >
                        <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Kullanım Koşulları</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Hizmet şartları & kurallar</p>
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </Card>

            {/* Danger Zone - Reset Progress */}
            <Card className="p-6 border-2 border-red-200 dark:border-red-900/50">
                <h2 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Tehlikeli Bölge</h2>
                <p className="text-sm text-gray-500 mb-4">
                    İlerleme verilerinizi sıfırlayabilir veya hesabınızı tamamen silebilirsiniz.
                    Hesap silme işlemi geri alınamaz ve tüm verileriniz (dersler, program, notlar vb.) tamamen kalıcı olarak silinir.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        onClick={handleResetProgress}
                        disabled={loading}
                        className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {loading ? 'İşleniyor...' : 'İlerlemeyi Sıfırla'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={async () => {
                            if (!user) return

                            const confirmed = window.confirm(
                                '⚠️ DİKKAT: Bu işlem GERİ ALINAMAZ!\n\n' +
                                'Hesabınız ve hesabınıza bağlı TÜM veriler (dersler, program, çalışma oturumları, rozetler) kalıcı olarak SİLİNECEKTİR.\n\n' +
                                'Devam etmek istiyor musunuz?'
                            )

                            if (!confirmed) return

                            const doubleConfirm = window.confirm('SON UYARI: Hesabınızı kalıcı olarak silmek istediğinize emin misiniz?')
                            if (!doubleConfirm) return

                            setLoading(true)
                            try {
                                const { error } = await supabase.rpc('delete_user_account')

                                if (error) {
                                    console.error('Account deletion error:', error.message, error.details)
                                    alert('⚠️ Hesap silinirken bir hata oluştu: ' + error.message)
                                } else {
                                    alert('✅ Hesabınız başarıyla silindi. Hoşçakalın!')
                                    await supabase.auth.signOut()
                                    window.location.href = '/' // Force redirect
                                }
                            } catch (error) {
                                console.error('Account deletion error:', error)
                                alert('Hesap silme işlemi sırasında beklenmeyen bir hata oluştu.')
                            } finally {
                                setLoading(false)
                            }
                        }}
                        disabled={loading}
                        className="bg-red-600 dark:bg-red-600 text-white border border-red-700 hover:bg-red-700 dark:hover:bg-red-700"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {loading ? 'İşleniyor...' : 'Hesabımı Kalıcı Olarak Sil'}
                    </Button>
                </div>
            </Card>

            <LegalModal
                isOpen={legalModalOpen}
                onClose={() => setLegalModalOpen(false)}
                initialTab={legalModalTab}
            />

            <FAQModal
                isOpen={faqModalOpen}
                onClose={() => setFaqModalOpen(false)}
            />
        </div>
    )
}
