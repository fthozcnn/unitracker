import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui-base'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import { subDays, subMonths, startOfWeek, endOfWeek, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns'
import { tr } from 'date-fns/locale'
import { TrendingUp, Clock, BookOpen, Activity, Zap } from 'lucide-react'

type Period = 'week' | 'month' | '3months'

const PERIOD_LABELS: Record<Period, string> = {
    week: 'Bu Hafta',
    month: 'Bu Ay',
    '3months': 'Son 3 Ay',
}

function getPeriodRange(period: Period): { start: Date; end: Date } {
    const end = endOfDay(new Date())
    switch (period) {
        case 'week':
            return { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }
        case 'month':
            return { start: subDays(new Date(), 30), end }
        case '3months':
            return { start: subMonths(new Date(), 3), end }
    }
}

export default function Analytics() {
    const { user } = useAuth()
    const [period, setPeriod] = useState<Period>('week')

    const { start, end } = useMemo(() => getPeriodRange(period), [period])

    // All sessions for selected period
    const { data: sessions } = useQuery({
        queryKey: ['analytics_sessions', period],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('*, courses(name, color)')
                .eq('user_id', user?.id)
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())
                .order('start_time', { ascending: true })
            return data || []
        }
    })

    // Streak (all-time)
    const { data: streak } = useQuery({
        queryKey: ['streak'],
        queryFn: async () => {
            const { data } = await supabase
                .from('study_sessions')
                .select('start_time')
                .eq('user_id', user?.id)
                .order('start_time', { ascending: false })
            if (!data || data.length === 0) return 0
            const uniqueDates = Array.from(new Set(data.map(s => s.start_time.split('T')[0])))
            let currentStreak = 0
            const today = new Date().toISOString().split('T')[0]
            const yesterday = subDays(new Date(), 1).toISOString().split('T')[0]
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                currentStreak = 1
                let checkDate = new Date(uniqueDates[0])
                for (let i = 1; i < uniqueDates.length; i++) {
                    checkDate.setDate(checkDate.getDate() - 1)
                    if (uniqueDates[i] === checkDate.toISOString().split('T')[0]) currentStreak++
                    else break
                }
            }
            return currentStreak
        }
    })

    // ---- Derived data computed from sessions ----

    // Daily chart (bar)
    const dailyData = useMemo(() => {
        if (!sessions) return []
        const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) })
        return days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const total = sessions
                .filter((s: any) => s.start_time.startsWith(dayStr))
                .reduce((acc: number, s: any) => acc + (s.duration || 0), 0)
            return {
                name: period === 'week'
                    ? format(day, 'EEE', { locale: tr })
                    : format(day, 'd MMM', { locale: tr }),
                minutes: Math.round(total / 60),
            }
        })
    }, [sessions, start, end, period])

    // Cumulative hours line chart
    const cumulativeData = useMemo(() => {
        if (!sessions) return []
        const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) })
        let cumTotal = 0
        return days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const dayTotal = sessions
                .filter((s: any) => s.start_time.startsWith(dayStr))
                .reduce((acc: number, s: any) => acc + (s.duration || 0), 0)
            cumTotal += dayTotal / 3600
            return {
                name: period === 'week'
                    ? format(day, 'd EEE', { locale: tr })
                    : format(day, 'd MMM', { locale: tr }),
                saat: parseFloat(cumTotal.toFixed(2))
            }
        })
    }, [sessions, start, end, period])

    // Hourly productivity (0-23)
    const hourlyData = useMemo(() => {
        if (!sessions) return []
        const counts = new Array(24).fill(0)
        sessions.forEach((s: any) => {
            const hour = new Date(s.start_time).getHours()
            counts[hour] += (s.duration || 0) / 60
        })
        return counts.map((minutes, hour) => ({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            dakika: Math.round(minutes)
        }))
    }, [sessions])

    // Course distribution
    const courseDist = useMemo(() => {
        if (!sessions) return []
        const dist: Record<string, { name: string; value: number; color: string; sessionCount: number }> = {}
        sessions.forEach((s: any) => {
            const name = s.courses?.name || 'Diğer'
            if (!dist[name]) dist[name] = { name, value: 0, color: s.courses?.color || '#cbd5e1', sessionCount: 0 }
            dist[name].value += (s.duration || 0)
            dist[name].sessionCount++
        })
        return Object.values(dist)
            .map(d => ({ ...d, hours: +(d.value / 3600).toFixed(1), value: Math.round(d.value / 60) }))
            .sort((a, b) => b.value - a.value)
    }, [sessions])

    // Summary stats
    const totalMinutes = sessions?.reduce((acc: number, s: any) => acc + (s.duration || 0), 0) / 60 || 0
    const totalHours = (totalMinutes / 60).toFixed(1)
    const sessionCount = sessions?.length || 0
    const avgMinutes = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0
    const longestSession = sessions?.length
        ? Math.round(Math.max(...sessions.map((s: any) => s.duration || 0)) / 60)
        : 0
    const topCourse = courseDist[0]?.name || '-'

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Analizler</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1">Çalışma verilerini tüm detaylarıyla incele.</p>
                </div>
                {/* Period Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                    {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${period === p
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Toplam Süre', value: `${totalHours} sa`, icon: Clock, color: 'blue' },
                    { label: 'Seans Sayısı', value: sessionCount, icon: Activity, color: 'green' },
                    { label: 'Ort. Seans', value: `${avgMinutes} dk`, icon: TrendingUp, color: 'purple' },
                    { label: 'En Uzun Seans', value: `${longestSession} dk`, icon: Zap, color: 'orange' },
                    { label: 'En Çok Çalışılan', value: topCourse, icon: BookOpen, color: 'pink' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 shrink-0`}>
                            <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white truncate">{value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily bar chart */}
                <Card className="p-6 lg:col-span-2">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Günlük Çalışma Süresi (Dakika)</h3>
                    <div className="h-[260px]">
                        {dailyData.some(d => d.minutes > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData} barSize={period === 'week' ? 28 : 10}>
                                    <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        formatter={(v: any) => [`${v} dk`, 'Süre']}
                                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                        cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                                    />
                                    <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                Seçili dönemde veri yok
                            </div>
                        )}
                    </div>
                </Card>

                {/* Ders Dağılımı */}
                <Card className="p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Ders Dağılımı</h3>
                    <div className="h-[180px]">
                        {courseDist.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={courseDist} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                                        {courseDist.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color || COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [`${v} dk`, '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
                        )}
                    </div>
                    <div className="space-y-1.5 mt-4">
                        {courseDist.slice(0, 4).map((c, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || COLORS[idx % COLORS.length] }} />
                                <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{c.name}</span>
                                <span className="font-bold text-gray-900 dark:text-white">{c.hours} sa</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Cumulative Line Chart */}
            <Card className="p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-6">Kümülatif Toplam Saat</h3>
                <div className="h-[220px]">
                    {cumulativeData.some(d => d.saat > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={cumulativeData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false}
                                    interval={period === 'week' ? 0 : period === 'month' ? 4 : 9} />
                                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} unit=" sa" />
                                <Tooltip
                                    formatter={(v: any) => [`${v} sa`, 'Toplam']}
                                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                />
                                <Line type="monotone" dataKey="saat" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
                    )}
                </div>
            </Card>

            {/* Hourly Chart */}
            <Card className="p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Saat Bazlı Verimlilik</h3>
                <p className="text-xs text-gray-400 mb-6">Günün hangi saatlerinde daha çok çalıştığını göster</p>
                <div className="h-[220px]">
                    {hourlyData.some(d => d.dakika > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData} barSize={10}>
                                <XAxis dataKey="hour" stroke="#888" fontSize={10} tickLine={false} axisLine={false}
                                    interval={2} />
                                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} unit=" dk" />
                                <Tooltip
                                    formatter={(v: any) => [`${v} dk`, 'Süre']}
                                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                    cursor={{ fill: 'rgba(139,92,246,0.07)' }}
                                />
                                <Bar dataKey="dakika" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
                    )}
                </div>
            </Card>

            {/* Per-Course Table */}
            <Card className="p-6 overflow-x-auto">
                <h3 className="font-bold text-gray-900 dark:text-white mb-6">Ders Bazında İstatistikler</h3>
                {courseDist.length > 0 ? (
                    <table className="w-full text-sm min-w-[480px]">
                        <thead>
                            <tr className="text-xs font-black uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                <th className="pb-3 text-left">Ders</th>
                                <th className="pb-3 text-right">Toplam Süre</th>
                                <th className="pb-3 text-right">Seans</th>
                                <th className="pb-3 text-right">Ort. Seans</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {courseDist.map((c, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                    <td className="py-3 flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || COLORS[idx % COLORS.length] }} />
                                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">{c.name}</span>
                                    </td>
                                    <td className="py-3 text-right font-bold text-gray-800 dark:text-white">{c.hours} sa</td>
                                    <td className="py-3 text-right text-gray-500 font-medium">{c.sessionCount}</td>
                                    <td className="py-3 text-right text-gray-500 font-medium">
                                        {c.sessionCount > 0 ? `${Math.round(c.value / c.sessionCount)} dk` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-400 text-center py-8 text-sm">Seçili dönemde çalışma verisi bulunamadı.</p>
                )}
            </Card>

            {/* Streak Card */}
            <Card className="p-6 flex items-center gap-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white border-none shadow-lg shadow-orange-500/20">
                <div className="text-5xl font-black">{streak || 0}</div>
                <div>
                    <p className="font-black text-lg">Günlük Seri 🔥</p>
                    <p className="text-orange-100 text-sm">Bugün de çalış, serini kır!</p>
                </div>
            </Card>
        </div>
    )
}
