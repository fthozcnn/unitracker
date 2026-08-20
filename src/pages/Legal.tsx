import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, FileText, ArrowLeft, CheckCircle, Lock, Eye, Database, Trash2, Home } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface LegalProps {
    defaultTab?: 'privacy' | 'terms'
}

export default function Legal({ defaultTab }: LegalProps) {
    const location = useLocation()
    
    // Determine tab based on prop or route pathname
    const determineTab = (): 'privacy' | 'terms' => {
        if (defaultTab) return defaultTab
        if (location.pathname.includes('terms')) return 'terms'
        return 'privacy'
    }

    const [tab, setTab] = useState<'privacy' | 'terms'>(determineTab)

    useEffect(() => {
        if (location.pathname.includes('terms')) {
            setTab('terms')
        } else if (location.pathname.includes('privacy')) {
            setTab('privacy')
        }
    }, [location.pathname])

    useDocumentTitle(tab === 'privacy' ? 'Gizlilik Politikası ve KVKK' : 'Kullanım Koşulları', {
        description: 'UniMarmara kullanıcı gizlilik politikası, KVKK aydınlatma metni ve kullanım şartları.'
    })

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Decorative Glow */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[36rem] h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                {/* Header Navigation */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Ana Sayfaya Dön</span>
                    </Link>
                    <span className="text-xs text-indigo-400 font-medium px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/50">
                        Yasal Bilgilendirme
                    </span>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-700/80 p-6 sm:p-10 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 mb-3">
                            {tab === 'privacy' ? <Shield className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                            {tab === 'privacy' ? 'Gizlilik Politikası & KVKK' : 'Kullanım Koşulları'}
                        </h1>
                        <p className="text-slate-400 text-xs sm:text-sm mt-2">
                            Son Güncelleme: 20 Ağustos 2026 • Sürüm 1.2
                        </p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-slate-900/80 p-1.5 rounded-xl mb-8 border border-slate-700/60 max-w-md mx-auto text-xs sm:text-sm font-semibold">
                        <button
                            onClick={() => setTab('privacy')}
                            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                                tab === 'privacy'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Shield className="w-4 h-4" />
                            Gizlilik Politikası
                        </button>
                        <button
                            onClick={() => setTab('terms')}
                            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                                tab === 'terms'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Kullanım Koşulları
                        </button>
                    </div>

                    {/* Document Content */}
                    <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                        {tab === 'privacy' ? (
                            <>
                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-emerald-400" />
                                        1. Veri Sorumlusu ve Genel Bakış
                                    </h2>
                                    <p>
                                        UniMarmara, üniversite öğrencilerinin akademik hayatlarını ve çalışma rutinlerini kolaylaştırmak üzere tasarlanmıştır. Kişisel verilerinizin gizliliğini korumak temel ilkemizdir. 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca verileriniz sadece aşağıda belirtilen amaçlar doğrultusunda işlenmektedir.
                                    </p>
                                </section>

                                <section className="space-y-3 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <Database className="w-4 h-4 text-indigo-400" />
                                        2. İşlenen Veriler ve Toplama Yöntemi
                                    </h2>
                                    <p>Uygulamamız tarafından işlenen veriler şunlardır:</p>
                                    <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                                        <li><strong>Hesap Bilgileri:</strong> Kayıt sırasında sağlanan e-posta adresi, ad soyad veya belirlediğiniz kullanıcı takma adı.</li>
                                        <li><strong>Akademik Takip Verileri:</strong> Ders isimleri, kodları, haftalık program saatleri, devamsızlık kayıtları, sınav ve ödev notları.</li>
                                        <li><strong>Çalışma İstatistikleri:</strong> Pomodoro çalışma oturumlarının tarih ve süreleri, kazanılan unvan ve rozetler.</li>
                                        <li><strong>Sosyal Özellikler:</strong> Arkadaş listesi, çalışma düelloları ve ortak meydan okuma verileri.</li>
                                    </ul>
                                </section>

                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-amber-400" />
                                        3. Veri Güvenliği ve Üçüncü Şahıslarla Paylaşım
                                    </h2>
                                    <p>
                                        Verileriniz modern şifreleme yöntemleriyle (HTTPS/TLS) korunmakta ve Supabase bulut veri tabanında Satır Düzeyinde Güvenlik (RLS) protokolleri altında saklanmaktadır. Verileriniz asla üçüncü taraflara satılmaz, kiralanmaz veya ticari reklam amaçlarıyla işlenmez.
                                    </p>
                                </section>

                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                        4. Kullanıcı Hakları ve Hesap Silme (Unutulma Hakkı)
                                    </h2>
                                    <p>
                                        KVKK Madde 11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, yanlış verilerin düzeltilmesini talep etme ve verilerinizin silinmesini isteme hakkına sahipsiniz. Uygulama içerisindeki <strong>Ayarlar &gt; Tehlikeli Bölge</strong> alanından tek tıkla hesabınızı ve tüm ilişkili verilerinizi anında kalıcı olarak silebilirsiniz.
                                    </p>
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white">
                                        1. Şartların Kabulü ve Hizmet Tanımı
                                    </h2>
                                    <p>
                                        UniMarmara uygulamasını indirerek, ziyaret ederek veya kayıt olarak bu Kullanım Koşulları'nı bütünüyle kabul etmiş olursunuz. UniMarmara, öğrencilerin eğitim süreçlerini organize etmelerine yardımcı bir üretkenlik aracıdır.
                                    </p>
                                </section>

                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white">
                                        2. Kullanım Kuralları ve Topluluk Standartları
                                    </h2>
                                    <p>
                                        Sosyal modüller (çalışma düelloları, arkadaş sohbeti, grup meydan okumaları) kullanılırken saygılı ve akademik etiğe uygun davranılması esastır. Taciz, nefret söylemi, spam veya yasa dışı faaliyet içeren hesaplar uyarılmaksızın askıya alınabilir.
                                    </p>
                                </section>

                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white">
                                        3. Resmi Bilgi Sistemleri Feragatnamesi
                                    </h2>
                                    <p>
                                        UniMarmara, üniversitelerin resmi Bilgi Yönetim Sistemleri (BYS / OBS) yerine geçmez. Not ortalaması ve devamsızlık hesaplamaları yaklaşık bilgilendirme niteliğindedir. Resmi durumlarda daima üniversitenizin OBS kayıtları esas alınmalıdır.
                                    </p>
                                </section>

                                <section className="space-y-2 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-700/40">
                                    <h2 className="text-base font-bold text-white">
                                        4. Sorumluluğun Sınırlandırılması
                                    </h2>
                                    <p>
                                        UniMarmara hizmetlerinin kesintisiz çalışması için azami gayret gösterilir ancak olası teknik aksaklıklar veya veri kayıplarından doğabilecek dolaylı zararlardan sorumlu tutulamaz. Kullanıcıların periyodik olarak Ayarlar sekmesinden veri yedeği indirmeleri önerilir.
                                    </p>
                                </section>
                            </>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="mt-8 pt-6 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            <span>KVKK & GDPR Standartlarına Uyumlu</span>
                        </div>
                        <div className="flex gap-4">
                            <Link to="/login" className="hover:text-white transition-colors underline">
                                Giriş Ekranına Dön
                            </Link>
                            <Link to="/" className="hover:text-white transition-colors underline">
                                Ana Sayfa
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
