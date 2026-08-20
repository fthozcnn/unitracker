import { useNavigate, Link } from 'react-router-dom'
import { Home, ArrowLeft, Timer, BookOpen, Compass, Search } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
    useDocumentTitle('Sayfa Bulunamadı (404)', {
        description: 'Aradığınız sayfa silinmiş, taşınmış veya hiç var olmamış olabilir.'
    })
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
            {/* Background Decorative Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-lg w-full text-center">
                {/* 404 Visual Badge */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 mb-6 shadow-xl shadow-indigo-500/5 ring-8 ring-indigo-500/5">
                    <Compass className="w-12 h-12 text-indigo-400 animate-pulse" />
                </div>

                <div className="mb-2">
                    <span className="text-sm font-semibold tracking-wider text-indigo-400 uppercase bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
                        Hata 404
                    </span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mt-3 mb-3">
                    Rotadan Çıktın!
                </h1>

                <p className="text-slate-400 text-base sm:text-lg mb-8 leading-relaxed">
                    Aradığın sayfa kampüste kaybolmuş, taşınmış veya bağlantı hatalı olabilir. Seni güvenli bir alana geri götürelim.
                </p>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Önceki Sayfaya Dön
                    </button>
                    <Link
                        to="/"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25"
                    >
                        <Home className="w-4 h-4" />
                        Ana Sayfaya Git
                    </Link>
                </div>

                {/* Quick Helpful Links */}
                <div className="pt-6 border-t border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                        Popüler Bölümler
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <Link
                            to="/study"
                            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 border border-slate-800 transition-colors"
                        >
                            <Timer className="w-4 h-4" />
                            <span>Pomodoro</span>
                        </Link>
                        <Link
                            to="/schedule"
                            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 border border-slate-800 transition-colors"
                        >
                            <BookOpen className="w-4 h-4" />
                            <span>Ders Programı</span>
                        </Link>
                        <Link
                            to="/grades"
                            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 border border-slate-800 transition-colors col-span-2 sm:col-span-1"
                        >
                            <Search className="w-4 h-4" />
                            <span>Not Hesapla</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
