import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui-base'
import {
    GraduationCap, Timer, Trophy,
    Users, ChevronRight, ChevronLeft,
    Sparkles, BookOpen, Target, X
} from 'lucide-react'

const STEPS = [
    {
        icon: Sparkles,
        title: 'UniMarmara\'ya Hoş Geldin! 🎓',
        description: 'Ders takibini kolaylaştıran, çalışma motivasyonunu artıran kişisel asistanın.',
        details: [
            'Derslerini takip et, çalışma süreni kaydet',
            'Not ortalamanı hesapla, devamsızlığını takip et',
            'Rozetler kazan, arkadaşlarınla yarış',
            'Hadi başlayalım! 🚀'
        ],
        color: 'from-blue-500 to-indigo-600',
        action: null
    },
    {
        icon: BookOpen,
        title: '1. Derslerini Ekle',
        description: 'İlk adım olarak bu dönemin derslerini ekle.',
        details: [
            '📚 Ders adı, kredi ve renk seçerek derslerini oluştur',
            '📋 CSV dosyası ile toplu yükleme yapabilirsin',
            '🎨 Her derse farklı renk atayarak organize ol',
            '⏰ Haftalık ders programını oluştur'
        ],
        color: 'from-emerald-500 to-green-600',
        action: { label: 'Ders Programına Git', path: '/schedule' }
    },
    {
        icon: Timer,
        title: '2. Çalışmaya Başla',
        description: 'Kronometre veya Pomodoro tekniği ile çalışmanı kaydet.',
        details: [
            '⏱️ Kronometre modu: Özgürce çalış, bitince kaydet',
            '🍅 Pomodoro modu: 25dk çalış, 5dk mola ver',
            '🎵 Ambient sesler ile odaklan (lo-fi, yağmur, doğa)',
            '✍️ Manuel kayıt ile geçmiş çalışmaları ekle'
        ],
        color: 'from-orange-500 to-red-600',
        action: { label: 'Çalışma Odasına Git', path: '/study' }
    },
    {
        icon: GraduationCap,
        title: '3. Notlarını Takip Et',
        description: 'Vize, final, ödev notlarını gir ve ortalamanı hesapla.',
        details: [
            '📊 Ağırlıklı not ortalaması otomatik hesaplanır',
            '🎯 "Final\'den kaç almalıyım?" hesaplayıcısı',
            '📈 Dönem GPA\'ini takip et',
            '📋 Devamsızlık durumunu kontrol et'
        ],
        color: 'from-purple-500 to-violet-600',
        action: { label: 'Not Hesaplamaya Git', path: '/grades' }
    },
    {
        icon: Trophy,
        title: '4. Rozetler ve XP Kazan',
        description: 'Çalıştıkça XP kazanır, seviye atlar ve rozetler toplarsın!',
        details: [
            '⭐ Her dakika çalışma = 2 XP',
            '🍅 Pomodoro tamamla = 50 XP',
            '🏅 30 farklı rozet kazanabilirsin',
            '🏆 Arkadaşlarınla XP sıralamasında yarış'
        ],
        color: 'from-amber-500 to-yellow-600',
        action: { label: 'Rozetlere Göz At', path: '/badges' }
    },
    {
        icon: Users,
        title: '5. Sosyal Özellikler',
        description: 'Arkadaşlarını ekle, challenge oluştur ve birlikte çalış!',
        details: [
            '👥 Arkadaş ekle ve çalışma durumlarını gör',
            '🎯 Challenge oluştur ve yarış',
            '📣 Dürtme ve tezahürat gönder',
            '🔔 Bildirimlerle hiçbir şeyi kaçırma'
        ],
        color: 'from-pink-500 to-rose-600',
        action: { label: 'Sosyal Sayfaya Git', path: '/social' }
    },
    {
        icon: Target,
        title: 'Hazırsın! 🎉',
        description: 'Artık UniMarmara\'yı kullanmaya başlayabilirsin.',
        details: [
            '✅ Derslerini ekle ve programını oluştur',
            '✅ Çalışma oturumlarını kaydet',
            '✅ Notlarını gir ve GPA\'ini takip et',
            '✅ Rozetler kazan ve seviye atla!'
        ],
        color: 'from-cyan-500 to-blue-600',
        action: null
    }
]

export default function OnboardingWizard({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [currentStep, setCurrentStep] = useState(0)
    const navigate = useNavigate()
    const step = STEPS[currentStep]
    const Icon = step.icon
    const isLast = currentStep === STEPS.length - 1

    const handleComplete = () => {
        localStorage.setItem('onboarding_completed', 'true')
        onClose()
    }

    const handleAction = () => {
        if (step.action) {
            localStorage.setItem('onboarding_completed', 'true')
            onClose()
            navigate(step.action.path)
        }
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => { }}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-90"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-90"
                        >
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-3xl bg-white dark:bg-gray-900 shadow-2xl transition-all">

                                {/* Skip Button */}
                                <button
                                    onClick={handleComplete}
                                    className="absolute top-4 right-4 z-10 text-white/70 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>

                                {/* Header with gradient */}
                                <div className={`bg-gradient-to-br ${step.color} p-8 text-center relative overflow-hidden`}>
                                    {/* Decorative circles */}
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
                                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full" />

                                    <div className="relative">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
                                            <Icon className="h-8 w-8 text-white" />
                                        </div>
                                        <Dialog.Title className="text-2xl font-black text-white mb-2">
                                            {step.title}
                                        </Dialog.Title>
                                        <p className="text-white/80 text-sm font-medium">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <ul className="space-y-3 mb-6">
                                        {step.details.map((detail, i) => (
                                            <li key={i} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                                                <span className="mr-2">{detail.substring(0, 2)}</span>
                                                <span>{detail.substring(2)}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Step Indicator */}
                                    <div className="flex justify-center gap-1.5 mb-6">
                                        {STEPS.map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep
                                                    ? 'w-8 bg-blue-500'
                                                    : i < currentStep
                                                        ? 'w-1.5 bg-blue-300'
                                                        : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Navigation Buttons */}
                                    <div className="flex items-center justify-between gap-3">
                                        {currentStep > 0 ? (
                                            <Button
                                                variant="ghost"
                                                onClick={() => setCurrentStep(s => s - 1)}
                                                className="flex items-center"
                                            >
                                                <ChevronLeft className="h-4 w-4 mr-1" />
                                                Geri
                                            </Button>
                                        ) : (
                                            <div />
                                        )}

                                        <div className="flex gap-2">
                                            {step.action && (
                                                <Button
                                                    variant="secondary"
                                                    onClick={handleAction}
                                                    className="text-sm"
                                                >
                                                    {step.action.label}
                                                </Button>
                                            )}

                                            {isLast ? (
                                                <Button onClick={handleComplete} className="shadow-lg">
                                                    Başlayalım! 🚀
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => setCurrentStep(s => s + 1)}
                                                    className="flex items-center"
                                                >
                                                    İleri
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
