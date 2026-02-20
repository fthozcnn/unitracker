import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// Check if notifications are supported
export function isNotificationSupported(): boolean {
    return Capacitor.isNativePlatform() || 'Notification' in window
}

// Get current permission status
export async function getNotificationPermission(): Promise<NotificationPermission> {
    if (Capacitor.isNativePlatform()) {
        try {
            const { display } = await LocalNotifications.checkPermissions()
            if (display === 'granted') return 'granted'
            if (display === 'denied') return 'denied'
            return 'default'
        } catch {
            return 'default'
        }
    }
    if (!('Notification' in window)) return 'denied'
    return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!isNotificationSupported()) {
        console.warn('Bu cihaz bildirimleri desteklemiyor')
        return 'denied'
    }

    if (Capacitor.isNativePlatform()) {
        try {
            const { display } = await LocalNotifications.requestPermissions()
            if (display === 'granted') return 'granted'
            if (display === 'denied') return 'denied'
            return 'default'
        } catch (error) {
            console.error('Bildirim izni istenirken hata:', error)
            return 'denied'
        }
    }

    try {
        const permission = await Notification.requestPermission()
        console.log('Bildirim izni:', permission)
        return permission
    } catch (error) {
        console.error('Bildirim izni istenirken hata:', error)
        return 'denied'
    }
}

// Send a local notification (now async)
export async function sendLocalNotification(
    title: string,
    body: string,
    options?: {
        icon?: string
        tag?: string
        data?: Record<string, unknown>
        requireInteraction?: boolean
    }
): Promise<any> {
    if (!isNotificationSupported()) return null

    if (Capacitor.isNativePlatform()) {
        const perm = await getNotificationPermission()
        if (perm !== 'granted') return null

        try {
            const id = Math.floor(Math.random() * 100000)
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title,
                        body,
                        id,
                        extra: options?.data,
                        smallIcon: options?.icon?.includes('unitracker') ? 'ic_stat_name' : undefined
                    }
                ]
            })
            return { id }
        } catch (error) {
            console.error('Mobil bildirim gönderme hatası:', error)
            return null
        }
    }

    // Web Fallback
    if (Notification.permission !== 'granted') return null

    try {
        const notification = new Notification(title, {
            body,
            icon: options?.icon || '/unitracker_app_icon.png',
            tag: options?.tag || 'unitracker-notification',
            requireInteraction: options?.requireInteraction || false,
        })

        notification.onclick = () => {
            window.focus()
            notification.close()
        }

        return notification
    } catch (error) {
        console.error('Web bildirim gönderme hatası:', error)
        return null
    }
}

// Send study completion notification
export async function sendStudyCompleteNotification(courseName: string, duration: number) {
    const minutes = Math.round(duration / 60)
    await sendLocalNotification(
        '🎉 Çalışma tamamlandı!',
        `${courseName} için ${minutes} dakika çalıştınız. Harika iş!`,
        { tag: 'study-complete' }
    )
}

// Send pomodoro notification
export async function sendPomodoroNotification(type: 'work' | 'break') {
    if (type === 'work') {
        await sendLocalNotification(
            '🍅 Pomodoro tamamlandı!',
            'Harika iş! Şimdi mola zamanı. ☕',
            { tag: 'pomodoro', requireInteraction: true }
        )
    } else {
        await sendLocalNotification(
            '⏰ Mola bitti!',
            'Çalışmaya geri dönme zamanı! 💪',
            { tag: 'pomodoro', requireInteraction: true }
        )
    }
}

// Send exam reminder notification
export async function sendExamReminderNotification(examName: string, courseName: string, daysLeft: number) {
    const urgency = daysLeft <= 1 ? '🚨' : daysLeft <= 3 ? '⚠️' : '📅'
    const dayText = daysLeft === 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün sonra`

    await sendLocalNotification(
        `${urgency} Sınav Hatırlatması`,
        `${courseName} - ${examName} ${dayText}!`,
        { tag: `exam-${examName}`, requireInteraction: daysLeft <= 1 }
    )
}

// Check and send exam reminders (called on Dashboard load)
export async function checkExamReminders(exams: Array<{ title: string; course_name: string; due_date: string }>) {
    const perm = await getNotificationPermission()
    if (perm !== 'granted') return

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const lastReminderDate = localStorage.getItem('unitracker_last_exam_reminder')
    const todayStr = today.toISOString().split('T')[0]
    if (lastReminderDate === todayStr) return

    let sentAny = false
    for (const exam of exams) {
        const examDate = new Date(exam.due_date)
        const examDay = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate())
        const diffTime = examDay.getTime() - today.getTime()
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (daysLeft >= 0 && daysLeft <= 3) {
            await sendExamReminderNotification(exam.title, exam.course_name, daysLeft)
            sentAny = true
        }
    }

    if (sentAny) {
        localStorage.setItem('unitracker_last_exam_reminder', todayStr)
    }
}

// Register service worker (for PWA)
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null
    try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        return registration
    } catch (error) {
        return null
    }
}

// Legacy exports
export const isPushNotificationSupported = isNotificationSupported
export async function subscribeToPushNotifications(_userId: string): Promise<boolean> {
    const permission = await requestNotificationPermission()
    return permission === 'granted'
}
export async function unsubscribeFromPushNotifications(_userId: string): Promise<boolean> {
    return true
}
export async function isSubscribedToPush(): Promise<boolean> {
    const perm = await getNotificationPermission()
    return perm === 'granted'
}
