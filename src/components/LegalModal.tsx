import { useState } from 'react'
import { Shield, FileText, X, CheckCircle, Lock, Eye, Database, Trash2 } from 'lucide-react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'

interface LegalModalProps {
    isOpen: boolean
    onClose: () => void
    initialTab?: 'privacy' | 'terms'
}

export default function LegalModal({ isOpen, onClose, initialTab = 'privacy' }: LegalModalProps) {
    const [tab, setTab] = useState<'privacy' | 'terms'>(initialTab)

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-2xl border border-gray-100 dark:border-slate-800 transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                                            {tab === 'privacy' ? <Shield className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <DialogTitle as="h3" className="text-lg font-bold text-gray-900 dark:text-white">
                                                {tab === 'privacy' ? 'Gizlilik Politikası ve KVKK' : 'Kullanım Koşulları'}
                                            </DialogTitle>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Son güncelleme: 20 Ağustos 2026
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl my-4 text-xs font-semibold">
                                    <button
                                        onClick={() => setTab('privacy')}
                                        className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                                            tab === 'privacy'
                                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Gizlilik Politikası (KVKK)
                                    </button>
                                    <button
                                        onClick={() => setTab('terms')}
                                        className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                                            tab === 'terms'
                                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        Kullanım Koşulları
                                    </button>
                                </div>

                                {/* Content Area */}
                                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
                                    {tab === 'privacy' ? (
                                        <>
                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                                    <Lock className="w-4 h-4 text-emerald-500" />
                                                    1. Veri Sorumlusu ve Genel Bilgilendirme
                                                </h4>
                                                <p>
                                                    UniMarmara ("Uygulama"), üniversite öğrencilerinin ders, not, çalışma ve pomodoro takibini kolaylaştırmak amacıyla geliştirilmiştir. 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat uyarınca kişisel verilerinizin gizliliğine ve güvenliğine en üst düzeyde önem veriyoruz.
                                                </p>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                                    <Database className="w-4 h-4 text-indigo-500" />
                                                    2. Toplanan Veriler ve Kullanım Amacı
                                                </h4>
                                                <p>Uygulamayı kullanırken yalnızca temel hizmet sunumu için gerekli olan veriler işlenir:</p>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    <li><strong>Hesap Bilgileri:</strong> Kayıt sırasında alınan e-posta adresi ve belirlediğiniz rumuz/ad soyad.</li>
                                                    <li><strong>Akademik ve Çalışma Verileri:</strong> Eklediğiniz dersler, ders programı saatleri, devamsızlık kayıtları, sınav ve ödev notları, pomodoro çalışma süreleri.</li>
                                                    <li><strong>Sosyal Etkileşim:</strong> Arkadaşlık istekleri, liderlik sıralaması XP değerleri ve sosyal çalışma düelloları.</li>
                                                </ul>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                                    <Eye className="w-4 h-4 text-amber-500" />
                                                    3. Verilerin Güvenliği ve Üçüncü Taraflar
                                                </h4>
                                                <p>
                                                    Verileriniz şifreli bağlantılar (SSL/TLS) ve Supabase bulut altyapısında Row Level Security (Satır Düzeyinde Güvenlik) ile korunmaktadır.
                                                    <strong> Kişisel verileriniz hiçbir koşulda ticari amaçla satılmaz, kiralanmaz veya üçüncü parti reklam ağlarıyla paylaşılmaz.</strong>
                                                </p>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                    4. Unutulma Hakkı ve Hesap Silme
                                                </h4>
                                                <p>
                                                    Kullanıcılar diledikleri an <strong>Ayarlar &gt; Tehlikeli Bölge</strong> menüsünden tüm verilerini sıfırlayabilir veya hesaplarını kalıcı olarak silebilirler. Hesap silindiğinde tüm kişisel veriler ve kayıtlar veritabanından geri döndürülemez şekilde anında silinir.
                                                </p>
                                            </section>
                                        </>
                                    ) : (
                                        <>
                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                                    1. Hizmetin Niteliği ve Kabul
                                                </h4>
                                                <p>
                                                    UniMarmara platformuna kaydolarak veya giriş yaparak bu kullanım şartlarını kabul etmiş sayılırsınız. Uygulama, öğrencilerin bireysel çalışma planlamalarına yardımcı olmak üzere ücretsiz/açık bir araç olarak sunulmaktadır.
                                                </p>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                                    2. Hesap Güvenliği ve Kullanıcı Sorumluluğu
                                                </h4>
                                                <p>
                                                    Kullanıcı, hesap şifresinin gizliliğini korumakla kendisi sorumludur. Sosyal etkileşim, düello ve genel sohbet alanlarında saygılı, etik kurallara uygun ve hukuka aykırı olmayan içerik paylaşılması zorunludur.
                                                </p>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                                    3. Akademik Feragatname (Disclaimer)
                                                </h4>
                                                <p>
                                                    Uygulama içerisindeki not hesaplama, devamsızlık ve takvim araçları bilgilendirme ve kişisel takip amaçlıdır. Üniversitenizin resmi öğrenci bilgi sistemi (BYS / OBS) kayıtları her zaman esastır ve tek yasal geçerliliğe sahip kaynaktır.
                                                </p>
                                            </section>

                                            <section className="space-y-2">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                                    4. Fikri Mülkiyet ve Değişiklikler
                                                </h4>
                                                <p>
                                                    UniMarmara yazılımı, tasarımı ve arayüz ögeleri korunmaktadır. Geliştirici ekip, hizmet koşullarında ve uygulama özelliklerinde önceden haber vererek veya vermeksizin güncelleme yapma hakkını saklı tutar.
                                                </p>
                                            </section>
                                        </>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                    <div className="flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 gap-1 font-medium">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>KVKK Uyumlu Altyapı</span>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                                    >
                                        Anladım & Kapat
                                    </button>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
