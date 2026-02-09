import { createClient } from '@supabase/supabase-js';
const VITE_SUPABASE_URL = 'https://czganctlxchjpxpzyjok.supabase.co';
const VITE_SUPABASE_ANON_KEY = 'sb_publishable_IC94zpsl2gez920YY9PfBQ_zLmMctHG';

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('badges').select('*');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Badge count:', data.length);
    if (data.length > 0) {
        console.log('Sample badge name:', data[0].name);
    }
}

check();
