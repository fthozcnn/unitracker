import { useState, useEffect } from 'react'
import StudyTimer from '../components/StudyTimer'
import ManualSessionModal from '../components/ManualSessionModal'
import { Button, Card } from '../components/ui-base'
import { Plus, Edit2, Trash2, Wind, CloudRain, Music, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const AMBIENT_SOUNDS = [
    { id: 'lofi', name: 'Lo-Fi Müzik', icon: Music, url: 'https://p.scdn.co/mp3-preview/a02018a4a584347781b09b5e581297eef84090b8?cid=774b29d4f13844c495f206141e300357' },
    { id: 'rain', name: 'Yağmur', icon: CloudRain, url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
    { id: 'forest', name: 'Doğa', icon: Wind, url: 'https://assets.mixkit.co/active_storage/sfx/1243/1243-preview.mp3' }
]

export default function Study() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [editingSession, setEditingSession] = useState<any>(null)
    const [isZenMode, setIsZenMode] = useState(false)
    const [activeSound, setActiveSound] = useState<string | null>(null)
    const [audio] = useState(new Audio())

    useEffect(() => {
        if (activeSound) {
            const sound = AMBIENT_SOUNDS.find(s => s.id === activeSound)
            if (sound) {
                audio.src = sound.url
                audio.loop = true
                audio.play().catch(e => console.log('Audio error:', e))
            }
        } else {
            audio.pause()
        }
        return () => audio.pause()
    }, [activeSound, audio])

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

                {/* Ambient Sounds Section */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Volume2 className="h-5 w-5 text-blue-500" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Odaklanma Sesleri</h3>
                        </div>
                        <div className="space-y-3">
                            {AMBIENT_SOUNDS.map((sound) => (
                                <button
                                    key={sound.id}
                                    onClick={() => setActiveSound(activeSound === sound.id ? null : sound.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${activeSound === sound.id
                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-blue-600'
                                        : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 text-gray-500 hover:border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <sound.icon className="h-4 w-4" />
                                        <span className="text-sm font-semibold">{sound.name}</span>
                                    </div>
                                    {activeSound === sound.id ? <Volume2 className="h-4 w-4 animate-pulse" /> : <VolumeX className="h-4 w-4 opacity-50" />}
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Stats/Info Section */}
                    <Card className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-500/20">
                        <h3 className="font-bold text-lg mb-2">Günün İpucu 💡</h3>
                        <p className="text-sm text-blue-50 opacity-90 leading-relaxed">
                            "Pomodoro tekniği, odaklanma süresini artırırken zihinsel yorgunluğu azaltır. Her 4 döngüde bir uzun mola vermeyi unutma!"
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
                        <div className="mt-12 flex justify-center gap-6">
                            {AMBIENT_SOUNDS.map(sound => (
                                <button
                                    key={sound.id}
                                    onClick={() => setActiveSound(activeSound === sound.id ? null : sound.id)}
                                    className={`p-4 rounded-2xl border-2 transition-all ${activeSound === sound.id
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    <sound.icon className="h-6 w-6" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ManualSessionModal
                isOpen={isManualModalOpen}
                onClose={() => { setIsManualModalOpen(false); setEditingSession(null); }}
                editingSession={editingSession}
            />
        </div>
    )
}
