import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, CalendarDays, Pencil } from 'lucide-react'
import { Button, Input } from './ui-base'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useQuery } from '@tanstack/react-query'

type Assignment = {
    id: string
    course_id: string
    title: string
    type: string
    due_date: string
    description?: string
}

type AddAssignmentModalProps = {
    isOpen: boolean
    onClose: () => void
    defaultDate?: Date | null
    editingAssignment?: Assignment | null
}

export const EVENT_TYPES = [
    { value: 'exam', label: 'Sınav', emoji: '🔴' },
    { value: 'quiz', label: 'Quiz', emoji: '🟡' },
    { value: 'homework', label: 'Ödev', emoji: '🔵' },
    { value: 'project', label: 'Proje', emoji: '🟢' },
    { value: 'review', label: 'Tekrar', emoji: '🟣' },
    { value: 'other', label: 'Diğer', emoji: '⚫' },
]

export default function AddAssignmentModal({ isOpen, onClose, defaultDate, editingAssignment }: AddAssignmentModalProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [formData, setFormData] = useState({
        courseId: '',
        title: '',
        type: 'homework',
        dueDate: '',
        dueTime: '23:59',
        description: '',
    })

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('id, name')
            return data || []
        }
    })

    // Prefill when editing
    useEffect(() => {
        if (editingAssignment && isOpen) {
            const d = new Date(editingAssignment.due_date)
            const offset = d.getTimezoneOffset()
            const local = new Date(d.getTime() - offset * 60000)
            setFormData({
                courseId: editingAssignment.course_id,
                title: editingAssignment.title,
                type: editingAssignment.type,
                dueDate: local.toISOString().split('T')[0],
                dueTime: local.toISOString().split('T')[1]?.slice(0, 5) || '23:59',
                description: editingAssignment.description || '',
            })
        } else if (!editingAssignment && defaultDate && isOpen) {
            const offset = defaultDate.getTimezoneOffset()
            const local = new Date(defaultDate.getTime() - offset * 60000)
            setFormData(prev => ({ ...prev, dueDate: local.toISOString().split('T')[0] }))
        }
    }, [editingAssignment, defaultDate, isOpen])

    const reset = () => {
        setFormData({ courseId: '', title: '', type: 'homework', dueDate: '', dueTime: '23:59', description: '' })
        setErrorMsg('')
    }

    const handleClose = () => { reset(); onClose() }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !formData.courseId) { setErrorMsg('Lütfen bir ders seçin.'); return }
        setLoading(true)
        setErrorMsg('')
        try {
            const dueDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`)
            const payload = {
                course_id: formData.courseId,
                title: formData.title,
                type: formData.type,
                due_date: dueDateTime.toISOString(),
                description: formData.description || null,
            }

            if (editingAssignment) {
                const { error } = await supabase.from('assignments').update(payload).eq('id', editingAssignment.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('assignments').insert({ user_id: user.id, ...payload, is_completed: false })
                if (error) throw error
            }

            await queryClient.invalidateQueries({ queryKey: ['assignments'] })
            await queryClient.invalidateQueries({ queryKey: ['upcoming_events'] })
            handleClose()
        } catch (err: any) {
            setErrorMsg(err.message || 'Kaydetme sırasında hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const isEditing = !!editingAssignment

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-100 dark:border-gray-800">
                                <div className="flex justify-between items-center mb-5">
                                    <Dialog.Title as="h3" className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {isEditing ? <Pencil className="h-5 w-5 text-blue-500" /> : <CalendarDays className="h-5 w-5 text-blue-500" />}
                                        {isEditing ? 'Etkinliği Düzenle' : 'Yeni Etkinlik Ekle'}
                                    </Dialog.Title>
                                    <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Type pills */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tür</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {EVENT_TYPES.map(t => (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, type: t.value }))}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${formData.type === t.value
                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                        }`}
                                                >
                                                    <span>{t.emoji}</span>{t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Course */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Ders</label>
                                        <select
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={formData.courseId}
                                            onChange={e => setFormData(p => ({ ...p, courseId: e.target.value }))}
                                            required
                                        >
                                            <option value="">Ders seçin...</option>
                                            {courses?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Title */}
                                    <Input
                                        label="Başlık"
                                        placeholder="Örn: Vize Sınavı, Algoritma Ödevi..."
                                        value={formData.title}
                                        onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                        required
                                    />

                                    {/* Date + Time */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Tarih" type="date" value={formData.dueDate} onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} required />
                                        <Input label="Saat" type="time" value={formData.dueTime} onChange={e => setFormData(p => ({ ...p, dueTime: e.target.value }))} required />
                                    </div>

                                    {/* Description (optional) */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Açıklama <span className="font-normal normal-case">(isteğe bağlı)</span></label>
                                        <textarea
                                            rows={2}
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            placeholder="Ek notlar..."
                                            value={formData.description}
                                            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                        />
                                    </div>

                                    {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}

                                    <div className="flex justify-end gap-2 pt-1">
                                        <Button type="button" variant="secondary" onClick={handleClose}>İptal</Button>
                                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                                            {loading ? 'Kaydediliyor…' : isEditing ? 'Güncelle' : 'Kaydet'}
                                        </Button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
