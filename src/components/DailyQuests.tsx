import { CheckCircle2, Flame, Target, Zap, Coffee, BookOpen, Layers, Sun, Play } from 'lucide-react'
import { Card } from './ui-base'

interface DailyQuestsProps {
    totalMinutesToday: number
    studiedToday: boolean
    currentStreak: number
    pomodoroCountToday: number
    longSessionToday: boolean
    differentCoursesToday: number
    earlyBirdToday: boolean
    sessionsCountToday: number
}

export default function DailyQuests({
    totalMinutesToday,
    studiedToday,
    currentStreak,
    pomodoroCountToday,
    longSessionToday,
    differentCoursesToday,
    earlyBirdToday,
    sessionsCountToday,
}: DailyQuestsProps) {

    // Day-based rotation: changes every day, stable within the day
    const dayIndex = Math.floor(Date.now() / 86400000) % 6

    type Quest = {
        id: string
        title: string
        description: string
        icon: React.ReactNode
        current: number
        target: number
        color: string
    }

    const QUEST_SETS: Quest[][] = [
        // Gün 0 — Klasik
        [
            {
                id: 'focus_2h', title: 'Odaklanma Ustası',
                description: 'Bugün toplam 2 saat çalış',
                icon: <Flame className="w-5 h-5 text-orange-500" />,
                current: totalMinutesToday, target: 120, color: 'bg-orange-500'
            },
            {
                id: 'pomodoro', title: 'Pomodoro Savaşçısı',
                description: '2 pomodoro seansı (20-35 dk) tamamla',
                icon: <Coffee className="w-5 h-5 text-red-500" />,
                current: pomodoroCountToday, target: 2, color: 'bg-red-500'
            },
            {
                id: 'streak', title: 'Zinciri Kırma',
                description: currentStreak > 0 ? `Serin: ${currentStreak} gün — bugün de çalış!` : 'Bugün en az bir çalışma seansı başlat',
                icon: <Zap className="w-5 h-5 text-yellow-500" />,
                current: studiedToday ? 1 : 0, target: 1, color: 'bg-yellow-500'
            },
        ],
        // Gün 1 — Uzun Oturum
        [
            {
                id: 'marathon', title: 'Maraton Koşucusu',
                description: 'En az 30 dk kesintisiz çalış',
                icon: <Target className="w-5 h-5 text-purple-500" />,
                current: longSessionToday ? 1 : 0, target: 1, color: 'bg-purple-500'
            },
            {
                id: 'multi_session', title: 'Seri Seanslar',
                description: 'Bugün 3 ayrı çalışma seansı başlat',
                icon: <Play className="w-5 h-5 text-blue-500" />,
                current: sessionsCountToday, target: 3, color: 'bg-blue-500'
            },
            {
                id: 'streak', title: 'Zinciri Kırma',
                description: currentStreak > 0 ? `Serin: ${currentStreak} gün — bugün de çalış!` : 'Bugün en az bir çalışma seansı başlat',
                icon: <Zap className="w-5 h-5 text-yellow-500" />,
                current: studiedToday ? 1 : 0, target: 1, color: 'bg-yellow-500'
            },
        ],
        // Gün 2 — Çeşitlilik
        [
            {
                id: 'diverse', title: 'Çok Yönlü Öğrenci',
                description: '2 farklı derste çalış',
                icon: <Layers className="w-5 h-5 text-indigo-500" />,
                current: differentCoursesToday, target: 2, color: 'bg-indigo-500'
            },
            {
                id: 'mini_focus', title: 'Hafif Başlangıç',
                description: 'Bugün toplam 45 dk çalış',
                icon: <BookOpen className="w-5 h-5 text-green-500" />,
                current: totalMinutesToday, target: 45, color: 'bg-green-500'
            },
            {
                id: 'pomodoro3', title: 'Pomodoro Ustası',
                description: '3 pomodoro seansı (20-35 dk) tamamla',
                icon: <Coffee className="w-5 h-5 text-red-500" />,
                current: pomodoroCountToday, target: 3, color: 'bg-red-500'
            },
        ],
        // Gün 3 — Sabahçı
        [
            {
                id: 'earlybird', title: 'Sabah Kuşu',
                description: 'Sabah 08:00\'den önce çalışmaya başla',
                icon: <Sun className="w-5 h-5 text-amber-500" />,
                current: earlyBirdToday ? 1 : 0, target: 1, color: 'bg-amber-500'
            },
            {
                id: 'focus_90', title: 'Odak Bloğu',
                description: 'Bugün 90 dk çalış',
                icon: <Flame className="w-5 h-5 text-orange-500" />,
                current: totalMinutesToday, target: 90, color: 'bg-orange-500'
            },
            {
                id: 'streak', title: 'Zinciri Kırma',
                description: currentStreak > 0 ? `Serin: ${currentStreak} gün — bugün de çalış!` : 'Bugün en az bir çalışma seansı başlat',
                icon: <Zap className="w-5 h-5 text-yellow-500" />,
                current: studiedToday ? 1 : 0, target: 1, color: 'bg-yellow-500'
            },
        ],
        // Gün 4 — Zorlayıcı
        [
            {
                id: 'focus_3h', title: 'Süper Odaklanma',
                description: 'Bugün toplam 3 saat çalış',
                icon: <Flame className="w-5 h-5 text-orange-600" />,
                current: totalMinutesToday, target: 180, color: 'bg-orange-600'
            },
            {
                id: 'diverse2', title: 'Çok Yönlü Öğrenci',
                description: '3 farklı derste çalış',
                icon: <Layers className="w-5 h-5 text-indigo-500" />,
                current: differentCoursesToday, target: 3, color: 'bg-indigo-500'
            },
            {
                id: 'multi4', title: 'Çalışma Makinesi',
                description: '4 ayrı çalışma seansı başlat',
                icon: <Play className="w-5 h-5 text-blue-600" />,
                current: sessionsCountToday, target: 4, color: 'bg-blue-600'
            },
        ],
        // Gün 5 — Dengeli
        [
            {
                id: 'long30', title: 'Derin Odak',
                description: 'En az 45 dk kesintisiz çalış',
                icon: <Target className="w-5 h-5 text-purple-600" />,
                current: longSessionToday ? 1 : 0, target: 1, color: 'bg-purple-600'
            },
            {
                id: 'pomodoro2b', title: 'Pomodoro Savaşçısı',
                description: '2 pomodoro seansı tamamla',
                icon: <Coffee className="w-5 h-5 text-red-500" />,
                current: pomodoroCountToday, target: 2, color: 'bg-red-500'
            },
            {
                id: 'streak', title: 'Zinciri Kırma',
                description: currentStreak > 0 ? `Serin: ${currentStreak} gün — bugün de çalış!` : 'Bugün en az bir çalışma seansı başlat',
                icon: <Zap className="w-5 h-5 text-yellow-500" />,
                current: studiedToday ? 1 : 0, target: 1, color: 'bg-yellow-500'
            },
        ],
    ]

    const goals = QUEST_SETS[dayIndex]
    const completedCount = goals.filter(g => g.current >= g.target).length

    // Show which day rotation we're on (small label)
    const DAY_LABELS = ['Klasik', 'Uzun Oturum', 'Çeşitlilik', 'Sabahçı', 'Zorlayıcı', 'Dengeli']

    return (
        <Card className="p-6 border-2 border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-gray-900">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                        <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Günlük Görevler
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 rounded-full uppercase tracking-wide">
                                {DAY_LABELS[dayIndex]}
                            </span>
                        </h3>
                        <p className="text-xs text-gray-500">Bugünün hedeflerini tamamla</p>
                    </div>
                </div>
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                    {completedCount} / 3 Tamamlandı
                </div>
            </div>

            <div className="space-y-4">
                {goals.map((goal) => {
                    const isCompleted = goal.current >= goal.target
                    const progress = Math.min((goal.current / goal.target) * 100, 100)

                    return (
                        <div key={goal.id} className={`p-4 rounded-xl border transition-all ${isCompleted ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex gap-4">
                                <div className={`mt-1 flex-shrink-0 ${isCompleted ? 'opacity-50 grayscale' : ''}`}>
                                    {goal.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <h4 className={`text-sm font-bold ${isCompleted ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                {goal.title}
                                            </h4>
                                            <p className="text-xs text-gray-500">{goal.description}</p>
                                        </div>
                                        {isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        ) : (
                                            <span className="text-xs font-black text-gray-400 shrink-0">
                                                {Math.floor(goal.current)}/{goal.target}
                                            </span>
                                        )}
                                    </div>
                                    {!isCompleted && (
                                        <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${goal.color}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}
