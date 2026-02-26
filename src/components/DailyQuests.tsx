import { CheckCircle2, Flame, Target, Zap } from 'lucide-react'
import { Card } from './ui-base'

interface DailyQuestsProps {
    totalMinutesToday: number
    assignmentsCompletedToday: number
    currentStreak: number
    studiedToday: boolean
}

export default function DailyQuests({ totalMinutesToday, assignmentsCompletedToday, currentStreak, studiedToday }: DailyQuestsProps) {
    const goals = [
        {
            id: 'focus',
            title: 'Odaklanma Ustası',
            description: 'Bugün 2 saat çalış (120 dk)',
            icon: <Flame className="w-5 h-5 text-orange-500" />,
            current: totalMinutesToday,
            target: 120,
            color: 'bg-orange-500'
        },
        {
            id: 'task',
            title: 'Görev Avcısı',
            description: '1 ödev veya sınav tamamla',
            icon: <Target className="w-5 h-5 text-blue-500" />,
            current: assignmentsCompletedToday,
            target: 1,
            color: 'bg-blue-500'
        },
        {
            id: 'streak',
            title: 'Zinciri Kırma',
            description: currentStreak > 0 ? `Serin: ${currentStreak} gün — bugün de çalış!` : 'Bugün en az bir çalışma seansı başlat',
            icon: <Zap className="w-5 h-5 text-yellow-500" />,
            current: studiedToday ? 1 : 0,
            target: 1,
            color: 'bg-yellow-500'
        }
    ]

    return (
        <Card className="p-6 border-2 border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-gray-900">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                        <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Günlük Görevler</h3>
                        <p className="text-xs text-gray-500">Bugünün hedeflerini tamamla</p>
                    </div>
                </div>
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                    {goals.filter(g => g.current >= g.target).length} / 3 Tamamlandı
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
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <span className="text-xs font-black text-gray-400">
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
