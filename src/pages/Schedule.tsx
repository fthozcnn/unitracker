import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button } from '../components/ui-base'
import { CalendarDays, Plus, Trash2, Clock, MapPin, BookOpen, Upload, Download, MoreVertical, Edit2 } from 'lucide-react'
import { Menu, Transition } from '@headlessui/react'
import CourseModal from '../components/CourseModal'

const DAYS = [
    { id: 1, name: 'Pazartesi', aliases: ['pazartesi', 'pzt'] },
    { id: 2, name: 'Salı', aliases: ['sali', 'salı'] },
    { id: 3, name: 'Çarşamba', aliases: ['carsamba', 'çarşamba', 'çrş'] },
    { id: 4, name: 'Perşembe', aliases: ['persembe', 'perşembe', 'prş'] },
    { id: 5, name: 'Cuma', aliases: ['cuma', 'cum'] },
    { id: 6, name: 'Cumartesi', aliases: ['cumartesi', 'cmt'] },
    { id: 0, name: 'Pazar', aliases: ['pazar', 'pzr'] }
]

export default function Schedule() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isAdding, setIsAdding] = useState(false)
    const [uploadLoading, setUploadLoading] = useState(false)
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
    const [editingCourse, setEditingCourse] = useState<any>(null)

    const [formData, setFormData] = useState({
        course_id: '',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:00',
        room: ''
    })

    const { data: schedule } = useQuery({
        queryKey: ['schedule', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('weekly_schedule')
                .select('*, courses(name, color)')
                .eq('user_id', user?.id)
                .order('start_time', { ascending: true })
            return data || []
        }
    })

    const { data: courses, refetch: refetchCourses } = useQuery({
        queryKey: ['courses', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
            return data || []
        }
    })

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadLoading(true)
        const reader = new FileReader()

        reader.onload = async (event) => {
            const text = event.target?.result as string
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

            // 0. Fetch LATEST courses directly to avoid stale data
            const { data: freshCourses, error: fetchError } = await supabase
                .from('courses')
                .select('id, name')
                .eq('user_id', user?.id)

            if (fetchError) {
                alert('Ders listesi alınırken hata oluştu: ' + fetchError.message)
                setUploadLoading(false)
                return
            }

            // 1. Collect all unique course names from CSV
            const courseNamesInCSV = [...new Set(lines.map(line => line.split(',')[0].trim()))]
            const existingCourseMap = new Map((freshCourses || []).map(c => [c.name.toLowerCase(), c.id]))

            // 2. Identify and create missing courses
            const missingCourseNames = courseNamesInCSV.filter(name => !existingCourseMap.has(name.toLowerCase()))

            if (missingCourseNames.length > 0) {
                const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
                const newCourses = missingCourseNames.map(name => ({
                    user_id: user?.id,
                    name: name,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)]
                }))

                const { data: createdCourses, error: courseError } = await supabase
                    .from('courses')
                    .insert(newCourses)
                    .select()

                if (courseError) {
                    alert('Yeni dersler oluşturulurken hata oluştu: ' + courseError.message)
                    setUploadLoading(false)
                    return
                }

                createdCourses?.forEach(c => existingCourseMap.set(c.name.toLowerCase(), c.id))
                queryClient.invalidateQueries({ queryKey: ['courses'] })
            }

            // 3. Process schedule entries
            const newEntries: any[] = []
            const errors: string[] = []

            lines.forEach((line, index) => {
                const parts = line.split(',').map(p => p.trim())
                if (parts.length < 4) return

                const [courseName, dayName, startTime, endTime, room] = parts
                const courseId = existingCourseMap.get(courseName.toLowerCase())
                const day = DAYS.find(d => d.aliases.includes(dayName.toLowerCase()))

                if (!courseId) {
                    errors.push(`Satır ${index + 1}: '${courseName}' dersi için ID bulunamadı.`)
                    return
                }

                if (day === undefined) {
                    errors.push(`Satır ${index + 1}: '${dayName}' geçerli bir gün değil.`)
                    return
                }

                // Ensure time is in HH:MM format
                const formatTime = (t: string) => {
                    const match = t.match(/(\d{1,2})[:.](\d{1,2})/)
                    if (!match) return t
                    return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`
                }

                newEntries.push({
                    user_id: user?.id,
                    course_id: courseId,
                    day_of_week: day.id,
                    start_time: formatTime(startTime),
                    end_time: formatTime(endTime),
                    room: room || ''
                })
            })

            if (errors.length > 0) {
                console.warn('CSV Errors:', errors)
            }

            if (newEntries.length > 0) {
                const { error: scheduleError } = await supabase.from('weekly_schedule').insert(newEntries)
                if (scheduleError) {
                    alert('Ders programı kaydedilirken hata oluştu: ' + scheduleError.message)
                } else {
                    queryClient.invalidateQueries({ queryKey: ['schedule'] })
                    alert(`İşlem Başarılı!\n- ${newEntries.length} ders programına eklendi.\n- ${missingCourseNames.length} yeni ders listenize eklendi.`)
                }
            } else {
                alert('Yüklenecek geçerli bir ders programı satırı bulunamadı. Lütfen CSV formatını kontrol edin.')
            }
            setUploadLoading(false)
            // Reset input
            e.target.value = ''
        }

        reader.readAsText(file)
    }

    const downloadTemplate = () => {
        const content = "Matematik, Pazartesi, 09:00, 10:30, Amfi 1\nFizik, Salı, 11:00, 12:30, 202 Nolu Sınıf"
        const blob = new Blob([content], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'ders_programi_sablonu.csv'
        a.click()
    }

    const addMutation = useMutation({
        mutationFn: async (newData: any) => {
            const { error } = await supabase.from('weekly_schedule').insert([{ ...newData, user_id: user?.id }])
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule'] })
            setIsAdding(false)
            setFormData({ course_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:00', room: '' })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('weekly_schedule').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule'] })
        }
    })

    const deleteCourseMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!window.confirm('Bu dersi silmek istediğinize emin misiniz?')) return
            const { error } = await supabase.from('courses').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            refetchCourses()
            queryClient.invalidateQueries({ queryKey: ['schedule'] })
        }
    })

    const handleEditCourse = (course: any) => {
        setEditingCourse(course)
        setIsCourseModalOpen(true)
    }

    const handleAddNewCourse = () => {
        setEditingCourse(null)
        setIsCourseModalOpen(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        addMutation.mutate(formData)
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                        <CalendarDays className="h-8 w-8 text-blue-600" />
                        Ders Programı
                    </h1>
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        Haftalık derslerini planla, hiçbirini kaçırma.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button
                        variant="secondary"
                        onClick={downloadTemplate}
                        className="flex-1 md:flex-none"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Şablon İndir
                    </Button>
                    <label className="flex-1 md:flex-none cursor-pointer">
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleCSVUpload}
                            disabled={uploadLoading}
                        />
                        <div className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full">
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadLoading ? 'Yükleniyor...' : 'CSV Yükle'}
                        </div>
                    </label>
                    <Button onClick={() => setIsAdding(true)} className="flex-1 md:flex-none shadow-lg shadow-blue-500/20">
                        <Plus className="h-5 w-5 mr-2" />
                        Ders Ekle
                    </Button>
                </div>
            </div>

            {/* Add Schedule Form */}
            {isAdding && (
                <Card className="p-6 border-2 border-blue-500/20 bg-blue-50/10 dark:bg-blue-900/5">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ders Seç</label>
                            <select
                                required
                                value={formData.course_id}
                                onChange={e => setFormData({ ...formData, course_id: e.target.value })}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-blue-500 outline-none"
                            >
                                <option value="">Ders Seçiniz...</option>
                                {courses?.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Gün</label>
                            <select
                                value={formData.day_of_week}
                                onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-blue-500 outline-none"
                            >
                                {DAYS.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Başlangıç</label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bitiş</label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Derslik</label>
                            <input
                                type="text"
                                placeholder="Örn: Amfi 1"
                                value={formData.room}
                                onChange={e => setFormData({ ...formData, room: e.target.value })}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-3 lg:col-span-5 flex justify-end gap-3 mt-4">
                            <Button variant="ghost" onClick={() => setIsAdding(false)}>Vazgeç</Button>
                            <Button type="submit" disabled={addMutation.isPending}>
                                {addMutation.isPending ? 'Ekleniyor...' : 'Kaydet'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Weekly Schedule Grid */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {DAYS.map(day => (
                    <div key={day.id} className="space-y-4">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">{day.name}</h3>
                        </div>

                        <div className="space-y-3 min-h-[300px]">
                            {schedule?.filter((s: any) => s.day_of_week === day.id).map((item: any) => (
                                <Card key={item.id} className="p-4 relative group hover:ring-2 ring-blue-500/20 transition-all">
                                    <button
                                        onClick={() => deleteMutation.mutate(item.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.courses?.color }} />
                                        <span className="text-[10px] font-black uppercase text-gray-400 truncate tracking-tight">
                                            {item.courses?.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        <Clock className="h-3 w-3 text-blue-500" />
                                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                                    </div>

                                    {item.room && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                            <MapPin className="h-3 w-3" />
                                            {item.room}
                                        </div>
                                    )}
                                </Card>
                            ))}
                            {schedule?.filter((s: any) => s.day_of_week === day.id).length === 0 && (
                                <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-gray-50 dark:border-gray-900 rounded-3xl opacity-30 grayscale">
                                    <BookOpen className="h-6 w-6 text-gray-400" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Courses Management Section (Moved from Courses.tsx) */}
            <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Derslerim</h2>
                        <p className="text-gray-500 dark:text-gray-400">Dönem derslerinizi buradan yönetebilirsiniz.</p>
                    </div>
                    <Button onClick={handleAddNewCourse} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="h-5 w-5 mr-2" />
                        Yeni Ders Ekle
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses?.map((course: any) => (
                        <Card key={course.id} className="relative overflow-hidden group hover:shadow-md transition-shadow">
                            {/* Color Banner */}
                            <div className="h-2 w-full absolute top-0 left-0" style={{ backgroundColor: course.color }} />

                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                                {course.code || 'Bilinmiyor'}
                                            </span>
                                            <span className="text-xs text-gray-500">{course.credit} Kredi</span>
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-1" title={course.name}>
                                            {course.name}
                                        </h3>
                                    </div>

                                    <Menu as="div" className="relative ml-2">
                                        <Menu.Button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                                            <MoreVertical className="h-5 w-5" />
                                        </Menu.Button>
                                        <Transition
                                            as={Fragment}
                                            enter="transition ease-out duration-100"
                                            enterFrom="transform opacity-0 scale-95"
                                            enterTo="transform opacity-100 scale-100"
                                            leave="transition ease-in duration-75"
                                            leaveFrom="transform opacity-100 scale-100"
                                            leaveTo="transform opacity-0 scale-95"
                                        >
                                            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                                <div className="py-1">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => handleEditCourse(course)}
                                                                className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                                                    } flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                                                            >
                                                                <Edit2 className="mr-3 h-4 w-4" />
                                                                Düzenle
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => deleteCourseMutation.mutate(course.id)}
                                                                className={`${active ? 'bg-red-50 dark:bg-red-900/20' : ''
                                                                    } flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400`}
                                                            >
                                                                <Trash2 className="mr-3 h-4 w-4" />
                                                                Sil
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </div>
                                            </Menu.Items>
                                        </Transition>
                                    </Menu>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                        <BookOpen className="h-4 w-4 mr-2 text-gray-400" />
                                        <span>Syllabus: %{0} Tamamlandı</span>
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                        <span>Devamsızlık: 0/{course.attendance_limit}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {/* Empty State */}
                    {courses?.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl">
                            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Henüz hiç ders eklemediniz</h3>
                            <p className="text-gray-500 mt-1 mb-6">Derslerinizi ekleyerek takibe başlayın.</p>
                            <Button onClick={handleAddNewCourse}>İlk Dersi Ekle</Button>
                        </div>
                    )}
                </div>
            </div>

            <CourseModal
                isOpen={isCourseModalOpen}
                onClose={() => setIsCourseModalOpen(false)}
                course={editingCourse}
            />
        </div>
    )
}
