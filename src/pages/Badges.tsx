import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui-base'
import * as Icons from 'lucide-react'
import { Trophy, ShieldCheck, Lock } from 'lucide-react'

const CATEGORIES = [
    { id: 'onboarding', name: 'Onboarding', icon: Icons.Compass },
    { id: 'streak', name: 'Zaman ve İstikrar', icon: Icons.Zap },
    { id: 'habits', name: 'Çalışma Tarzı', icon: Icons.Activity },
    { id: 'academic', name: 'Akademik Başarı', icon: Icons.GraduationCap },
    { id: 'social', name: 'Sosyal ve Özel', icon: Icons.Palette }
]
const GET_CATEGORY = (type: string) => {
    if (['first_course', 'gpa_calc', 'absenteeism_update', 'syllabus_add', 'set_goal', 'profile_complete', 'first_session'].includes(type)) return 'onboarding'
    if (['streak', 'marathon', 'study_hours', 'weekend_warrior', 'weekly_marathon'].includes(type)) return 'streak'
    if (['early_bird', 'night_owl', 'pomodoro_count', 'last_minute', 'planned_study', 'uninterrupted', 'focus_master'].includes(type)) return 'habits'
    if (['high_grade', 'no_fail', 'barely_pass', 'exam_week_streak', 'final_marathon', 'attendance_survival', 'gpa_legend', 'grades_logged'].includes(type)) return 'academic'
    return 'social'
}

export default function Badges() {
    const { user } = useAuth()

    const { data: allBadges } = useQuery({
        queryKey: ['all_badges'],
        queryFn: async () => {
            const { data } = await supabase.from('badges').select('*').order('name', { ascending: true })
            return data || []
        }
    })

    const { data: userBadges } = useQuery({
        queryKey: ['user_badges', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('user_badges')
                .select('badge_id, earned_at')
                .eq('user_id', user?.id)
            return data || []
        }
    })

    const { data: userStats } = useQuery({
        queryKey: ['user_stats_for_progress', user?.id],
        queryFn: async () => {
            const [sessionsRes, coursesRes, profilesRes, friendsRes, challengesRes, assignmentsRes] = await Promise.all([
                supabase.from('study_sessions').select('*').eq('user_id', user?.id).order('start_time', { ascending: false }),
                supabase.from('courses').select('id, name').eq('user_id', user?.id),
                supabase.from('profiles').select('*').eq('id', user?.id).single(),
                supabase.from('friendships').select('id', { count: 'exact' }).eq('user_id', user?.id).eq('status', 'accepted'),
                supabase.from('challenge_participants').select('id', { count: 'exact' }).eq('user_id', user?.id),
                supabase.from('assignments').select('id, grade').eq('user_id', user?.id)
            ])

            const sessions = sessionsRes.data || []
            const assignments = assignmentsRes.data || []
            const days = [...new Set(sessions.map(s => new Date(s.start_time).toDateString()))]
            let streak = 0
            if (days.length > 0) {
                let checkDate = new Date()
                if (days[0] !== checkDate.toDateString()) checkDate.setDate(checkDate.getDate() - 1)
                for (const day of days) {
                    if (day === checkDate.toDateString()) { streak++; checkDate.setDate(checkDate.getDate() - 1) }
                    else break
                }
            }

            // Pomodoro count (sessions between 20-35 min)
            const pomodoroCount = sessions.filter(s => s.duration >= 1200 && s.duration <= 2100).length
            const focusMasterSessions = sessions.filter(s => s.duration >= 1500).length
            const scoredAssignments = assignments.filter(a => a.grade != null && a.grade > 0).length

            const weekMap: Record<string, number> = {}
            sessions.forEach(s => {
                const d = new Date(s.start_time)
                const weekStart = new Date(d)
                weekStart.setDate(d.getDate() - d.getDay())
                const key = weekStart.toISOString().split('T')[0]
                weekMap[key] = (weekMap[key] || 0) + (s.duration / 3600)
            })
            const maxWeeklyHours = Math.max(0, ...Object.values(weekMap), 0)

            return {
                totalHours: (sessions.reduce((acc, s) => acc + (s.duration / 3600), 0)),
                streak,
                coursesCount: coursesRes.data?.length || 0,
                gpa: profilesRes.data?.gpa || 0,
                sessionsCount: sessions.length,
                friendsCount: friendsRes.count || 0,
                challengesCount: challengesRes.count || 0,
                pomodoroCount,
                focusMasterSessions,
                scoredAssignments,
                maxWeeklyHours
            }
        }
    })

    const earnedBadgeIds = userBadges?.map(ub => ub.badge_id) || []

    const calculateProgress = (badge: any) => {
        if (!userStats) return 0
        switch (badge.criteria_type) {
            case 'study_hours': return Math.min(100, (userStats.totalHours / badge.criteria_value) * 100)
            case 'streak': return Math.min(100, (userStats.streak / badge.criteria_value) * 100)
            case 'first_course': return userStats.coursesCount >= 1 ? 100 : 0
            case 'first_session': return userStats.sessionsCount >= 1 ? 100 : 0
            case 'gpa_legend': return Math.min(100, (userStats.gpa / badge.criteria_value) * 100)
            case 'friends_count': return Math.min(100, (userStats.friendsCount / badge.criteria_value) * 100)
            case 'pomodoro_count': return Math.min(100, (userStats.pomodoroCount / badge.criteria_value) * 100)
            case 'diverse_study': {
                // Show progress based on max we know
                return Math.min(100, (Math.min(userStats.coursesCount, badge.criteria_value) / badge.criteria_value) * 100)
            }
            case 'first_challenge': return userStats.challengesCount >= 1 ? 100 : 0
            case 'grades_logged': return Math.min(100, (userStats.scoredAssignments / badge.criteria_value) * 100)
            case 'focus_master': return Math.min(100, (userStats.focusMasterSessions / badge.criteria_value) * 100)
            case 'weekly_marathon': return Math.min(100, (userStats.maxWeeklyHours / badge.criteria_value) * 100)
            case 'sessions_count': return Math.min(100, (userStats.sessionsCount / badge.criteria_value) * 100)
            default: return 0
        }
    }

    return (
        <div className="space-y-12 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white flex items-center gap-4 tracking-tight">
                        <Trophy className="h-10 w-10 text-amber-500 drop-shadow-lg" />
                        Rozetler
                    </h1>
                    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Hedeflerini aş, akademik yolculuğunda efsaneleş!
                    </p>
                </div>

                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <div className="px-4 text-center">
                        <p className="text-2xl font-black text-blue-600">{userBadges?.length || 0}</p>
                        <p className="text-[10px] uppercase font-black text-gray-400">Kazanılan</p>
                    </div>
                    <div className="w-px bg-gray-200 dark:bg-gray-800" />
                    <div className="px-4 text-center">
                        <p className="text-2xl font-black text-gray-400">{(allBadges?.length || 0) - (userBadges?.length || 0)}</p>
                        <p className="text-[10px] uppercase font-black text-gray-400">Kalan</p>
                    </div>
                </div>
            </div>

            {CATEGORIES.map(cat => (
                <div key={cat.id} className="space-y-6">
                    <div className="flex items-center gap-3 border-b-2 border-gray-50 dark:border-gray-900 pb-4">
                        <cat.icon className="h-6 w-6 text-blue-500" />
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wider">{cat.name}</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allBadges?.filter((b: any) => GET_CATEGORY(b.criteria_type) === cat.id).map((badge: any) => {
                            const isEarned = earnedBadgeIds.includes(badge.id)
                            const IconComponent = (Icons as any)[badge.icon] || Icons.Medal
                            const progress = calculateProgress(badge)

                            return (
                                <Card
                                    key={badge.id}
                                    className={`p-6 relative overflow-hidden transition-all duration-300 ${isEarned
                                        ? `border-${badge.color}-500/20 bg-white dark:bg-gray-800 shadow-lg shadow-${badge.color}-500/5`
                                        : 'grayscale opacity-60 bg-gray-50/50 dark:bg-gray-900/20 hover:grayscale-0 hover:opacity-100'
                                        }`}
                                >
                                    <div className="flex items-start gap-4 h-full">
                                        <div className={`p-4 rounded-2xl shrink-0 ${isEarned
                                            ? `bg-${badge.color}-500/10 text-${badge.color}-500`
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                            }`}>
                                            <IconComponent className="h-8 w-8" />
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className={`font-black text-lg truncate ${isEarned ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                                                        {badge.name}
                                                    </h3>
                                                    {isEarned && <div className="p-1 bg-amber-50 dark:bg-amber-900/20 rounded-full"><ShieldCheck className="h-4 w-4 text-amber-500" /></div>}
                                                    {!isEarned && <Lock className="h-4 w-4 text-gray-300" />}
                                                </div>
                                                <p className="text-xs font-medium text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                                                    {badge.description}
                                                </p>
                                            </div>

                                            {(!isEarned && progress > 0) && (
                                                <div className="space-y-1.5 mt-auto">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-gray-400">
                                                        <span>İlerleme</span>
                                                        <span>%{Math.round(progress)}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full bg-${badge.color}-500 rounded-full transition-all duration-1000`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {isEarned && (
                                                <div className="mt-auto pt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-amber-600">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    KAZANILDI
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
