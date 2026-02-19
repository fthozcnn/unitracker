// Local Notification System - Browser Notification API
// Push API yerine yerel bildirim sistemi (localhost'ta ve HTTPS'te çalışır)

// Check if notifications are supported
export function isNotificationSupported(): boolean {
    return 'Notification' in window
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission {
    if (!isNotificationSupported()) {
        return 'denied'
    }
    return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!isNotificationSupported()) {
        console.warn('Bu tarayıcı bildirimleri desteklemiyor')
        return 'denied'
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

// Send a local notification
export function sendLocalNotification(
    title: string,
    body: string,
    options?: {
        icon?: string
        tag?: string
        data?: Record<string, unknown>
        requireInteraction?: boolean
    }
): Notification | null {
    if (!isNotificationSupported()) {
        console.warn('Bildirimler desteklenmiyor')
        return null
    }

    if (Notification.permission !== 'granted') {
        console.warn('Bildirim izni verilmemiş')
        return null
    }

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
        console.error('Bildirim gönderme hatası:', error)
        return null
    }
}

// Send study completion notification
export function sendStudyCompleteNotification(courseName: string, duration: number) {
    const minutes = Math.round(duration / 60)
    sendLocalNotification(
        '🎉 Çalışma tamamlandı!',
        `${courseName} için ${minutes} dakika çalıştınız. Harika iş!`,
        { tag: 'study-complete' }
    )
}

// Send pomodoro notification
export function sendPomodoroNotification(type: 'work' | 'break') {
    if (type === 'work') {
        sendLocalNotification(
            '🍅 Pomodoro tamamlandı!',
            'Harika iş! Şimdi mola zamanı. ☕',
            { tag: 'pomodoro', requireInteraction: true }
        )
    } else {
        sendLocalNotification(
            '⏰ Mola bitti!',
            'Çalışmaya geri dönme zamanı! 💪',
            { tag: 'pomodoro', requireInteraction: true }
        )
    }
}

// Send exam reminder notification
export function sendExamReminderNotification(examName: string, courseName: string, daysLeft: number) {
    const urgency = daysLeft <= 1 ? '🚨' : daysLeft <= 3 ? '⚠️' : '📅'
    const dayText = daysLeft === 0 ? 'bugün' : daysLeft === 1 ? 'yarın' : `${daysLeft} gün sonra`

    sendLocalNotification(
        `${urgency} Sınav Hatırlatması`,
        `${courseName} - ${examName} ${dayText}!`,
        { tag: `exam-${examName}`, requireInteraction: daysLeft <= 1 }
    )
}

// Check and send exam reminders (called on Dashboard load)
export function checkExamReminders(exams: Array<{ title: string; course_name: string; due_date: string }>) {
    if (Notification.permission !== 'granted') return

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Check if we already sent reminders today
    const lastReminderDate = localStorage.getItem('unitracker_last_exam_reminder')
    const todayStr = today.toISOString().split('T')[0]
    if (lastReminderDate === todayStr) return

    let sentAny = false
    for (const exam of exams) {
        const examDate = new Date(exam.due_date)
        const examDay = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate())
        const diffTime = examDay.getTime() - today.getTime()
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Send notifications for exams within 3 days
        if (daysLeft >= 0 && daysLeft <= 3) {
            sendExamReminderNotification(exam.title, exam.course_name, daysLeft)
            sentAny = true
        }
    }

    if (sentAny) {
        localStorage.setItem('unitracker_last_exam_reminder', todayStr)
    }
}

// Register service worker (for PWA only - no push subscription)
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('Service worker desteklenmiyor')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        })
        console.log('Service Worker kayıtlı:', registration)
        return registration
    } catch (error) {
        console.error('Service Worker kaydı başarısız:', error)
        return null
    }
}

// Legacy exports for backward compatibility
export const isPushNotificationSupported = isNotificationSupported
export async function subscribeToPushNotifications(_userId: string): Promise<boolean> {
    const permission = await requestNotificationPermission()
    return permission === 'granted'
}
export async function unsubscribeFromPushNotifications(_userId: string): Promise<boolean> {
    // No-op — local notifications don't have subscriptions
    return true
}
export async function isSubscribedToPush(): Promise<boolean> {
    return Notification.permission === 'granted'
}
