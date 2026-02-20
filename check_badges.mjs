import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBadges() {
    const { data, error } = await supabase.from('badges').select('*').order('criteria_type', { ascending: true })

    if (error) {
        console.error('Error fetching badges:', error)
        return
    }

    console.log(`Found ${data.length} badges in the database:`)
    const counts = {}
    data.forEach(b => {
        const key = `${b.criteria_type}_${b.criteria_value}`
        counts[key] = (counts[key] || 0) + 1
        console.log(`- ${b.name} | ${b.criteria_type}:${b.criteria_value} | ID: ${b.id}`)
    })

    console.log('\nDuplicates:')
    Object.keys(counts).forEach(k => {
        if (counts[k] > 1) {
            console.log(k, counts[k], 'times')
        }
    })
}

checkBadges()
