import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { Button, Input } from './ui-base'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'

type CourseModalProps = {
    isOpen: boolean
    onClose: () => void
    course?: any // To be typed properly later
}

const COLORS = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#14b8a6', // Teal
]

export default function CourseModal({ isOpen, onClose, course }: CourseModalProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        credit: 3,
        attendance_limit: 14,
        color: COLORS[0]
    })

    useEffect(() => {
        if (course) {
            setFormData({
                name: course.name,
                code: course.code || '',
                credit: course.credit,
                attendance_limit: course.attendance_limit,
                color: course.color
            })
        } else {
            setFormData({
                name: '',
                code: '',
                credit: 3,
                attendance_limit: 14,
                color: COLORS[0]
            })
        }
    }, [course, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setLoading(true)
        try {
            if (course) {
                // Update
                const { error } = await supabase
                    .from('courses')
                    .update({
                        name: formData.name,
                        code: formData.code,
                        credit: formData.credit,
                        attendance_limit: formData.attendance_limit,
                        color: formData.color
                    })
                    .eq('id', course.id)
                if (error) throw error
            } else {
                // Create
                const { error } = await supabase
                    .from('courses')
                    .insert([{
                        user_id: user.id,
                        name: formData.name,
                        code: formData.code,
                        credit: formData.credit,
                        attendance_limit: formData.attendance_limit,
                        color: formData.color,
                        syllabus: [] // Initialize empty syllabus
                    }])
                if (error) throw error
            }

            await queryClient.invalidateQueries({ queryKey: ['courses'] })
            onClose()
        } catch (error) {
            console.error('Error saving course:', error)
            alert('Ders kaydedilirken bir hata oluştu.')
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
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                        {course ? 'Dersi Düzenle' : 'Yeni Ders Ekle'}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <Input
                                        label="Ders Adı"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Örn: Algoritma Analizi"
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Ders Kodu"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="Örn: CS101"
                                        />
                                        <Input
                                            label="Kredi"
                                            type="number"
                                            value={formData.credit}
                                            onChange={(e) => setFormData({ ...formData, credit: Number(e.target.value) })}
                                            min={0}
                                        />
                                    </div>

                                    <Input
                                        label="Devamsızlık Limiti (Saat/Ders)"
                                        type="number"
                                        value={formData.attendance_limit}
                                        onChange={(e) => setFormData({ ...formData, attendance_limit: Number(e.target.value) })}
                                        min={0}
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Renk
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${formData.color === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => setFormData({ ...formData, color })}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-end space-x-2">
                                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
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
