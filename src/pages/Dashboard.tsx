import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, ListSkeleton, GridSkeleton, EmptyState } from '../components/ui-base'
import * as Icons from 'lucide-react'
import { Play, Calendar, BookOpen, TrendingUp, AlertCircle, Clock, Trophy, Medal, ShieldCheck, Target, GraduationCap, Wifi } from 'lucide-react'
import { format, subDays, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useBadgeCheck } from '../hooks/useBadgeCheck'
import { calculateLevel, levelProgress, xpForLevel } from '../lib/xpSystem'
import { checkExamReminders } from '../lib/pushNotifications'
import OnboardingWizard from '../components/OnboardingWizard'
import DailyQuests from '../components/DailyQuests'
import WeeklySummaryCard from '../components/WeeklySummaryCard'

export default function Dashboard() {
    const { user, profile } = useAuth()
    useBadgeCheck()
    const [friendPresence, setFriendPresence] = useState<Record<string, { status: string, current_course: string | null }>>({})
    const [showOnboarding, setShowOnboarding] = useState(() => {
        return !localStorage.getItem('onboarding_completed')
    })

    // Recent Badges Query
    const { data: recentBadges, isLoading: isLoadingBadges } = useQuery({
        queryKey: ['recent_badges'],
        queryFn: async () => {
            const { data } = await supabase
                .from('user_badges')
                .select('earned_at, badges(*)')
                .eq('user_id', user?.id)
                .order('earned_at', { ascending: false })
                .limit(4)
            return data || []
        }
    })

    // Stats Query
    const { data: stats } = useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            const todayISO = new Date().toISOString().split('T')[0]

            const [coursesRes, sessionsRes, pendingAssignmentsRes, todaySessionsRes, todayAssignmentsRes] = await Promise.all([
                supabase.from('courses').select('id', { count: 'exact' }).eq('user_id', user?.id),
                supabase.from('study_sessions').select('duration', { count: 'exact' }).eq('user_id', user?.id),
                supabase.from('assignments').select('id', { count: 'exact' }).eq('user_id', user?.id).eq('is_completed', false),
                supabase.from('study_sessions').select('duration').eq('user_id', user?.id).gte('start_time', `${todayISO}T00:00:00Z`),
                supabase.from('assignments').select('id').eq('user_id', user?.id).eq('is_completed', true).gte('updated_at', `${todayISO}T00:00:00Z`)
            ])

            const totalMinutesToday = todaySessionsRes.data?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0

            return {
                courses: coursesRes.count || 0,
                sessions: sessionsRes.count || 0,
                totalDuration: sessionsRes.data?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0,
                pendingAssignments: pendingAssignmentsRes.count || 0,
                totalMinutesToday,
                assignmentsCompletedToday: todayAssignmentsRes.data?.length || 0
            }
        }
    })

    // Heatmap Data Query
    const { data: heatmapData } = useQuery({
        queryKey: ['heatmap'],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('start_time, duration')
                .eq('user_id', user?.id)
                .gte('start_time', subMonths(new Date(), 3).toISOString())

            const map: Record<string, number> = {}
            data?.forEach((s: any) => {
                const day = s.start_time.split('T')[0]
                map[day] = (map[day] || 0) + (s.duration || 0)
            })
            return map
        }
    })

    // Upcoming Assignments
    const { data: upcomingAssignments, isLoading: isLoadingUpcoming } = useQuery({
        queryKey: ['upcoming_dashboard'],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select('*, courses(name, color)')
                .eq('user_id', user?.id)
                .eq('is_completed', false)
                .gte('due_date', new Date().toISOString())
                .order('due_date', { ascending: true })
                .limit(3)
            return data || []
        }
    })

    // Upcoming Exams for Countdown
    const { data: upcomingExams } = useQuery({
        queryKey: ['upcoming_exams_countdown'],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select('*, courses(name, color)')
                .eq('user_id', user?.id)
                .in('type', ['exam', 'project'])
                .eq('is_completed', false)
                .gte('due_date', new Date().toISOString())
                .order('due_date', { ascending: true })
                .limit(5)
            return data || []
        }
    })

    // Streak Calculation
    const { data: streak } = useQuery({
        queryKey: ['streak_dashboard'],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('start_time')
                .eq('user_id', user?.id)
                .order('start_time', { ascending: false })

            if (!data || data.length === 0) return 0

            const uniqueDates = Array.from(new Set(data.map((s: any) => s.start_time.split('T')[0])))

            const today = format(new Date(), 'yyyy-MM-dd')
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

            if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0

            let currentStreak = 1
            let checkDate = new Date(uniqueDates[0])

            for (let i = 1; i < uniqueDates.length; i++) {
                const prevDate = subDays(checkDate, 1)
                const prevDateStr = format(prevDate, 'yyyy-MM-dd')

                if (uniqueDates[i] === prevDateStr) {
                    currentStreak++
                    checkDate = prevDate
                } else {
                    break
                }
            }
            return currentStreak
        }
    })

    const yearDays = eachDayOfInterval({
        start: subMonths(new Date(), 3),
        end: new Date()
    })

    const getHeatmapColor = (minutes: number) => {
        if (!minutes) return 'bg-gray-100 dark:bg-gray-800'
        if (minutes < 30) return 'bg-emerald-200 dark:bg-emerald-900/30'
        if (minutes < 60) return 'bg-emerald-300 dark:bg-emerald-800'
        if (minutes < 120) return 'bg-emerald-400 dark:bg-emerald-600'
        return 'bg-emerald-500 dark:bg-emerald-500'
    }

    // Leaderboard Query
    const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery({
        queryKey: ['leaderboard_compact'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_leaderboard', { timeframe: 'weekly' })
            if (error) throw error
            return data?.slice(0, 5) || []
        }
    })

    // Active Challenges Query
    const { data: activeChallenges } = useQuery({
        queryKey: ['active_challenges_dashboard'],
        queryFn: async () => {
            const { data: challenges, error } = await supabase
                .from('challenges')
                .select(`
                    *,
                    challenge_participants!inner (user_id)
                `)
                .eq('challenge_participants.user_id', user?.id)
                .gte('end_date', new Date().toISOString())
                .lte('start_date', new Date().toISOString())
                .limit(2)

            if (error) return []

            const challengesWithProgress = await Promise.all((challenges || []).map(async (c) => {
                let totalMinutes = 0
                if (c.is_group) {
                    const { data: participants } = await supabase.from('challenge_participants').select('user_id').eq('challenge_id', c.id)
                    const pIds = participants?.map(p => p.user_id) || []
                    const { data } = await supabase.from('study_sessions').select('duration').in('user_id', pIds).gte('start_time', c.start_date).lte('start_time', c.end_date)
                    totalMinutes = data?.reduce((sum, s) => sum + s.duration, 0) || 0
                } else {
                    const { data } = await supabase.from('study_sessions').select('duration').eq('user_id', user?.id).gte('start_time', c.start_date).lte('start_time', c.end_date)
                    totalMinutes = data?.reduce((sum, s) => sum + s.duration, 0) || 0
                }
                return { ...c, current_hours: Math.round(totalMinutes / 60) }
            }))

            return challengesWithProgress
        }
    })

    // Friends for presence
    const { data: friends } = useQuery({
        queryKey: ['dashboard_friends'],
        queryFn: async () => {
            const { data } = await supabase
                .from('friendships')
                .select('*, friend:friend_id(id, email, display_name)')
                .eq('user_id', user?.id)
                .eq('status', 'accepted')
            return data || []
        }
    })

    // Presence subscription
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

        const channel = supabase.channel('dashboard_presence')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload: any) => {
                const row = payload.new
                if (row && friendIds.includes(row.user_id)) {
                    setFriendPresence(prev => ({ ...prev, [row.user_id]: { status: row.status, current_course: row.current_course } }))
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [friends])

    // Exam reminder notifications
    useEffect(() => {
        if (upcomingExams && upcomingExams.length > 0) {
            const examsForReminder = upcomingExams.map((exam: any) => ({
                title: exam.title,
                course_name: exam.courses?.name || 'Ders',
                due_date: exam.due_date
            }))
            checkExamReminders(examsForReminder)
        }
    }, [upcomingExams])

    return (
        <div className="space-y-6 md:space-y-8">
            {/* Onboarding Wizard */}
            <OnboardingWizard isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

            {/* Weekly Summary Card - only shows on Sundays */}
            <WeeklySummaryCard />

            {/* Home Header & Quick Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            Ana Sayfa
                        </h1>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800" />
                        <span className="text-gray-500 font-medium">UniMarmara</span>
                    </div>
                    <h2 className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                        Hoşgeldin, {profile?.display_name || user?.email?.split('@')[0]} 👋
                    </h2>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link to="/badges" className="flex-1 md:flex-none">
                        <Button variant="secondary" className="w-full">
                            <Trophy className="h-4 w-4 mr-2 text-amber-500" />
                            Rozetlerim
                        </Button>
                    </Link>
                    <Link to="/study" className="flex-1 md:flex-none">
                        <Button className="shadow-lg shadow-blue-500/20 w-full">
                            <Play className="h-5 w-5 mr-2 fill-current" />
                            Çalışmaya Başla
                        </Button>
                    </Link>
                </div>
            </div>
            {/* XP & Level Card */}
            {profile && (
                <Card className="p-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-none shadow-lg shadow-purple-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black">
                                {calculateLevel(profile.total_xp || 0)}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white/70 uppercase tracking-wider">Seviye {calculateLevel(profile.total_xp || 0)}</p>
                                <p className="text-lg font-black">{(profile.total_xp || 0).toLocaleString()} XP</p>
                            </div>
                        </div>
                        <div className="text-right text-xs text-white/70">
                            <p>Sonraki seviye</p>
                            <p className="font-bold text-white">{xpForLevel(calculateLevel(profile.total_xp || 0) + 1).toLocaleString()} XP</p>
                        </div>
                    </div>
                    <div className="mt-3 w-full bg-white/20 rounded-full h-2">
                        <div className="bg-white h-2 rounded-full transition-all duration-700" style={{ width: `${levelProgress(profile.total_xp || 0)}%` }} />
                    </div>
                </Card>
            )}

            {/* Exam Countdown Widget */}
            {upcomingExams && upcomingExams.length > 0 && (
                <Card className="p-4 md:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-red-500" />
                            Yaklaşan Sınavlar & Projeler
                        </h3>
                        <Link to="/calendar" className="text-xs text-blue-600 hover:underline font-semibold">Tümü →</Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {upcomingExams.map((exam: any) => {
                            const daysLeft = differenceInDays(new Date(exam.due_date), new Date())
                            const isUrgent = daysLeft <= 3
                            const isWarning = daysLeft <= 7
                            return (
                                <div
                                    key={exam.id}
                                    className={`relative p-4 rounded-xl border-l-4 transition-all ${isUrgent
                                        ? 'bg-red-50 dark:bg-red-900/15 border-red-500'
                                        : isWarning
                                            ? 'bg-orange-50 dark:bg-orange-900/15 border-orange-500'
                                            : 'bg-gray-50 dark:bg-gray-800 border-green-500'
                                        } ${isUrgent ? 'animate-pulse' : ''}`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: exam.courses?.color || '#6B7280' }} />
                                        <span className="text-xs font-bold text-gray-500 uppercase">{exam.courses?.name}</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-2 truncate">{exam.title}</p>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-2xl font-black ${isUrgent ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-green-600'
                                            }`}>
                                            {daysLeft === 0 ? 'BUGÜN!' : `${daysLeft} gün`}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-semibold">
                                            {format(new Date(exam.due_date), 'd MMM', { locale: tr })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            {/* Daily Quests / Günlük Görevler */}
            <div className="mb-4 md:mb-6">
                <DailyQuests
                    totalMinutesToday={stats?.totalMinutesToday || 0}
                    assignmentsCompletedToday={stats?.assignmentsCompletedToday || 0}
                    currentStreak={streak || 0}
                />
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Card className="p-3 md:p-4 flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                        <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Toplam Çalışma</p>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                            {Math.round((stats?.totalDuration || 0) / 3600)} <span className="text-xs md:text-sm font-normal">saat</span>
                        </h3>
                    </div>
                </Card>

                <Card className="p-3 md:p-4 flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg shrink-0">
                        <BookOpen className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Aktif Dersler</p>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                            {stats?.courses || 0}
                        </h3>
                    </div>
                </Card>

                <Card className="p-3 md:p-4 flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg shrink-0">
                        <AlertCircle className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Bekleyen Ödevler</p>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                            {stats?.pendingAssignments || 0}
                        </h3>
                    </div>
                </Card>

                <Card className="p-3 md:p-4 flex items-center space-x-3 md:space-x-4">
                    <div className="p-2 md:p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                        <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Seri (Streak)</p>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                            {streak || 0} <span className="text-xs md:text-sm font-normal">Gün</span>
                        </h3>
                    </div>
                </Card>
            </div>

            {/* Live Presence Widget */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-green-500" />
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Canlı Durum</h3>
                    </div>
                    <Link to="/social" className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider">Sosyal</Link>
                </div>
                {(() => {
                    const activeFriends = friends?.filter((f: any) => {
                        const p = friendPresence[f.friend?.id]
                        return p && p.status !== 'idle'
                    }) || []

                    if (activeFriends.length === 0) {
                        return (
                            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500">Şu an aktif arkadaş yok.</p>
                            </div>
                        )
                    }

                    return (
                        <div className="space-y-3">
                            {activeFriends.map((f: any) => {
                                const p = friendPresence[f.friend?.id]
                                const statusLabels: Record<string, string> = {
                                    studying: '📖 Çalışıyor',
                                    pomodoro: '🍅 Pomodoro',
                                    break: '☕ Molada'
                                }
                                const statusColors: Record<string, string> = {
                                    studying: 'bg-green-500',
                                    pomodoro: 'bg-red-500',
                                    break: 'bg-yellow-500'
                                }
                                return (
                                    <div key={f.friend?.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                                                    {(f.friend?.display_name || f.friend?.email)?.[0]?.toUpperCase()}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${statusColors[p?.status] || 'bg-gray-400'} animate-pulse`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{f.friend?.display_name || f.friend?.email?.split('@')[0]}</p>
                                                <p className="text-[10px] text-gray-500 font-medium">{p?.current_course || ''}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500">{statusLabels[p?.status] || p?.status}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })()}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Heatmap Section */}
                <Card className="p-4 md:p-6 lg:col-span-2 overflow-hidden">
                    <div className="flex flex-col mb-4 md:mb-6 gap-1">
                        <h3 className="font-semibold text-base md:text-lg text-gray-900 dark:text-white tracking-tight">3 Aylık Aktivite</h3>
                        <p className="text-xs md:text-sm text-gray-500">Çalışma yoğunluğu haritası</p>
                    </div>

                    <div className="flex flex-wrap gap-1 md:gap-1.5">
                        {yearDays.slice(-90).map((day) => { // Match the 3-month data query
                            const dateStr = format(day, 'yyyy-MM-dd')
                            const duration = heatmapData?.[dateStr] || 0
                            return (
                                <div
                                    key={dateStr}
                                    className={`w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full ${getHeatmapColor(duration / 60)} hover:ring-2 ring-blue-400 dark:ring-blue-500 transition-all cursor-crosshair`}
                                    title={`${dateStr}: ${Math.round(duration / 60)} dk`}
                                />
                            )
                        })}
                    </div>
                    <div className="mt-8 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Son 90 günlük aktivite</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold">AZ</span>
                            <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-800" />
                                <div className="w-3 h-3 rounded-full bg-emerald-200 dark:bg-emerald-900/30" />
                                <div className="w-3 h-3 rounded-full bg-emerald-300 dark:bg-emerald-800" />
                                <div className="w-3 h-3 rounded-full bg-emerald-400 dark:bg-emerald-600" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500 dark:bg-emerald-500" />
                            </div>
                            <span className="font-bold">ÇOK</span>
                        </div>
                    </div>
                </Card>

                {/* Compact Leaderboard */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Liderlik</h3>
                        </div>
                        <Link to="/social" className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider">Tümü</Link>
                    </div>

                    <div className="space-y-4">
                        {isLoadingLeaderboard ? (
                            <ListSkeleton />
                        ) : leaderboard?.length === 0 ? (
                            <EmptyState
                                icon={Trophy}
                                title="Liderlik Boş"
                                description="Arkadaşlarını ekle veya süre kaydetmeye başla."
                                color="orange"
                            />
                        ) : (
                            leaderboard?.map((entry: any, idx: number) => (
                                <div key={entry.user_id} className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${entry.user_id === user?.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800' : ''}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' :
                                            idx === 1 ? 'bg-slate-100 text-slate-600' :
                                                idx === 2 ? 'bg-orange-100 text-orange-600' :
                                                    'bg-gray-100 text-gray-500'
                                            }`}>
                                            {idx + 1}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                            {entry.display_name}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 bg-white dark:bg-gray-800 py-1 px-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                        {(entry.total_minutes / 60).toFixed(1)} sa
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Badges Showcase */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Medal className="h-5 w-5 text-blue-500" />
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Rozetlerim</h3>
                        </div>
                        <Link to="/badges" className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider">Tümü</Link>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {isLoadingBadges ? (
                            <GridSkeleton />
                        ) : recentBadges?.length === 0 ? (
                            <div className="w-full">
                                <EmptyState
                                    icon={Medal}
                                    title="Henüz Rozet Yok"
                                    description="Seri yaparak veya hedeflerine ulaşarak ilk rozetini kazan!"
                                    color="blue"
                                />
                            </div>
                        ) : (
                            recentBadges?.map((item: any) => {
                                const b = item.badges;
                                const IconComponent = (Icons as any)[b.icon] || Icons.Medal;
                                return (
                                    <div key={b.id} className="group relative" title={b.name}>
                                        <div className={`p-4 rounded-xl bg-${b.color}-100 dark:bg-${b.color}-900/30 text-${b.color}-600 transition-transform group-hover:scale-110 shadow-sm border border-transparent hover:border-${b.color}-200`}>
                                            <IconComponent className="h-6 w-6" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-1 border-2 border-white dark:border-gray-800 shadow-sm">
                                            <ShieldCheck className="w-2.5 h-2.5 text-amber-500" />
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Card>

                {/* Upcoming Assignments Widget */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Yaklaşanlar</h3>
                        <Link to="/calendar" className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider">Tümü</Link>
                    </div>

                    <div className="space-y-4">
                        {isLoadingUpcoming ? (
                            <ListSkeleton />
                        ) : upcomingAssignments?.length === 0 ? (
                            <EmptyState
                                icon={Calendar}
                                title="Boş Takvim"
                                description="Yaklaşan ödev veya sınav yok 🎉"
                                color="green"
                            />
                        ) : (
                            upcomingAssignments?.map((item: any) => {
                                const daysLeft = differenceInDays(new Date(item.due_date), new Date())
                                return (
                                    <div key={item.id} className="flex flex-col space-y-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all border-2 border-transparent hover:border-blue-50 dark:hover:border-blue-900/20 group">
                                        <div className="flex items-start space-x-3">
                                            <div className="mt-1">
                                                <div className="w-2 h-2 rounded-full group-hover:scale-150 transition-transform" style={{ backgroundColor: item.courses?.color || '#3b82f6' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                    {item.title}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate font-medium">{item.courses?.name}</p>
                                            </div>
                                            <div className="text-right whitespace-nowrap flex flex-col items-end gap-1">
                                                {daysLeft <= 0 ? (
                                                    <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> BUGÜN
                                                    </span>
                                                ) : daysLeft === 1 ? (
                                                    <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        YARIN
                                                    </span>
                                                ) : (
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${daysLeft <= 3
                                                        ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40'
                                                        : 'text-blue-600 bg-blue-100 dark:bg-blue-900/40'
                                                        }`}>
                                                        {daysLeft} GÜN KALDI
                                                    </span>
                                                )}
                                                <div className="flex items-center text-[10px] font-black uppercase text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <Link to="/calendar">
                        <Button variant="ghost" className="w-full mt-6 text-gray-400 hover:text-blue-600 transition-colors py-3 rounded-xl border-t border-gray-50 dark:border-gray-800">
                            + Yeni Ekle
                        </Button>
                    </Link>
                </Card>

                {/* Active Challenges Widget */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-orange-500" />
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Aktif Challenge'larım</h3>
                        </div>
                        <Link to="/social" className="text-xs font-bold text-blue-600 hover:text-blue-500 uppercase tracking-wider">Tümü</Link>
                    </div>

                    <div className="space-y-6">
                        {!activeChallenges || activeChallenges.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500">Şu an aktif bir challenge yok.</p>
                                <Link to="/social" className="text-xs text-blue-600 font-bold mt-2 inline-block">Birine Katıl</Link>
                            </div>
                        ) : (
                            activeChallenges.map((challenge) => {
                                const progress = Math.min((challenge.current_hours / challenge.target_hours) * 100, 100)
                                return (
                                    <div key={challenge.id} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{challenge.title}</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Hedef: {challenge.target_hours}sa</p>
                                            </div>
                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{Math.round(progress)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
