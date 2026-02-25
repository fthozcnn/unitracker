import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Save, CheckCircle, TrendingUp, UserPlus, X, Share2, Inbox, Check } from 'lucide-react'
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
                    const { avg, hasGrades } = getCourseAverage(course.id)
                    const letterGrade = hasGrades ? getLetterGrade(avg) : null
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
                                {letterGrade ? (
                                    <div className="flex items-baseline gap-1 mt-2">
                                        <span className={`text-xl font-black ${letterGrade.color}`}>{letterGrade.letter}</span>
                                        <span className="text-xs text-gray-400">{avg.toFixed(1)}</span>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 mt-2 italic">Not girilmemiş</p>
                                )}
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
