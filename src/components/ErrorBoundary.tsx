import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card } from './ui-base.tsx'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Yakalanan Hata:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full p-6 text-center shadow-2xl border border-slate-800 bg-slate-900">
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-900/40 text-red-400 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Bir şeyler ters gitti
                        </h2>
                        <p className="text-sm text-slate-400 mb-4">
                            Sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.
                        </p>
                        {this.state.error?.message && (
                            <div className="p-2 mb-4 bg-slate-800/80 border border-slate-700 rounded text-left text-xs font-mono text-red-400 max-h-24 overflow-auto">
                                {this.state.error.message}
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => window.location.reload()}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Sayfayı Yenile
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    localStorage.clear()
                                    window.location.href = '/login'
                                }}
                                className="w-full text-xs text-slate-400"
                            >
                                Oturumu Sıfırla ve Giriş Yap
                            </Button>
                        </div>
                    </Card>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
