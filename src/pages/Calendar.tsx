import { useState } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, differenceInDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, Download } from 'lucide-react'
import { Button, Card } from '../components/ui-base'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AddAssignmentModal from '../components/AddAssignmentModal'

export default function CalendarPage() {
    const { user } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

    // Fetch calendar assignments (month view)
    const { data: assignments } = useQuery({
        queryKey: ['assignments', format(currentDate, 'yyyy-MM')],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select(`
                  *,
                  courses (name, color)
                `)
                .eq('user_id', user?.id)
                .gte('due_date', startDate.toISOString())
                .lte('due_date', endDate.toISOString())

            return data || []
        }
    })

    // Fetch future exams and projects for countdown
    const { data: futureExamsProjects } = useQuery({
        queryKey: ['future_exams_projects', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select(`
                    *,
                    courses (name, color)
                `)
                .eq('user_id', user?.id)
                .in('type', ['exam', 'project'])
                .gte('due_date', new Date().toISOString())
                .order('due_date', { ascending: true })
            return data || []
        }
    })

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const handleDayClick = (day: Date) => {
        setSelectedDate(day)
        setIsModalOpen(true)
    }

    const getDayContent = (day: Date) => {
        const dayAssignments = assignments?.filter(a => isSameDay(new Date(a.due_date), day)) || []
        return (
            <div className="flex flex-col gap-1 mt-1">
                {dayAssignments.map((assignment: any) => (
                    <div
                        key={assignment.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: assignment.courses?.color || '#3b82f6' }}
                        title={assignment.title}
                    >
                        {assignment.title}
                    </div>
                ))}
            </div>
        )
    }

    const exams = futureExamsProjects?.filter(a => a.type === 'exam') || []
    const projects = futureExamsProjects?.filter(a => a.type === 'project') || []

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Takvim</h1>
                    <p className="text-sm font-medium text-gray-500">Önemli tarihler ve geri sayımlar.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            if (!assignments || assignments.length === 0) {
                                alert('İndirilecek takvim verisi bulunamadı.')
                                return
                            }
                            const exportData = {
                                title: 'Akademik Takvim',
                                exported_at: new Date().toISOString(),
                                assignments: assignments.map((a: any) => ({
                                    title: a.title,
                                    type: a.type === 'exam' ? 'Sınav' : a.type === 'project' ? 'Proje' : a.type === 'homework' ? 'Ödev' : a.type,
                                    course: a.courses?.name || '',
                                    due_date: a.due_date,
                                    description: a.description || ''
                                }))
                            }
                            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `takvim-${format(currentDate, 'yyyy-MM')}.json`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                        }}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Takvimi İndir
                    </Button>
                    <Button onClick={() => { setSelectedDate(new Date()); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-5 w-5 mr-2" />
                        Yeni Görev Ekle
                    </Button>
                </div>
            </div>

            {/* Countdown Cards section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Exams Countdown */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Yaklaşan Sınavlar
                    </h2>
                    {exams.length === 0 ? (
                        <Card className="p-6 text-center text-gray-400 border-dashed">Kayıtlı sınav bulunamadı.</Card>
                    ) : (
                        <div className="space-y-3">
                            {exams.slice(0, 3).map((exam: any) => {
                                const days = differenceInDays(new Date(exam.due_date), new Date())
                                return (
                                    <Card key={exam.id} className="p-4 flex items-center justify-between group hover:border-red-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: exam.courses?.color }} />
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{exam.title}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{format(new Date(exam.due_date), 'd MMMM yyyy', { locale: tr })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-red-600">{days}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-tighter">GÜN KALDI</p>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Projects Countdown */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Yaklaşan Projeler
                    </h2>
                    {projects.length === 0 ? (
                        <Card className="p-6 text-center text-gray-400 border-dashed">Kayıtlı proje bulunamadı.</Card>
                    ) : (
                        <div className="space-y-3">
                            {projects.slice(0, 3).map((project: any) => {
                                const days = differenceInDays(new Date(project.due_date), new Date())
                                return (
                                    <Card key={project.id} className="p-4 flex items-center justify-between group hover:border-blue-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: project.courses?.color }} />
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{project.title}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{format(new Date(project.due_date), 'd MMMM yyyy', { locale: tr })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-blue-600">{days}</p>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-tighter">GÜN KALDI</p>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Monthly Calendar View (Now at bottom) */}
            <Card className="p-6 border-none shadow-xl shadow-gray-200/50 dark:shadow-none">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white capitalize tracking-tight">
                        {format(currentDate, 'MMMM yyyy', { locale: tr })}
                    </h2>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <Button variant="ghost" onClick={handlePrevMonth} className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-gray-700">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" onClick={handleNextMonth} className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-gray-700">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                    {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
                        <div key={day} className="bg-gray-50/50 dark:bg-gray-900/50 p-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {day}
                        </div>
                    ))}
                    {calendarDays.map((day) => (
                        <div
                            key={day.toString()}
                            className={`bg-white dark:bg-gray-800 min-h-[100px] p-2 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer flex flex-col ${!isSameMonth(day, currentDate) ? 'bg-gray-50/20 dark:bg-gray-900/20 opacity-40' : ''}`}
                            onClick={() => handleDayClick(day)}
                        >
                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-700 dark:text-gray-300'}`}>
                                {format(day, 'd')}
                            </span>
                            {getDayContent(day)}
                        </div>
                    ))}
                </div>
            </Card>

            <AddAssignmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultDate={selectedDate}
            />
        </div>
    )
}
