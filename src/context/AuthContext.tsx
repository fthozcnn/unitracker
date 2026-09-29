import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Profile = {
    id: string
    email: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    total_xp: number
    level: number
}

type AuthContextType = {
    session: Session | null
    user: User | null
    profile: Profile | null
    loading: boolean
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, avatar_url, bio, total_xp, level')
            .eq('id', userId)
            .single()

        if (!error && data) {
            setProfile(data)
        }
    }

    useEffect(() => {
        let mounted = true

        // Safety timeout in case network or Supabase is paused / unresponsive
        const timeoutId = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Auth session check timed out - Supabase may be paused or offline.')
                setLoading(false)
            }
        }, 5000)

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return
            setSession(session)
            if (session?.user) {
                fetchProfile(session.user.id)
            }
            setLoading(false)
        }).catch((err) => {
            console.error('Failed to get auth session:', err)
            if (mounted) {
                setLoading(false)
            }
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return
            setSession(session)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
            }
            setLoading(false)
        })

        return () => {
            mounted = false
            clearTimeout(timeoutId)
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setProfile(null)
    }

    const value = {
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut,
        refreshProfile: async () => {
            if (session?.user) await fetchProfile(session.user.id)
        }
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
