import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Clock, Edit2 } from 'lucide-react'
import { Button, Input } from './ui-base'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { addXP, XP_REWARDS } from '../lib/xpSystem'

type ManualSessionModalProps = {
    isOpen: boolean
    onClose: () => void
    editingSession?: any
}

export default function ManualSessionModal({ isOpen, onClose, editingSession }: ManualSessionModalProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        courseId: '',
        date: new Date().toISOString().split('T')[0],
        duration: 60, // minutes
        note: ''
    })

    // Update form when editingSession changes
    useEffect(() => {
        if (editingSession) {
            setFormData({
                courseId: editingSession.course_id || '',
                date: editingSession.start_time.split('T')[0],
                duration: Math.round(editingSession.duration / 60),
                note: editingSession.note || ''
            })
        } else {
            setFormData({
                courseId: '',
                date: new Date().toISOString().split('T')[0],
                duration: 60,
                note: ''
            })
        }
    }, [editingSession, isOpen])

    const { data: courses } = useQuery({
        queryKey: ['courses'],
        queryFn: async () => {
            const { data } = await supabase.from('courses').select('id, name')
            return data || []
        }
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !formData.courseId) {
            alert('Lütfen bir ders seçin')
            return
        }

        setLoading(true)
        try {
            const date = new Date(formData.date)
            const now = new Date()

            // If editing, try to keep the original hours/minutes if possible, 
            // otherwise use current time.
            const originalDate = editingSession ? new Date(editingSession.start_time) : now
            date.setHours(originalDate.getHours(), originalDate.getMinutes())

            const startTime = date.toISOString()
            const endTime = new Date(date.getTime() + formData.duration * 60000).toISOString()

            const sessionData = {
                user_id: user.id,
                course_id: formData.courseId,
                start_time: startTime,
                end_time: endTime,
                duration: formData.duration * 60, // seconds
                note: formData.note
            }

            if (editingSession) {
                const { error } = await supabase
                    .from('study_sessions')
                    .update(sessionData)
                    .eq('id', editingSession.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('study_sessions')
                    .insert(sessionData)
                if (error) throw error

                // Award XP for manual session
                if (formData.duration > 0) {
                    await addXP(user.id, formData.duration * XP_REWARDS.STUDY_MINUTE)
                }
            }

            await queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
            await queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] })
            await queryClient.invalidateQueries({ queryKey: ['analytics_weekly'] })
            await queryClient.invalidateQueries({ queryKey: ['analytics_dist'] })
            await queryClient.invalidateQueries({ queryKey: ['profile'] })

            alert(editingSession ? 'Çalışma güncellendi!' : 'Çalışma kaydedildi!')
            onClose()
        } catch (error) {
            console.error('Error saving session:', error)
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
                                        {editingSession ? (
                                            <Edit2 className="mr-2 h-5 w-5 text-amber-500" />
                                        ) : (
                                            <Clock className="mr-2 h-5 w-5 text-blue-500" />
                                        )}
                                        {editingSession ? 'Çalışmayı Düzenle' : 'Manuel Çalışma Ekle'}
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
                                        label="Tarih"
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />

                                    <Input
                                        label="Süre (Dakika)"
                                        type="number"
                                        min="1"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                        required
                                    />

                                    <Input
                                        label="Not"
                                        placeholder="Ne çalıştınız?"
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    />

                                    <div className="mt-6 flex justify-end space-x-2">
                                        <Button type="button" variant="secondary" onClick={onClose}>
                                            İptal
                                        </Button>
                                        <Button type="submit" disabled={loading} className={editingSession ? 'bg-amber-600 hover:bg-amber-700' : ''}>
                                            {loading ? 'Kaydediliyor...' : (editingSession ? 'Güncelle' : 'Kaydet')}
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
