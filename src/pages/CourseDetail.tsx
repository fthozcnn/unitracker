import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, CheckCircle, Circle, AlertTriangle, Minus, Save, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input } from '../components/ui-base'

const EXAM_TYPES = [
    { id: 'vize', label: 'Vize', defaultWeight: 40 },
    { id: 'final', label: 'Final', defaultWeight: 50 },
    { id: 'odev', label: 'Ödev', defaultWeight: 10 },
    { id: 'quiz', label: 'Quiz', defaultWeight: 0 },
    { id: 'proje', label: 'Proje', defaultWeight: 0 },
]

function getPassStatus(avg: number, grades: any[]): { status: 'gecer' | 'kalır' | 'belirsiz', label: string, color: string, bgColor: string } {
    const finalGrade = grades.find(g => g.exam_type === 'final')?.grade
    if (finalGrade === undefined || finalGrade === null) return { status: 'belirsiz', label: 'Belirsiz', color: 'text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-900/20' }
    
    const isPassed = avg >= 35 && finalGrade >= 35
    if (isPassed) return { status: 'gecer', label: 'Geçti', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' }
    return { status: 'kalır', label: 'Kaldı', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' }
}


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
    absent_count: number
}



export default function CourseDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { user } = useAuth()
    const [newTopic, setNewTopic] = useState('')
    const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string, weight: string }>>({})
    const [gradesSaved, setGradesSaved] = useState(false)

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

    // Fetch grades for this course
    const { data: savedGrades } = useQuery({
        queryKey: ['course_grades', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('course_grades')
                .select('*')
                .eq('course_id', id)
                .eq('user_id', user?.id)
            if (error) {
                console.error('Grades fetch error:', error)
                return []
            }
            return data || []
        },
        enabled: !!user && !!id
    })

    // Populate grade inputs from saved grades
    useEffect(() => {
        if (savedGrades && savedGrades.length > 0) {
            const inputs: Record<string, { grade: string, weight: string }> = {}
            savedGrades.forEach((g: any) => {
                inputs[g.exam_type] = {
                    grade: g.grade?.toString() || '',
                    weight: g.weight?.toString() || '0'
                }
            })
            setGradeInputs(inputs)
        } else {
            // Set defaults
            const defaults: Record<string, { grade: string, weight: string }> = {}
            EXAM_TYPES.forEach(t => {
                defaults[t.id] = { grade: '', weight: t.defaultWeight.toString() }
            })
            setGradeInputs(defaults)
        }
    }, [savedGrades])

    // Attendance Mutation
    const updateAttendanceMutation = useMutation({
        mutationFn: async (newCount: number) => {
            const { error } = await supabase
                .from('courses')
                .update({ absent_count: Math.max(0, newCount) })
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course', id] })
        }
    })

    // Save grades mutation
    const saveGradesMutation = useMutation({
        mutationFn: async () => {
            const entries = Object.entries(gradeInputs)
                .filter(([_, v]) => v.grade !== '' && parseFloat(v.grade) >= 0)

            for (const [examType, values] of entries) {
                const { error } = await supabase
                    .from('course_grades')
                    .upsert({
                        user_id: user?.id,
                        course_id: id,
                        exam_type: examType,
                        grade: parseFloat(values.grade),
                        weight: parseFloat(values.weight) || 0
                    }, { onConflict: 'user_id,course_id,exam_type' })
                if (error) throw error
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course_grades', id] })
            setGradesSaved(true)
            setTimeout(() => setGradesSaved(false), 2000)
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
        const newItem: SyllabusItem = { week: nextWeek, topic: newTopic, isCompleted: false }
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
        const reindexedSyllabus = newSyllabus.map((item, index) => ({ ...item, week: index + 1 }))
        updateSyllabusMutation.mutate(reindexedSyllabus)
    }

    // Calculate weighted average
    const calculateAverage = (): { avg: number, totalWeight: number } => {
        let totalWeightedScore = 0
        let totalWeight = 0
        Object.entries(gradeInputs).forEach(([_, v]) => {
            const grade = parseFloat(v.grade)
            const weight = parseFloat(v.weight)
            if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
                totalWeightedScore += grade * weight
                totalWeight += weight
            }
        })
        if (totalWeight === 0) return { avg: 0, totalWeight: 0 }
        return { avg: totalWeightedScore / totalWeight, totalWeight }
    }

    // Min final grade to pass
    const getMinFinalGrade = (): { minGrade: number, type: 'success' | 'warning' | 'danger' | 'impossible' } | null => {
        const finalWeight = parseFloat(gradeInputs['final']?.weight || '0')
        if (finalWeight <= 0) return null

        const enteredGrades = Object.entries(gradeInputs).filter(([key, v]) => key !== 'final' && v.grade !== '')
        if (enteredGrades.length === 0) return null

        let otherWeightedScore = 0
        let otherWeight = 0
        enteredGrades.forEach(([_, v]) => {
            const grade = parseFloat(v.grade)
            const weight = parseFloat(v.weight)
            if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
                otherWeightedScore += grade * weight
                otherWeight += weight
            }
        })

        const totalWeight = otherWeight + finalWeight
        const neededForAvg = (35 * totalWeight - otherWeightedScore) / finalWeight
        const minGrade = Math.max(35, Math.ceil(neededForAvg))

        if (minGrade > 100) return { minGrade, type: 'impossible' }
        if (minGrade > 35) return { minGrade, type: 'warning' }
        
        const allEnteredGradesAbove35 = enteredGrades.every(([_, v]) => parseFloat(v.grade) >= 35)
        if (allEnteredGradesAbove35) return { minGrade, type: 'success' }
        
        return { minGrade, type: 'warning' }
    }


    if (isLoading) return <div className="p-8">Yükleniyor...</div>
    if (error || !course) return <div className="p-8">Ders bulunamadı.</div>

    const { avg, totalWeight } = calculateAverage()
    const minFinal = getMinFinalGrade()

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent" onClick={() => navigate('/schedule')}>
                <ArrowLeft className="h-5 w-5 mr-2" />
                Ders Programına Dön
            </Button>

            <div className="flex items-center space-x-4 mb-6">
                <div className="w-4 h-12 rounded-full" style={{ backgroundColor: course.color }} />
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{course.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{course.code} • {course.credit} Kredi</p>
                </div>
            </div>

            {/* Top Row: Attendance + Grades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attendance Card */}
                <Card className="p-6 border-t-4" style={{ borderTopColor: course.color }}>
                    <h3 className="font-semibold text-lg mb-4">Devamsızlık Durumu</h3>

                    {course.absent_count >= course.attendance_limit ? (
                        <div className="flex items-center gap-2 p-2 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold animate-pulse">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Kaldınız! Sınır aşıldı.</span>
                        </div>
                    ) : (course.absent_count / course.attendance_limit) >= 0.8 && (
                        <div className="flex items-center gap-2 p-2 mb-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Dikkat! Limit dolmak üzere.</span>
                        </div>
                    )}

                    <div className="text-center py-4">
                        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                            {course.absent_count} <span className="text-lg text-gray-400 font-normal">/ {course.attendance_limit}</span>
                        </div>
                        <p className="text-sm text-gray-500">Ders/Saat</p>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-6">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${(course.absent_count / course.attendance_limit) >= 1 ? 'bg-red-600' :
                                (course.absent_count / course.attendance_limit) >= 0.8 ? 'bg-orange-500' : 'bg-blue-600'
                                }`}
                            style={{ width: `${Math.min((course.absent_count / course.attendance_limit) * 100, 100)}%` }}
                        ></div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <Button
                            className="flex-1"
                            variant="secondary"
                            size="sm"
                            onClick={() => updateAttendanceMutation.mutate(course.absent_count - 1)}
                            disabled={course.absent_count <= 0 || updateAttendanceMutation.isPending}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            size="sm"
                            onClick={() => updateAttendanceMutation.mutate(course.absent_count + 1)}
                            disabled={updateAttendanceMutation.isPending}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>

                {/* Grades & GPA Card */}
                <Card className="p-6 border-t-4 border-purple-500">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-purple-500" />
                            Notlar & Ortalama
                        </h3>
                        {totalWeight > 0 && (
                            <div className="text-right">
                                {(() => {
                                    const status = getPassStatus(avg, Object.entries(gradeInputs).map(([k, v]) => ({ exam_type: k, grade: v.grade !== '' ? parseFloat(v.grade) : null })))
                                    if (status.status === 'belirsiz') return null
                                    return (
                                        <span className={`text-xl font-black uppercase px-3 py-1 rounded-lg ${status.bgColor} ${status.color}`}>
                                            {status.label}
                                        </span>
                                    )
                                })()}
                                <p className="text-[10px] text-gray-400 font-bold mt-1">{avg.toFixed(1)} puan</p>
                            </div>
                        )}

                    </div>

                    <div className="space-y-3">
                        {EXAM_TYPES.map(type => {
                            const input = gradeInputs[type.id] || { grade: '', weight: type.defaultWeight.toString() }
                            return (
                                <div key={type.id} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 w-12 shrink-0">{type.label}</span>
                                    <Input
                                        type="number"
                                        placeholder="Not"
                                        min="0"
                                        max="100"
                                        value={input.grade}
                                        onChange={e => setGradeInputs(prev => ({
                                            ...prev,
                                            [type.id]: { ...prev[type.id], grade: e.target.value }
                                        }))}
                                        className="flex-1 text-sm h-9"
                                    />
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={input.weight}
                                            onChange={e => setGradeInputs(prev => ({
                                                ...prev,
                                                [type.id]: { ...prev[type.id], weight: e.target.value }
                                            }))}
                                            className="w-16 text-sm h-9 text-center"
                                        />
                                        <span className="text-[10px] text-gray-400 font-bold">%</span>
                                    </div>
                                </div>
                            )
                        })}
                        {/* Min Final Helper */}
                        {minFinal && !gradeInputs['final']?.grade && (
                            <div className={`mt-4 p-3 rounded-lg text-xs font-bold ${minFinal.type === 'impossible' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                                minFinal.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' :
                                    'bg-green-50 dark:bg-green-900/20 text-green-600'
                                }`}>
                                {minFinal.type === 'impossible'
                                    ? '❌ Ortalamanın 35 olması için finalden 100 üzeri almanız gerekiyor, geçmeniz imkansız görünüyor.'
                                    : minFinal.type === 'warning'
                                        ? `⚠️ Ortalamanın 35 olması için finalden en az ${minFinal.minGrade} almanız gerekiyor.`
                                        : `📝 Geçmek için finalden en az 35 almanız yeterli.`
                                }
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full mt-4"
                        size="sm"
                        onClick={() => saveGradesMutation.mutate()}
                        disabled={saveGradesMutation.isPending}
                    >
                        {gradesSaved ? (
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Kaydedildi!</span>
                        ) : (
                            <span className="flex items-center gap-1"><Save className="h-4 w-4" /> Notları Kaydet</span>
                        )}
                    </Button>
                </Card>
            </div>

            {/* Syllabus Card */}
            <Card className="p-6">
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
    )
}
