import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button } from './ui-base'
import { Swords, Clock, X, Check, Timer } from 'lucide-react'
import clsx from 'clsx'

const DURATION_OPTIONS = [15, 25, 45]

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
    challenger?: { display_name: string | null; email: string }
    opponent?: { display_name: string | null; email: string }
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

// --- Active Duel Screen ---
function ActiveDuel({ duel, onFinished }: { duel: Duel; onFinished: () => void }) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const totalSeconds = duel.duration_minutes * 60
    const startedAt = duel.started_at ? new Date(duel.started_at).getTime() : Date.now()

    const [myElapsed, setMyElapsed] = useState(0)
    const [opponentElapsed, setOpponentElapsed] = useState(0)
    const [finished, setFinished] = useState(false)
    const channelRef = useRef<any>(null)

    const isChallenger = user?.id === duel.challenger_id
    const opponent = isChallenger ? duel.opponent : duel.challenger
    const opponentId = isChallenger ? duel.opponent_id : duel.challenger_id

    // Local timer
    useEffect(() => {
        if (finished) return
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            setMyElapsed(Math.min(elapsed, totalSeconds))
            if (elapsed >= totalSeconds) {
                setFinished(true)
                clearInterval(interval)
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [startedAt, totalSeconds, finished])

    // Broadcast my elapsed + receive opponent elapsed via Supabase Realtime
    useEffect(() => {
        const channel = supabase.channel(`duel_${duel.id}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'tick' }, (payload: any) => {
                if (payload.payload?.user_id !== user?.id) {
                    setOpponentElapsed(payload.payload?.elapsed ?? 0)
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [duel.id, user?.id])

    // Broadcast my timer every second
    useEffect(() => {
        if (!channelRef.current || finished) return
        const interval = setInterval(() => {
            channelRef.current?.send({
                type: 'broadcast',
                event: 'tick',
                payload: { user_id: user?.id, elapsed: myElapsed }
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [myElapsed, user?.id, finished])

    // Finalize duel when time is up
    const finalizeMutation = useMutation({
        mutationFn: async () => {
            const winnerId = myElapsed >= opponentElapsed ? user?.id : opponentId
            await supabase.from('study_duels').update({
                status: 'finished',
                finished_at: new Date().toISOString(),
                winner_id: winnerId
            }).eq('id', duel.id)
            // Award XP
            await supabase.rpc('award_duel_xp', { winner_user_id: winnerId, xp_amount: 50 })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
            onFinished()
        }
    })

    useEffect(() => {
        if (finished && !finalizeMutation.isPending && !finalizeMutation.isSuccess) {
            finalizeMutation.mutate()
        }
    }, [finished])

    const myProgress = (myElapsed / totalSeconds) * 100
    const oppProgress = (opponentElapsed / totalSeconds) * 100
    const remaining = Math.max(0, totalSeconds - myElapsed)

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    <Swords className="h-5 w-5 text-red-500" />
                    Aktif Düello
                </h3>
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-xl">
                    <Timer className="h-4 w-4 animate-pulse" />
                    <span className="font-black tabular-nums">{formatTime(remaining)}</span>
                </div>
            </div>

            {/* VS Banner */}
            <div className="grid grid-cols-3 gap-3 items-center">
                {/* Me */}
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl font-black text-blue-600">
                        {(user?.email)?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">Sen</p>
                    <p className="text-2xl font-black text-blue-600">{formatTime(myElapsed)}</p>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center gap-1">
                    <Swords className="h-8 w-8 text-gray-400" />
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">vs</span>
                </div>

                {/* Opponent */}
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl font-black text-red-500">
                        {(opponent?.display_name || opponent?.email)?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{opponent?.display_name || opponent?.email?.split('@')[0]}</p>
                    <p className="text-2xl font-black text-red-500">
                        {opponentElapsed > 0 ? formatTime(opponentElapsed) : '--:--'}
                    </p>
                </div>
            </div>

            {/* Progress Bars */}
            <div className="space-y-3">
                <div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                        <span>Senin ilerleme</span>
                        <span>{Math.round(myProgress)}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                            style={{ width: `${myProgress}%` }}
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                        <span>Rakip ilerleme</span>
                        <span>{opponentElapsed > 0 ? `${Math.round(oppProgress)}%` : 'Bekliyor…'}</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-red-500 rounded-full transition-all duration-1000"
                            style={{ width: `${oppProgress}%` }}
                        />
                    </div>
                </div>
            </div>

            <p className="text-center text-xs text-gray-400 font-medium">Süre dolunca kazanana otomatik +50 XP! 🏆</p>
        </div>
    )
}

// --- Main StudyDuel Component ---
export default function StudyDuel({ friends }: { friends: any[] }) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [selectedFriend, setSelectedFriend] = useState<string | null>(null)
    const [selectedDuration, setSelectedDuration] = useState(25)
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null)
    const [finishedDuel, setFinishedDuel] = useState<Duel | null>(null)

    const { data: duels, isLoading } = useQuery({
        queryKey: ['my_duels', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('study_duels')
                .select(`
                    *,
                    challenger:challenger_id(display_name, email),
                    opponent:opponent_id(display_name, email)
                `)
                .or(`challenger_id.eq.${user?.id},opponent_id.eq.${user?.id}`)
                .order('created_at', { ascending: false })
                .limit(20)
            if (error) console.error(error)
            return (data || []) as Duel[]
        },
        refetchInterval: 5000
    })

    // Watch for incoming accepted duels
    useEffect(() => {
        if (!duels) return
        const active = duels.find(d => d.status === 'active')
        if (active && active.id !== activeDuel?.id) setActiveDuel(active as Duel)
    }, [duels])

    // Realtime subscription for duel status changes
    useEffect(() => {
        const channel = supabase.channel('duel_invites')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'study_duels' }, () => {
                queryClient.invalidateQueries({ queryKey: ['my_duels'] })
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [queryClient])

    const sendDuelMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('study_duels').insert({
                challenger_id: user?.id,
                opponent_id: selectedFriend,
                duration_minutes: selectedDuration,
                status: 'pending'
            })
            if (error) throw error
        },
        onSuccess: () => {
            setSelectedFriend(null)
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
        }
    })

    const respondMutation = useMutation({
        mutationFn: async ({ duelId, accept }: { duelId: string; accept: boolean }) => {
            if (accept) {
                await supabase.from('study_duels').update({
                    status: 'active',
                    started_at: new Date().toISOString()
                }).eq('id', duelId)
            } else {
                await supabase.from('study_duels').update({ status: 'declined' }).eq('id', duelId)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my_duels'] })
        }
    })

    const pendingReceived = duels?.filter(d => d.status === 'pending' && d.opponent_id === user?.id) || []
    const pendingSent = duels?.filter(d => d.status === 'pending' && d.challenger_id === user?.id) || []
    const finishedDuels = duels?.filter(d => d.status === 'finished') || []

    // Show active duel if exists
    if (activeDuel) {
        return (
            <ActiveDuel
                duel={activeDuel}
                onFinished={() => {
                    setFinishedDuel(activeDuel)
                    setActiveDuel(null)
                    queryClient.invalidateQueries({ queryKey: ['my_duels'] })
                }}
            />
        )
    }

    // Duel finished result screen
    if (finishedDuel) {
        const iWon = finishedDuel.winner_id === user?.id
        return (
            <div className={clsx(
                "rounded-2xl p-8 text-white text-center space-y-4",
                iWon
                    ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30"
                    : "bg-gradient-to-br from-gray-600 to-gray-700"
            )}>
                <p className="text-5xl">{iWon ? '🏆' : '😤'}</p>
                <h3 className="text-2xl font-black">{iWon ? 'Kazandın!' : 'Kaybettin!'}</h3>
                <p className="text-sm opacity-80">{iWon ? '+50 XP hesabına eklendi!' : 'Bir dahaki sefere daha iyi odaklan!'}</p>
                <Button
                    onClick={() => setFinishedDuel(null)}
                    className="bg-white text-gray-900 hover:bg-gray-100"
                >
                    Tamam
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* New Duel */}
            <Card className="p-5">
                <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Swords className="h-5 w-5 text-red-500" />
                    Yeni Düello Gönder
                </h3>
                <div className="space-y-4">
                    {/* Friend picker */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Rakip Seç</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {friends.map((f: any) => (
                                <button
                                    key={f.friend?.id}
                                    onClick={() => setSelectedFriend(f.friend?.id === selectedFriend ? null : f.friend?.id)}
                                    className={clsx(
                                        "flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-sm font-semibold",
                                        selectedFriend === f.friend?.id
                                            ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600"
                                            : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300"
                                    )}
                                >
                                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                                        {(f.friend?.display_name || f.friend?.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="truncate">{f.friend?.display_name || f.friend?.email?.split('@')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration picker */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Süre</p>
                        <div className="flex gap-2">
                            {DURATION_OPTIONS.map(d => (
                                <button
                                    key={d}
                                    onClick={() => setSelectedDuration(d)}
                                    className={clsx(
                                        "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                                        selectedDuration === d
                                            ? "bg-red-500 text-white shadow-sm"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    )}
                                >
                                    {d} dk
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25"
                        onClick={() => sendDuelMutation.mutate()}
                        disabled={!selectedFriend || sendDuelMutation.isPending}
                    >
                        <Swords className="h-4 w-4 mr-2" />
                        {sendDuelMutation.isPending ? 'Gönderiliyor…' : 'Meydan Oku!'}
                    </Button>
                </div>
            </Card>

            {/* Incoming invites */}
            {pendingReceived.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Gelen Meydan Okumalar</p>
                    {pendingReceived.map(d => (
                        <Card key={d.id} className="p-4 border-l-4 border-red-500">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Swords className="h-4 w-4 text-red-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                            {d.challenger?.display_name || d.challenger?.email?.split('@')[0]}
                                        </p>
                                        <p className="text-xs text-gray-400">{d.duration_minutes} dakika</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => respondMutation.mutate({ duelId: d.id, accept: true })}
                                        className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 transition-colors"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => respondMutation.mutate({ duelId: d.id, accept: false })}
                                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"
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
                                    {d.opponent?.display_name || d.opponent?.email?.split('@')[0]} yanıt bekliyor…
                                </p>
                                <p className="text-xs text-gray-400">{d.duration_minutes} dk</p>
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
                        const opponent = d.challenger_id === user?.id ? d.opponent : d.challenger
                        return (
                            <Card key={d.id} className={clsx("p-4 flex items-center justify-between", iWon ? "border-l-4 border-amber-400" : "border-l-4 border-gray-300")}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl">{iWon ? '🏆' : '😤'}</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                            {opponent?.display_name || opponent?.email?.split('@')[0]}
                                        </p>
                                        <p className="text-xs text-gray-400">{d.duration_minutes} dk</p>
                                    </div>
                                </div>
                                <div className={clsx("text-xs font-black px-2 py-1 rounded-lg", iWon ? "bg-amber-100 dark:bg-amber-900/20 text-amber-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                                    {iWon ? '+50 XP' : 'Kayıp'}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            {!isLoading && duels?.length === 0 && friends.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">Düello yapmak için önce arkadaş ekle!</p>
                </div>
            )}
        </div>
    )
}
