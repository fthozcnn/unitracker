import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MessageCircle, X, Send, Hash } from 'lucide-react'
import { Card, Input } from './ui-base'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Message = {
    id: string
    user_id: string
    display_name: string
    content: string
    created_at: string
}

interface GlobalChatProps {
    className?: string
}

export default function GlobalChat({ className }: GlobalChatProps) {
    const { user, profile } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [unread, setUnread] = useState(0)
    const bottomRef = useRef<HTMLDivElement>(null)
    const wasOpenRef = useRef(false)

    // Fetch last 50 messages on open
    useEffect(() => {
        if (!isOpen) return
        setUnread(0)
        wasOpenRef.current = true

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)
            if (data) setMessages(data.reverse())
        }
        fetchMessages()
    }, [isOpen])

    // Scroll to bottom when messages change
    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('global_chat_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload: any) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        // avoid duplicates
                        if (prev.find(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    if (!wasOpenRef.current) {
                        setUnread(n => n + 1)
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    // Keep wasOpenRef in sync
    useEffect(() => {
        wasOpenRef.current = isOpen
        if (isOpen) setUnread(0)
    }, [isOpen])

    const handleSend = async () => {
        const trimmed = text.trim()
        if (!trimmed || sending || !user) return
        setSending(true)
        setText('')

        const displayName = profile?.display_name || user.email?.split('@')[0] || 'Kullanıcı'
        const { error } = await supabase.from('chat_messages').insert({
            user_id: user.id,
            display_name: displayName,
            content: trimmed,
        })
        if (error) {
            // Restore text on error
            setText(trimmed)
        }
        setSending(false)
    }

    // --- Closed (toggle button) ---
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={twMerge(
                    'relative flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform',
                    className
                )}
            >
                {/* Unread badge */}
                {unread > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </div>
                <MessageCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Sohbet</span>
            </button>
        )
    }

    // --- Open card ---
    return (
        <Card className={twMerge('w-[340px] flex flex-col shadow-2xl relative overflow-hidden', className)} style={{ height: 440 }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Genel Sohbet</h3>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full uppercase tracking-wide">
                        Canlı
                    </span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <MessageCircle className="h-10 w-10 opacity-20" />
                        <p className="text-xs font-medium">Henüz mesaj yok. İlk sen yaz!</p>
                    </div>
                )}
                {messages.map(msg => {
                    const isMe = msg.user_id === user?.id
                    return (
                        <div
                            key={msg.id}
                            className={clsx('flex flex-col', isMe ? 'items-end' : 'items-start')}
                        >
                            {!isMe && (
                                <span className="text-[10px] font-bold text-gray-400 px-1 mb-0.5">
                                    {msg.display_name}
                                </span>
                            )}
                            <div
                                className={clsx(
                                    'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                                    isMe
                                        ? 'bg-green-500 text-white rounded-br-sm'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                                )}
                            >
                                {msg.content}
                            </div>
                            <span className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5 px-1">
                                {format(new Date(msg.created_at), 'HH:mm', { locale: tr })}
                            </span>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                <div className="flex gap-2">
                    <Input
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Bir şey yaz…"
                        className="text-sm h-9 flex-1"
                        maxLength={500}
                        disabled={sending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className={clsx(
                            'flex items-center justify-center w-9 h-9 rounded-xl transition-all',
                            text.trim() && !sending
                                ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[9px] text-gray-400 text-right mt-1">{text.length}/500</p>
            </div>
        </Card>
    )
}
