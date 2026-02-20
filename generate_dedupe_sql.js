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

async function checkBadges() {
    const { data, error } = await supabase.from('badges').select('*').order('created_at', { ascending: true })

    if (error) {
        console.error(error)
        return
    }

    const counts = {}
    const toDelete = []

    data.forEach(b => {
        const key = `${b.criteria_type}_${b.criteria_value}`
        if (counts[key]) {
            // This is a duplicate (it was created after the first one)
            toDelete.push(b.id)
            console.log(`-- Duplicate found: [${b.name}] (type: ${b.criteria_type}, value: ${b.criteria_value}, id: ${b.id})`)
        } else {
            counts[key] = b.id
        }
    })

    if (toDelete.length > 0) {
        console.log(`\nDeleting ${toDelete.length} duplicates...`)
        const { error: deleteErr } = await supabase.from('badges').delete().in('id', toDelete)
        if (deleteErr) {
            console.error("Failed to delete duplicates:", deleteErr)
        } else {
            console.log("Successfully deleted duplicates!")
        }
    } else {
        console.log('-- No duplicates found.')
    }
}

checkBadges()
