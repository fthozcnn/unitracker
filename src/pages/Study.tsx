import { useState, useEffect, useRef, useCallback } from 'react'
import StudyTimer from '../components/StudyTimer'
import SyncPomodoro from '../components/SyncPomodoro'
import ManualSessionModal from '../components/ManualSessionModal'
import { Button, Card } from '../components/ui-base'
import { Plus, Edit2, Trash2, Wind, CloudRain, Music, Maximize2, Minimize2, Volume2, VolumeX, Coffee } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const AMBIENT_SOUNDS = [
    { id: 'lofi', name: 'Lo-Fi Müzik', icon: Music },
    { id: 'rain', name: 'Yağmur', icon: CloudRain },
    { id: 'forest', name: 'Doğa', icon: Wind },
    { id: 'cafe', name: 'Kütüphane / Kafe', icon: Coffee }
]

function createAmbientSound(ctx: AudioContext, type: string): { nodes: AudioNode[], stop: () => void } {
    const nodes: AudioNode[] = []
    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.35
    gainNode.connect(ctx.destination)
    nodes.push(gainNode)

    if (type === 'rain') {
        // Rain: filtered white noise with bandpass
        const bufferSize = 2 * ctx.sampleRate
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true

        const bandpass = ctx.createBiquadFilter()
        bandpass.type = 'bandpass'
        bandpass.frequency.value = 1800
        bandpass.Q.value = 0.4

        const highpass = ctx.createBiquadFilter()
        highpass.type = 'highpass'
        highpass.frequency.value = 400

        source.connect(highpass)
        highpass.connect(bandpass)
        bandpass.connect(gainNode)
        source.start()
        nodes.push(source, bandpass, highpass)

        // Add subtle low rumble
        const rumbleBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const rumbleData = rumbleBuffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) rumbleData[i] = Math.random() * 2 - 1
        const rumbleSource = ctx.createBufferSource()
        rumbleSource.buffer = rumbleBuffer
        rumbleSource.loop = true
        const lowpass = ctx.createBiquadFilter()
        lowpass.type = 'lowpass'
        lowpass.frequency.value = 200
        const rumbleGain = ctx.createGain()
        rumbleGain.gain.value = 0.15
        rumbleSource.connect(lowpass)
        lowpass.connect(rumbleGain)
        rumbleGain.connect(gainNode)
        rumbleSource.start()
        nodes.push(rumbleSource, lowpass, rumbleGain)

    } else if (type === 'forest') {
        // Forest: layered filtered noise for wind + birds chirps
        const bufferSize = 2 * ctx.sampleRate
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true

        const windFilter = ctx.createBiquadFilter()
        windFilter.type = 'lowpass'
        windFilter.frequency.value = 600
        windFilter.Q.value = 1.0

        const windGain = ctx.createGain()
        windGain.gain.value = 0.5

        source.connect(windFilter)
        windFilter.connect(windGain)
        windGain.connect(gainNode)
        source.start()
        nodes.push(source, windFilter, windGain)

        // LFO to modulate wind
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.15
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 200
        lfo.connect(lfoGain)
        lfoGain.connect(windFilter.frequency)
        lfo.start()
        nodes.push(lfo, lfoGain)

        // Simulated bird chirps using high-freq oscillators
        const birdGain = ctx.createGain()
        birdGain.gain.value = 0.06
        birdGain.connect(gainNode)
        const birdOsc = ctx.createOscillator()
        birdOsc.type = 'sine'
        birdOsc.frequency.value = 3200
        const birdLfo = ctx.createOscillator()
        birdLfo.frequency.value = 5
        const birdLfoGain = ctx.createGain()
        birdLfoGain.gain.value = 800
        birdLfo.connect(birdLfoGain)
        birdLfoGain.connect(birdOsc.frequency)
        birdOsc.connect(birdGain)
        birdOsc.start()
        birdLfo.start()
        nodes.push(birdOsc, birdLfo, birdLfoGain, birdGain)

    } else if (type === 'cafe') {
        // Cafe: brownian noise for warm ambient chatter
        const bufferSize = 4 * ctx.sampleRate
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1
            data[i] = (last + (0.02 * white)) / 1.02
            last = data[i]
            data[i] *= 3.5
        }

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 800
        filter.Q.value = 0.3

        source.connect(filter)
        filter.connect(gainNode)
        source.start()
        nodes.push(source, filter)

        // Add subtle "clink" texture with high frequency sparkle
        const sparkleBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const sparkleData = sparkleBuffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) sparkleData[i] = Math.random() * 2 - 1
        const sparkleSource = ctx.createBufferSource()
        sparkleSource.buffer = sparkleBuffer
        sparkleSource.loop = true
        const sparkleFilter = ctx.createBiquadFilter()
        sparkleFilter.type = 'highpass'
        sparkleFilter.frequency.value = 3000
        const sparkleGain = ctx.createGain()
        sparkleGain.gain.value = 0.04
        sparkleSource.connect(sparkleFilter)
        sparkleFilter.connect(sparkleGain)
        sparkleGain.connect(gainNode)
        sparkleSource.start()
        nodes.push(sparkleSource, sparkleFilter, sparkleGain)

    } else if (type === 'lofi') {
        // Lo-Fi: warm chord oscillators with subtle wow/flutter
        const chordFreqs = [130.81, 164.81, 196.0, 261.63] // C3, E3, G3, C4

        chordFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = freq

            const oscGain = ctx.createGain()
            oscGain.gain.value = 0.12 - i * 0.02

            // Add warmth with lowpass
            const warmFilter = ctx.createBiquadFilter()
            warmFilter.type = 'lowpass'
            warmFilter.frequency.value = 800

            // Subtle vibrato
            const vibrato = ctx.createOscillator()
            vibrato.frequency.value = 0.3 + i * 0.1
            const vibratoGain = ctx.createGain()
            vibratoGain.gain.value = 2
            vibrato.connect(vibratoGain)
            vibratoGain.connect(osc.frequency)

            osc.connect(warmFilter)
            warmFilter.connect(oscGain)
            oscGain.connect(gainNode)
            osc.start()
            vibrato.start()
            nodes.push(osc, oscGain, warmFilter, vibrato, vibratoGain)
        })

        // Tape hiss
        const hissBuffer = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate)
        const hissData = hissBuffer.getChannelData(0)
        for (let i = 0; i < hissBuffer.length; i++) hissData[i] = Math.random() * 2 - 1
        const hissSource = ctx.createBufferSource()
        hissSource.buffer = hissBuffer
        hissSource.loop = true
        const hissFilter = ctx.createBiquadFilter()
        hissFilter.type = 'highpass'
        hissFilter.frequency.value = 4000
        const hissGain = ctx.createGain()
        hissGain.gain.value = 0.02
        hissSource.connect(hissFilter)
        hissFilter.connect(hissGain)
        hissGain.connect(gainNode)
        hissSource.start()
        nodes.push(hissSource, hissFilter, hissGain)
    }

    return {
        nodes,
        stop: () => {
            gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime)
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
            setTimeout(() => {
                nodes.forEach(n => {
                    try {
                        if ('stop' in n && typeof (n as any).stop === 'function') (n as any).stop()
                    } catch (e) { /* already stopped */ }
                    try { n.disconnect() } catch (e) { /* ok */ }
                })
            }, 600)
        }
    }
}

export default function Study() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [editingSession, setEditingSession] = useState<any>(null)
    const [isZenMode, setIsZenMode] = useState(false)
    const [activeSound, setActiveSound] = useState<string | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const soundRef = useRef<{ stop: () => void } | null>(null)

    const toggleSound = useCallback((soundId: string) => {
        // Stop current sound
        if (soundRef.current) {
            soundRef.current.stop()
            soundRef.current = null
        }

        if (activeSound === soundId) {
            setActiveSound(null)
            if (audioCtxRef.current) {
                audioCtxRef.current.close()
                audioCtxRef.current = null
            }
            return
        }

        // Start new sound
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const result = createAmbientSound(ctx, soundId)
        soundRef.current = result
        setActiveSound(soundId)
    }, [activeSound])

    useEffect(() => {
        return () => {
            if (soundRef.current) soundRef.current.stop()
            if (audioCtxRef.current) audioCtxRef.current.close()
        }
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

                {/* Ambient Sounds Section */}
                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Sync Pomodoro */}
                    <SyncPomodoro />

                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Volume2 className="h-5 w-5 text-blue-500" />
                            <h3 className="font-bold text-gray-900 dark:text-white">Odaklanma Sesleri</h3>
                        </div>
                        <div className="space-y-3">
                            {AMBIENT_SOUNDS.map((sound) => (
                                <button
                                    key={sound.id}
                                    onClick={() => toggleSound(sound.id)}
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
                                    onClick={() => toggleSound(sound.id)}
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
