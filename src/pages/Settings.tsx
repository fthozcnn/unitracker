import { useState, useEffect } from 'react'
import { Card, Button, Input } from '../components/ui-base'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, Download, Moon, Sun, Bell, BellOff } from 'lucide-react'
import {
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    isPushNotificationSupported,
    getNotificationPermission,
    isSubscribedToPush
} from '../lib/pushNotifications'

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState(profile?.display_name || user?.user_metadata?.full_name || '')
    const [pushEnabled, setPushEnabled] = useState(false)
    const [pushSupported, setPushSupported] = useState(false)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

    useEffect(() => {
        // Check push notification support and status
        const checkPushStatus = async () => {
            const supported = isPushNotificationSupported()
            setPushSupported(supported)
            setNotificationPermission(getNotificationPermission())

            if (supported) {
                const subscribed = await isSubscribedToPush()
                setPushEnabled(subscribed)
            }
        }
        checkPushStatus()
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
                    Tüm verilerinizi JSON formatında indirebilirsiniz. Bu dosya yedekleme amaçlı kullanılabilir.
                </p>
                <div className="flex space-x-4">
                    <Button variant="secondary" onClick={handleExportData} disabled={loading}>
                        <Download className="h-4 w-4 mr-2" />
                        Verileri İndir (Yedekle)
                    </Button>
                    {/* Import feature could be added here later */}
                </div>
            </Card>

            {/* Push Notifications */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bildirimler</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Uygulama kapalıyken bile bildirim al
                        </p>
                    </div>
                    {pushEnabled ? (
                        <Bell className="h-6 w-6 text-blue-600" />
                    ) : (
                        <BellOff className="h-6 w-6 text-gray-400" />
                    )}
                </div>

                {!pushSupported ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            ⚠️ <strong>iOS Kullanıcıları:</strong> Apple PWA push bildirimlerini desteklemiyor. Uygulama içi bildirimler çalışmaya devam eder.
                        </p>
                    </div>
                ) : notificationPermission === 'denied' ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            🚫 <strong>Bildirimler Engellendi:</strong> Tarayıcı ayarlarından bildirim iznini etkinleştirmeniz gerekiyor.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {pushEnabled ? 'Bildirimler aktif' : 'Bildirimler kapalı'}
                            </span>
                            <Button
                                variant={pushEnabled ? 'ghost' : 'primary'}
                                onClick={async () => {
                                    setLoading(true)
                                    try {
                                        if (pushEnabled) {
                                            const success = await unsubscribeFromPushNotifications(user?.id || '')
                                            if (success) {
                                                setPushEnabled(false)
                                                alert('Bildirimler kapatıldı')
                                            }
                                        } else {
                                            const success = await subscribeToPushNotifications(user?.id || '')
                                            if (success) {
                                                setPushEnabled(true)
                                                setNotificationPermission(getNotificationPermission())
                                                alert('Bildirimler aktif edildi! 🔔')
                                            } else {
                                                alert('Bildirim izni verilmedi veya bir hata oluştu')
                                            }
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
                                {pushEnabled ? (
                                    <><BellOff className="h-4 w-4 mr-2" /> Bildirimleri Kapat</>
                                ) : (
                                    <><Bell className="h-4 w-4 mr-2" /> Bildirimleri Aç</>
                                )}
                            </Button>
                        </div>

                        {pushEnabled && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                                <p className="text-xs text-green-800 dark:text-green-200">
                                    ✅ Arkadaş istekleri, dürtmeler ve ödev hatırlatmaları için bildirim alacaksınız.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Appearance */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Görünüm</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Sistem temanıza göre otomatik olarak ayarlanır. (Tailwind dark mode 'class' strategy kullanıyorsa toggle gerekir, şu an sistem veya manual class ekleme ile çalışır.)
                </p>
                <div className="flex space-x-2">
                    <Button variant="secondary" onClick={() => document.documentElement.classList.remove('dark')}>
                        <Sun className="h-4 w-4 mr-2" />
                        Aydınlık
                    </Button>
                    <Button variant="secondary" onClick={() => document.documentElement.classList.add('dark')}>
                        <Moon className="h-4 w-4 mr-2" />
                        Karanlık
                    </Button>
                </div>
            </Card>
        </div>
    )
}
