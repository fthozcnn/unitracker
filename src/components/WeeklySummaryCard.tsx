import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, startOfWeek, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { X, Trophy, Flame, Clock, BookOpen, Sparkles } from 'lucide-react'

/**
 * Shown only on Sundays, once per week (tracked via localStorage).
 * Summarizes the current week: total hours, top course, longest session, streak.
 */
export default function WeeklySummaryCard() {
    const { user } = useAuth()
    const [visible, setVisible] = useState(false)

    // Check if today is Sunday and if we already showed this week's card
    useEffect(() => {
        const today = new Date()
        const isSunday = today.getDay() === 0
        if (!isSunday) return

        const weekKey = `weekly_summary_${format(today, 'yyyy-ww')}`
        const alreadyShown = localStorage.getItem(weekKey)
        if (!alreadyShown) setVisible(true)
    }, [])

    const handleClose = () => {
        const today = new Date()
        const weekKey = `weekly_summary_${format(today, 'yyyy-ww')}`
        localStorage.setItem(weekKey, '1')
        setVisible(false)
    }

    // Fetch this week's sessions (Mon → Sun)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

    const { data: weeklySessions } = useQuery({
        queryKey: ['weekly_summary_sessions', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('*, courses(name, color)')
                .eq('user_id', user?.id)
                .gte('start_time', weekStart.toISOString())
                .order('start_time', { ascending: true })
            return data || []
        },
        enabled: visible && !!user
    })

    // Streak
    const { data: streak } = useQuery({
        queryKey: ['weekly_summary_streak', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('start_time')
                .eq('user_id', user?.id)
                .order('start_time', { ascending: false })
            if (!data || data.length === 0) return 0
            const uniqueDates = Array.from(new Set(data.map((s: any) => s.start_time.split('T')[0])))
            let count = 0
            const today = new Date().toISOString().split('T')[0]
            const yesterday = subDays(new Date(), 1).toISOString().split('T')[0]
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                count = 1
                let d = new Date(uniqueDates[0])
                for (let i = 1; i < uniqueDates.length; i++) {
                    d.setDate(d.getDate() - 1)
                    if (uniqueDates[i] === d.toISOString().split('T')[0]) count++
                    else break
                }
            }
            return count
        },
        enabled: visible && !!user
    })

    if (!visible) return null

    // Derived stats
    const totalSeconds = weeklySessions?.reduce((acc: number, s: any) => acc + (s.duration || 0), 0) || 0
    const totalHours = (totalSeconds / 3600).toFixed(1)
    const longestSession = weeklySessions?.length
        ? Math.round(Math.max(...weeklySessions.map((s: any) => (s.duration || 0))) / 60)
        : 0
    const sessionCount = weeklySessions?.length || 0

    // Top course
    const courseMap: Record<string, number> = {}
    weeklySessions?.forEach((s: any) => {
        const name = s.courses?.name || 'Diğer'
        courseMap[name] = (courseMap[name] || 0) + (s.duration || 0)
    })
    const topCourse = Object.entries(courseMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 text-white p-6 shadow-2xl shadow-purple-500/30 animate-in slide-in-from-top-4 duration-500">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            {/* Close button */}
            <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
                <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <h2 className="text-lg font-black tracking-tight">Bu Haftanın Özeti 🎉</h2>
                <span className="ml-auto text-xs text-purple-200 font-medium">
                    {format(weekStart, 'd MMM', { locale: tr })} – {format(new Date(), 'd MMM', { locale: tr })}
                </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-purple-200 text-xs font-bold uppercase">
                        <Clock className="h-3.5 w-3.5" />
                        Toplam Süre
                    </div>
                    <p className="text-2xl font-black">{totalHours}<span className="text-sm font-normal"> sa</span></p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-purple-200 text-xs font-bold uppercase">
                        <BookOpen className="h-3.5 w-3.5" />
                        Seans Sayısı
                    </div>
                    <p className="text-2xl font-black">{sessionCount}<span className="text-sm font-normal"> kez</span></p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-purple-200 text-xs font-bold uppercase">
                        <Trophy className="h-3.5 w-3.5" />
                        En Uzun Seans
                    </div>
                    <p className="text-2xl font-black">{longestSession}<span className="text-sm font-normal"> dk</span></p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-purple-200 text-xs font-bold uppercase">
                        <Flame className="h-3.5 w-3.5" />
                        Günlük Seri
                    </div>
                    <p className="text-2xl font-black">{streak || 0}<span className="text-sm font-normal"> 🔥</span></p>
                </div>
            </div>

            {/* Top Course badge */}
            {topCourse !== '-' && (
                <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-yellow-300 shrink-0" />
                    <div>
                        <p className="text-xs text-purple-200 font-bold uppercase">Bu Hafta En Çok Çalışılan Ders</p>
                        <p className="font-black text-white">{topCourse}</p>
                    </div>
                </div>
            )}

            {/* Motivational message */}
            <p className="mt-4 text-xs text-purple-200 font-medium text-center">
                {sessionCount === 0
                    ? 'Bu hafta henüz çalışma seansı yok. Hadi başla! 💪'
                    : parseFloat(totalHours) >= 10
                        ? 'İnanılmaz bir hafta geçirdin! Bir sonraki haftada da böyle devam! 🚀'
                        : parseFloat(totalHours) >= 5
                            ? 'Harika bir haftaydı! Her geçen gün daha iyi oluyorsun. 🌟'
                            : 'Güzel bir başlangıç! Gelecek hafta daha yüksek hedefler koy. 🎯'
                }
            </p>
        </div>
    )
}
