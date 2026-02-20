import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Card, Input } from '../components/ui-base'
import { GraduationCap, LogIn, UserPlus } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { session } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)

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
                setMessage('Kayıt başarılı! Şimdi giriş yapabilirsiniz.')
                setIsSignUp(false)
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            }
        } catch (error: any) {
            setMessage(error.error_description || error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 shadow-xl border-t-4 border-t-blue-600">
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                        <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">UniMarmara</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        {isSignUp ? 'Yeni hesap oluştur' : 'Hesabınıza giriş yapın'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            E-posta Adresi
                        </label>
                        <Input
                            type="email"
                            placeholder="ornek@universite.edu.tr"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Şifre
                        </label>
                        <Input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <Button type="submit" className="w-full h-11" disabled={loading}>
                        {loading ? 'İşleniyor...' : (isSignUp ? 'Kayıt Ol' : 'Giriş Yap')}
                    </Button>
                </form>

                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('başarılı') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message}
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center justify-center mx-auto"
                    >
                        {isSignUp ? (
                            <>
                                <LogIn className="h-4 w-4 mr-2" />
                                Zaten hesabın var mı? Giriş yap
                            </>
                        ) : (
                            <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Hesabın yok mu? Kayıt ol
                            </>
                        )}
                    </button>
                </div>
            </Card>
        </div>
    )
}
