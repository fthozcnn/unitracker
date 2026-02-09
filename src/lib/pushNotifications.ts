import { supabase } from './supabase'

// VAPID public key - will be set in environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BNxJvXhF8Q3K5L9mPqRsTuVwXyZ0AbCdEfGhIjKlMnOpQrStUvWxYz'

// Convert base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

// Check if push notifications are supported
export function isPushNotificationSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications')
        return 'denied'
    }

    const permission = await Notification.requestPermission()
    return permission
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.log('Service workers are not supported')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        })
        console.log('Service Worker registered successfully:', registration)
        return registration
    } catch (error) {
        console.error('Service Worker registration failed:', error)
        return null
    }
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
        // Check if already supported
        if (!isPushNotificationSupported()) {
            console.log('Push notifications not supported')
            return false
        }

        // Request permission
        const permission = await requestNotificationPermission()
        if (permission !== 'granted') {
            console.log('Notification permission denied')
            return false
        }

        // Register service worker
        let registration = await navigator.serviceWorker.ready
        if (!registration) {
            const reg = await registerServiceWorker()
            if (!reg) {
                console.log('Failed to register service worker')
                return false
            }
            registration = reg
        }

        // Subscribe to push
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as any
        })

        // Save subscription to Supabase
        const subscriptionData = subscription.toJSON()
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                subscription: subscriptionData,
                user_agent: navigator.userAgent
            }, {
                onConflict: 'user_id'
            })

        if (error) {
            console.error('Failed to save subscription:', error)
            return false
        }

        console.log('Successfully subscribed to push notifications')
        return true
    } catch (error) {
        console.error('Error subscribing to push notifications:', error)
        return false
    }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            await subscription.unsubscribe()
        }

        // Remove from database
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)

        if (error) {
            console.error('Failed to remove subscription from database:', error)
            return false
        }

        console.log('Successfully unsubscribed from push notifications')
        return true
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error)
        return false
    }
}

// Check if user is subscribed
export async function isSubscribedToPush(): Promise<boolean> {
    try {
        if (!isPushNotificationSupported()) {
            return false
        }

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        return subscription !== null
    } catch (error) {
        console.error('Error checking push subscription:', error)
        return false
    }
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
    if (!('Notification' in window)) {
        return 'denied'
    }
    return Notification.permission
}
