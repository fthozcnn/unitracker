import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSupabasePing } from './hooks/useSupabasePing'
import AnalyticsTracker from './components/AnalyticsTracker'

// Lazy-loaded pages for code-splitting (F3)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const Study = lazy(() => import('./pages/Study'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Social = lazy(() => import('./pages/Social'))
const Badges = lazy(() => import('./pages/Badges'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Grades = lazy(() => import('./pages/Grades'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Legal = lazy(() => import('./pages/Legal'))

// F11: Configure QueryClient with proper caching defaults
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 2 * 60 * 1000,      // 2 minutes
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, loading } = useAuth()

    if (loading) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>

    if (!session) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

// Local Login component removed to fix conflict with imported Login page

// Local Dashboard removed in favor of page component

function PingManager() {
    useSupabasePing()
    return null
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <PingManager />
                <BrowserRouter>
                    <AnalyticsTracker />
                    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Yükleniyor...</div>}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/privacy" element={<Legal defaultTab="privacy" />} />
                            <Route path="/terms" element={<Legal defaultTab="terms" />} />
                            <Route path="/legal" element={<Legal />} />
                            <Route path="/" element={
                                <ProtectedRoute>
                                    <Layout />
                                </ProtectedRoute>
                            }>
                                <Route index element={<Dashboard />} />
                                <Route path="badges" element={<Badges />} />
                                <Route path="schedule" element={<Schedule />} />
                                <Route path="attendance" element={<Attendance />} />
                                <Route path="grades" element={<Grades />} />
                                <Route path="courses/:id" element={<CourseDetail />} />
                                <Route path="study" element={<Study />} />
                                <Route path="calendar" element={<CalendarPage />} />
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="social" element={<Social />} />
                            </Route>
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    )
}
