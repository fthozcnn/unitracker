import { useState } from 'react'
import { Card, Button, Input } from '../components/ui-base'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Save, Download, Moon, Sun, Upload } from 'lucide-react'

export default function Settings() {
    const { user, profile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState(profile?.display_name || user?.user_metadata?.full_name || '')

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
