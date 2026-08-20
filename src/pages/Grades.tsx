import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Save, CheckCircle, TrendingUp, UserPlus, X, Share2, Inbox, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input } from '../components/ui-base'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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


type Course = {
    id: string
    name: string
    code: string
    color: string
    credit: number
}

export default function Grades() {
    const { user } = useAuth()
    useDocumentTitle('Not & Vize/Final Hesaplama', {
        description: 'Vize, final, ödev ve proje ağırlıklarına göre ders notu ortalaması ve harf notu hesaplayın.'
    })
    const queryClient = useQueryClient()
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
    const [gradeInputs, setGradeInputs] = useState<Record<string, { grade: string, weight: string }>>({})
    const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({})

    // Share state
    const [sharingCourse, setSharingCourse] = useState<Course | null>(null)
    const [selectedFriendId, setSelectedFriendId] = useState('')
    const [shareLoading, setShareLoading] = useState(false)
    const [shareSuccess, setShareSuccess] = useState(false)
    const [acceptingCourseShare, setAcceptingCourseShare] = useState<any | null>(null)
    const [acceptLoading, setAcceptLoading] = useState(false)

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

    // Friends for share picker
    const { data: friends = [] } = useQuery({
        queryKey: ['friends_for_course_share'],
        queryFn: async () => {
            const { data } = await supabase
                .from('friendships')
                .select('friend:friend_id (id, email, display_name)')
                .eq('user_id', user?.id)
                .eq('status', 'accepted')
            return (data || []).map((f: any) => f.friend).filter(Boolean)
        },
        enabled: !!user
    })

    // Incoming pending course shares
    const { data: incomingCourseShares = [] } = useQuery({
        queryKey: ['incoming_course_shares', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('course_shares')
                .select('*, sender:sender_id (display_name, email)')
                .eq('receiver_id', user?.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
            return data || []
        },
        refetchInterval: 15000,
        enabled: !!user
    })

    const sendCourseShare = async (course: Course) => {
        if (!selectedFriendId) return
        setShareLoading(true)
        try {
            const { error } = await supabase.from('course_shares').insert({
                sender_id: user?.id,
                receiver_id: selectedFriendId,
                course_name: course.name,
                course_code: course.code,
                course_color: course.color,
                course_credit: course.credit,
            })
            if (error) throw error
            setShareSuccess(true)
            setTimeout(() => { setSharingCourse(null); setShareSuccess(false); setSelectedFriendId('') }, 1500)
        } catch (err: any) {
            alert(err.message || 'Paylaşım hatası')
        } finally {
            setShareLoading(false)
        }
    }

    const acceptCourseShare = async () => {
        if (!acceptingCourseShare) return
        setAcceptLoading(true)
        try {
            const { error } = await supabase.from('courses').insert({
                user_id: user?.id,
                name: acceptingCourseShare.course_name,
                code: acceptingCourseShare.course_code || '',
                color: acceptingCourseShare.course_color || '#6366f1',
                credit: acceptingCourseShare.course_credit || 3,
                syllabus: [],
            })
            if (error) throw error
            await supabase.from('course_shares').update({ status: 'accepted' }).eq('id', acceptingCourseShare.id)
            queryClient.invalidateQueries({ queryKey: ['courses_for_grades'] })
            queryClient.invalidateQueries({ queryKey: ['courses'] })
            queryClient.invalidateQueries({ queryKey: ['incoming_course_shares'] })
            setAcceptingCourseShare(null)
        } catch (err: any) {
            alert(err.message || 'Ekleme hatası')
        } finally {
            setAcceptLoading(false)
        }
    }

    const declineCourseShare = async (shareId: string) => {
        await supabase.from('course_shares').update({ status: 'declined' }).eq('id', shareId)
        queryClient.invalidateQueries({ queryKey: ['incoming_course_shares'] })
    }

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

    // Delete all saved grades for a course
    const deleteGradesMutation = useMutation({
        mutationFn: async (courseId: string) => {
            const { error } = await supabase
                .from('course_grades')
                .delete()
                .eq('user_id', user?.id)
                .eq('course_id', courseId)
            if (error) throw error
        },
        onSuccess: (_data, _courseId) => {
            queryClient.invalidateQueries({ queryKey: ['all_course_grades'] })
            // Reset inputs to blank defaults
            const defaults: Record<string, { grade: string, weight: string }> = {}
            EXAM_TYPES.forEach(t => { defaults[t.id] = { grade: '', weight: t.defaultWeight.toString() } })
            setGradeInputs(defaults)
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
        // Need: (otherWeightedScore + finalGrade * finalWeight) / totalWeight >= 35
        const neededForAvg = (35 * totalWeight - otherWeightedScore) / finalWeight
        const minGrade = Math.max(35, Math.ceil(neededForAvg))

        if (minGrade > 100) return { minGrade, type: 'impossible' }
        if (minGrade > 35) return { minGrade, type: 'warning' }
        
        // Check if the only grade entered is >= 35
        const allEnteredGradesAbove35 = enteredGrades.every(([_, v]) => parseFloat(v.grade) >= 35)
        if (allEnteredGradesAbove35) return { minGrade, type: 'success' }
        
        return { minGrade, type: 'warning' }
    }


    // Calculate stats across all courses
    const calculateStats = (): { totalCredits: number, passedCount: number, failedCount: number } => {
        if (!courses || !allGrades) return { totalCredits: 0, passedCount: 0, failedCount: 0 }
        let totalCredits = 0
        let passedCount = 0
        let failedCount = 0
        
        courses.forEach(course => {
            const courseGrades = allGrades.filter((g: any) => g.course_id === course.id)
            const { avg, hasGrades } = getCourseAverage(course.id)
            if (hasGrades) {
                const status = getPassStatus(avg, courseGrades)
                if (status.status === 'gecer') passedCount++
                else if (status.status === 'kalır') failedCount++
                totalCredits += course.credit
            }
        })
        return { totalCredits, passedCount, failedCount }
    }

    const { totalCredits, passedCount } = calculateStats()
    const selectedAverageData = getSelectedAverage()
    const selectedPassStatus = selectedAverageData.totalWeight > 0 
        ? getPassStatus(selectedAverageData.avg, Object.entries(gradeInputs).map(([k, v]) => ({ exam_type: k, grade: v.grade !== '' ? parseFloat(v.grade) : null }))) 
        : null

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

            {/* Stats Summary */}
            {totalCredits > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Geçilen Dersler</p>
                                <p className="text-4xl font-black mt-1">{passedCount} <span className="text-lg font-normal text-emerald-200">Ders</span></p>
                            </div>
                            <CheckCircle className="h-10 w-10 text-emerald-200/50" />
                        </div>
                    </Card>
                    <Card className="p-5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100 text-xs font-bold uppercase tracking-wider">Toplam Kredi</p>
                                <p className="text-4xl font-black mt-1">{totalCredits} <span className="text-lg font-normal text-purple-200">Kredi</span></p>
                            </div>
                            <TrendingUp className="h-10 w-10 text-purple-200/50" />
                        </div>
                    </Card>
                </div>
            )}


            {/* Incoming Course Shares */}
            {incomingCourseShares.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl p-4 space-y-3">
                    <h3 className="font-black text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                        <Inbox className="h-4 w-4" /> Gelen Ders Paylaşımları ({incomingCourseShares.length})
                    </h3>
                    {incomingCourseShares.map((share: any) => (
                        <div key={share.id} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 rounded-xl p-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: share.course_color }} />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{share.course_name}</p>
                                    <p className="text-[10px] text-gray-400">
                                        <span className="text-indigo-500 font-bold">{share.sender?.display_name || share.sender?.email?.split('@')[0]}</span> paylaştı · {share.course_code} · {share.course_credit} Kredi
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button
                                    onClick={() => setAcceptingCourseShare(share)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                >Ekle</button>
                                <button
                                    onClick={() => declineCourseShare(share.id)}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                ><X className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Course Grid - Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {courses?.map(course => {
                    const isSelected = selectedCourse === course.id

                    return (
                        <div key={course.id} className="relative group/card">
                            <button
                                onClick={() => setSelectedCourse(isSelected ? null : course.id)}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md shadow-purple-100 dark:shadow-none scale-[1.02]'
                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
                                    <span className="text-xs font-bold text-gray-400">{course.code}</span>
                                </div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{course.name}</p>
                                {(() => {
                                    const courseGrades = allGrades?.filter((g: any) => g.course_id === course.id) || []
                                    const finalGrade = courseGrades.find((g: any) => g.exam_type === 'final' && g.grade !== null && g.grade !== undefined)
                                    const otherGrades = courseGrades.filter((g: any) => g.exam_type !== 'final' && g.grade !== null && g.grade !== undefined)
                                    
                                    if (finalGrade) {
                                        // Final exists, show Pass/Fail
                                        const { avg } = getCourseAverage(course.id)
                                        const status = getPassStatus(avg, courseGrades)
                                        return (
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${status.bgColor} ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                <span className="text-xs text-gray-400">{avg.toFixed(1)}</span>
                                            </div>
                                        )
                                    }

                                    if (otherGrades.length > 0) {
                                        // No final, but has some other grades
                                        let otherWeightedScore = 0
                                        let otherWeight = 0
                                        otherGrades.forEach(g => {
                                            otherWeightedScore += g.grade * (g.weight || 0)
                                            otherWeight += (g.weight || 0)
                                        })
                                        
                                        // Use 50 as default final weight if not specified
                                        const finalWeight = 50 
                                        const totalWeight = otherWeight + finalWeight
                                        const needed = Math.max(35, Math.ceil((35 * totalWeight - otherWeightedScore) / finalWeight))
                                        
                                        return (
                                            <div className="flex flex-col gap-0.5 mt-2">
                                                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight">Final Gerekli</p>
                                                <p className="text-sm font-black text-gray-900 dark:text-white">{needed}+</p>
                                            </div>
                                        )
                                    }

                                    return <p className="text-xs text-gray-400 mt-2 italic">Not girilmemiş</p>
                                })()}





                            </button>
                            {/* Share button overlay */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setSharingCourse(course); setSelectedFriendId(''); setShareSuccess(false) }}
                                title="Arkadaşa Gönder"
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-300 hover:text-indigo-500 hover:border-indigo-300 opacity-0 group-hover/card:opacity-100 transition-all shadow-sm"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                            </button>
                        </div>
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
                        {selectedPassStatus && selectedPassStatus.status !== 'belirsiz' && (
                            <div className="text-right">
                                <span className={`text-xl font-black uppercase px-3 py-1 rounded-lg ${selectedPassStatus.bgColor} ${selectedPassStatus.color}`}>
                                    {selectedPassStatus.label}
                                </span>
                                <p className="text-[10px] text-gray-400 font-bold mt-1">{selectedAverageData.avg.toFixed(1)} puan</p>
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
                                    {/* Clear single row */}
                                    {input.grade !== '' && (
                                        <button
                                            onClick={() => setGradeInputs(prev => ({
                                                ...prev,
                                                [type.id]: { ...prev[type.id], grade: '' }
                                            }))}
                                            title="Bu notu temizle"
                                            className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>

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



                    <div className="flex gap-2 mt-4">
                        <Button
                            className="flex-1"
                            size="sm"
                            onClick={() => saveGradesMutation.mutate(selectedCourse)}
                            disabled={saveGradesMutation.isPending || deleteGradesMutation.isPending}
                        >
                            {savedFeedback[selectedCourse] ? (
                                <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Kaydedildi!</span>
                            ) : (
                                <span className="flex items-center gap-1"><Save className="h-4 w-4" /> Notları Kaydet</span>
                            )}
                        </Button>
                        {/* Delete all grades for this course */}
                        {allGrades?.some((g: any) => g.course_id === selectedCourse) && (
                            <button
                                onClick={() => {
                                    if (window.confirm('Bu derse ait tüm kayıtlı notlar silinsin mi? Bu işlem geri alınamaz.'))
                                        deleteGradesMutation.mutate(selectedCourse)
                                }}
                                disabled={deleteGradesMutation.isPending || saveGradesMutation.isPending}
                                title="Kayıtlı notları sil"
                                className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <Trash2 className="h-4 w-4" />
                                {deleteGradesMutation.isPending ? 'Siliniyor…' : 'Sil'}
                            </button>
                        )}
                    </div>
                </Card>
            )}
            {/* Share Course Modal */}
            {sharingCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Share2 className="h-5 w-5 text-indigo-500" />
                                Dersi Paylaş
                            </h3>
                            <button onClick={() => setSharingCourse(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: sharingCourse.color }} />
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-sm">{sharingCourse.name}</p>
                                <p className="text-gray-400 text-xs">{sharingCourse.code} · {sharingCourse.credit} Kredi</p>
                            </div>
                        </div>
                        {shareSuccess ? (
                            <p className="text-center text-green-600 font-bold text-sm py-2">Ders paylaşıldı! ✅</p>
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
                                    {friends.length === 0 && <p className="text-xs text-gray-400 mt-1">Henüz arkadaşın yok. Sosyal sayfasından ekle!</p>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSharingCourse(null)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                        İptal
                                    </button>
                                    <button
                                        onClick={() => sendCourseShare(sharingCourse)}
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

            {/* Accept Course Share Modal */}
            {acceptingCourseShare && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-gray-900 dark:text-white">Ders Eklensin Mi?</h3>
                            <button onClick={() => setAcceptingCourseShare(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: acceptingCourseShare.course_color }} />
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-sm">{acceptingCourseShare.course_name}</p>
                                <p className="text-gray-400 text-xs">{acceptingCourseShare.course_code} · {acceptingCourseShare.course_credit} Kredi</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Bu ders derslerinize eklenecek. İçerik (notlar, program) boş gelir, kendiniz düzenleyebilirsiniz.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setAcceptingCourseShare(null)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                İptal
                            </button>
                            <button
                                onClick={acceptCourseShare}
                                disabled={acceptLoading}
                                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {acceptLoading ? 'Ekleniyor…' : '✅ Ekle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
