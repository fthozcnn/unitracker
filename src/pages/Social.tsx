import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Input } from '../components/ui-base'
import { Users, Trophy, UserPlus, Check, X, Search, Target, Plus, Calendar as CalendarIcon, Users2, Megaphone, PartyPopper } from 'lucide-react'
import { format, differenceInDays, isAfter, isBefore } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function Social() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'friends' | 'challenges' | 'leaderboard'>('friends')
    const [searchEmail, setSearchEmail] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'weekly' | 'monthly'>('weekly')
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [reactionFeedback, setReactionFeedback] = useState<Record<string, string>>({})
    const [friendPresence, setFriendPresence] = useState<Record<string, { status: string, current_course: string | null }>>({})

    // Challenges State
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newChallenge, setNewChallenge] = useState({
        title: '',
        description: '',
        target_hours: 10,
        is_group: false,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    })

    // Fetch friends
    const { data: friends } = useQuery({
        queryKey: ['friends'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    *,
                    friend:friend_id (
                        id,
                        email,
                        display_name
                    )
                `)
                .eq('user_id', user?.id)
                .eq('status', 'accepted')
            if (error) console.error('Fetch friends error:', error)
            return data || []
        }
    })

    // Fetch and subscribe to friend presence
    useEffect(() => {
        if (!friends || friends.length === 0) return
        const friendIds = friends.map((f: any) => f.friend?.id).filter(Boolean)
        if (friendIds.length === 0) return

        const fetchPresence = async () => {
            const { data } = await supabase
                .from('user_presence')
                .select('user_id, status, current_course')
                .in('user_id', friendIds)
            if (data) {
                const map: Record<string, { status: string, current_course: string | null }> = {}
                data.forEach((p: any) => { map[p.user_id] = { status: p.status, current_course: p.current_course } })
                setFriendPresence(map)
            }
        }
        fetchPresence()

        const channel = supabase.channel('presence_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload: any) => {
                const row = payload.new
                if (row && friendIds.includes(row.user_id)) {
                    setFriendPresence(prev => ({ ...prev, [row.user_id]: { status: row.status, current_course: row.current_course } }))
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [friends])

    // Fetch sent pending requests
    const { data: sentRequests } = useQuery({
        queryKey: ['sent_requests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    *,
                    friend:friend_id (
                        id,
                        email,
                        display_name
                    )
                `)
                .eq('user_id', user?.id)
                .eq('status', 'pending')
            if (error) console.error('Fetch sent requests error:', error)
            return data || []
        }
    })

    // Fetch pending requests (received)
    const { data: pendingRequests } = useQuery({
        queryKey: ['pending_requests'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    *,
                    sender:user_id (
                        id,
                        email,
                        display_name
                    )
                `)
                .eq('friend_id', user?.id)
                .eq('status', 'pending')
            if (error) console.error('Fetch pending requests error:', error)
            return data || []
        }
    })

    // Fetch leaderboard
    const { data: leaderboard } = useQuery({
        queryKey: ['leaderboard', leaderboardTimeframe],
        queryFn: async () => {
            const { data } = await supabase.rpc('get_leaderboard', { timeframe: leaderboardTimeframe })
            return data || []
        }
    })

    // Fetch user's recent badges for the showcase
    const { data: recentBadges } = useQuery({
        queryKey: ['recent_badges'],
        queryFn: async () => {
            const { data } = await supabase
                .from('user_badges')
                .select(`
                    id,
                    earned_at,
                    badges (
                        id,
                        name,
                        icon,
                        color,
                        description
                    )
                `)
                .eq('user_id', user?.id)
                .order('earned_at', { ascending: false })
                .limit(3)
            return data || []
        }
    })

    // Search users
    const handleSearch = async () => {
        if (!searchEmail.trim()) return
        const { data } = await supabase.rpc('search_users_by_email', { search_email: searchEmail })
        setSearchResults(data || [])
    }

    // Send friend request
    const sendRequestMutation = useMutation({
        mutationFn: async (friendId: string) => {
            setErrorMessage('')
            setSuccessMessage('')
            const { error } = await supabase
                .from('friendships')
                .insert({ user_id: user?.id, friend_id: friendId, status: 'pending' })
            if (error) throw error
        },
        onSuccess: () => {
            setSearchEmail('')
            setSearchResults([])
            setSuccessMessage('Arkadaşlık isteği gönderildi!')
            queryClient.invalidateQueries({ queryKey: ['sent_requests'] })
            setTimeout(() => setSuccessMessage(''), 3000)
        },
        onError: (error: any) => {
            setErrorMessage(error.message || 'İstek gönderilirken bir hata oluştu.')
            setTimeout(() => setErrorMessage(''), 5000)
        }
    })

    // Accept friend request
    const acceptRequestMutation = useMutation({
        mutationFn: async (friendshipId: string) => {
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', friendshipId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
            queryClient.invalidateQueries({ queryKey: ['friends'] })
        }
    })


    const rejectRequestMutation = useMutation({
        mutationFn: async (friendshipId: string) => {
            const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
        }
    })

    // Send social reaction (nudge/cheer)
    const sendReaction = useCallback(async (targetUserId: string, type: 'nudge' | 'cheer') => {
        const feedbackKey = `${targetUserId}_${type}`
        if (reactionFeedback[feedbackKey]) return // Already showing feedback

        try {
            const { data, error } = await supabase.rpc('send_social_reaction', {
                target_user_id: targetUserId,
                reaction_type: type
            })
            if (error) throw error
            if (data && !data.success) {
                setReactionFeedback(prev => ({ ...prev, [feedbackKey]: 'error' }))
                setErrorMessage(data.error)
                setTimeout(() => setErrorMessage(''), 3000)
            } else {
                setReactionFeedback(prev => ({ ...prev, [feedbackKey]: 'sent' }))
                queryClient.invalidateQueries({ queryKey: ['notifications'] })
            }
        } catch (err: any) {
            setReactionFeedback(prev => ({ ...prev, [feedbackKey]: 'error' }))
            setErrorMessage(err.message || 'Tepki gönderilemedi.')
            setTimeout(() => setErrorMessage(''), 3000)
        }

        setTimeout(() => {
            setReactionFeedback(prev => {
                const next = { ...prev }
                delete next[feedbackKey]
                return next
            })
        }, 2000)
    }, [reactionFeedback, queryClient])

    // --- Challenges Logic ---
    const { data: allChallenges } = useQuery({
        queryKey: ['challenges_all'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('challenges')
                .select(`
                    *,
                    challenge_participants (user_id)
                `)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        }
    })

    const myChallenges = allChallenges?.filter(c =>
        c.challenge_participants?.some((p: any) => p.user_id === user?.id)
    ) || []

    const publicGroupChallenges = allChallenges?.filter(c =>
        c.is_group && !c.challenge_participants?.some((p: any) => p.user_id === user?.id)
    ) || []

    const { data: challengeProgress } = useQuery({
        queryKey: ['challenge_progress', allChallenges?.length],
        queryFn: async () => {
            if (!allChallenges || allChallenges.length === 0) return {}
            const progress: Record<string, number> = {}
            for (const challenge of allChallenges) {
                if (challenge.is_group) {
                    const participantIds = challenge.challenge_participants?.map((p: any) => p.user_id) || []
                    if (participantIds.length === 0) {
                        progress[challenge.id] = 0
                        continue
                    }
                    const { data } = await supabase
                        .from('study_sessions')
                        .select('duration')
                        .in('user_id', participantIds)
                        .gte('start_time', challenge.start_date)
                        .lte('start_time', challenge.end_date)
                    const totalMinutes = data?.reduce((sum, s) => sum + s.duration, 0) || 0
                    progress[challenge.id] = Math.round(totalMinutes / 60)
                } else {
                    const isParticipating = challenge.challenge_participants?.some((p: any) => p.user_id === user?.id)
                    if (!isParticipating) continue
                    const { data } = await supabase
                        .from('study_sessions')
                        .select('duration')
                        .eq('user_id', user?.id)
                        .gte('start_time', challenge.start_date)
                        .lte('start_time', challenge.end_date)
                    const totalMinutes = data?.reduce((sum, s) => sum + s.duration, 0) || 0
                    progress[challenge.id] = Math.round(totalMinutes / 60)
                }
            }
            return progress
        },
        enabled: !!allChallenges && allChallenges.length > 0
    })

    const createChallengeMutation = useMutation({
        mutationFn: async () => {
            setErrorMessage('')
            setSuccessMessage('')
            const { data: challenge, error } = await supabase
                .from('challenges')
                .insert({ creator_id: user?.id, ...newChallenge })
                .select().single()
            if (error) throw error
            const { error: joinError } = await supabase
                .from('challenge_participants')
                .insert({ challenge_id: challenge.id, user_id: user?.id })
            if (joinError) throw joinError
        },
        onSuccess: () => {
            setSuccessMessage('Challenge başarıyla oluşturuldu!')
            queryClient.invalidateQueries({ queryKey: ['challenges_all'] })
            setShowCreateModal(false)
            setNewChallenge({
                title: '', description: '', target_hours: 10, is_group: false,
                start_date: format(new Date(), 'yyyy-MM-dd'),
                end_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
            })
            setTimeout(() => setSuccessMessage(''), 3000)
        }
    })

    const joinChallengeMutation = useMutation({
        mutationFn: async (challengeId: string) => {
            const { error } = await supabase
                .from('challenge_participants')
                .insert({ challenge_id: challengeId, user_id: user?.id })
            if (error) throw error
        },
        onSuccess: () => {
            setSuccessMessage('Challenge’a katıldınız! Başarılar ✨')
            queryClient.invalidateQueries({ queryKey: ['challenges_all'] })
            setTimeout(() => setSuccessMessage(''), 3000)
        }
    })

    const getChallengeStatus = (challenge: any) => {
        const now = new Date()
        const start = new Date(challenge.start_date)
        const end = new Date(challenge.end_date)
        if (isBefore(now, start)) return 'upcoming'
        if (isAfter(now, end)) return 'completed'
        return 'active'
    }

    return (
        <div className="space-y-6 md:space-y-8 pb-10">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Sosyal & Challenge'lar</h1>
                <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">Arkadaşlarınla rekabet et ve hedeflerine ulaş!</p>
            </div>

            {/* Tab System */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-fit flex-wrap gap-1">
                <button
                    onClick={() => setActiveTab('leaderboard')}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'leaderboard'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    <Trophy className="h-4 w-4" />
                    Liderlik & Vitrin
                </button>
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'friends'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    <Users className="h-4 w-4" />
                    Arkadaşlarım
                </button>
                <button
                    onClick={() => setActiveTab('challenges')}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'challenges'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    <Target className="h-4 w-4" />
                    Challenge'lar
                </button>
            </div>

            {activeTab === 'leaderboard' && (
                <div className="space-y-8">
                    {/* Badge Showcase (Vitrin) */}
                    <Card className="p-6 md:p-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border-indigo-100 dark:border-indigo-800/30">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                <PartyPopper className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rozet Vitrini</h2>
                                <p className="text-sm text-gray-500">En son kazandığın rozetler</p>
                            </div>
                        </div>

                        {recentBadges?.length === 0 ? (
                            <div className="text-center py-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800">
                                <p className="text-gray-500 text-sm">Henüz sergilenecek rozetin yok. Çalışmaya başla ve kazan!</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-3 gap-4">
                                {recentBadges?.map((userBadge: any) => {
                                    const b = userBadge.badges;
                                    return (
                                        <div key={userBadge.id} className="relative group p-4 border rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 shadow-inner`} style={{ backgroundColor: `${b.color}20`, color: b.color, border: `2px solid ${b.color}40` }}>
                                                {b.icon}
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{b.name}</h3>
                                            <p className="text-xs text-gray-500 px-2 line-clamp-2">{b.description}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Card>

                    {/* Leaderboard */}
                    <Card className="p-4 md:p-8 border-2 border-blue-100 dark:border-blue-900/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                                    <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Liderlik Tablosu</h2>
                                    <p className="text-sm text-gray-500">Arkadaşların arasındaki sıralaman</p>
                                </div>
                            </div>

                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                <button
                                    onClick={() => setLeaderboardTimeframe('weekly')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${leaderboardTimeframe === 'weekly'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Haftalık
                                </button>
                                <button
                                    onClick={() => setLeaderboardTimeframe('monthly')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${leaderboardTimeframe === 'monthly'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Aylık
                                </button>
                            </div>
                        </div>

                        {leaderboard?.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">Henüz rekabet verisi yok. Arkadaşlarını ekleyerek başla!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {leaderboard?.map((entry: any, index: number) => (
                                    <div
                                        key={entry.user_id}
                                        className={`relative flex items-center p-4 rounded-xl transition-all ${entry.user_id === user?.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500/50 ring-4 ring-blue-500/5'
                                            : 'bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mr-4 shrink-0 shadow-sm ${index === 0 ? 'bg-yellow-400 text-yellow-900 ring-4 ring-yellow-400/20' :
                                            index === 1 ? 'bg-gray-300 text-gray-800 ring-4 ring-gray-300/20' :
                                                index === 2 ? 'bg-orange-300 text-orange-900 ring-4 ring-orange-300/20' :
                                                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            {entry.rank}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                                                {entry.display_name}
                                                {entry.user_id === user?.id && (
                                                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Sen</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Bu {leaderboardTimeframe === 'weekly' ? 'hafta' : 'ay'}</p>
                                        </div>
                                        <div className="text-right ml-3 shrink-0 flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-black text-lg text-blue-600 dark:text-blue-400">{Math.round(entry.total_minutes / 60)}h</p>
                                                <p className="text-[10px] uppercase font-bold text-gray-400">{entry.total_minutes % 60}m</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {activeTab === 'friends' ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-6">
                        {/* Friend Management Column */}
                        <div className="space-y-6">
                            {/* Pending & Sent Requests Area (Only if exists) */}
                            {((pendingRequests?.length || 0) > 0 || (sentRequests?.length || 0) > 0) && (
                                <div className="space-y-4">
                                    {pendingRequests?.map((request: any) => (
                                        <div key={request.id} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                <p className="text-sm font-medium text-orange-800 dark:text-orange-400">
                                                    <span className="font-bold">{request.sender?.display_name || request.sender?.email}</span> arkadaşlık istedi.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="primary" className="h-8 w-8 p-0" onClick={() => acceptRequestMutation.mutate(request.id)}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => rejectRequestMutation.mutate(request.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {sentRequests?.map((request: any) => (
                                        <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl text-xs">
                                            <p className="text-gray-500">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{request.friend?.display_name || request.friend?.email}</span> için istek beklemede...
                                            </p>
                                            <button onClick={() => rejectRequestMutation.mutate(request.id)} className="text-red-500 hover:underline">İptal</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Card className="p-4 md:p-6 bg-gray-50 dark:bg-gray-800/30 border-none shadow-none">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-blue-500" />
                                    Arkadaş Bul
                                </h2>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="E-posta adresi ile ara..."
                                        value={searchEmail}
                                        onChange={(e) => setSearchEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="bg-white dark:bg-gray-800 border-gray-200"
                                    />
                                    <Button onClick={handleSearch} className="shrink-0 bg-blue-600 hover:bg-blue-700">
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>

                                {successMessage && <p className="mt-2 text-xs text-green-600 font-medium">{successMessage}</p>}
                                {errorMessage && <p className="mt-2 text-xs text-red-600 font-medium">{errorMessage}</p>}

                                {searchResults.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {searchResults.map((result) => (
                                            <div key={result.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">{result.display_name}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{result.email}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="text-xs py-1 h-auto"
                                                    onClick={() => sendRequestMutation.mutate(result.id)}
                                                    disabled={sendRequestMutation.isPending}
                                                >
                                                    {sendRequestMutation.isPending ? '...' : 'Ekle'}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Friends List Column */}
                        <div className="space-y-6">
                            <Card className="p-4 md:p-6 h-full">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Users className="h-5 w-5 text-emerald-500" />
                                    Arkadaşlarım
                                    <span className="ml-auto bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs">
                                        {friends?.length || 0}
                                    </span>
                                </h2>
                                {friends?.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                        <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">Henüz arkadaşın yok.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {friends?.map((friendship: any) => {
                                            const friendId = friendship.friend?.id
                                            const nudgeKey = `${friendId}_nudge`
                                            const cheerKey = `${friendId}_cheer`
                                            return (
                                                <div key={friendship.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 transition-all group">
                                                    <div className="flex items-center">
                                                        <div className="relative h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs mr-3 shrink-0">
                                                            {(friendship.friend?.display_name || friendship.friend?.email)?.[0]?.toUpperCase()}
                                                            {/* Presence dot */}
                                                            {friendPresence[friendId] && friendPresence[friendId].status !== 'idle' && (
                                                                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-800 ${friendPresence[friendId].status === 'studying' ? 'bg-green-500' : friendPresence[friendId].status === 'pomodoro' ? 'bg-orange-500' : friendPresence[friendId].status === 'break' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                                {friendship.friend?.display_name || friendship.friend?.email}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 truncate">
                                                                {friendPresence[friendId] && friendPresence[friendId].status !== 'idle'
                                                                    ? <span className="text-green-600 dark:text-green-400 font-semibold">
                                                                        {friendPresence[friendId].status === 'pomodoro' ? '🍅 Pomodoro' : '📚 Çalışıyor'}
                                                                        {friendPresence[friendId].current_course && ` • ${friendPresence[friendId].current_course}`}
                                                                    </span>
                                                                    : friendship.friend?.email
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1 ml-2 shrink-0">
                                                            <button
                                                                onClick={() => sendReaction(friendId, 'nudge')}
                                                                disabled={!!reactionFeedback[nudgeKey]}
                                                                title="Dürt! 👊"
                                                                className={`p-1.5 rounded-lg transition-all text-xs ${reactionFeedback[nudgeKey] === 'sent'
                                                                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 scale-110'
                                                                    : reactionFeedback[nudgeKey] === 'error'
                                                                        ? 'bg-red-100 text-red-500'
                                                                        : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 dark:hover:text-orange-400'
                                                                    }`}
                                                            >
                                                                {reactionFeedback[nudgeKey] === 'sent' ? '👊' : <Megaphone className="h-3.5 w-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => sendReaction(friendId, 'cheer')}
                                                                disabled={!!reactionFeedback[cheerKey]}
                                                                title="Tebrik et! 🎉"
                                                                className={`p-1.5 rounded-lg transition-all text-xs ${reactionFeedback[cheerKey] === 'sent'
                                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 scale-110'
                                                                    : reactionFeedback[cheerKey] === 'error'
                                                                        ? 'bg-red-100 text-red-500'
                                                                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 dark:hover:text-green-400'
                                                                    }`}
                                                            >
                                                                {reactionFeedback[cheerKey] === 'sent' ? '🎉' : <PartyPopper className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                </>
            ) : (
                /* Challenges Tab View */
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Aktif Challenge'lar</h2>
                        <Button onClick={() => setShowCreateModal(true)} variant="primary" size="sm">
                            <Plus className="h-4 w-4 mr-1" /> Yeni Challenge
                        </Button>
                    </div>

                    {successMessage && <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">{successMessage}</div>}
                    {errorMessage && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{errorMessage}</div>}

                    {showCreateModal && (
                        <Card className="p-6 border-2 border-blue-100 dark:border-blue-900/30">
                            <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Yeni Challenge Oluştur</h3>
                            <div className="space-y-5 max-w-2xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Başlık</label>
                                        <Input value={newChallenge.title} onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })} placeholder="Örn: Hafta Sonu Maratonu" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Açıklama</label>
                                        <Input value={newChallenge.description} onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })} placeholder="Bu challenge neyi hedefliyor?" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Hedef Saat</label>
                                        <Input type="number" value={newChallenge.target_hours} onChange={(e) => setNewChallenge({ ...newChallenge, target_hours: parseInt(e.target.value) || 0 })} min="1" />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={() => setNewChallenge({ ...newChallenge, is_group: !newChallenge.is_group })}
                                            className={`flex items-center gap-2 h-10 px-4 rounded-md border-2 transition-all ${newChallenge.is_group ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-400'}`}
                                        >
                                            <Users2 className="h-4 w-4" />
                                            <span className="text-sm font-bold">{newChallenge.is_group ? 'Grup Hedefi' : 'Bireysel Hedef'}</span>
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Başlangıç</label>
                                        <Input type="date" value={newChallenge.start_date} onChange={(e) => setNewChallenge({ ...newChallenge, start_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-1.5">Bitiş</label>
                                        <Input type="date" value={newChallenge.end_date} onChange={(e) => setNewChallenge({ ...newChallenge, end_date: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button onClick={() => createChallengeMutation.mutate()} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={createChallengeMutation.isPending}>
                                        Challenge Başlat
                                    </Button>
                                    <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">İptal</Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {myChallenges.map((challenge) => {
                            const status = getChallengeStatus(challenge)
                            const currentHours = challengeProgress?.[challenge.id] || 0
                            const progress = Math.min((currentHours / challenge.target_hours) * 100, 100)
                            const daysLeft = differenceInDays(new Date(challenge.end_date), new Date())

                            return (
                                <Card key={challenge.id} className="p-6 hover:shadow-lg transition-all group relative overflow-hidden">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {challenge.is_group && (
                                                    <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Grup</span>
                                                )}
                                                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{challenge.title}</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 line-clamp-1">{challenge.description}</p>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-800/20' : 'bg-gray-100 text-gray-500'}`}>
                                            {status === 'active' ? 'Aktif' : 'Bitti'}
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">İlerleme</p>
                                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                                    {currentHours}<span className="text-sm text-gray-400 font-medium">/{challenge.target_hours}sa</span>
                                                </p>
                                            </div>
                                            <p className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(progress)}%</p>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${progress}%` }} />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 pt-3 border-t border-gray-50 dark:border-gray-800">
                                            <div className="flex gap-3">
                                                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {format(new Date(challenge.end_date), 'd MMM', { locale: tr })}</span>
                                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {challenge.challenge_participants?.length || 0}</span>
                                            </div>
                                            {status === 'active' && <span className="text-orange-500">{daysLeft} gün kaldı</span>}
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>

                    {publicGroupChallenges.length > 0 && (
                        <div className="space-y-4 pt-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users2 className="h-5 w-5 text-orange-500" /> Grup Hedefleri
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {publicGroupChallenges.map((challenge) => (
                                    <Card key={challenge.id} className="p-4 border-2 border-orange-50 dark:border-orange-900/10">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{challenge.title}</h3>
                                        <p className="text-[10px] text-gray-400 mb-3">{challenge.target_hours} Saat • {challenge.challenge_participants?.length || 0} Katılımcı</p>
                                        <Button size="sm" onClick={() => joinChallengeMutation.mutate(challenge.id)} className="w-full bg-orange-600 hover:bg-orange-700 text-xs">Katıl</Button>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div >
    )
}
