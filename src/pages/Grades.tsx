import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Save, CheckCircle, TrendingUp } from 'lucide-react'
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

function getLetterGrade(avg: number): { letter: string, color: string, bgColor: string } {
    if (avg >= 90) return { letter: 'AA', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' }
    if (avg >= 85) return { letter: 'BA', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20' }
    if (avg >= 80) return { letter: 'BB', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20' }
    if (avg >= 75) return { letter: 'CB', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20' }
    if (avg >= 70) return { letter: 'CC', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' }
    if (avg >= 65) return { letter: 'DC', color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20' }
    if (avg >= 60) return { letter: 'DD', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20' }
    if (avg >= 50) return { letter: 'FD', color: 'text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' }
    return { letter: 'FF', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' }
}

const LETTER_GRADE_POINTS: Record<string, number> = {
    'AA': 4.0, 'BA': 3.5, 'BB': 3.0, 'CB': 2.5,
    'CC': 2.0, 'DC': 1.5, 'DD': 1.0, 'FD': 0.5, 'FF': 0
}

type Course = {
    id: string
    name: string
    code: string
    color: string
    credit: number
}

export default function Grades() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
    const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string, weight: string }>>({})
    const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({})

    // Fetch all courses
    const { data: courses } = useQuery({
        queryKey: ['courses_for_grades'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, code, color, credit')
                .eq('user_id', user?.id)
                .order('name')
            if (error) throw error
            return (data || []) as Course[]
        },
        enabled: !!user
    })

    // Fetch all grades
    const { data: allGrades } = useQuery({
        queryKey: ['all_course_grades'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('course_grades')
                .select('*')
                .eq('user_id', user?.id)
            if (error) {
                console.error('Grades fetch error:', error)
                return []
            }
            return data || []
        },
        enabled: !!user
    })

    // Load grade inputs for selected course
    useEffect(() => {
        if (!selectedCourse || !allGrades) return
        const courseGrades = allGrades.filter((g: any) => g.course_id === selectedCourse)
        if (courseGrades.length > 0) {
            const inputs: Record<string, { grade: string, weight: string }> = {}
            courseGrades.forEach((g: any) => {
                inputs[g.exam_type] = { grade: g.grade?.toString() || '', weight: g.weight?.toString() || '0' }
            })
            // Fill missing types with defaults
            EXAM_TYPES.forEach(t => {
                if (!inputs[t.id]) inputs[t.id] = { grade: '', weight: t.defaultWeight.toString() }
            })
            setGradeInputs(inputs)
        } else {
            const defaults: Record<string, { grade: string, weight: string }> = {}
            EXAM_TYPES.forEach(t => { defaults[t.id] = { grade: '', weight: t.defaultWeight.toString() } })
            setGradeInputs(defaults)
        }
    }, [selectedCourse, allGrades])

    // Save mutation
    const saveGradesMutation = useMutation({
        mutationFn: async (courseId: string) => {
            const entries = Object.entries(gradeInputs)
                .filter(([_, v]) => v.grade !== '' && parseFloat(v.grade) >= 0)
            for (const [examType, values] of entries) {
                const { error } = await supabase
                    .from('course_grades')
                    .upsert({
                        user_id: user?.id,
                        course_id: courseId,
                        exam_type: examType,
                        grade: parseFloat(values.grade),
                        weight: parseFloat(values.weight) || 0
                    }, { onConflict: 'user_id,course_id,exam_type' })
                if (error) throw error
            }
        },
        onSuccess: (_data, courseId) => {
            queryClient.invalidateQueries({ queryKey: ['all_course_grades'] })
            setSavedFeedback(prev => ({ ...prev, [courseId]: true }))
            setTimeout(() => setSavedFeedback(prev => ({ ...prev, [courseId]: false })), 2000)
        }
    })

    // Calculate weighted average for a course
    const getCourseAverage = (courseId: string): { avg: number, hasGrades: boolean } => {
        const courseGrades = allGrades?.filter((g: any) => g.course_id === courseId) || []
        if (courseGrades.length === 0) return { avg: 0, hasGrades: false }
        let totalWeightedScore = 0
        let totalWeight = 0
        courseGrades.forEach((g: any) => {
            if (g.grade !== null && g.weight > 0) {
                totalWeightedScore += g.grade * g.weight
                totalWeight += g.weight
            }
        })
        if (totalWeight === 0) return { avg: 0, hasGrades: false }
        return { avg: totalWeightedScore / totalWeight, hasGrades: true }
    }

    // Selected course average from inputs
    const getSelectedAverage = (): { avg: number, totalWeight: number } => {
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
    const getMinFinalGrade = (): number | null => {
        const finalWeight = parseFloat(gradeInputs['final']?.weight || '0')
        if (finalWeight <= 0) return null
        let otherWeightedScore = 0
        let otherWeight = 0
        Object.entries(gradeInputs).forEach(([key, v]) => {
            if (key === 'final') return
            const grade = parseFloat(v.grade)
            const weight = parseFloat(v.weight)
            if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
                otherWeightedScore += grade * weight
                otherWeight += weight
            }
        })
        const totalWeight = otherWeight + finalWeight
        const needed = (60 * totalWeight - otherWeightedScore) / finalWeight
        return Math.max(0, Math.ceil(needed))
    }

    // Calculate GPA across all courses
    const calculateGPA = (): { gpa: number, totalCredits: number } => {
        if (!courses || !allGrades) return { gpa: 0, totalCredits: 0 }
        let totalPoints = 0
        let totalCredits = 0
        courses.forEach(course => {
            const { avg, hasGrades } = getCourseAverage(course.id)
            if (hasGrades) {
                const letterGrade = getLetterGrade(avg)
                const points = LETTER_GRADE_POINTS[letterGrade.letter] || 0
                totalPoints += points * course.credit
                totalCredits += course.credit
            }
        })
        if (totalCredits === 0) return { gpa: 0, totalCredits: 0 }
        return { gpa: totalPoints / totalCredits, totalCredits }
    }

    const { gpa, totalCredits } = calculateGPA()
    const selectedAvg = getSelectedAverage()
    const selectedLetterGrade = selectedAvg.totalWeight > 0 ? getLetterGrade(selectedAvg.avg) : null
    const minFinal = getMinFinalGrade()

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-none">
                    <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Not Hesaplama</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Vize, Final notlarını gir ve ortalamanı hesapla</p>
                </div>
            </div>

            {/* GPA Summary */}
            {totalCredits > 0 && (
                <Card className="p-5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-xs font-bold uppercase tracking-wider">Genel Not Ortalaması (GPA)</p>
                            <p className="text-4xl font-black mt-1">{gpa.toFixed(2)} <span className="text-lg font-normal text-purple-200">/ 4.00</span></p>
                        </div>
                        <div className="text-right">
                            <TrendingUp className="h-8 w-8 text-purple-200 mb-1" />
                            <p className="text-xs text-purple-200">{totalCredits} Kredi</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Course Grid - Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {courses?.map(course => {
                    const { avg, hasGrades } = getCourseAverage(course.id)
                    const letterGrade = hasGrades ? getLetterGrade(avg) : null
                    const isSelected = selectedCourse === course.id

                    return (
                        <button
                            key={course.id}
                            onClick={() => setSelectedCourse(isSelected ? null : course.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md shadow-purple-100 dark:shadow-none scale-[1.02]'
                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
                                <span className="text-xs font-bold text-gray-400">{course.code}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{course.name}</p>
                            {letterGrade ? (
                                <div className="flex items-baseline gap-1 mt-2">
                                    <span className={`text-xl font-black ${letterGrade.color}`}>{letterGrade.letter}</span>
                                    <span className="text-xs text-gray-400">{avg.toFixed(1)}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 mt-2 italic">Not girilmemiş</p>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Selected Course Grade Entry */}
            {selectedCourse && courses && (
                <Card className="p-6 border-t-4 border-purple-500 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: courses.find(c => c.id === selectedCourse)?.color }} />
                            {courses.find(c => c.id === selectedCourse)?.name}
                        </h3>
                        {selectedLetterGrade && (
                            <div className="text-right">
                                <span className={`text-3xl font-black ${selectedLetterGrade.color}`}>{selectedLetterGrade.letter}</span>
                                <p className="text-[10px] text-gray-400 font-bold">{selectedAvg.avg.toFixed(1)} puan</p>
                            </div>
                        )}
                    </div>

                    {/* Grade Inputs */}
                    <div className="space-y-3">
                        {EXAM_TYPES.map(type => {
                            const input = gradeInputs[type.id] || { grade: '', weight: type.defaultWeight.toString() }
                            return (
                                <div key={type.id} className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-500 w-14 shrink-0">{type.label}</span>
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
                    </div>

                    {/* Min Final Helper */}
                    {minFinal !== null && gradeInputs['vize']?.grade && (
                        <div className={`mt-4 p-3 rounded-lg text-xs font-bold ${minFinal > 100 ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                            minFinal > 70 ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' :
                                'bg-green-50 dark:bg-green-900/20 text-green-600'
                            }`}>
                            {minFinal > 100
                                ? '❌ DD almak için bile finalden 100 üzeri almanız gerekiyor.'
                                : `📝 Geçmek (DD) için finalden en az ${minFinal} almanız gerekiyor.`
                            }
                        </div>
                    )}

                    <Button
                        className="w-full mt-4"
                        size="sm"
                        onClick={() => saveGradesMutation.mutate(selectedCourse)}
                        disabled={saveGradesMutation.isPending}
                    >
                        {savedFeedback[selectedCourse] ? (
                            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Kaydedildi!</span>
                        ) : (
                            <span className="flex items-center gap-1"><Save className="h-4 w-4" /> Notları Kaydet</span>
                        )}
                    </Button>
                </Card>
            )}
        </div>
    )
}
