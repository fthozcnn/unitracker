import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import clsx from 'clsx'

export default function NotificationCenter({ position = 'right' }: { position?: 'left' | 'right' }) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isOpen, setIsOpen] = useState(false)

    const { data: notifications } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(20)
            return data || []
        },
        enabled: !!user
    })

    const unreadCount = notifications?.filter(n => !n.is_read).length || 0

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from('notifications').update({ is_read: true }).eq('id', id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    })

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    })

    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from('notifications').delete().eq('id', id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    })

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-950">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className={clsx(
                        "absolute mt-2 w-80 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden transform animate-in slide-in-from-top-2 duration-200",
                        position === 'right' ? 'right-0' : 'left-0'
                    )}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 dark:text-white">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllAsReadMutation.mutate()}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                >
                                    Tümünü okundu yap
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                            {notifications?.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Henüz bildirim yok.</p>
                                </div>
                            ) : (
                                notifications?.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm text-gray-900 dark:text-white">{n.title}</span>
                                                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{n.message}</p>
                                                <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: tr })}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {!n.is_read && (
                                                    <button
                                                        onClick={() => markAsReadMutation.mutate(n.id)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Okundu işaretle"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotificationMutation.mutate(n.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                {n.link && (
                                                    <Link
                                                        to={n.link}
                                                        onClick={() => { setIsOpen(false); markAsReadMutation.mutate(n.id); }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Git"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
