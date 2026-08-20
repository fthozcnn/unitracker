import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'

/**
 * AnalyticsTracker component to place inside BrowserRouter.
 * Initializes analytics on mount and tracks pageviews on every route change.
 */
export function AnalyticsTracker() {
    const location = useLocation()

    useEffect(() => {
        initAnalytics()
    }, [])

    useEffect(() => {
        trackPageView(location.pathname + location.search)
    }, [location])

    return null
}

export default AnalyticsTracker
