import { supabase } from './supabase'

// XP Rewards
export const XP_REWARDS = {
    STUDY_MINUTE: 2,       // Per minute studied
    POMODORO_COMPLETE: 50,  // Completing a Pomodoro cycle
    DAILY_STREAK: 100,     // Maintaining daily streak
    CHALLENGE_COMPLETE: 200, // Completing a challenge
    SOCIAL_REACTION: 10,   // Nudge or cheer
}

// Level formula: level = floor(sqrt(totalXP / 100))
export function calculateLevel(xp: number): number {
    return Math.max(1, Math.floor(Math.sqrt(xp / 100)))
}

// XP needed for next level
export function xpForLevel(level: number): number {
    return level * level * 100
}

// Progress to next level (0-100%)
export function levelProgress(xp: number): number {
    const currentLevel = calculateLevel(xp)
    const currentLevelXP = xpForLevel(currentLevel)
    const nextLevelXP = xpForLevel(currentLevel + 1)
    return Math.min(100, ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
}

// Add XP to user profile
export async function addXP(userId: string, amount: number): Promise<{ newXP: number, newLevel: number, leveledUp: boolean } | null> {
    try {
        // Get current XP
        const { data: profile } = await supabase
            .from('profiles')
            .select('total_xp, level')
            .eq('id', userId)
            .single()

        if (!profile) return null

        const currentXP = profile.total_xp || 0
        const currentLevel = profile.level || 1
        const newXP = currentXP + amount
        const newLevel = calculateLevel(newXP)
        const leveledUp = newLevel > currentLevel

        // Update profile
        await supabase
            .from('profiles')
            .update({ total_xp: newXP, level: newLevel })
            .eq('id', userId)

        return { newXP, newLevel, leveledUp }
    } catch (err) {
        console.error('XP update error:', err)
        return null
    }
}

// Update user presence
export async function updatePresence(status: 'idle' | 'studying' | 'pomodoro' | 'break', courseName?: string) {
    try {
        await supabase.rpc('update_user_presence', {
            p_status: status,
            p_course: courseName || null
        })
    } catch (err) {
        console.error('Presence update error:', err)
    }
}
