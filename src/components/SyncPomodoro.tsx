import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Play, Pause, Copy, Check, LogOut as Leave, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input } from './ui-base'

type SyncSession = {
    id: string
    host_id: string
    room_code: string
    status: string
    work_time: number
    break_time: number
    current_phase: string
    phase_started_at: string | null
    created_at: string
}

type Participant = {
    user_id: string
    profiles?: { display_name: string | null, email: string }
}

function generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function SyncPomodoro() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [joinCode, setJoinCode] = useState('')
    const [copied, setCopied] = useState(false)
    const [activeSession, setActiveSession] = useState<SyncSession | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [timer, setTimer] = useState(0)
    const [timerPhase, setTimerPhase] = useState<'work' | 'break'>('work')
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const isHost = activeSession?.host_id === user?.id

    // Check for existing active session
    const { data: existingSession } = useQuery({
        queryKey: ['my_sync_session'],
        queryFn: async () => {
            // Check if user is participant in any active session
            const { data: participations } = await supabase
                .from('sync_pomodoro_participants')
                .select('session_id')
                .eq('user_id', user?.id)

            if (!participations || participations.length === 0) return null

            const sessionIds = participations.map(p => p.session_id)
            const { data: sessions } = await supabase
                .from('sync_pomodoro_sessions')
                .select('*')
                .in('id', sessionIds)
                .neq('status', 'completed')
                .limit(1)

            return sessions?.[0] || null
        },
        enabled: !!user
    })

    useEffect(() => {
        if (existingSession) setActiveSession(existingSession)
    }, [existingSession])

    // Fetch participants when session is active
    useEffect(() => {
        if (!activeSession) return

        const fetchParticipants = async () => {
            const { data } = await supabase
                .from('sync_pomodoro_participants')
                .select('user_id, profiles:user_id(display_name, email)')
                .eq('session_id', activeSession.id)
            setParticipants((data as any) || [])
        }
        fetchParticipants()

        // Subscribe to participant changes
        const channel = supabase.channel(`sync_${activeSession.id}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'sync_pomodoro_participants',
                filter: `session_id=eq.${activeSession.id}`
            }, () => fetchParticipants())
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'sync_pomodoro_sessions',
                filter: `id=eq.${activeSession.id}`
            }, (payload: any) => {
                const updated = payload.new as SyncSession
                setActiveSession(updated)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [activeSession?.id])

    // Timer logic based on phase_started_at
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'active' || !activeSession.phase_started_at) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            return
        }

        const phase = activeSession.current_phase as 'work' | 'break'
        setTimerPhase(phase)
        const totalSeconds = (phase === 'work' ? activeSession.work_time : activeSession.break_time) * 60
        const startedAt = new Date(activeSession.phase_started_at).getTime()

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, totalSeconds - elapsed)
            setTimer(remaining)

            if (remaining <= 0 && isHost) {
                // Host toggles phase
                const nextPhase = phase === 'work' ? 'break' : 'work'
                supabase.from('sync_pomodoro_sessions').update({
                    current_phase: nextPhase,
                    phase_started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', activeSession.id).then()
            }
        }

        tick()
        intervalRef.current = setInterval(tick, 1000)
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [activeSession?.status, activeSession?.phase_started_at, activeSession?.current_phase])

    // Create session
    const createMutation = useMutation({
        mutationFn: async () => {
            const code = generateRoomCode()
            const { data: session, error } = await supabase
                .from('sync_pomodoro_sessions')
                .insert({
                    host_id: user?.id,
                    room_code: code,
                    status: 'waiting',
                    work_time: 25,
                    break_time: 5
                })
                .select()
                .single()
            if (error) throw error

            // Host joins as participant
            await supabase.from('sync_pomodoro_participants').insert({
                session_id: session.id,
                user_id: user?.id
            })

            return session
        },
        onSuccess: (session) => {
            setActiveSession(session)
            queryClient.invalidateQueries({ queryKey: ['my_sync_session'] })
        }
    })

    // Join session
    const joinMutation = useMutation({
        mutationFn: async (code: string) => {
            const { data: session, error } = await supabase
                .from('sync_pomodoro_sessions')
                .select('*')
                .eq('room_code', code.toUpperCase())
                .neq('status', 'completed')
                .single()
            if (error || !session) throw new Error('Oda bulunamadı')

            const { error: joinError } = await supabase
                .from('sync_pomodoro_participants')
                .insert({ session_id: session.id, user_id: user?.id })
            if (joinError) throw joinError

            return session
        },
        onSuccess: (session) => {
            setActiveSession(session)
            setJoinCode('')
            queryClient.invalidateQueries({ queryKey: ['my_sync_session'] })
        }
    })

    // Start/Pause session (host only)
    const toggleSession = async () => {
        if (!activeSession || !isHost) return
        if (activeSession.status === 'waiting' || activeSession.status === 'paused') {
            await supabase.from('sync_pomodoro_sessions').update({
                status: 'active',
                phase_started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', activeSession.id)
        } else if (activeSession.status === 'active') {
            await supabase.from('sync_pomodoro_sessions').update({
                status: 'paused',
                updated_at: new Date().toISOString()
            }).eq('id', activeSession.id)
        }
    }

    // Leave session
    const leaveSession = async () => {
        if (!activeSession) return
        await supabase.from('sync_pomodoro_participants')
            .delete().eq('session_id', activeSession.id).eq('user_id', user?.id)

        if (isHost) {
            await supabase.from('sync_pomodoro_sessions')
                .update({ status: 'completed' }).eq('id', activeSession.id)
        }

        setActiveSession(null)
        queryClient.invalidateQueries({ queryKey: ['my_sync_session'] })
    }

    const copyCode = () => {
        if (activeSession) {
            navigator.clipboard.writeText(activeSession.room_code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }

    // Active session view
    if (activeSession) {
        return (
            <Card className="p-6 border-2 border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-500" />
                        Birlikte Pomodoro
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyCode}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors"
                        >
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {activeSession.room_code}
                        </button>
                    </div>
                </div>

                {/* Timer Display */}
                <div className="text-center py-6">
                    <span className={`text-xs font-bold uppercase tracking-wider ${timerPhase === 'work' ? 'text-purple-600' : 'text-green-600'
                        }`}>
                        {activeSession.status === 'waiting' ? 'Bekleniyor...' :
                            timerPhase === 'work' ? '🧠 Çalışma' : '☕ Mola'}
                    </span>
                    <p className={`text-6xl font-black mt-2 ${timerPhase === 'work' ? 'text-gray-900 dark:text-white' : 'text-green-600'
                        }`}>
                        {activeSession.status === 'waiting'
                            ? `${activeSession.work_time}:00`
                            : formatTime(timer)
                        }
                    </p>
                </div>

                {/* Participants */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                    {participants.map((p) => (
                        <div key={p.user_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            {(p.profiles as any)?.display_name || (p.profiles as any)?.email?.split('@')[0] || 'Kullanıcı'}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                    {isHost && (
                        <Button
                            className="flex-1"
                            onClick={toggleSession}
                        >
                            {activeSession.status === 'active' ? (
                                <><Pause className="h-4 w-4 mr-1" /> Duraklat</>
                            ) : (
                                <><Play className="h-4 w-4 mr-1 fill-current" /> Başlat</>
                            )}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        onClick={leaveSession}
                        className="text-red-500 hover:text-red-600"
                    >
                        <Leave className="h-4 w-4 mr-1" />
                        {isHost ? 'Bitir' : 'Ayrıl'}
                    </Button>
                </div>
            </Card>
        )
    }

    // Create/Join view
    return (
        <Card className="p-6">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-purple-500" />
                Birlikte Çalış
            </h3>
            <p className="text-sm text-gray-500 mb-5">
                Arkadaşlarınla senkronize Pomodoro oturumu başlat veya bir odaya katıl.
            </p>

            <div className="space-y-3">
                <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-200 dark:shadow-none"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                >
                    <Clock className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? 'Oluşturuluyor...' : 'Oda Oluştur'}
                </Button>

                <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 font-bold">veya</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                <div className="flex gap-2">
                    <Input
                        placeholder="Oda kodu gir..."
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="flex-1 text-center font-bold tracking-widest uppercase"
                        maxLength={6}
                    />
                    <Button
                        variant="secondary"
                        onClick={() => joinMutation.mutate(joinCode)}
                        disabled={joinCode.length < 4 || joinMutation.isPending}
                    >
                        Katıl
                    </Button>
                </div>

                {joinMutation.isError && (
                    <p className="text-xs text-red-500 font-semibold text-center">Oda bulunamadı veya kapandı.</p>
                )}
            </div>
        </Card>
    )
}
