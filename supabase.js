const SUPABASE_URL     = 'https://idhvfxbkfljtwjfvpulu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHZmeGJrZmxqdHdqZnZwdWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjU0NjAsImV4cCI6MjA5MTY0MTQ2MH0._SEWNgZPwGKfBwHiGbT2kG8Uq4Jcbq-1uTS8DJC1IAI';

// the cdn script (loaded in index.html) exposes a global `supabase` object
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// fetches all levels for a given category, sorted by difficulty
async function fetchLevelsByCategory(category = 'basics') {
    const { data, error } = await db
        .from('levels')
        .select('*')
        .eq('category', category)
        .order('difficulty', { ascending: true });

    if (error) {
        console.error('could not fetch levels:', error.message);
        return [];
    }

    return data;
}

// calculates star rating based on block efficiency
function calculateStars(blocksUsed, optimalBlockCount) {
    if (blocksUsed <= optimalBlockCount)        return 3;
    if (blocksUsed <= optimalBlockCount * 1.5)  return 2;
    return 1;
}

// returns the currently logged in user, or null
async function getCurrentUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
}

async function signOut() {
    const { error } = await db.auth.signOut();
    if (error) console.error('sign out failed:', error.message);
}