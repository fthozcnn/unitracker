import { useState, useEffect } from 'react'
import StudyTimer from '../components/StudyTimer'
import SyncPomodoro from '../components/SyncPomodoro'
import ManualSessionModal from '../components/ManualSessionModal'
import MusicPlayer from '../components/MusicPlayer'
import { Card, Button } from '../components/ui-base'
import { Plus, Edit2, Trash2, Maximize2, Minimize2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const STUDY_TIPS = [
    "Pomodoro tekniği, odaklanma süresini artırırken zihinsel yorgunluğu azaltır. Her 4 döngüde bir uzun mola vermeyi unutma! 🍅",
    "Uyumadan önce öğrendiklerini tekrar etmek, bilgilerin uzun süreli hafızaya kalıcı olarak geçmesini sağlar. 😴",
    "Çalışırken telefonunu başka bir odada bırakmak, odaklanma süreni ve verimini %40 oranında artırabilir. 📱",
    "Zor veya sevmediğin konuları günün en enerjik olduğun ilk saatlerinde çalışmaya özen göster (Kurbağayı yut!). 🐸",
    "Çalışma masanı düzenli tutmak, zihnindeki karmaşayı azaltır ve direkt hedef odaklı çalışmanı sağlar. 🧹",
    "Aralıklı tekrar (Spaced Repetition) yöntemiyle öğrenmek, sınav gecesi sabahlamaktan çok daha etkilidir. 📈",
    "Sadece okuyarak çalışmak yerine, kendi notlarını çıkararak veya başkasına anlatıyormuş gibi sesli özetleyerek çalış. 🗣️",
    "Su içmeyi ihmal etme. Hafif bir dehidrasyon bile dikkat dağınıklığına ve baş ağrısına yol açabilir. 💧",
    "Müzik dinleyerek çalışmayı seviyorsan, sözsüz lofi veya klasik müzik gibi enstrümantal türleri tercih et. 🎵",
    "Mükemmeliyetçilikten kaçın; 'yeterince iyi' bir çalışma başlangıcı, hiç başlamamaktan her zaman daha iyidir. 🚀",
    "Uyku düzenine dikkat et. Yetişkin bir bireyin tam odaklanabilmesi için günlük 7-8 saat kaliteli uyku şarttır. 🛏️",
    "Hedeflerini küçük, yönetilebilir parçalara böl. 'Tüm kitabı bitireceğim' yerine 'İlk 10 sayfayı okuyacağım' demek başlatıcı gücü artırır. 🧩",
    "Herhangi bir konuyu öğrenmenin en iyi yolu, o konuyu hiç bilmeyen birine basitleştirerek anlatabilmektir (Feynman Tekniği). 👨‍🏫",
    "Haftalık ve günlük planlar yapmak, zihinsel yükü azaltır ve gün içindeki kararsızlık hissini yok eder. 📅",
    "Çalışmaya başlamadan önce net bir hedef belirle: 'Bugün sadece türev testini bitireceğim' gibi spesifik amaçlar koy. 🎯"
]

export default function Study() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [editingSession, setEditingSession] = useState<any>(null)
    const [isZenMode, setIsZenMode] = useState(false)
    const [dailyTip, setDailyTip] = useState(STUDY_TIPS[0])

    useDocumentTitle('Çalışma Odası & Pomodoro', {
        description: 'Pomodoro zamanlayıcısı, senkronize çalışma odası ve odaklanma araçları.'
    })

    useEffect(() => {
        setDailyTip(STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)])
    }, [])

    useEffect(() => {
        if (isZenMode) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isZenMode])

    const { data: recentSessions } = useQuery({
        queryKey: ['recent_activity'],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('*, courses (name, color)')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(10)
            return data || []
        }
    })

    const handleEdit = (session: any) => {
        setEditingSession(session)
        setIsManualModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu çalışma kaydını silmek istediğinize emin misiniz?')) return
        try {
            const { error } = await supabase.from('study_sessions').delete().eq('id', id)
            if (error) throw error
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
            alert('Kayıt silindi.')
        } catch (error) {
            alert('Silme hatası.')
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Çalışma Odası</h1>
                    <p className="text-sm text-gray-400 font-medium">Odaklan, çalış ve başarını kaydet.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="secondary" onClick={() => setIsZenMode(true)} className="flex-1 md:flex-none">
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Zen Modu
                    </Button>
                    <Button variant="secondary" onClick={() => { setEditingSession(null); setIsManualModalOpen(true); }} className="flex-1 md:flex-none">
                        <Plus className="h-4 w-4 mr-2" />
                        Manuel Giriş
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Timer Section */}
                <div className="lg:col-span-2">
                    <StudyTimer />
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Sync Pomodoro */}
                    <SyncPomodoro />

                    {/* Stats/Info Section */}
                    <Card className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-500/20">
                        <h3 className="font-bold text-lg mb-2">Günün İpucu 💡</h3>
                        <p className="text-sm text-blue-50 opacity-90 leading-relaxed">
                            "{dailyTip}"
                        </p>
                    </Card>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Son Çalışmalar</h2>
                </div>
                <Card className="overflow-hidden">
                    {recentSessions?.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            Henüz kayıtlı bir çalışma seansı bulunmuyor.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {recentSessions?.map((session: any) => (
                                <div key={session.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: session.courses?.color || '#cbd5e1' }} />
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{session.courses?.name || 'Ders Silinmiş'}</p>
                                            <p className="text-xs text-gray-400 font-medium">{format(new Date(session.start_time), 'd MMMM HH:mm', { locale: tr })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(session.duration / 60)} dk</span>
                                            {session.note && <p className="text-[10px] text-gray-400 max-w-[150px] truncate">{session.note}</p>}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(session)} className="p-2 text-gray-400 hover:text-amber-500 transition-colors"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => handleDelete(session.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Zen Mode Overlay */}
            {isZenMode && (
                <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-950 flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <button
                        onClick={() => setIsZenMode(false)}
                        className="absolute top-8 right-8 p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                        <Minimize2 className="h-6 w-6 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                    </button>

                    <div className="w-full max-w-2xl px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-500 mb-2">Zen Modu Aktif</h2>
                            <p className="text-gray-400 font-medium">Sadece sen ve hedeflerin.</p>
                        </div>
                        <StudyTimer />
                    </div>
                </div>
            )}

            <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50">
                <MusicPlayer />
            </div>

            <ManualSessionModal
                isOpen={isManualModalOpen}
                onClose={() => { setIsManualModalOpen(false); setEditingSession(null); }}
                editingSession={editingSession}
            />
        </div>
    )
}
