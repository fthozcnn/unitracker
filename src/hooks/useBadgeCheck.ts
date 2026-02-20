import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { sendLocalNotification } from '../lib/pushNotifications'
import { addXP, XP_REWARDS } from '../lib/xpSystem'

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
                const [sessionsRes, friendsRes, challengesRes, profileRes, coursesRes, assignmentsRes] = await Promise.all([
                    supabase.from('study_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false }),
                    supabase.from('friendships').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'accepted'),
                    supabase.from('challenge_participants').select('id', { count: 'exact' }).eq('user_id', user.id),
                    supabase.from('profiles').select('*').eq('id', user.id).single(),
                    supabase.from('courses').select('*, study_sessions(duration, start_time)').eq('user_id', user.id),
                    supabase.from('assignments').select('*, courses(name)').eq('user_id', user.id)
                ])

                const sessions = sessionsRes.data || []
                const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration / 60), 0) || 0
                const totalHours = totalMinutes / 60
                const friendCount = friendsRes.count || 0
                const challengeCount = challengesRes.count || 0
                const profile = profileRes.data
                const courses = coursesRes.data || []
                const assignments = assignmentsRes.data || []

                // ─── Streak Calculation ───
                let currentStreak = 0
                if (sessions.length > 0) {
                    const days = [...new Set(sessions.map(s => new Date(s.start_time).toDateString()))]
                    let checkDate = new Date()
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

                // ─── Habit Checks ───
                const hasNightOwl = sessions.some(s => {
                    const hour = new Date(s.start_time).getHours()
                    return hour >= 0 && hour <= 4
                })
                const hasEarlyBird = sessions.some(s => {
                    const hour = new Date(s.start_time).getHours()
                    return hour >= 5 && hour <= 8
                })
                const hasMarathon = sessions.some(s => (s.duration / 3600) >= 3)

                // Diverse study: max unique courses studied in a single day
                const dayCoursesMap: Record<string, Set<string>> = {}
                sessions.forEach(s => {
                    if (!s.course_id) return
                    const day = new Date(s.start_time).toDateString()
                    if (!dayCoursesMap[day]) dayCoursesMap[day] = new Set()
                    dayCoursesMap[day].add(s.course_id)
                })
                const maxDiverseStudy = Math.max(0, ...Object.values(dayCoursesMap).map(s => s.size))

                // Weekend warrior: any session on Saturday or Sunday
                const hasWeekendSession = sessions.some(s => {
                    const day = new Date(s.start_time).getDay()
                    return day === 0 || day === 6 // Sunday = 0, Saturday = 6
                })

                // Uninterrupted: a session >= 25 minutes (full pomodoro without pause)
                const hasUninterrupted = sessions.some(s => s.duration >= 1500) // 25 min

                // Return user: gap of >= 7 days between sessions
                let hasReturnGap = false
                if (sessions.length >= 2) {
                    for (let i = 0; i < sessions.length - 1; i++) {
                        const curr = new Date(sessions[i].start_time).getTime()
                        const next = new Date(sessions[i + 1].start_time).getTime()
                        if ((curr - next) >= 7 * 24 * 60 * 60 * 1000) {
                            hasReturnGap = true
                            break
                        }
                    }
                }

                // Pomodoro count: count sessions with typical pomodoro duration (25 min)
                const pomodoroSessions = sessions.filter(s => s.duration >= 1200 && s.duration <= 2100).length

                // ─── Academic Checks ───
                const completedExams = assignments.filter(a => a.is_completed && a.type === 'exam')
                const hasHighGrade = completedExams.some(a => a.grade && a.grade >= 85)
                const hasBarelyPass = completedExams.some(a => a.grade && a.grade >= 50 && a.grade <= 55)

                // No fail: all completed assignments passed (grade >= 50 or is_completed)
                const allPassed = completedExams.length > 0 && completedExams.every(a => !a.grade || a.grade >= 50)

                // Last minute: study session within 24h before exam, with >= 5 hours study
                let hasLastMinute = false
                const exams = assignments.filter(a => a.type === 'exam' && a.due_date)
                for (const exam of exams) {
                    const examTime = new Date(exam.due_date).getTime()
                    const dayBefore = examTime - 24 * 60 * 60 * 1000
                    const lastMinuteSessions = sessions.filter(s => {
                        const t = new Date(s.start_time).getTime()
                        return t >= dayBefore && t <= examTime && s.course_id === exam.course_id
                    })
                    const totalLastMinuteHours = lastMinuteSessions.reduce((sum, s) => sum + s.duration / 3600, 0)
                    if (totalLastMinuteHours >= 5) {
                        hasLastMinute = true
                        break
                    }
                }

                // Planned study: study session >= 14 days before an exam for that course
                let hasPlannedStudy = false
                for (const exam of exams) {
                    const examTime = new Date(exam.due_date).getTime()
                    const twoWeeksBefore = examTime - 14 * 24 * 60 * 60 * 1000
                    const earlySession = sessions.some(s => {
                        const t = new Date(s.start_time).getTime()
                        return t <= twoWeeksBefore && s.course_id === exam.course_id
                    })
                    if (earlySession) {
                        hasPlannedStudy = true
                        break
                    }
                }

                // Exam week streak: study every day for 7 days around an exam
                // Simplified: check if there's any 7-day streak (already calculated)
                const hasExamWeekStreak = currentStreak >= 7

                // Final marathon: 40+ hours in a single week
                let hasFinalMarathon = false
                const weekMap: Record<string, number> = {}
                sessions.forEach(s => {
                    const d = new Date(s.start_time)
                    const weekStart = new Date(d)
                    weekStart.setDate(d.getDate() - d.getDay())
                    const key = weekStart.toISOString().split('T')[0]
                    weekMap[key] = (weekMap[key] || 0) + (s.duration / 3600)
                })
                hasFinalMarathon = Object.values(weekMap).some(h => h >= 40)

                // Attendance survival: any course where absences > 0 but still have sessions
                const hasAttendanceSurvival = courses.some(c =>
                    (c.absences || 0) > 0 && (c.attendance_limit || 14) > 0 &&
                    (c.absences || 0) >= Math.floor((c.attendance_limit || 14) * 0.7)
                )

                // Grades logged: count of assignments/exams with a registered grade
                const scoredAssignments = assignments.filter(a => a.grade != null && a.grade > 0).length

                // Focus master: 10 uninterrupted pomodoros
                const focusMasterSessions = sessions.filter(s => s.duration >= 1500).length

                // ─── Badge Evaluation ───
                const badgesToAward: string[] = []

                for (const badge of badges) {
                    if (earnedBadgeIds.includes(badge.id)) continue

                    let shouldAward = false
                    switch (badge.criteria_type) {
                        // Onboarding
                        case 'first_course':
                            shouldAward = courses.length >= 1
                            break
                        case 'profile_complete':
                            shouldAward = !!(profile?.display_name && profile?.university)
                            break
                        case 'gpa_calc':
                            shouldAward = (profile?.gpa || 0) > 0
                            break
                        case 'absenteeism_update':
                            shouldAward = courses.some(c => (c.absences || 0) > 0)
                            break
                        case 'syllabus_add':
                            shouldAward = courses.some(c => Array.isArray(c.syllabus) && c.syllabus.length > 0)
                            break
                        case 'set_goal':
                            // Hedef belirleme: profile'da goal alanı veya en az 1 sınav eklenmişse
                            shouldAward = assignments.some(a => a.type === 'exam')
                            break
                        case 'first_session':
                            shouldAward = sessions.length >= 1
                            break
                        case 'grades_logged':
                            // En az 3 sinav/odev notu kaydedilmis olsun
                            shouldAward = scoredAssignments >= badge.criteria_value
                            break

                        // Streak & Duration
                        case 'streak':
                            shouldAward = currentStreak >= badge.criteria_value
                            break
                        case 'study_hours':
                            shouldAward = totalHours >= badge.criteria_value
                            break
                        case 'marathon':
                            shouldAward = hasMarathon
                            break
                        case 'weekly_marathon':
                            // Bir haftada 20 veya daha fazla saat
                            shouldAward = hasFinalMarathon || Object.values(weekMap).some(h => h >= badge.criteria_value)
                            break
                        case 'weekend_warrior':
                            shouldAward = hasWeekendSession
                            break

                        // Habits
                        case 'night_owl':
                            shouldAward = hasNightOwl
                            break
                        case 'early_bird':
                            shouldAward = hasEarlyBird
                            break
                        case 'diverse_study':
                            shouldAward = maxDiverseStudy >= badge.criteria_value
                            break
                        case 'pomodoro_count':
                            shouldAward = pomodoroSessions >= badge.criteria_value
                            break
                        case 'uninterrupted':
                            shouldAward = hasUninterrupted
                            break
                        case 'focus_master':
                            shouldAward = focusMasterSessions >= badge.criteria_value
                            break
                        case 'last_minute':
                            shouldAward = hasLastMinute
                            break
                        case 'planned_study':
                            shouldAward = hasPlannedStudy
                            break
                        case 'return_user':
                            shouldAward = hasReturnGap
                            break

                        // Academic
                        case 'high_grade':
                            shouldAward = hasHighGrade
                            break
                        case 'no_fail':
                            shouldAward = allPassed
                            break
                        case 'barely_pass':
                            shouldAward = hasBarelyPass
                            break
                        case 'exam_week_streak':
                            shouldAward = hasExamWeekStreak
                            break
                        case 'final_marathon':
                            shouldAward = hasFinalMarathon
                            break
                        case 'attendance_survival':
                            shouldAward = hasAttendanceSurvival
                            break
                        case 'gpa_legend':
                            shouldAward = (profile?.gpa || 0) >= badge.criteria_value
                            break

                        // Social
                        case 'friends_count':
                            shouldAward = friendCount >= badge.criteria_value
                            break
                        case 'first_challenge':
                            shouldAward = challengeCount >= 1
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
                        queryClient.invalidateQueries({ queryKey: ['recent_badges'] })

                        // Award XP for each badge earned
                        await addXP(user.id, badgesToAward.length * XP_REWARDS.BADGE_EARNED)
                        queryClient.invalidateQueries({ queryKey: ['profile'] })

                        // Send browser notification for newly earned badges
                        const awardedBadges = badges.filter(b => badgesToAward.includes(b.id))
                        for (const badge of awardedBadges) {
                            sendLocalNotification(
                                `🏅 Yeni Rozet: ${badge.name}`,
                                badge.description,
                                { tag: `badge-${badge.id}` }
                            )
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking badges:', error)
            }
        }

        checkBadges()
    }, [user, queryClient])
}
