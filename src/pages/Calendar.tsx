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
    FileDown, FileUp, UserPlus, Share2, Check, X, Inbox
} from 'lucide-react'
import { Button, Card } from '../components/ui-base'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AddAssignmentModal, { EVENT_TYPES } from '../components/AddAssignmentModal'
import clsx from 'clsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = differenceInDays(target, today)
    
    if (days < 0) return null
    if (days === 0) return (
        <div className="text-right">
            <span className="text-xs font-black text-red-600 animate-pulse uppercase tracking-wider">BUGÜN!</span>
        </div>
    )
    if (days === 1) return (
        <div className="text-right">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">YARIN</span>
        </div>
    )
    return (
        <div className="text-right">
            <p className="text-xl font-black text-red-600 leading-none">{days}</p>
            <p className="text-[9px] uppercase font-bold text-gray-400 tracking-tighter">GÜN KALDI</p>
        </div>
    )
}

export default function CalendarPage() {
    const { user } = useAuth()
    useDocumentTitle('Akademik Takvim & Görevler', {
        description: 'Sınav tarihleri, ödev teslimleri, projeler ve kişisel etkinlik takvimi.'
    })
    const queryClient = useQueryClient()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [activeTab, setActiveTab] = useState<'calendar' | 'events'>('calendar')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)

    // Share state
    const [sharingEvent, setSharingEvent] = useState<Assignment | null>(null)
    const [selectedFriendId, setSelectedFriendId] = useState('')
    const [shareLoading, setShareLoading] = useState(false)
    const [shareSuccess, setShareSuccess] = useState('')

    // Accept state
    const [acceptingShare, setAcceptingShare] = useState<any | null>(null)
    const [acceptCourseId, setAcceptCourseId] = useState('')
    const [acceptLoading, setAcceptLoading] = useState(false)

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

    // Upcoming events for Etkinlikler tab (F8: limit to next 90 days + incomplete)
    const { data: upcomingEvents = [] } = useQuery<Assignment[]>({
        queryKey: ['upcoming_events', user?.id],
        queryFn: async () => {
            const now = new Date()
            const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
            const { data } = await supabase
                .from('assignments')
                .select('*, courses (name, color)')
                .eq('user_id', user?.id)
                .gte('due_date', now.toISOString())
                .lte('due_date', futureDate.toISOString())
                .order('due_date', { ascending: true })
                .limit(100)
            return (data || []) as Assignment[]
        }
    })

    // Friends (for share picker)
    const { data: friends = [] } = useQuery({
        queryKey: ['friends_for_share'],
        queryFn: async () => {
            const { data } = await supabase
                .from('friendships')
                .select('friend:friend_id (id, email, display_name)')
                .eq('user_id', user?.id)
                .eq('status', 'accepted')
            return (data || []).map((f: any) => f.friend).filter(Boolean)
        }
    })

    // My courses (for accept picker)
    const { data: myCourses = [] } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('id, name').eq('user_id', user?.id)
            return data || []
        }
    })

    // Incoming pending shares
    const { data: incomingShares = [] } = useQuery({
        queryKey: ['incoming_shares', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('event_shares')
                .select('*, sender:sender_id (display_name, email)')
                .eq('receiver_id', user?.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
            return data || []
        },
        refetchInterval: 60000,  // F17: reduced from 15s to 60s
    })

    // Send share
    const sendShare = async (event: Assignment) => {
        if (!selectedFriendId) return
        setShareLoading(true)
        try {
            const { error } = await supabase.from('event_shares').insert({
                sender_id: user?.id,
                receiver_id: selectedFriendId,
                title: event.title,
                type: event.type,
                due_date: event.due_date,
            })
            if (error) throw error
            setShareSuccess('Etkinlik paylaşıldı! ✅')
            setTimeout(() => { setSharingEvent(null); setShareSuccess(''); setSelectedFriendId('') }, 1500)
        } catch (err: any) {
            alert(err.message || 'Paylaşım hatası')
        } finally {
            setShareLoading(false)
        }
    }

    // Accept share
    const acceptShare = async () => {
        if (!acceptingShare || !acceptCourseId) return
        setAcceptLoading(true)
        try {
            const { error: insertErr } = await supabase.from('assignments').insert({
                user_id: user?.id,
                course_id: acceptCourseId,
                title: acceptingShare.title,
                type: acceptingShare.type,
                due_date: acceptingShare.due_date,
                is_completed: false,
            })
            if (insertErr) throw insertErr
            await supabase.from('event_shares').update({ status: 'accepted' }).eq('id', acceptingShare.id)
            queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
            queryClient.invalidateQueries({ queryKey: ['assignments'] })
            queryClient.invalidateQueries({ queryKey: ['incoming_shares'] })
            setAcceptingShare(null)
            setAcceptCourseId('')
        } catch (err: any) {
            alert(err.message || 'Kabul hatası')
        } finally {
            setAcceptLoading(false)
        }
    }

    const declineShare = async (shareId: string) => {
        await supabase.from('event_shares').update({ status: 'declined' }).eq('id', shareId)
        queryClient.invalidateQueries({ queryKey: ['incoming_shares'] })
    }

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

    const downloadCalendarTemplate = () => {
        const header = 'Tür,Ders,Başlık,Tarih,Saat'
        const examples = [
            'homework,Matematiğe Giriş,Matematik Ödevi,2026-05-15,23:59',
            'exam,Fizik I,Vize Sınavı,2026-05-20,10:30',
            'project,Bilgisayar Mimarisi,Proje Teslimi,2026-05-25,17:00',
        ].join('\n')
        const content = `${header}\n${examples}`
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const el = document.createElement('a')
        el.href = url
        el.download = 'takvim_sablonu.csv'
        document.body.appendChild(el)
        el.click()
        document.body.removeChild(el)
        URL.revokeObjectURL(url)
    }

    const handleCSVExport = () => {
        const allEvts = upcomingEvents
        if (!allEvts.length) { alert('Dışa aktarılacak etkinlik bulunamadı.'); return }
        const header = 'Tür,Ders,Başlık,Tarih,Saat'
        const rows = allEvts.map(a => {
            const type = a.type || 'other'
            const course = `"${(a.courses?.name || '').replace(/"/g, '""')}"`
            const title = `"${(a.title || '').replace(/"/g, '""')}"`
            const date = a.due_date ? a.due_date.split('T')[0] : ''
            const time = a.due_date ? a.due_date.split('T')[1].slice(0, 5) : '09:00'
            return `${type},${course},${title},${date},${time}`
        })
        const content = `${header}\n${rows.join('\n')}`
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const el = document.createElement('a')
        el.href = url
        el.download = `takvim-${format(new Date(), 'yyyy-MM-dd')}.csv`
        document.body.appendChild(el)
        el.click()
        document.body.removeChild(el)
        URL.revokeObjectURL(url)
    }

    const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
            try {
                const text = ev.target?.result as string
                // Skip comment lines and header
                const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
                const lines = allLines.filter(l => {
                    if (l.startsWith('#')) return false
                    const lower = l.toLowerCase()
                    if (lower.startsWith('tür') || lower.startsWith('tur') || lower.startsWith('başlık') || lower.startsWith('baslik') || lower.startsWith('title')) return false
                    return true
                })

                if (lines.length === 0) {
                    alert('Şablonda veri bulunamadı. Başlık satırının altına verilerinizi ekleyin.')
                    e.target.value = ''
                    return
                }

                // Get courses to match names
                const { data: courses } = await supabase.from('courses').select('id, name').eq('user_id', user?.id)
                const courseMap: Record<string, string> = {}
                courses?.forEach((c: any) => { courseMap[c.name.toLowerCase()] = c.id })

                const VALID_TYPES = ['homework', 'exam', 'quiz', 'project', 'review', 'other']
                const rows: any[] = []
                const errors: string[] = []

                lines.forEach((line, idx) => {
                    // Support both comma and semicolon
                    const delimiter = line.includes(';') ? ';' : ','
                    
                    // Parse CSV handling potential quoted fields
                    const parts: string[] = []
                    let current = ''
                    let inQuote = false
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i]
                        if (ch === '"') { inQuote = !inQuote }
                        else if (ch === delimiter && !inQuote) { parts.push(current.trim()); current = '' }
                        else { current += ch }
                    }
                    parts.push(current.trim())

                    const [type, course, title, date, time] = parts
                    if (!title) { errors.push(`Satır ${idx + 1}: Başlık boş`); return }
                    if (!date) { errors.push(`Satır ${idx + 1}: Tarih boş`); return }

                    const courseId = course ? courseMap[course.toLowerCase()] : null
                    if (course && !courseId) {
                        errors.push(`Satır ${idx + 1}: '${course}' dersi bulunamadı (sistemdeki ders adlarıyla eşleşmeli)`)
                        return
                    }

                    // 1. Akıllı Tür Eşleştirme (Smart Type Mapping)
                    const typeMapping: Record<string, string> = {
                        'vize': 'exam', 'final': 'exam', 'sınav': 'exam', 'sinav': 'exam',
                        'ödev': 'homework', 'odev': 'homework',
                        'proje': 'project', 'quiz': 'quiz', 'tekrar': 'review'
                    }
                    const lowerType = type.toLowerCase().trim()
                    let normalType = 'other'
                    if (VALID_TYPES.includes(lowerType)) {
                        normalType = lowerType
                    } else {
                        for (const [key, val] of Object.entries(typeMapping)) {
                            if (lowerType.includes(key)) { normalType = val; break }
                        }
                    }

                    // 2. Akıllı Tarih Çözümleme (Smart Date Parsing - e.g: 10.Nis.26)
                    let cleanDate = date.trim()
                    if (cleanDate.includes('.')) {
                        const trMonths: Record<string, string> = {
                            'oca': '01', 'sub': '02', 'şub': '02', 'mar': '03', 'nis': '04',
                            'may': '05', 'haz': '06', 'tem': '07', 'agu': '08', 'ağu': '08',
                            'eyl': '09', 'eki': '10', 'kas': '11', 'ara': '12'
                        }
                        const dParts = cleanDate.split('.')
                        if (dParts.length >= 3) {
                            const dDay = dParts[0].padStart(2, '0')
                            const dMon = trMonths[dParts[1].toLowerCase().substring(0, 3)] || '01'
                            const dYear = dParts[2].length === 2 ? '20' + dParts[2] : dParts[2].substring(0, 4)
                            cleanDate = `${dYear}-${dMon}-${dDay}`
                        }
                    }
                    
                    // Combine Date and Time
                    const validTime = time && time.includes(':') ? time.trim() : '09:00'
                    const parsedDate = new Date(`${cleanDate}T${validTime.padStart(5, '0')}:00`)
                    
                    if (isNaN(parsedDate.getTime())) {
                        errors.push(`Satır ${idx + 1}: Tarih/Saat formatı anlaşılamadı ('${date} ${time}')`)
                        return
                    }

                    rows.push({
                        user_id: user?.id,
                        course_id: courseId || null,
                        title,
                        type: normalType,
                        due_date: parsedDate.toISOString(),
                        is_completed: false,
                    })
                })

                if (rows.length > 0) {
                    const { error } = await supabase.from('assignments').insert(rows)
                    if (error) throw error
                    await queryClient.invalidateQueries({ queryKey: ['assignments'] })
                    await queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
                    const errMsg = errors.length > 0 ? `\n\n⚠️ ${errors.length} satır atlandı:\n${errors.slice(0, 5).join('\n')}` : ''
                    alert(`✅ ${rows.length} etkinlik başarıyla içe aktarıldı!${errMsg}`)
                } else {
                    alert(`❌ Hiçbir etkinlik aktarılamadı.\n\n${errors.slice(0, 5).join('\n')}\n\nŞablonu indirerek doğru formatı kontrol edin.`)
                }
            } catch (err: any) {
                alert('Dosya okunamadı: ' + (err.message || 'Bilinmeyen hata'))
            }
            e.target.value = ''
        }
        reader.readAsText(file)
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

                    {/* Incoming Shares */}
                    {incomingShares.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Inbox className="h-5 w-5 text-indigo-500" />
                                Gelen Paylaşımlar
                                <span className="text-xs font-black px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                    {incomingShares.length}
                                </span>
                            </h2>
                            {incomingShares.map((share: any) => {
                                const cfg = getTypeConfig(share.type)
                                const senderName = share.sender?.display_name || share.sender?.email?.split('@')[0] || '?'
                                return (
                                    <Card key={share.id} className="p-4 border-l-4 border-indigo-500 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">
                                                    <span className="mr-1">{cfg.emoji}</span>{share.title}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    <span className="font-bold text-indigo-500">{senderName}</span> paylaştı &middot; {cfg.label} &middot; {format(new Date(share.due_date), 'd MMM yyyy', { locale: tr })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => declineShare(share.id)}
                                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                                                title="Reddet"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => { setAcceptingShare(share); setAcceptCourseId('') }}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                                        >
                                            <Check className="h-4 w-4" />
                                            Takvime Ekle
                                        </button>
                                    </Card>
                                )
                            })}
                        </div>
                    )}

                    {/* Accept Share Modal (inline) */}
                    {acceptingShare && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-gray-900 dark:text-white">Etkinliği Takvime Ekle</h3>
                                    <button onClick={() => setAcceptingShare(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm">
                                    <p className="font-bold text-gray-900 dark:text-white">{getTypeConfig(acceptingShare.type).emoji} {acceptingShare.title}</p>
                                    <p className="text-gray-400 text-xs mt-1">{format(new Date(acceptingShare.due_date), 'd MMMM yyyy HH:mm', { locale: tr })}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Bu etkinliğin dersini seç</label>
                                    <select
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={acceptCourseId}
                                        onChange={e => setAcceptCourseId(e.target.value)}
                                    >
                                        <option value="">Ders seç…</option>
                                        {(myCourses as any[]).map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAcceptingShare(null)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                                        İptal
                                    </button>
                                    <button
                                        onClick={acceptShare}
                                        disabled={!acceptCourseId || acceptLoading}
                                        className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {acceptLoading ? 'Ekleniyor…' : '✅ Ekle'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
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
                                            <div className="flex items-center gap-2 shrink-0">
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
                                                    onClick={() => { setSharingEvent(event); setSelectedFriendId('') }}
                                                    title="Arkadaşla Paylaş"
                                                    className="p-2 rounded-xl text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                                >
                                                    <UserPlus className="h-4 w-4" />
                                                </button>
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
                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-1">Veri Aktar</h3>
                <p className="text-[10px] text-gray-400 mb-4">
                    💡 Boş Şablon İndir → Excel / Google Sheets'te doldur → CSV Yükle ile içe aktar
                </p>
                <div className="flex flex-wrap gap-3">
                    {/* Template download */}
                    <Button variant="secondary" onClick={downloadCalendarTemplate} className="text-sm border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                        <FileDown className="h-4 w-4 mr-2" />
                        Boş Şablon İndir
                    </Button>

                    {/* CSV Upload */}
                    <label className="cursor-pointer">
                        <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-sm font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                            <FileUp className="h-4 w-4" />
                            Şablon Yükle (.csv)
                        </span>
                    </label>

                    {/* CSV Export */}
                    <Button variant="secondary" onClick={handleCSVExport} className="text-sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Mevcut Veriyi Dışa Aktar
                    </Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                    Ders isimleri sistemdeki ders adlarıyla eşleşmelidir. Tür değerleri: homework / exam / quiz / project / review / other
                </p>
            </div>

            {/* Share Event Modal (inline) */}
            {sharingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Share2 className="h-5 w-5 text-indigo-500" />
                                Etkinliği Paylaş
                            </h3>
                            <button onClick={() => { setSharingEvent(null); setShareSuccess('') }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm">
                            <p className="font-bold text-gray-900 dark:text-white">{getTypeConfig(sharingEvent.type).emoji} {sharingEvent.title}</p>
                            <p className="text-gray-400 text-xs mt-1">{format(new Date(sharingEvent.due_date), 'd MMMM yyyy HH:mm', { locale: tr })}</p>
                        </div>
                        {shareSuccess ? (
                            <p className="text-center text-green-600 font-bold text-sm py-2">{shareSuccess}</p>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Arkadaş seç</label>
                                    <select
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={selectedFriendId}
                                        onChange={e => setSelectedFriendId(e.target.value)}
                                    >
                                        <option value="">Arkadaş seç…</option>
                                        {(friends as any[]).map((f: any) => (
                                            <option key={f.id} value={f.id}>{f.display_name || f.email?.split('@')[0]}</option>
                                        ))}
                                    </select>
                                    {friends.length === 0 && (
                                        <p className="text-xs text-gray-400 mt-1">Henüz arkadaşın yok. Sosyal sayfasından arkadaş ekle!</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSharingEvent(null)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => sendShare(sharingEvent)}
                                        disabled={!selectedFriendId || shareLoading}
                                        className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {shareLoading ? 'Gönderiliyor…' : '📤 Gönder'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <AddAssignmentModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingAssignment(null) }}
                defaultDate={selectedDate}
                editingAssignment={editingAssignment}
            />
        </div>
    )
}
