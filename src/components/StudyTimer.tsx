import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, RefreshCw, Timer as TimerIcon, Watch, Coffee, Brain } from 'lucide-react'
import { Button, Card } from './ui-base'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type TimerMode = 'stopwatch' | 'pomodoro'

export default function StudyTimer() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [mode, setMode] = useState<TimerMode>('stopwatch')
    const [isActive, setIsActive] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const [selectedCourseId, setSelectedCourseId] = useState<string>('')
    const [note, setNote] = useState('')
    const startTimeRef = useRef<Date | null>(null)

    // Pomodoro settings
    const POMODORO_TIME = 25 * 60
    const SHORT_BREAK = 5 * 60
    const LONG_BREAK = 15 * 60
    const [remainingTime, setRemainingTime] = useState(POMODORO_TIME)
    const [pomodoroMode, setPomodoroMode] = useState<'work' | 'short_break' | 'long_break'>('work')
    const [cycles, setCycles] = useState(0)

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('id, name, code, color')
            return data || []
        }
    })

    const playNotification = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        audio.play().catch(e => console.log('Audio play failed:', e))
    }

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null

        if (isActive) {
            if (mode === 'stopwatch') {
                interval = setInterval(() => {
                    setSeconds(s => s + 1)
                }, 1000)
            } else {
                interval = setInterval(() => {
                    setRemainingTime((prev) => {
                        if (prev <= 1) {
                            playNotification()
                            if (pomodoroMode === 'work') {
                                const newCycles = cycles + 1
                                setCycles(newCycles)
                                if (newCycles % 4 === 0) {
                                    setPomodoroMode('long_break')
                                    setRemainingTime(LONG_BREAK)
                                } else {
                                    setPomodoroMode('short_break')
                                    setRemainingTime(SHORT_BREAK)
                                }
                                alert('Çalışma seansı bitti! Mola vakti. ☕')
                            } else {
                                setPomodoroMode('work')
                                setRemainingTime(POMODORO_TIME)
                                alert('Mola bitti! Odaklanma vakti. 🧠')
                            }
                            return 0
                        }
                        return prev - 1
                    })
                }, 1000)
            }
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isActive, mode, pomodoroMode, cycles])

    const toggleTimer = () => {
        if (!isActive && mode === 'stopwatch' && seconds === 0) {
            startTimeRef.current = new Date()
        } else if (!isActive && mode === 'pomodoro' && pomodoroMode === 'work') {
            startTimeRef.current = new Date()
        }
        setIsActive(!isActive)
    }

    const resetTimer = () => {
        setIsActive(false)
        setSeconds(0)
        setRemainingTime(POMODORO_TIME)
        setPomodoroMode('work')
        setCycles(0)
        startTimeRef.current = null
    }

    const saveSession = async () => {
        if (!user || !selectedCourseId) {
            alert('Lütfen bir ders seçin!')
            return
        }

        const duration = mode === 'stopwatch'
            ? seconds
            : (pomodoroMode !== 'work' ? 0 : (POMODORO_TIME - remainingTime))

        if (duration < 10) { // Reduced for testing/quick save
            if (!window.confirm('Çalışma süresi çok kısa. Yine de kaydetmek istiyor musunuz?')) return
        }

        try {
            const endTime = new Date()
            const startTime = startTimeRef.current || new Date(endTime.getTime() - duration * 1000)

            const { error } = await supabase.from('study_sessions').insert({
                user_id: user.id,
                course_id: selectedCourseId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration: duration,
                note: note
            })

            if (error) throw error

            alert('Çalışma başarıyla kaydedildi! 🎉')
            if (mode === 'stopwatch') {
                resetTimer()
            } else {
                // In Pomodoro, we might want to keep the cycle going
                setNote('')
                startTimeRef.current = null
            }
            queryClient.invalidateQueries({ queryKey: ['study_sessions'] })
            queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
        } catch (error) {
            console.error('Error saving session:', error)
            alert('Kayıt hatası: ' + (error as any).message)
        }
    }

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)
        const s = totalSeconds % 60
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
        <Card className="p-6">
            <div className="flex justify-center space-x-4 mb-6">
                <Button
                    variant={mode === 'stopwatch' ? 'primary' : 'ghost'}
                    onClick={() => { setMode('stopwatch'); resetTimer(); }}
                    className="w-1/2"
                >
                    <Watch className="mr-2 h-4 w-4" />
                    Kronometre
                </Button>
                <Button
                    variant={mode === 'pomodoro' ? 'primary' : 'ghost'}
                    onClick={() => { setMode('pomodoro'); resetTimer(); }}
                    className="w-1/2"
                >
                    <TimerIcon className="mr-2 h-4 w-4" />
                    Pomodoro
                </Button>
            </div>

            <div className="text-center mb-8">
                <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white mb-2">
                    {mode === 'stopwatch' ? formatTime(seconds) : formatTime(remainingTime)}
                </div>
                <div className="flex items-center justify-center gap-2 text-gray-500">
                    {mode === 'pomodoro' && (
                        <>
                            {pomodoroMode === 'work' ? <Brain className="h-4 w-4 text-blue-500" /> : <Coffee className="h-4 w-4 text-emerald-500" />}
                            <span className="font-medium text-sm">
                                {pomodoroMode === 'work' ? 'Odaklanma Zamanı' :
                                    pomodoroMode === 'short_break' ? 'Kısa Mola' : 'Uzun Mola'}
                            </span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                                {cycles}. Döngü
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Çalışılan Ders
                    </label>
                    <select
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                    >
                        <option value="">Ders Seçin...</option>
                        {courses?.map(course => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Not (Opsiyonel)
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                        placeholder="Ne üzerine çalıştın?"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <div className="flex space-x-3 pt-2">
                    {!isActive ? (
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={toggleTimer}>
                            <Play className="mr-2 h-5 w-5" /> Başlat
                        </Button>
                    ) : (
                        <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600" onClick={toggleTimer}>
                            <Pause className="mr-2 h-5 w-5" /> Duraklat
                        </Button>
                    )}

                    <Button variant="secondary" onClick={resetTimer} disabled={isActive}>
                        <RefreshCw className="h-5 w-5" />
                    </Button>

                    <Button variant="danger" onClick={saveSession} disabled={isActive || (mode === 'stopwatch' ? seconds === 0 : remainingTime === POMODORO_TIME)}>
                        <Square className="mr-2 h-5 w-5" /> Bitir & Kaydet
                    </Button>
                </div>
            </div>
        </Card>
    )
}
