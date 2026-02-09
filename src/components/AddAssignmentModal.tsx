import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Calendar as CalendarIcon } from 'lucide-react'
import { Button, Input } from './ui-base'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useQuery } from '@tanstack/react-query'

type AddAssignmentModalProps = {
    isOpen: boolean
    onClose: () => void
    defaultDate?: Date | null
}

const TYPES = [
    { value: 'exam', label: 'Sınav' },
    { value: 'homework', label: 'Ödev' },
    { value: 'project', label: 'Proje' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'other', label: 'Diğer' },
]

export default function AddAssignmentModal({ isOpen, onClose, defaultDate }: AddAssignmentModalProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        courseId: '',
        title: '',
        type: 'homework',
        dueDate: '',
        dueTime: '23:59'
    })

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('id, name')
            return data || []
        }
    })

    useEffect(() => {
        if (defaultDate) {
            // Adjust for timezone offset to get correct YYYY-MM-DD
            const offset = defaultDate.getTimezoneOffset()
            const date = new Date(defaultDate.getTime() - (offset * 60 * 1000))
            setFormData(prev => ({ ...prev, dueDate: date.toISOString().split('T')[0] }))
        }
    }, [defaultDate, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !formData.courseId) {
            alert('Lütfen bir ders seçin')
            return
        }

        setLoading(true)
        try {
            const dueDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`)

            const { error } = await supabase
                .from('assignments')
                .insert({
                    user_id: user.id,
                    course_id: formData.courseId,
                    title: formData.title,
                    type: formData.type,
                    due_date: dueDateTime.toISOString(),
                    is_completed: false
                })

            if (error) throw error

            await queryClient.invalidateQueries({ queryKey: ['assignments'] })
            alert('Görev eklendi!')
            onClose()
            setFormData({
                courseId: '',
                title: '',
                type: 'homework',
                dueDate: '',
                dueTime: '23:59'
            })
        } catch (error) {
            console.error('Error saving assignment:', error)
            alert('Kaydetme hatası.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-center mb-4">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
                                        <CalendarIcon className="mr-2 h-5 w-5 text-blue-500" />
                                        Yeni Görev / Sınav Ekle
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Ders
                                        </label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                                            value={formData.courseId}
                                            onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                                            required
                                        >
                                            <option value="">Seçiniz...</option>
                                            {courses?.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <Input
                                        label="Başlık"
                                        placeholder="Örn: Vize Sınavı"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Tür
                                        </label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            {TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Tarih"
                                            type="date"
                                            value={formData.dueDate}
                                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                            required
                                        />
                                        <Input
                                            label="Saat"
                                            type="time"
                                            value={formData.dueTime}
                                            onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="mt-6 flex justify-end space-x-2">
                                        <Button type="button" variant="secondary" onClick={onClose}>
                                            İptal
                                        </Button>
                                        <Button type="submit" disabled={loading}>
                                            {loading ? 'Kaydediliyor...' : 'Kaydet'}
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
