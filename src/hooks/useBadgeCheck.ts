import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'

export function useBadgeCheck() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!user) return

        const checkBadges = async () => {
            try {
                // 1. Get all badges
                const { data: badges } = await supabase.from('badges').select('*')
                if (!badges) return

                // 2. Get user earned badges
                const { data: earnedBadges } = await supabase
                    .from('user_badges')
                    .select('badge_id')
                    .eq('user_id', user.id)

                const earnedBadgeIds = earnedBadges?.map(eb => eb.badge_id) || []

                // 3. Gather stats for criteria
                const [sessionsRes, friendsRes, challengesRes, profileRes, coursesRes] = await Promise.all([
                    supabase.from('study_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false }),
                    supabase.from('friendships').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'accepted'),
                    supabase.from('challenge_participants').select('id', { count: 'exact' }).eq('user_id', user.id),
                    supabase.from('profiles').select('*').eq('id', user.id).single(),
                    supabase.from('courses').select('*, study_sessions(duration, start_time)').eq('user_id', user.id)
                ])

                const sessions = sessionsRes.data || []
                const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration / 60), 0) || 0
                const friendCount = friendsRes.count || 0
                const challengeCount = challengesRes.count || 0
                const profile = profileRes.data
                const courses = coursesRes.data || []

                // Streak Calculation
                let currentStreak = 0
                if (sessions.length > 0) {
                    const days = [...new Set(sessions.map(s => new Date(s.start_time).toDateString()))]
                    let checkDate = new Date()
                    // If no session today, streak might have ended yesterday
                    if (days[0] !== checkDate.toDateString()) {
                        checkDate.setDate(checkDate.getDate() - 1)
                    }

                    for (const day of days) {
                        if (day === checkDate.toDateString()) {
                            currentStreak++
                            checkDate.setDate(checkDate.getDate() - 1)
                        } else {
                            break
                        }
                    }
                }

                // Habit Checks
                const hasNightOwl = sessions.some(s => {
                    const hour = new Date(s.start_time).getHours()
                    return hour >= 0 && hour <= 4
                })
                const hasEarlyBird = sessions.some(s => {
                    const hour = new Date(s.start_time).getHours()
                    return hour >= 5 && hour <= 8
                })
                const hasMarathon = sessions.some(s => (s.duration / 3600) >= 3)
                const diverseStudyCount = [...new Set(sessions.filter(s => new Date(s.start_time).toDateString() === new Date().toDateString()).map(s => s.course_id))].length

                const badgesToAward: string[] = []

                for (const badge of badges) {
                    if (earnedBadgeIds.includes(badge.id)) continue

                    let shouldAward = false
                    switch (badge.criteria_type) {
                        case 'first_course':
                            if (courses.length >= 1) shouldAward = true
                            break
                        case 'profile_complete':
                            if (profile?.display_name && profile?.university) shouldAward = true
                            break
                        case 'streak':
                            if (currentStreak >= badge.criteria_value) shouldAward = true
                            break
                        case 'study_hours':
                            if (totalMinutes / 60 >= badge.criteria_value) shouldAward = true
                            break
                        case 'marathon':
                            if (hasMarathon) shouldAward = true
                            break
                        case 'night_owl':
                            if (hasNightOwl) shouldAward = true
                            break
                        case 'early_bird':
                            if (hasEarlyBird) shouldAward = true
                            break
                        case 'diverse_study':
                            if (diverseStudyCount >= badge.criteria_value) shouldAward = true
                            break
                        case 'gpa_legend':
                            if ((profile?.gpa || 0) >= badge.criteria_value) shouldAward = true
                            break
                        case 'friends_count':
                            if (friendCount >= badge.criteria_value) shouldAward = true
                            break
                        case 'first_challenge':
                            if (challengeCount >= 1) shouldAward = true
                            break
                        // Proxy checks for interactive actions
                        case 'absenteeism_update':
                            if (courses.some(c => (c.absences || 0) > 0)) shouldAward = true
                            break
                        case 'syllabus_add':
                            if (courses.some(c => Array.isArray(c.syllabus) && c.syllabus.length > 0)) shouldAward = true
                            break
                        case 'gpa_calc':
                            // If they have a GPA, they likely used the calculator (or set it manually)
                            if (profile?.gpa > 0) shouldAward = true
                            break
                        case 'weights_complete':
                            if (courses.every(c => c.color)) shouldAward = true // Color used as proxy for setup
                            break
                        case 'first_session':
                            if (sessions.length >= 1) shouldAward = true
                            break
                    }

                    if (shouldAward) {
                        badgesToAward.push(badge.id)
                    }
                }

                if (badgesToAward.length > 0) {
                    const insertData = badgesToAward.map(badgeId => ({
                        user_id: user.id,
                        badge_id: badgeId
                    }))

                    const { error } = await supabase.from('user_badges').insert(insertData)
                    if (!error) {
                        queryClient.invalidateQueries({ queryKey: ['user_badges'] })
                        // We could show a toast here if we had one
                    }
                }
            } catch (error) {
                console.error('Error checking badges:', error)
            }
        }

        checkBadges()
    }, [user, queryClient])
}
