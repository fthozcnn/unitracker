import { useState } from 'react'
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, format, isSameMonth, isSameDay,
    addMonths, subMonths, differenceInDays, isPast
} from 'date-fns'
import { tr } from 'date-fns/locale'
import {
    ChevronLeft, ChevronRight, Plus,
    CalendarDays, ListChecks, CheckCircle2, Circle, Clock, Trash2,
    FileDown, FileUp
} from 'lucide-react'
import { Button, Card } from '../components/ui-base'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AddAssignmentModal, { EVENT_TYPES } from '../components/AddAssignmentModal'
import clsx from 'clsx'

type Assignment = {
    id: string
    user_id: string
    course_id: string
    title: string
    type: string
    due_date: string
    description?: string
    is_completed: boolean
    courses?: { name: string; color: string }
}

// Types that can be completed (not exams/quizzes)
const COMPLETABLE_TYPES = ['homework', 'project', 'review', 'other']

function getTypeConfig(type: string) {
    return EVENT_TYPES.find(t => t.value === type) || { value: type, label: type, emoji: '📌' }
}

function DaysUntil({ date }: { date: string }) {
    const days = differenceInDays(new Date(date), new Date())
    if (days < 0) return <span className="text-[10px] font-bold text-gray-400 uppercase">Geçti</span>
    if (days === 0) return <span className="text-[10px] font-black text-red-600 uppercase animate-pulse">Bugün!</span>
    if (days === 1) return <span className="text-[10px] font-black text-orange-500 uppercase">Yarın</span>
    return (
        <div className="text-right">
            <p className="text-xl font-black text-red-600 leading-none">{days}</p>
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-tighter">GÜN KALDI</p>
        </div>
    )
}

export default function CalendarPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [activeTab, setActiveTab] = useState<'calendar' | 'events'>('calendar')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

    // All assignments for calendar month
    const { data: assignments = [] } = useQuery<Assignment[]>({
        queryKey: ['assignments', format(currentDate, 'yyyy-MM')],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select('*, courses (name, color)')
                .eq('user_id', user?.id)
                .gte('due_date', startDate.toISOString())
                .lte('due_date', endDate.toISOString())
            return (data || []) as Assignment[]
        }
    })

    // Upcoming events for Etkinlikler tab (next 60 days)
    const { data: upcomingEvents = [] } = useQuery<Assignment[]>({
        queryKey: ['upcoming_events', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('assignments')
                .select('*, courses (name, color)')
                .eq('user_id', user?.id)
                .order('due_date', { ascending: true })
            return (data || []) as Assignment[]
        }
    })

    const completeMutation = useMutation({
        mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
            const { error } = await supabase.from('assignments').update({ is_completed: completed }).eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
            queryClient.invalidateQueries({ queryKey: ['assignments'] })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('assignments').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
            queryClient.invalidateQueries({ queryKey: ['assignments'] })
        }
    })

    // Open new event modal on empty day click
    const handleDayClick = (day: Date) => {
        setEditingAssignment(null)
        setSelectedDate(day)
        setIsModalOpen(true)
    }

    // Open edit modal when clicking an event chip
    const handleEventClick = (e: React.MouseEvent, assignment: Assignment) => {
        e.stopPropagation()
        setEditingAssignment(assignment)
        setSelectedDate(null)
        setIsModalOpen(true)
    }

    const getDayAssignments = (day: Date) =>
        assignments.filter(a => isSameDay(new Date(a.due_date), day))

    // Group upcoming events by type
    const groupByType = (events: Assignment[]) => {
        const groups: Record<string, Assignment[]> = {}
        EVENT_TYPES.forEach(t => { groups[t.value] = [] })
        events.forEach(e => {
            if (groups[e.type]) groups[e.type].push(e)
            else groups['other'].push(e)
        })
        return groups
    }

    const upcomingGroups = groupByType(upcomingEvents)

    // Export calendar to JSON
    const handleExport = () => {
        const allEvts = upcomingEvents
        if (!allEvts.length) { alert('Dışa aktarılacak etkinlik bulunamadı.'); return }
        const exportData = {
            title: 'Akademik Takvim',
            exported_at: new Date().toISOString(),
            assignments: allEvts.map(a => ({
                title: a.title,
                type: a.type,
                course: a.courses?.name || '',
                due_date: a.due_date,
                is_completed: a.is_completed,
            }))
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const el = document.createElement('a')
        el.href = url
        el.download = `takvim-${format(new Date(), 'yyyy-MM-dd')}.json`
        document.body.appendChild(el)
        el.click()
        document.body.removeChild(el)
        URL.revokeObjectURL(url)
    }

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string)
                if (!json.assignments || !Array.isArray(json.assignments)) {
                    alert('Dosya formatı hatalı. Lütfen daha önce dışa aktardığınız bir JSON dosyası kullanın.')
                    return
                }
                // Get courses to match names
                const { data: courses } = await supabase.from('courses').select('id, name').eq('user_id', user?.id)
                const courseMap: Record<string, string> = {}
                courses?.forEach((c: any) => { courseMap[c.name] = c.id })

                let imported = 0
                for (const a of json.assignments) {
                    const courseId = courseMap[a.course]
                    if (!courseId || !a.title || !a.due_date) continue
                    await supabase.from('assignments').insert({
                        user_id: user?.id,
                        course_id: courseId,
                        title: a.title,
                        type: a.type || 'other',
                        due_date: a.due_date,
                        is_completed: a.is_completed || false,
                    })
                    imported++
                }
                await queryClient.invalidateQueries({ queryKey: ['assignments'] })
                await queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
                alert(`${imported} etkinlik başarıyla içe aktarıldı!`)
            } catch {
                alert('Dosya okunamadı. Geçerli bir JSON dosyası seçin.')
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Header — clean, no export button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Takvim</h1>
                    <p className="text-sm font-medium text-gray-500 mt-0.5">Etkinlikler, sınavlar ve önemli tarihler.</p>
                </div>
                <Button
                    onClick={() => { setEditingAssignment(null); setSelectedDate(new Date()); setIsModalOpen(true) }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Etkinlik Ekle
                </Button>
            </div>

            {/* Tab Bar */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-fit gap-1">
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'calendar'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <CalendarDays className="h-4 w-4" />
                    Takvim
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'events'
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <ListChecks className="h-4 w-4" />
                    Etkinlikler
                </button>
            </div>

            {/* ── TAB 1: CALENDAR ── */}
            {activeTab === 'calendar' && (
                <Card className="p-4 md:p-6 border-none shadow-xl shadow-gray-200/50 dark:shadow-none">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white capitalize tracking-tight">
                            {format(currentDate, 'MMMM yyyy', { locale: tr })}
                        </h2>
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                            <Button variant="ghost" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="h-8 w-8 p-0">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" onClick={() => setCurrentDate(new Date())} className="h-8 px-3 text-xs font-bold">
                                Bugün
                            </Button>
                            <Button variant="ghost" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="h-8 w-8 p-0">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {EVENT_TYPES.map(t => (
                            <span key={t.value} className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                <span>{t.emoji}</span>{t.label}
                            </span>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                            <div key={d} className="bg-gray-50/80 dark:bg-gray-900/60 p-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {d}
                            </div>
                        ))}
                        {calendarDays.map(day => {
                            const dayAssignments = getDayAssignments(day)
                            const isToday = isSameDay(day, new Date())
                            const inMonth = isSameMonth(day, currentDate)
                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => handleDayClick(day)}
                                    className={clsx(
                                        'bg-white dark:bg-gray-800 min-h-[90px] p-1.5 transition-colors cursor-pointer flex flex-col group',
                                        !inMonth && 'opacity-30',
                                        inMonth && 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                                    )}
                                >
                                    <span className={clsx(
                                        'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 self-start',
                                        isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-gray-700 dark:text-gray-300'
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    <div className="flex flex-col gap-0.5 flex-1">
                                        {dayAssignments.slice(0, 3).map(a => {
                                            const cfg = getTypeConfig(a.type)
                                            return (
                                                <div
                                                    key={a.id}
                                                    onClick={e => handleEventClick(e, a)}
                                                    title={`${cfg.label}: ${a.title} — Düzenlemek için tıkla`}
                                                    className={clsx(
                                                        'text-[10px] px-1.5 py-0.5 rounded-md truncate text-white font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity',
                                                        a.is_completed && 'opacity-50 line-through'
                                                    )}
                                                    style={{ backgroundColor: a.courses?.color || '#3b82f6' }}
                                                >
                                                    <span className="text-[8px]">{cfg.emoji}</span>
                                                    {a.title}
                                                </div>
                                            )
                                        })}
                                        {dayAssignments.length > 3 && (
                                            <span className="text-[9px] text-gray-400 font-bold pl-1">+{dayAssignments.length - 3} daha</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <p className="text-[11px] text-gray-400 text-center mt-3 font-medium">💡 Boş güne tıklayarak etkinlik ekle, etkinliğe tıklayarak düzenle</p>
                </Card>
            )}

            {/* ── TAB 2: EVENTS ── */}
            {activeTab === 'events' && (
                <div className="space-y-8">
                    {EVENT_TYPES.map(typeConfig => {
                        const events = upcomingGroups[typeConfig.value] || []
                        const pending = events.filter(e => !e.is_completed)
                        const completed = events.filter(e => e.is_completed)
                        const canComplete = COMPLETABLE_TYPES.includes(typeConfig.value)

                        if (events.length === 0) return null

                        return (
                            <div key={typeConfig.value} className="space-y-3">
                                <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="text-xl">{typeConfig.emoji}</span>
                                    {typeConfig.label}lar
                                    {pending.length > 0 && (
                                        <span className="ml-1 text-xs font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                            {pending.length}
                                        </span>
                                    )}
                                </h2>

                                {/* Pending events */}
                                <div className="space-y-2">
                                    {pending.map(event => (
                                        <Card
                                            key={event.id}
                                            className={clsx(
                                                'p-4 flex items-center justify-between gap-3 transition-all hover:shadow-md',
                                                isPast(new Date(event.due_date)) && 'border-red-200 dark:border-red-800/50'
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {/* Color strip */}
                                                <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: event.courses?.color || '#94a3b8' }} />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{event.title}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {event.courses?.name && (
                                                            <span className="text-[10px] font-bold text-gray-400 truncate">{event.courses.name}</span>
                                                        )}
                                                        <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                                                        <span className="text-[10px] font-bold text-gray-400">
                                                            {format(new Date(event.due_date), 'd MMM HH:mm', { locale: tr })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <DaysUntil date={event.due_date} />
                                                {canComplete && (
                                                    <button
                                                        onClick={() => completeMutation.mutate({ id: event.id, completed: true })}
                                                        title="Tamamla"
                                                        className="p-2 rounded-xl text-gray-300 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                                                    >
                                                        <Circle className="h-5 w-5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setEditingAssignment(event); setIsModalOpen(true) }}
                                                    title="Düzenle"
                                                    className="p-2 rounded-xl text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                                >
                                                    <Clock className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`"${event.title}" silinsin mi?`)) {
                                                            deleteMutation.mutate(event.id)
                                                        }
                                                    }}
                                                    title="Sil"
                                                    className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>

                                {/* Completed events (last 3) */}
                                {canComplete && completed.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tamamlananlar</p>
                                        {completed.slice(0, 3).map(event => (
                                            <Card key={event.id} className="p-3 flex items-center justify-between gap-3 opacity-60">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: event.courses?.color || '#94a3b8' }} />
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate line-through">{event.title}</p>
                                                </div>
                                                <button
                                                    onClick={() => completeMutation.mutate({ id: event.id, completed: false })}
                                                    title="Geri al"
                                                    className="p-1.5 rounded-lg text-green-500 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </button>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {upcomingEvents.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p className="font-semibold">Henüz etkinlik yok.</p>
                            <p className="text-sm mt-1">Yukarıdaki "Etkinlik Ekle" butonunu kullan!</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── EXPORT / IMPORT SECTION ── */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-3">Veri Aktar</h3>
                <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={handleExport} className="text-sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Dışa Aktar (.json)
                    </Button>
                    <label className="cursor-pointer">
                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <FileUp className="h-4 w-4" />
                            İçe Aktar (.json)
                        </span>
                    </label>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">İçe aktarma için dışa aktarılan JSON formatı kullanılmalıdır. Ders isimleri eşleşmeli.</p>
            </div>

            <AddAssignmentModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingAssignment(null) }}
                defaultDate={selectedDate}
                editingAssignment={editingAssignment}
            />
        </div>
    )
}
