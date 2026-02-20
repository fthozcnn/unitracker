import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
    envFile.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function fetchBadges() {
    const { data, error } = await supabase.from('badges').select('*').order('created_at', { ascending: false })
    if (error) {
        console.error(error)
        return
    }

    console.log(`Current Badge Count in DB: ${data.length}`)
    const updatedTypes = ['focus_master', 'weekly_marathon', 'grades_logged', 'diverse_study']
    console.log("\nChecking updated badge types:")
    const foundBadges = data.filter(b => updatedTypes.includes(b.criteria_type))

    if (foundBadges.length > 0) {
        foundBadges.forEach(b => {
            console.log(`[FOUND] ${b.name} (Type: ${b.criteria_type}, Value: ${b.criteria_value})`)
        })
    } else {
        console.log("[ERROR] None of the updated badge types were found in the database. Update might have failed silently.")
    }

    const duplicateCheck = {}
    let hasDupes = false
    data.forEach(b => {
        const key = `${b.criteria_type}_${b.criteria_value}`
        if (duplicateCheck[key]) {
            console.log(`[DUPLICATE] ${b.name} (${key})`)
            hasDupes = true
        }
        duplicateCheck[key] = true
    })
    if (!hasDupes) console.log("\nNo duplicates found in current DB.")

    // Check old broken badge types
    const brokenTypes = ['share_stats', 'library_study', 'weights_complete']
    const brokenBadges = data.filter(b => brokenTypes.includes(b.criteria_type))
    if (brokenBadges.length > 0) {
        console.log("\n[WARNING] Old broken badge types still exist in DB:")
        brokenBadges.forEach(b => console.log(`- ${b.name} (${b.criteria_type})`))
    }
}

fetchBadges()
