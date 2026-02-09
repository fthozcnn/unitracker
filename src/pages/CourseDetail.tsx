import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, CheckCircle, Circle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Card, Input } from '../components/ui-base'
import { startOfWeek, addWeeks, format } from 'date-fns'
import { tr } from 'date-fns/locale'

type SyllabusItem = {
    week: number
    topic: string
    isCompleted: boolean
}

type Course = {
    id: string
    name: string
    code: string
    color: string
    credit: number
    syllabus: SyllabusItem[]
    attendance_limit: number
}

export default function CourseDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [newTopic, setNewTopic] = useState('')

    const { data: course, isLoading, error } = useQuery({
        queryKey: ['course', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            const sortedSyllabus = (data.syllabus || []).sort((a: SyllabusItem, b: SyllabusItem) => a.week - b.week)
            return { ...data, syllabus: sortedSyllabus } as Course
        }
    })

    // Attendance Query
    const { data: attendanceCount } = useQuery({
        queryKey: ['attendance', id],
        queryFn: async () => {
            // For now, we calculate attendance based on user input or study sessions?
            // Actually, per requirement "Ders bazlı devamsızlık takibi", we might need a simple counter or specific dates.
            // Let's implement a simple counter for MVP stored in local state or a separate table if needed.
            // But wait, schema has no separate attendance table, maybe we use a JSON field or just a simple counter in courses?
            // Ah, the schema I defined has `attendance_limit`.
            // Let's add an `attendance` field to the course table or use `study_sessions` to infer?
            // Requirement: "Ders bazlı devamsızlık takibi". 
            // Let's allow user to manually increment "Missed Hours".
            // I'll add `absent_hours` to the courses table schema update or assume it exists/add it now.
            // Checking my schema... I didn't add `absent_hours` to `courses`.
            // I will add it via SQL query first.

            // Temporary: fetching specific absent count if I had it.
            // usage of 'attendance_limit' suggests we need to track 'current_absent'.
            // I will update the table structure in the next step. For now, let's assume it is 0.
            return 0
        }
    })

    // Mutation to update syllabus
    const updateSyllabusMutation = useMutation({
        mutationFn: async (newSyllabus: SyllabusItem[]) => {
            const { error } = await supabase
                .from('courses')
                .update({ syllabus: newSyllabus })
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course', id] })
        }
    })

    const handleAddTopic = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTopic.trim() || !course) return

        const nextWeek = course.syllabus.length + 1
        const newItem: SyllabusItem = {
            week: nextWeek,
            topic: newTopic,
            isCompleted: false
        }

        updateSyllabusMutation.mutate([...course.syllabus, newItem])
        setNewTopic('')
    }

    const toggleTopicCompletion = (week: number) => {
        if (!course) return
        const newSyllabus = course.syllabus.map(item =>
            item.week === week ? { ...item, isCompleted: !item.isCompleted } : item
        )
        updateSyllabusMutation.mutate(newSyllabus)
    }

    const deleteTopic = (week: number) => {
        if (!course) return
        const newSyllabus = course.syllabus.filter(item => item.week !== week)
        // Re-index weeks
        const reindexedSyllabus = newSyllabus.map((item, index) => ({ ...item, week: index + 1 }))
        updateSyllabusMutation.mutate(reindexedSyllabus)
    }

    if (isLoading) return <div className="p-8">Yükleniyor...</div>
    if (error || !course) return <div className="p-8">Ders bulunamadı.</div>

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent" onClick={() => navigate('/courses')}>
                <ArrowLeft className="h-5 w-5 mr-2" />
                Derslere Dön
            </Button>

            <div className="flex items-center space-x-4 mb-6">
                <div className="w-4 h-12 rounded-full" style={{ backgroundColor: course.color }} />
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{course.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{course.code} • {course.credit} Kredi</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Attendance Card */}
                <Card className="p-6 md:col-span-1 border-t-4" style={{ borderTopColor: course.color }}>
                    <h3 className="font-semibold text-lg mb-4">Devamsızlık Durumu</h3>
                    <div className="text-center py-4">
                        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                            {/* Placeholder for actual absent count */}
                            0 <span className="text-lg text-gray-400 font-normal">/ {course.attendance_limit}</span>
                        </div>
                        <p className="text-sm text-gray-500">Saat</p>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-4">
                        <div
                            className="bg-red-600 h-2.5 rounded-full"
                            style={{ width: `${Math.min((0 / course.attendance_limit) * 100, 100)}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-center space-x-2">
                        <Button size="sm" variant="secondary" onClick={() => alert('Devamsızlık ekleme yakında!')}>
                            +1 Saat Ekle
                        </Button>
                    </div>
                </Card>

                {/* Syllabus Card */}
                <Card className="p-6 md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg">Haftalık Konu Takibi (Syllabus)</h3>
                        <span className="text-sm text-gray-500">
                            %{Math.round((course.syllabus.filter(i => i.isCompleted).length / (course.syllabus.length || 1)) * 100)} Tamamlandı
                        </span>
                    </div>

                    <form onSubmit={handleAddTopic} className="flex gap-2 mb-6">
                        <Input
                            placeholder="Yeni hafta konusu ekle..."
                            value={newTopic}
                            onChange={(e) => setNewTopic(e.target.value)}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={!newTopic.trim()}>
                            <Plus className="h-5 w-5" />
                        </Button>
                    </form>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {course.syllabus.length === 0 && (
                            <p className="text-center text-gray-500 py-4">Henüz konu eklenmemiş.</p>
                        )}

                        {course.syllabus.map((item) => (
                            <div
                                key={item.week}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${item.isCompleted ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        onClick={() => toggleTopicCompletion(item.week)}
                                        className={`flex-shrink-0 focus:outline-none ${item.isCompleted ? 'text-green-600 hover:text-green-700' : 'text-gray-300 hover:text-gray-400'}`}
                                    >
                                        {item.isCompleted ? <CheckCircle className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                                    </button>
                                    <div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hafta {item.week}</span>
                                        <p className={`text-sm font-medium ${item.isCompleted ? 'text-gray-900 dark:text-gray-200 line-through decoration-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                            {item.topic}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteTopic(item.week)}
                                    className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}
