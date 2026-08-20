import { maskSensitiveData } from './masking'

declare global {
    interface Window {
        dataLayer: any[]
        gtag?: (...args: any[]) => void
    }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || ''

let isInitialized = false

/**
 * Initialize Analytics (Google Analytics 4 or custom tracker)
 */
export function initAnalytics() {
    if (isInitialized) return
    if (typeof window === 'undefined') return

    if (GA_MEASUREMENT_ID) {
        try {
            // Inject GA4 script tag asynchronously
            const script = document.createElement('script')
            script.async = true
            script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
            document.head.appendChild(script)

            window.dataLayer = window.dataLayer || []
            window.gtag = function () {
                window.dataLayer.push(arguments)
            }
            window.gtag('js', new Date())
            window.gtag('config', GA_MEASUREMENT_ID, {
                send_page_view: false, // We manually send pageviews with React Router
                anonymize_ip: true,
                cookie_flags: 'SameSite=None;Secure'
            })

            console.log('[Analytics] GA4 initialized with ID:', GA_MEASUREMENT_ID)
        } catch (err) {
            console.warn('[Analytics] Failed to initialize GA4:', err)
        }
    } else {
        if (import.meta.env.DEV) {
            console.log('[Analytics] Running in local/dev mode (no GA ID provided). Events will be logged to console.')
        }
    }

    isInitialized = true
}

/**
 * Track page views dynamically on route change
 */
export function trackPageView(path: string, title?: string) {
    if (typeof window === 'undefined') return

    const pageTitle = title || document.title

    if (window.gtag && GA_MEASUREMENT_ID) {
        window.gtag('event', 'page_view', {
            page_path: path,
            page_title: pageTitle,
            page_location: window.location.href,
        })
    }

    if (import.meta.env.DEV) {
        console.log(`📊 [Analytics PageView]: ${path} - "${pageTitle}"`)
    }
}

/**
 * Track user interaction / feature usage events
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
    if (typeof window === 'undefined') return

    const eventPayload = {
        ...params,
        timestamp: new Date().toISOString(),
    }

    if (window.gtag && GA_MEASUREMENT_ID) {
        window.gtag('event', eventName, eventPayload)
    }

    if (import.meta.env.DEV) {
        console.log(`🎯 [Analytics Event] ${eventName}:`, maskSensitiveData(eventPayload))
    }
}

/**
 * Common Analytics Event Names for consistency across the app
 */
export const AnalyticsEvents = {
    // Auth & Onboarding
    SIGN_UP: 'sign_up',
    LOGIN: 'login',
    ONBOARDING_COMPLETED: 'onboarding_completed',

    // Academic
    COURSE_CREATED: 'course_created',
    COURSE_DELETED: 'course_deleted',
    GRADE_SAVED: 'grade_saved',
    ATTENDANCE_UPDATED: 'attendance_updated',
    ASSIGNMENT_CREATED: 'assignment_created',
    ASSIGNMENT_COMPLETED: 'assignment_completed',

    // Study & Pomodoro
    POMODORO_STARTED: 'pomodoro_started',
    POMODORO_COMPLETED: 'pomodoro_completed',
    MANUAL_SESSION_ADDED: 'manual_session_added',

    // Social & Gamification
    DUEL_CREATED: 'duel_created',
    DUEL_ACCEPTED: 'duel_accepted',
    FRIEND_INVITED: 'friend_invited',
    BADGE_VIEWED: 'badge_viewed',

    // UX & Support
    FAQ_OPENED: 'faq_opened',
    LEGAL_VIEWED: 'legal_viewed',
    BACKUP_EXPORTED: 'backup_exported',
    BACKUP_IMPORTED: 'backup_imported',
} as const
