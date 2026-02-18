import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button, Card } from '../components/ui-base'

type Course = {
    id: string
    name: string
    code: string
    color: string
    attendance_limit: number
    absent_count: number
}

export default function Attendance() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const { data: courses, isLoading } = useQuery({
        queryKey: ['courses_attendance'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('courses')
                .select('id, name, code, color, attendance_limit, absent_count')
                .eq('user_id', user?.id)
                .order('name')
            if (error) throw error
            return (data || []) as Course[]
        },
        enabled: !!user
    })

    const updateMutation = useMutation({
        mutationFn: async ({ courseId, newCount }: { courseId: string, newCount: number }) => {
            const { error } = await supabase
                .from('courses')
                .update({ absent_count: Math.max(0, newCount) })
                .eq('id', courseId)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses_attendance'] })
        }
    })

    const getStatusInfo = (course: Course) => {
        const ratio = course.attendance_limit > 0 ? course.absent_count / course.attendance_limit : 0
        if (ratio >= 1) return { label: 'Kaldınız!', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', bar: 'bg-red-600', pulse: true }
        if (ratio >= 0.8) return { label: 'Dikkat!', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-500', pulse: false }
        if (ratio >= 0.5) return { label: 'Orta', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', bar: 'bg-yellow-500', pulse: false }
        return { label: 'İyi', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', bar: 'bg-blue-600', pulse: false }
    }

    if (isLoading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>

    const totalAbsent = courses?.reduce((sum, c) => sum + (c.absent_count || 0), 0) || 0
    const dangerCourses = courses?.filter(c => c.attendance_limit > 0 && c.absent_count >= c.attendance_limit).length || 0
    const warningCourses = courses?.filter(c => c.attendance_limit > 0 && c.absent_count / c.attendance_limit >= 0.8 && c.absent_count < c.attendance_limit).length || 0

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none">
                    <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devamsızlık Takibi</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Tüm derslerinin devamsızlık durumunu takip et</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{totalAbsent}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Toplam Devamsızlık</p>
                </Card>
                <Card className={`p-4 text-center ${dangerCourses > 0 ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                    <p className={`text-3xl font-black ${dangerCourses > 0 ? 'text-red-600' : 'text-green-600'}`}>{dangerCourses}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Kalınan Ders</p>
                </Card>
                <Card className={`p-4 text-center ${warningCourses > 0 ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                    <p className={`text-3xl font-black ${warningCourses > 0 ? 'text-orange-600' : 'text-green-600'}`}>{warningCourses}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Riskli Ders</p>
                </Card>
            </div>

            {/* Course List */}
            {!courses || courses.length === 0 ? (
                <Card className="p-12 text-center">
                    <ClipboardList className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 font-semibold">Henüz ders eklenmemiş</p>
                    <p className="text-xs text-gray-400 mt-1">Ders Programı sayfasından ders ekleyin</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {courses.map(course => {
                        const status = getStatusInfo(course)
                        const ratio = course.attendance_limit > 0 ? Math.min(course.absent_count / course.attendance_limit, 1) : 0
                        const remaining = Math.max(0, course.attendance_limit - course.absent_count)

                        return (
                            <Card key={course.id} className="p-5 border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: course.color }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{course.name}</h3>
                                        <p className="text-xs text-gray-500">{course.code}</p>
                                    </div>
                                    {course.attendance_limit > 0 && (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${status.bg} ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}>
                                            {status.label}
                                        </span>
                                    )}
                                </div>

                                {course.attendance_limit > 0 ? (
                                    <>
                                        {/* Progress */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex-1">
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                                    <div
                                                        className={`h-2.5 rounded-full transition-all duration-500 ${status.bar}`}
                                                        style={{ width: `${ratio * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-lg font-black text-gray-900 dark:text-white">{course.absent_count}</span>
                                                <span className="text-sm text-gray-400 font-normal"> / {course.attendance_limit}</span>
                                            </div>
                                        </div>

                                        {/* Remaining info */}
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-500">
                                                {remaining > 0
                                                    ? <span>Kalan hak: <strong className="text-gray-700 dark:text-gray-300">{remaining}</strong></span>
                                                    : <span className="text-red-500 font-bold">Hak kalmadı!</span>
                                                }
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => updateMutation.mutate({ courseId: course.id, newCount: course.absent_count - 1 })}
                                                    disabled={course.absent_count <= 0 || updateMutation.isPending}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => updateMutation.mutate({ courseId: course.id, newCount: course.absent_count + 1 })}
                                                    disabled={updateMutation.isPending}
                                                    className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 text-white"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Devamsızlık limiti tanımlanmamış</p>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
