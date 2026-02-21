import { useState } from 'react'
import { Music, Youtube, Play, Pause, ExternalLink, X, Settings } from 'lucide-react'
import { Card, Button, Input } from './ui-base'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface MusicPlayerProps {
    className?: string
}

export default function MusicPlayer({ className }: MusicPlayerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'spotify' | 'youtube'>('youtube')
    const [spotifyUrl, setSpotifyUrl] = useState('https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FgS800?si=5c0b784e857d42cf') // Lofi Girl
    const [youtubeUrl, setYoutubeUrl] = useState('https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1') // Lofi Girl Stream
    const [customLink, setCustomLink] = useState('')

    // Presets
    const spotifyPresets = [
        { name: 'Lofi Girl', url: 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FgS800' },
        { name: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
        { name: 'Jazz Vibes', url: 'https://open.spotify.com/playlist/37i9dQZF1DX0SM0LYsmbMT' },
    ]

    const youtubePresets = [
        { name: 'Lofi Girl Radio', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1' },
        { name: 'Doğa ve Yağmur', url: 'https://www.youtube.com/embed/mPZkdNFkNps?autoplay=1' },
    ]

    const handleApplyCustomLink = (type: 'spotify' | 'youtube') => {
        if (!customLink) return

        if (type === 'spotify') {
            // Convert regular Spotify links to embed links if needed
            let embedUrl = customLink
            if (!embedUrl.includes('embed')) {
                embedUrl = embedUrl.replace('spotify.com/', 'spotify.com/embed/')
            }
            setSpotifyUrl(embedUrl)
        } else {
            // Convert regular YouTube links to embed links if needed
            let embedUrl = customLink
            if (embedUrl.includes('watch?v=')) {
                embedUrl = embedUrl.replace('watch?v=', 'embed/')
            } else if (embedUrl.includes('youtu.be/')) {
                embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/')
            }
            // Ensure we have autoplay
            if (!embedUrl.includes('autoplay=1')) {
                embedUrl += embedUrl.includes('?') ? '&autoplay=1' : '?autoplay=1'
            }
            setYoutubeUrl(embedUrl)
        }
        setCustomLink('')
    }

    const getSpotifyEmbedUrl = (url: string) => {
        if (url.includes('embed')) return url
        return url.replace('spotify.com/', 'spotify.com/embed/')
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={twMerge(
                    "flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform",
                    className
                )}
            >
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </div>
                <Music className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Müzik Çalar</span>
            </button>
        )
    }

    return (
        <Card className={twMerge("w-[340px] flex flex-col shadow-2xl relative overflow-hidden", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Çalışma Müzikleri</h3>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 bg-gray-50 dark:bg-gray-800/50">
                <button
                    onClick={() => setActiveTab('spotify')}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                        activeTab === 'spotify'
                            ? "bg-[#1DB954] text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                >
                    <Music className="w-4 h-4" />
                    Spotify
                </button>
                <button
                    onClick={() => setActiveTab('youtube')}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                        activeTab === 'youtube'
                            ? "bg-[#FF0000] text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                >
                    <Youtube className="w-4 h-4" />
                    YouTube
                </button>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col gap-4">
                {/* Embed Area */}
                <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden shadow-inner">
                    {activeTab === 'spotify' ? (
                        <iframe
                            style={{ borderRadius: '12px' }}
                            src={getSpotifyEmbedUrl(spotifyUrl)}
                            width="100%"
                            height="152"
                            frameBorder="0"
                            allowFullScreen
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                        />
                    ) : (
                        <div className="aspect-video w-full">
                            <iframe
                                width="100%"
                                height="100%"
                                src={youtubeUrl}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    )}
                </div>

                {/* Presets */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Popüler Seçimler</p>
                    <div className="flex flex-wrap gap-2">
                        {(activeTab === 'spotify' ? spotifyPresets : youtubePresets).map((preset, idx) => (
                            <button
                                key={idx}
                                onClick={() => activeTab === 'spotify' ? setSpotifyUrl(preset.url) : setYoutubeUrl(preset.url)}
                                className={clsx(
                                    "px-3 py-1.5 text-xs rounded-full font-medium transition-all hover:scale-105",
                                    (activeTab === 'spotify' ? spotifyUrl.includes(preset.url) : youtubeUrl === preset.url)
                                        ? activeTab === 'spotify'
                                            ? "bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20"
                                            : "bg-[#FF0000]/10 text-[#FF0000] border border-[#FF0000]/20"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                )}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Link Input */}
                <div className="flex gap-2">
                    <Input
                        type="url"
                        placeholder={`${activeTab === 'spotify' ? 'Spotify' : 'YouTube'} linki yapıştır...`}
                        value={customLink}
                        onChange={(e) => setCustomLink(e.target.value)}
                        className="text-sm h-9"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyCustomLink(activeTab)
                        }}
                    />
                    <Button
                        onClick={() => handleApplyCustomLink(activeTab)}
                        size="sm"
                        className="h-9 px-3"
                        disabled={!customLink}
                    >
                        Aç
                    </Button>
                </div>
            </div>
        </Card>
    )
}
