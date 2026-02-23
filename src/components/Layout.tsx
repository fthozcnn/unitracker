import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    LayoutDashboard,
    Calendar,
    BarChart2,
    Settings,
    LogOut,
    Menu,
    GraduationCap,
    Timer,
    Users,
    Trophy,
    CalendarDays,
    ClipboardList
} from 'lucide-react'
import clsx from 'clsx'
import NotificationCenter from './NotificationCenter'
import GlobalChat from './GlobalChat'

export default function Layout() {
    const { signOut, user, profile } = useAuth()
    const location = useLocation()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const navigation = [
        { name: 'Ana Sayfa', href: '/', icon: LayoutDashboard },
        { name: 'Ders Programı', href: '/schedule', icon: CalendarDays },
        { name: 'Devamsızlık', href: '/attendance', icon: ClipboardList },
        { name: 'Not Hesaplama', href: '/grades', icon: GraduationCap },
        { name: 'Rozetler', href: '/badges', icon: Trophy },
        { name: 'Çalışma Odası', href: '/study', icon: Timer },
        { name: 'Takvim', href: '/calendar', icon: Calendar },
        { name: 'Analizler', href: '/analytics', icon: BarChart2 },
        { name: 'Sosyal', href: '/social', icon: Users },
        { name: 'Profil & Ayarlar', href: '/settings', icon: Settings },
    ]

    // Bottom nav - 5 most important tabs for mobile
    const mobileNav = [
        { name: 'Ana Sayfa', href: '/', icon: LayoutDashboard },
        { name: 'Çalış', href: '/study', icon: Timer },
        { name: 'Takvim', href: '/calendar', icon: Calendar },
        { name: 'Sosyal', href: '/social', icon: Users },
        { name: 'Ayarlar', href: '/settings', icon: Settings },
    ]

    return (
        <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col p-6">
                    {/* Logo and Notifications Header */}
                    <div className="flex items-center justify-between px-2 mb-10">
                        <Link to="/" className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-gray-900">
                                <GraduationCap className="h-6 w-6" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">UniMarmara</span>
                        </Link>
                        <div className="hidden lg:block relative z-50">
                            <NotificationCenter position="left" />
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={clsx(
                                        "flex items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-200 group",
                                        isActive
                                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-lg shadow-gray-200 dark:shadow-none"
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                                    )}
                                >
                                    <item.icon className={clsx("mr-3 h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white dark:text-gray-900" : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300")} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User Profile - Clean */}
                    <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
                        <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold text-sm border-2 border-white dark:border-gray-700 shadow-sm">
                                {profile?.display_name ? profile.display_name[0].toUpperCase() : user?.email?.[0].toUpperCase()}
                            </div>
                            <div className="ml-3 overflow-hidden flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {profile?.display_name || user?.email?.split('@')[0]}
                                </p>
                                <p className="text-xs text-gray-400 truncate">Öğrenci</p>
                            </div>
                            <div className="flex items-center gap-1 pl-2">
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut(); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                        </Link>
                    </div>
                </div>
            </aside >

            {/* Main Content */}
            < div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-black" >
                {/* Mobile Header */}
                <header className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 h-16">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">UniMarmara</span>
                    </div>
                    <NotificationCenter position="right" />
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-24 lg:pb-12">
                    <Outlet />
                </main>

                {/* Mobile Bottom Navigation - hidden when sidebar is open */}
                {!isMobileMenuOpen && (
                    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
                        <div className="flex items-center justify-around h-16 px-2">
                            {mobileNav.map((item) => {
                                const isActive = location.pathname === item.href
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all duration-200",
                                            isActive
                                                ? "text-blue-600 dark:text-blue-400"
                                                : "text-gray-400 dark:text-gray-500"
                                        )}
                                    >
                                        <item.icon className={clsx(
                                            "h-5 w-5 transition-transform",
                                            isActive && "scale-110"
                                        )} />
                                        <span className={clsx(
                                            "text-[10px] font-semibold",
                                            isActive && "font-bold"
                                        )}>
                                            {item.name}
                                        </span>
                                        {isActive && (
                                            <div className="absolute bottom-1 w-5 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </nav>
                )}
            </div >

            {/* Global Chat widget - visible on all pages */}
            <div className="fixed bottom-24 md:bottom-6 left-4 md:left-auto md:right-6 z-40">
                <GlobalChat />
            </div>
        </div >
    )
}
