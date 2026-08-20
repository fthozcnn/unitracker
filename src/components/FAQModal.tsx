import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import {
    HelpCircle,
    Search,
    ChevronDown,
    GraduationCap,
    Timer,
    Swords,
    Shield,
    Smartphone,
    X,
    MessageCircle,
    Sparkles
} from 'lucide-react'
import { trackEvent, AnalyticsEvents } from '../lib/analytics'

interface FAQItem {
    id: string
    category: 'academic' | 'study' | 'social' | 'privacy' | 'general'
    question: string
    answer: string
}

const FAQS: FAQItem[] = [
    {
        id: 'faq-1',
        category: 'academic',
        question: 'Not hesaplama sistemi üniversitemin not sistemiyle uyumlu mu?',
        answer: 'Evet! Not Hesaplama modülünde Vize, Final, Quiz, Ödev ve Proje ağırlıklarını (%40-%60, %30-%70 vb.) dilediğiniz gibi özelleştirebilirsiniz. Sistem otomatik olarak geçme/kalma barajını (35 puan final barajı ve 50 genel ortalama) hesaplar.'
    },
    {
        id: 'faq-2',
        category: 'academic',
        question: 'Devamsızlık sınırı uyarısı nasıl çalışır?',
        answer: 'Her ders için okulunuzun belirlediği devamsızlık saat sınırını (örneğin 4 hafta veya 12 saat) girebilirsiniz. Kalan hakkınız kritik seviyeye (2 veya altı) düştüğünde sistem sizi renk kodlarıyla ve bildirimlerle uyarır.'
    },
    {
        id: 'faq-3',
        category: 'study',
        question: 'Pomodoro zamanlayıcısı arka planda çalışır mı?',
        answer: 'Evet! Pomodoro sayacını başlattıktan sonra başka sekmelere geçseniz dahi süreniz doğru şekilde sayılmaya devam eder. Seans bittiğinde tarayıcı veya cihaz bildiriminizle uyarılırsınız.'
    },
    {
        id: 'faq-4',
        category: 'study',
        question: 'Senkronize Çalışma Odası nedir?',
        answer: 'Çalışma Odası sekmesinde eşzamanlı olarak diğer öğrencilerle ve arkadaşlarınızla aynı anda odaklanabilirsiniz. Kimin hangi derse çalıştığını görebilir, birlikte mola verip çalışma disiplininizi artırabilirsiniz.'
    },
    {
        id: 'faq-5',
        category: 'social',
        question: 'Çalışma Düellosu nasıl başlatılır ve XP nasıl kazanılır?',
        answer: 'Sosyal sekmesinden arkadaşınızı seçerek 30, 60 veya 120 dakikalık bir çalışma düellosuna davet edebilirsiniz. Süreyi tamamlayan taraf ekstra XP ve Seviye puanı kazanarak liderlik tablosunda üst sıralara yükselir.'
    },
    {
        id: 'faq-6',
        category: 'social',
        question: 'Arkadaşımı uygulamaya nasıl ekleyebilirim?',
        answer: 'Sosyal > Arkadaşlar sekmesindeki arama çubuğuna arkadaşınızın sisteme kayıtlı e-posta adresini veya kullanıcı adını yazıp "İstek Gönder" butonuna basmanız yeterlidir.'
    },
    {
        id: 'faq-7',
        category: 'privacy',
        question: 'Verilerim güvende mi ve Marmara BYS ile senkronize mi?',
        answer: 'UniMarmara bağımsız bir öğrenci üretkenlik aracıdır ve verileriniz Supabase PostgreSQL üzerinde Row Level Security (RLS) ile şifreli korunur. Verileriniz üçüncü partilerle paylaşılmaz ve istediğiniz an Ayarlar sekmesinden tüm verilerinizi silebilirsiniz.'
    },
    {
        id: 'faq-8',
        category: 'privacy',
        question: 'Cihaz değiştirirsem verilerim kaybolur mu?',
        answer: 'Hayır, tüm dersleriniz, rozetleriniz ve çalışma geçmişiniz bulut hesabınıza bağlıdır. Başka bir telefon veya bilgisayardan aynı e-posta ve şifrenizle giriş yaptığınızda kaldığınız yerden devam edersiniz.'
    },
    {
        id: 'faq-9',
        category: 'general',
        question: 'Uygulamayı telefona uygulama (PWA / Mobil) olarak nasıl yüklerim?',
        answer: 'Tarayıcınızın (Chrome / Safari) "Paylaş" veya "Seçenekler" menüsünden "Ana Ekrana Ekle" (Add to Home Screen) butonuna basarak UniMarmara\'yı telefonunuza tam ekran mobil uygulama gibi anında kurabilirsiniz.'
    }
]

const CATEGORIES = [
    { id: 'all', label: 'Tümü', icon: Sparkles },
    { id: 'academic', label: 'Akademik & Notlar', icon: GraduationCap },
    { id: 'study', label: 'Pomodoro & Çalışma', icon: Timer },
    { id: 'social', label: 'Sosyal & Düellolar', icon: Swords },
    { id: 'privacy', label: 'Gizlilik & Güvenlik', icon: Shield },
    { id: 'general', label: 'Mobil & Genel', icon: Smartphone },
]

interface FAQModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function FAQModal({ isOpen, onClose }: FAQModalProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [openItem, setOpenItem] = useState<string | null>('faq-1')

    useEffect(() => {
        if (isOpen) {
            trackEvent(AnalyticsEvents.FAQ_OPENED)
        }
    }, [isOpen])

    const filteredFaqs = useMemo(() => {
        return FAQS.filter(faq => {
            const matchesCat = selectedCategory === 'all' || faq.category === selectedCategory
            const matchesSearch = searchQuery.trim() === '' ||
                faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCat && matchesSearch
        })
    }, [searchQuery, selectedCategory])

    const toggleItem = (id: string) => {
        setOpenItem(prev => (prev === id ? null : id))
    }

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
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                                            <HelpCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <DialogTitle as="h3" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                                Sıkça Sorulan Sorular (SSS)
                                            </DialogTitle>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                UniMarmara hakkında merak ettiğiniz her şey
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

                                {/* Search Bar */}
                                <div className="relative mt-4 mb-3">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Bir soru veya anahtar kelime arayın..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>

                                {/* Category Badges */}
                                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none text-xs">
                                    {CATEGORIES.map((cat) => {
                                        const Icon = cat.icon
                                        const isActive = selectedCategory === cat.id
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                                                    isActive
                                                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {cat.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* FAQ Accordion List */}
                                <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-2.5">
                                    {filteredFaqs.length === 0 ? (
                                        <div className="py-8 text-center text-gray-400 text-sm">
                                            Aramanızla eşleşen bir soru bulunamadı.
                                        </div>
                                    ) : (
                                        filteredFaqs.map((faq) => {
                                            const isOpen = openItem === faq.id
                                            return (
                                                <div
                                                    key={faq.id}
                                                    className="rounded-xl border border-gray-200/70 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 overflow-hidden transition-colors"
                                                >
                                                    <button
                                                        onClick={() => toggleItem(faq.id)}
                                                        className="w-full p-3.5 sm:p-4 text-left font-semibold text-xs sm:text-sm text-gray-900 dark:text-white flex items-center justify-between gap-3 hover:bg-gray-100/60 dark:hover:bg-slate-800/80 transition-colors"
                                                    >
                                                        <span>{faq.question}</span>
                                                        <ChevronDown
                                                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                                                                isOpen ? 'rotate-180 text-blue-500' : ''
                                                            }`}
                                                        />
                                                    </button>
                                                    {isOpen && (
                                                        <div className="px-3.5 sm:px-4 pb-3.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-slate-800/60 pt-2.5">
                                                            {faq.answer}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <MessageCircle className="w-4 h-4 text-blue-500" />
                                        <span>Başka bir sorunuz mu var? Geri bildirimde bulunun.</span>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition-all shadow-sm"
                                    >
                                        Kapat
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
