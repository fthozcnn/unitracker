import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Card, Input } from '../components/ui-base'
import { GraduationCap, LogIn, UserPlus, HelpCircle, Sparkles, Timer, Trophy, CalendarDays, ShieldCheck } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import LegalModal from '../components/LegalModal'
import FAQModal from '../components/FAQModal'
import { trackEvent, AnalyticsEvents } from '../lib/analytics'

export default function Login() {
    const { session } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [legalModalOpen, setLegalModalOpen] = useState(false)
    const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms'>('privacy')
    const [faqModalOpen, setFaqModalOpen] = useState(false)

    useDocumentTitle(isSignUp ? 'Kayıt Ol' : 'Giriş Yap', {
        description: 'UniMarmara ders takip ve çalışma platformuna giriş yapın veya yeni hesap oluşturun.'
    })

    if (session) {
        return <Navigate to="/" replace />
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: email.split('@')[0],
                        }
                    }
                })
                if (error) throw error
                trackEvent(AnalyticsEvents.SIGN_UP, { method: 'email' })
                setMessage('Kayıt başarılı! Şimdi giriş yapabilirsiniz.')
                setIsSignUp(false)
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                trackEvent(AnalyticsEvents.LOGIN, { method: 'email' })
            }
        } catch (error: any) {
            setMessage(error.error_description || error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Quick SSS & Help Link in Top Right */}
            <div className="w-full max-w-md flex justify-end mb-3">
                <button
                    type="button"
                    onClick={() => setFaqModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 bg-slate-900/80 hover:bg-slate-850 px-3 py-1.5 rounded-full border border-slate-800 transition-colors shadow-sm"
                >
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sıkça Sorulan Sorular (SSS)</span>
                </button>
            </div>

            <Card className="max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl rounded-2xl relative z-10">
                <div className="text-center mb-6">
                    <div className="mx-auto h-14 w-14 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/25">
                        <GraduationCap className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">UniMarmara</h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        {isSignUp ? 'Hemen ücretsiz hesap oluştur ve derslerini planla' : 'Öğrenci hesabınıza giriş yapın'}
                    </p>
                </div>

                {/* Feature Highlights Banner */}
                <div className="grid grid-cols-3 gap-2 mb-6 text-center text-[10px] sm:text-xs">
                    <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center gap-1">
                        <CalendarDays className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-300 font-medium leading-tight">Ders Programı</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center gap-1">
                        <Timer className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300 font-medium leading-tight">Pomodoro Odası</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-300 font-medium leading-tight">Çalışma Düellosu</span>
                    </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                            E-posta Adresi
                        </label>
                        <Input
                            type="email"
                            placeholder="ornek@universite.edu.tr"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Şifre
                        </label>
                        <Input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                        disabled={loading}
                    >
                        {loading ? 'İşleniyor...' : (isSignUp ? 'Hemen Ücretsiz Kayıt Ol' : 'Giriş Yap')}
                    </Button>

                    <p className="text-[11px] text-center text-slate-400 mt-3 leading-relaxed">
                        Devam ederek{' '}
                        <button
                            type="button"
                            onClick={() => { setLegalModalTab('terms'); setLegalModalOpen(true); }}
                            className="text-indigo-400 underline hover:text-indigo-300 font-medium"
                        >
                            Kullanım Koşulları
                        </button>{' '}
                        ve{' '}
                        <button
                            type="button"
                            onClick={() => { setLegalModalTab('privacy'); setLegalModalOpen(true); }}
                            className="text-indigo-400 underline hover:text-indigo-300 font-medium"
                        >
                            Gizlilik Politikası
                        </button>
                        'nı kabul etmiş olursunuz.
                    </p>
                </form>

                {message && (
                    <div className={`mt-4 p-3 rounded-xl text-xs sm:text-sm text-center ${message.includes('başarılı') ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-red-950/80 text-red-300 border border-red-800'}`}>
                        {message}
                    </div>
                )}

                <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-xs sm:text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center mx-auto transition-colors"
                    >
                        {isSignUp ? (
                            <>
                                <LogIn className="h-4 w-4 mr-1.5" />
                                Zaten hesabın var mı? <span className="underline ml-1">Giriş yap</span>
                            </>
                        ) : (
                            <>
                                <UserPlus className="h-4 w-4 mr-1.5" />
                                Hesabın yok mu? <span className="underline ml-1">Ücretsiz kayıt ol</span>
                            </>
                        )}
                    </button>
                </div>
            </Card>

            {/* Modals */}
            <LegalModal
                isOpen={legalModalOpen}
                onClose={() => setLegalModalOpen(false)}
                initialTab={legalModalTab}
            />

            <FAQModal
                isOpen={faqModalOpen}
                onClose={() => setFaqModalOpen(false)}
            />
        </div>
    )
}
