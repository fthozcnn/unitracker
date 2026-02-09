import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui-base'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { startOfWeek, endOfWeek, subWeeks, format, eachDayOfInterval } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function Analytics() {
    const { user } = useAuth()

    // Weekly Study Data
    const { data: weeklyData } = useQuery({
        queryKey: ['analytics_weekly'],
        queryFn: async () => {
            const start = startOfWeek(new Date(), { weekStartsOn: 1 })
            const end = endOfWeek(new Date(), { weekStartsOn: 1 })

            const { data } = await supabase
                .from('study_sessions')
                .select('*')
                .eq('user_id', user?.id)
                .gte('start_time', start.toISOString())
                .lte('end_time', end.toISOString())

            // Group by day
            const days = eachDayOfInterval({ start, end })
            return days.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd')
                const daySessions = data?.filter(s => s.start_time.startsWith(dayStr)) || []
                const totalDuration = daySessions.reduce((acc, curr) => acc + (curr.duration || 0), 0)
                return {
                    name: format(day, 'EEE', { locale: tr }),
                    duration: Math.round(totalDuration / 60) // minutes
                }
            })
        }
    })

    // Course Distribution
    const { data: courseDist } = useQuery({
        queryKey: ['analytics_dist'],
        queryFn: async () => {
            const { data: sessions } = await supabase
                .from('study_sessions')
                .select('duration, courses(name, color)')
                .eq('user_id', user?.id)

            const dist: Record<string, { name: string, value: number, color: string }> = {}

            sessions?.forEach((s: any) => {
                const courseName = s.courses?.name || 'Diğer'
                if (!dist[courseName]) {
                    dist[courseName] = {
                        name: courseName,
                        value: 0,
                        color: s.courses?.color || '#cbd5e1'
                    }
                }
                dist[courseName].value += (s.duration || 0)
            })

            return Object.values(dist).map(d => ({ ...d, value: Math.round(d.value / 60) }))
        }
    })

    // Streak Calculation (Simple version)
    const { data: streak } = useQuery({
        queryKey: ['streak'],
        queryFn: async () => {
            // Fetch unique dates from study sessions in descending order
            const { data } = await supabase
                .from('study_sessions')
                .select('start_time')
                .eq('user_id', user?.id)
                .order('start_time', { ascending: false })

            if (!data || data.length === 0) return 0

            const uniqueDates = Array.from(new Set(data.map(s => s.start_time.split('T')[0])))
            let currentStreak = 0
            const today = new Date().toISOString().split('T')[0]
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

            // If last study was today or yesterday, streak is active
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                currentStreak = 1
                let checkDate = new Date(uniqueDates[0])

                for (let i = 1; i < uniqueDates.length; i++) {
                    checkDate.setDate(checkDate.getDate() - 1)
                    const expectedDateStr = checkDate.toISOString().split('T')[0]
                    if (uniqueDates[i] === expectedDateStr) {
                        currentStreak++
                    } else {
                        break
                    }
                }
            }
            return currentStreak
        }
    })

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analizler</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                    <h3 className="text-sm font-medium text-gray-500">Mevcut Seri (Streak)</h3>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        {streak || 0} <span className="text-sm font-normal text-gray-500">Gün</span>
                    </p>
                </Card>
                <Card className="p-6">
                    <h3 className="text-sm font-medium text-gray-500">Bu Haftaki Çalışma</h3>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        {weeklyData?.reduce((acc, curr) => acc + curr.duration, 0) || 0} <span className="text-sm font-normal text-gray-500">Dk</span>
                    </p>
                </Card>
                <Card className="p-6">
                    <h3 className="text-sm font-medium text-gray-500">En Çok Çalışılan Ders</h3>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-2 truncate">
                        {courseDist && courseDist.length > 0 ? courseDist.sort((a, b) => b.value - a.value)[0]?.name : '-'}
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Chart */}
                <Card className="p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Haftalık Çalışma Süresi (Dakika)</h3>
                    <div className="h-[300px]">
                        {weeklyData && weeklyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData}>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="duration" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <p>Henüz çalışma verisi yok</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Distribution Chart */}
                <Card className="p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Ders Bazlı Dağılım</h3>
                    <div className="h-[300px]">
                        {courseDist && courseDist.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={courseDist}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {courseDist.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex flex-wrap gap-2 justify-center mt-4">
                                    {courseDist.map((entry, index) => (
                                        <div key={index} className="flex items-center text-xs text-gray-500">
                                            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }} />
                                            {entry.name}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <p>Ders dağılımı için veri yok</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
