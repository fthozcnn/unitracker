import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import CourseDetail from './pages/CourseDetail'
import Study from './pages/Study'
import CalendarPage from './pages/Calendar'
import Analytics from './pages/Analytics'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Social from './pages/Social'
import Badges from './pages/Badges'
import Schedule from './pages/Schedule'
import Attendance from './pages/Attendance'
import Grades from './pages/Grades'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

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

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
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
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    )
}
