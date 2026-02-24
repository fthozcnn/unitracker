import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Input } from './ui-base'
import { Swords, Clock, X, Check, Coffee, Flag, Zap, Wifi, WifiOff, Send } from 'lucide-react'
import clsx from 'clsx'
import { triggerSuccessConfetti } from '../lib/confetti'
import { addXP, XP_REWARDS } from '../lib/xpSystem'

type Duel = {
    id: string
    challenger_id: string
    opponent_id: string
    status: 'pending' | 'active' | 'finished' | 'declined'
    duration_minutes: number
    started_at: string | null
    finished_at: string | null
    winner_id: string | null
    created_at: string
    challenger_name?: string
    opponent_name?: string
}

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

const REACTIONS = ['👊', '💪', '😤', '🔥', '😂', '😴']

// ─── Game Over Screen ───────────────────────────────────────────────────────
function GameOverScreen({ iWon, opponentName, myElapsed, reason, onClose }: {
    iWon: boolean; opponentName?: string; myElapsed: number; reason: string; onClose: () => void
}) {
    const reasonLabels: Record<string, string> = {
        surrender: 'pes etti',
        disconnect: '60 sn bağlantısı kesildi',
        opponent_surrender: 'sen pes ettin',
    }
    return (
        <Card className="p-8 text-center space-y-5 border-2 border-opacity-50" style={{ borderColor: iWon ? '#f59e0b' : '#ef4444' }}>
            <div className="text-6xl">{iWon ? '🏆' : '😤'}</div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {iWon ? 'Zafer Senindir!' : 'Düelloyu Kaybettin'}
            </h2>
            <p className="text-sm text-gray-500">
                {iWon
                    ? `${opponentName} ${reasonLabels[reason] || 'durdu'} — sen kazandın!`
                    : `${opponentName} daha uzun dayanıp kazandı.`}
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 inline-block mx-auto">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Toplam Çalışma</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">{formatTime(myElapsed)}</p>
            </div>
            {iWon && <p className="text-green-600 font-black text-sm">+75 XP kazandın! 🎉</p>}
            <Button onClick={onClose} className="w-full">Kapat</Button>
        </Card>
    )
}

// ─── Active Duel ────────────────────────────────────────────────────────────
function ActiveDuel({ duel, onFinished }: { duel: Duel; onFinished: () => void }) {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const isChallenger = user?.id === duel.challenger_id
    const opponentName = isChallenger ? duel.opponent_name : duel.challenger_name
    const opponentId = isChallenger ? duel.opponent_id : duel.challenger_id

    // Stopwatch
    const [myElapsed, setMyElapsed] = useState(0)
    const myElapsedRef = useRef(0)
    const [opponentElapsed, setOpponentElapsed] = useState(0)

    // Break state
    const isOnBreakRef = useRef(false)
    const [isOnBreak, setIsOnBreak] = useState(false)
    const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null)
    const [breakTimeLeft, setBreakTimeLeft] = useState(0)
    const [incomingBreak, setIncomingBreak] = useState<{ fromName: string; minutes: number } | null>(null)
    const [showBreakInput, setShowBreakInput] = useState(false)
    const [breakMinutes, setBreakMinutes] = useState('5')
    const [breakStatus, setBreakStatus] = useState<'idle' | 'waiting' | 'rejected'>('idle')

    // Opponent connectivity
    const [opponentAlive, setOpponentAlive] = useState(true)
    const [opponentOnBreak, setOpponentOnBreak] = useState(false)
    const lastHeartbeatRef = useRef(Date.now())

    // Reactions
    const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; fromMe: boolean }[]>([])
    const reactionIdRef = useRef(0)

    // Game over
    const [gameOver, setGameOver] = useState<{ winnerId: string; reason: string } | null>(null)

    const channelRef = useRef<any>(null)

    // ── My timer ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (gameOver) return
        const interval = setInterval(() => {
            if (!isOnBreakRef.current) {
                setMyElapsed(prev => {
                    myElapsedRef.current = prev + 1
                    return prev + 1
                })
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [gameOver])

    // ── Break countdown ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!breakEndsAt) return
        const interval = setInterval(() => {
            const left = Math.max(0, Math.floor((breakEndsAt - Date.now()) / 1000))
            setBreakTimeLeft(left)
            if (left === 0) {
                setIsOnBreak(false)
                isOnBreakRef.current = false
                setBreakEndsAt(null)
            }
        }, 500)
        return () => clearInterval(interval)
    }, [breakEndsAt])

    // ── Heartbeat sent every 5s ──────────────────────────────────────────────
    useEffect(() => {
        if (gameOver) return
        const interval = setInterval(() => {
            channelRef.current?.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: { user_id: user?.id, elapsed: myElapsedRef.current, on_break: isOnBreakRef.current }
            })
        }, 5000)
        return () => clearInterval(interval)
    }, [gameOver, user?.id])

    // ── Opponent disconnect watchdog ─────────────────────────────────────────
    useEffect(() => {
        if (gameOver) return
        const interval = setInterval(() => {
            const gap = Date.now() - lastHeartbeatRef.current
            if (gap > 30000) setOpponentAlive(false)
            if (gap > 60000 && !gameOver) {
                handleGameOver(user!.id, 'disconnect')
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [gameOver])

    // ── Realtime channel ─────────────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase.channel(`duel_v2_${duel.id}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'heartbeat' }, ({ payload }: any) => {
                if (payload.user_id === user?.id) return
                setOpponentElapsed(payload.elapsed ?? 0)
                setOpponentOnBreak(payload.on_break ?? false)
                setOpponentAlive(true)
                lastHeartbeatRef.current = Date.now()
            })
            .on('broadcast', { event: 'break_request' }, ({ payload }: any) => {
                if (payload.from_user_id === user?.id) return
                setIncomingBreak({ fromName: payload.from_name, minutes: payload.minutes })
            })
            .on('broadcast', { event: 'break_approved' }, ({ payload }: any) => {
                const until = new Date(payload.break_until).getTime()
                setIsOnBreak(true)
                isOnBreakRef.current = true
                setBreakEndsAt(until)
                setIncomingBreak(null)
                setBreakStatus('idle')
            })
            .on('broadcast', { event: 'break_rejected' }, () => {
                setIncomingBreak(null)
                setBreakStatus('rejected')
                setTimeout(() => setBreakStatus('idle'), 3000)
            })
            .on('broadcast', { event: 'surrender' }, ({ payload }: any) => {
                if (payload.user_id !== user?.id) {
                    handleGameOver(user!.id, 'surrender')
                }
            })
            .on('broadcast', { event: 'reaction' }, ({ payload }: any) => {
                if (payload.user_id === user?.id) return
                pushReaction(payload.emoji, false)
            })
            .subscribe()

        // Send first heartbeat immediately
        setTimeout(() => {
            channel.send({ type: 'broadcast', event: 'heartbeat', payload: { user_id: user?.id, elapsed: 0, on_break: false } })
        }, 1000)

        return () => { supabase.removeChannel(channel) }
    }, [duel.id, user?.id])

    // ── Helpers ──────────────────────────────────────────────────────────────
    const handleGameOver = async (winnerId: string, reason: string) => {
        if (gameOver) return // prevent double-fire
        setGameOver({ winnerId, reason })
        if (winnerId === user?.id) triggerSuccessConfetti()

        await supabase.from('study_duels').update({
            status: 'finished',
            finished_at: new Date().toISOString(),
            winner_id: winnerId,
            loser_stopped_at: reason !== 'disconnect' ? new Date().toISOString() : null,
        }).eq('id', duel.id)

        if (winnerId === user?.id) {
            await supabase.rpc('award_duel_xp', { winner_user_id: winnerId, xp_amount: 75 })
        }
        queryClient.invalidateQueries({ queryKey: ['my_duels'] })
    }

    const handleSurrender = () => {
        if (!window.confirm('Gerçekten pes etmek istiyor musun? Rakibin kazanacak! 🏳')) return
        channelRef.current?.send({ type: 'broadcast', event: 'surrender', payload: { user_id: user?.id } })
        handleGameOver(opponentId, 'opponent_surrender')
    }

    const sendBreakRequest = () => {
        const mins = Math.max(1, Math.min(60, parseInt(breakMinutes) || 5))
        channelRef.current?.send({
            type: 'broadcast', event: 'break_request',
            payload: { from_user_id: user?.id, from_name: user?.email?.split('@')[0], minutes: mins }
        })
        setShowBreakInput(false)
        setBreakStatus('waiting')
    }

    const approveBreak = () => {
        const breakUntil = new Date(Date.now() + parseInt(breakMinutes || '5') * 60000)
        // Use the requested minutes from incomingBreak
        const until = new Date(Date.now() + (incomingBreak?.minutes || 5) * 60000)
        channelRef.current?.send({
            type: 'broadcast', event: 'break_approved',
            payload: { break_until: until.toISOString() }
        })
        setIsOnBreak(true)
        isOnBreakRef.current = true
        setBreakEndsAt(until.getTime())
        setIncomingBreak(null)
    }

    const rejectBreak = () => {
        channelRef.current?.send({ type: 'broadcast', event: 'break_rejected', payload: {} })
        setIncomingBreak(null)
    }

    const pushReaction = (emoji: string, fromMe: boolean) => {
        const id = ++reactionIdRef.current
        setFloatingReactions(prev => [...prev, { id, emoji, fromMe }])
        setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 2500)
    }

    const sendReaction = (emoji: string) => {
        channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { user_id: user?.id, emoji } })
        pushReaction(emoji, true)
    }

    // ── Game over screen ─────────────────────────────────────────────────────
    if (gameOver) {
        return (
            <GameOverScreen
                iWon={gameOver.winnerId === user?.id}
                opponentName={opponentName}
                myElapsed={myElapsed}
                reason={gameOver.reason}
                onClose={onFinished}
            />
        )
    }

    // ── Active duel UI ───────────────────────────────────────────────────────
    return (
        <Card className="p-5 space-y-5 relative border-2 border-indigo-100 dark:border-indigo-900/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-center gap-3">
                <Swords className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Düello Devam Ediyor
                </span>
            </div>

            {/* Break Banner */}
            {isOnBreak && breakEndsAt && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3 text-center animate-pulse">
                    <p className="text-amber-700 dark:text-amber-400 font-black text-sm flex items-center justify-center gap-2">
                        <Coffee className="h-4 w-4" />
                        ORTAK MOLA — <span className="font-mono text-base">{formatTime(breakTimeLeft)}</span> kaldı
                    </p>
                </div>
            )}

            {/* Timers */}
            <div className="grid grid-cols-2 gap-3">
                {/* Me */}
                <div className={clsx(
                    'flex flex-col items-center p-4 rounded-2xl space-y-1 transition-all',
                    isOnBreak ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-green-50 dark:bg-green-900/10'
                )}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sen</span>
                    <p className={clsx('text-3xl font-black font-mono tracking-tight', isOnBreak ? 'text-amber-600' : 'text-green-600')}>
                        {formatTime(myElapsed)}
                    </p>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', isOnBreak
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600')}>
                        {isOnBreak ? '☕ Mola' : '🟢 Aktif'}
                    </span>
                </div>

                {/* Opponent */}
                <div className={clsx(
                    'flex flex-col items-center p-4 rounded-2xl space-y-1 transition-all',
                    !opponentAlive ? 'bg-red-50 dark:bg-red-900/10'
                        : opponentOnBreak ? 'bg-amber-50 dark:bg-amber-900/10'
                            : 'bg-blue-50 dark:bg-blue-900/10'
                )}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate max-w-full">{opponentName}</span>
                    <p className={clsx('text-3xl font-black font-mono tracking-tight',
                        !opponentAlive ? 'text-red-400' : opponentOnBreak ? 'text-amber-600' : 'text-blue-600')}>
                        {opponentElapsed > 0 ? formatTime(opponentElapsed) : '--:--'}
                    </p>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full',
                        !opponentAlive ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                            : opponentOnBreak ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600')}>
                        {!opponentAlive
                            ? <span className="flex items-center gap-1"><WifiOff className="h-3 w-3" />Bağlantı yok</span>
                            : opponentOnBreak ? '☕ Mola' : <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />Aktif</span>}
                    </span>
                </div>
            </div>

            {/* Floating reactions */}
            {floatingReactions.length > 0 && (
                <div className="flex justify-center gap-3 h-8 relative">
                    {floatingReactions.map(r => (
                        <span
                            key={r.id}
                            className={clsx(
                                'text-2xl animate-bounce absolute',
                                r.fromMe ? 'left-1/4' : 'right-1/4'
                            )}
                        >
                            {r.emoji}
                        </span>
                    ))}
                </div>
            )}

            {/* Emoji reactions */}
            <div className="flex justify-center gap-2">
                {REACTIONS.map(emoji => (
                    <button
                        key={emoji}
                        onClick={() => sendReaction(emoji)}
                        className="text-xl hover:scale-125 transition-transform active:scale-95 p-1"
                        title="Reaksiyon gönder"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Incoming break request */}
            {incomingBreak && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Coffee className="h-4 w-4" />
                        {incomingBreak.fromName} <span className="font-black">{incomingBreak.minutes} dakika</span> mola istiyor
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={approveBreak}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors"
                        >
                            <Check className="h-4 w-4" /> Onayla
                        </button>
                        <button
                            onClick={rejectBreak}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
                        >
                            <X className="h-4 w-4" /> Reddet
                        </button>
                    </div>
                </div>
            )}

            {/* Break request status */}
            {breakStatus === 'waiting' && !incomingBreak && (
                <div className="text-center py-2 text-sm font-bold text-amber-600 animate-pulse">
                    ☕ Mola isteği gönderildi, bekleniyor…
                </div>
            )}
            {breakStatus === 'rejected' && (
                <div className="text-center py-2 text-sm font-bold text-red-500">
                    ❌ Mola isteği reddedildi!
                </div>
            )}

            {/* Break input */}
            {showBreakInput && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wide">Kaç dakika mola?</p>
                    <div className="flex gap-2">
                        {[5, 10, 15].map(m => (
                            <button
                                key={m}
                                onClick={() => setBreakMinutes(String(m))}
                                className={clsx('flex-1 py-2 rounded-xl text-sm font-bold transition-all',
                                    breakMinutes === String(m)
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300')}
                            >
                                {m} dk
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            value={breakMinutes}
                            onChange={e => setBreakMinutes(e.target.value)}
                            className="flex-1 h-9 text-sm"
                            placeholder="Özel dk"
                            min={1}
                            max={60}
                        />
                        <button
                            onClick={sendBreakRequest}
                            className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors flex items-center gap-1.5"
                        >
                            <Send className="h-3.5 w-3.5" /> Gönder
                        </button>
                        <button
                            onClick={() => setShowBreakInput(false)}
                            className="p-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            <X className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            {!showBreakInput && !incomingBreak && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                        onClick={() => { setShowBreakInput(true); setBreakStatus('idle') }}
                        disabled={isOnBreak || breakStatus === 'waiting'}
                        className={clsx(
                            'flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all',
                            isOnBreak || breakStatus === 'waiting'
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                        )}
                    >
                        <Coffee className="h-4 w-4" />
                        Mola İste
                    </button>
                    <button
                        onClick={handleSurrender}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
                    >
                        <Flag className="h-4 w-4" />
                        Pes Et
                    </button>
                </div>
            )}

            <p className="text-[10px] text-center text-gray-400 font-medium">
                ⚔ Kim önce durursa kaybeder — 60 sn bağlantı kesilirse otomatik yenilgi
            </p>
        </Card>
    )
}

// ─── Main StudyDuel Component ────────────────────────────────────────────────
interface StudyDuelProps {
    friends: { id: string; display_name?: string; email?: string }[]
}

export default function StudyDuel({ friends }: StudyDuelProps) {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null)
    const [selectedFriend, setSelectedFriend] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Enrich a duel with display names from friends
    const enrichDuel = (d: any): Duel => {
        const myName = profile?.display_name || user?.email?.split('@')[0] || 'Sen'
        const findName = (uid: string) => {
            if (uid === user?.id) return myName
            const f = friends.find(fr => fr.id === uid)
            return f?.display_name || f?.email?.split('@')[0] || uid.slice(0, 6)
        }
        return {
            ...d,
            challenger_name: findName(d.challenger_id),
            opponent_name: findName(d.opponent_id),
        }
    }

    // Fetch duels
    const { data: duels = [], error: duelsError } = useQuery<Duel[]>({
        queryKey: ['my_duels'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('study_duels')
                .select('id,challenger_id,opponent_id,status,duration_minutes,started_at,finished_at,winner_id,created_at')
                .or(`challenger_id.eq.${user?.id},opponent_id.eq.${user?.id}`)
                .order('created_at', { ascending: false })
            if (error) throw error
            return (data || []).map(enrichDuel)
        },
        refetchInterval: 10000,
    })

    const pendingReceived = duels.filter(d => d.status === 'pending' && d.opponent_id === user?.id)
    const pendingSent = duels.filter(d => d.status === 'pending' && d.challenger_id === user?.id)
    const finishedDuels = duels.filter(d => d.status === 'finished')
    const myActiveDuel = duels.find(d => d.status === 'active')

    // Open active duel screen
    useEffect(() => {
        if (myActiveDuel && !activeDuel) setActiveDuel(myActiveDuel)
    }, [myActiveDuel])

    // Send duel invite
    const sendMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFriend) throw new Error('Bir arkadaş seçmelisin')
            const { error } = await supabase.from('study_duels').insert({
                challenger_id: user?.id,
                opponent_id: selectedFriend,
                status: 'pending',
                duration_minutes: 0,
            })
            if (error) throw error
        },
        onSuccess: () => {
            setSuccessMsg('Meydan okuma gönderildi! ⚔')
            setSelectedFriend('')
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
            setTimeout(() => setSuccessMsg(''), 3000)
        },
        onError: (err: any) => {
            setErrorMsg(err.message?.includes('does not exist')
                ? '⚠ Veritabanı tablosu bulunamadı. supabase_study_duel.sql scriptini çalıştır.'
                : err.message || 'Bir hata oluştu.')
        }
    })

    const respondMutation = useMutation({
        mutationFn: async ({ duelId, accept }: { duelId: string; accept: boolean }) => {
            if (accept) {
                const { error } = await supabase.from('study_duels').update({
                    status: 'active',
                    started_at: new Date().toISOString(),
                }).eq('id', duelId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('study_duels').update({ status: 'declined' }).eq('id', duelId)
                if (error) throw error
            }
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
        }
    })

    // If there's an active duel, show it
    if (activeDuel) {
        return <ActiveDuel duel={activeDuel} onFinished={() => {
            setActiveDuel(null)
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
        }} />
    }

    return (
        <div className="space-y-6">
            {/* Error / Success banners */}
            {duelsError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-600 font-semibold border border-red-200 dark:border-red-800">
                    ⚠ Düellolar yüklenemedi — supabase_study_duel.sql scriptini Supabase'de çalıştırdın mı?
                </div>
            )}
            {errorMsg && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-600 font-semibold border border-red-200 dark:border-red-800">{errorMsg}</div>}
            {successMsg && <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-sm text-green-600 font-semibold border border-green-200 dark:border-green-800">{successMsg}</div>}

            {/* How it works */}
            <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-2 mb-2">
                    <Swords className="h-5 w-5 text-indigo-500" />
                    <h3 className="font-black text-gray-900 dark:text-white">Düello Modu</h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    ⚔ <strong>Kim önce durursa kaybeder!</strong> İki taraf aynı anda çalışmaya başlar.
                    Mola istemek istersen <strong>Mola İste</strong> butonuyla karşı taraftan onay al.
                    Kazanana <strong className="text-indigo-600">+75 XP</strong>!
                </p>
            </Card>

            {/* Challenge a friend */}
            <Card className="p-5 space-y-4">
                <h3 className="font-black text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Meydan Oku
                </h3>
                <select
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedFriend}
                    onChange={e => setSelectedFriend(e.target.value)}
                >
                    <option value="">Arkadaş seç…</option>
                    {friends.map(f => (
                        <option key={f.id} value={f.id}>{f.display_name || f.email?.split('@')[0]}</option>
                    ))}
                </select>
                <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => sendMutation.mutate()}
                    disabled={!selectedFriend || sendMutation.isPending}
                >
                    {sendMutation.isPending ? 'Gönderiliyor…' : '⚔ Meydan Oku!'}
                </Button>
            </Card>

            {/* Incoming invites */}
            {pendingReceived.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Gelen Meydan Okumalar</p>
                    {pendingReceived.map(d => (
                        <Card key={d.id} className="p-4 border-l-4 border-indigo-500">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Swords className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{d.challenger_name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">⚔ Dayanıklılık Düellosu</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => respondMutation.mutate({ duelId: d.id, accept: true })}
                                        className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => respondMutation.mutate({ duelId: d.id, accept: false })}
                                        className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Sent pending */}
            {pendingSent.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Bekleyen Davetler</p>
                    {pendingSent.map(d => (
                        <Card key={d.id} className="p-4 flex items-center gap-3 opacity-70">
                            <Clock className="h-4 w-4 text-gray-400 animate-spin-slow" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                                    {d.opponent_name} yanıt bekliyor…
                                </p>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* History */}
            {finishedDuels.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Düello Geçmişi</p>
                    {finishedDuels.slice(0, 5).map(d => {
                        const iWon = d.winner_id === user?.id
                        const opponentName = d.challenger_id === user?.id ? d.opponent_name : d.challenger_name
                        return (
                            <Card key={d.id} className={clsx('p-4 flex items-center justify-between', iWon ? 'border-l-4 border-amber-400' : 'border-l-4 border-gray-300')}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl">{iWon ? '🏆' : '😤'}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{opponentName}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">⚔ Dayanıklılık Modu</p>
                                    </div>
                                </div>
                                <div className={clsx('text-xs font-black px-2 py-1 rounded-lg', iWon ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400')}>
                                    {iWon ? '+75 XP' : 'Kayıp'}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
