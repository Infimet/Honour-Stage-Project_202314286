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

// saves or updates a students progress for a level
// uses upsert so replaying a level updates the row instead of duplicating it
// never downgrades stars, just only keeps the best score
async function saveProgress(levelId, starsEarned) {
    const user = await getCurrentUser();
    if (!user) {
        console.warn('saveProgress: no user logged in, skipping.');
        return;
    }

    // check for an existing record first to protect star count
    const { data: existing } = await db
        .from('student_progress')
        .select('stars_earned')
        .eq('student_id', user.id)
        .eq('level_id', levelId)
        .maybeSingle();

    const finalStars = existing
        ? Math.max(existing.stars_earned ?? 0, starsEarned)
        : starsEarned;

    const { error } = await db
        .from('student_progress')
        .upsert(
            { student_id: user.id, level_id: levelId, completed: true, stars_earned: finalStars },
            { onConflict: 'student_id,level_id' }
        );

    if (error) console.error('could not save progress:', error.message);
}

// fetches all progress rows for the currently logged in student
// rls ensures only ever get back their own rows
async function fetchMyProgress() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await db
        .from('student_progress')
        .select('*')
        .eq('student_id', user.id);

    if (error) {
        console.error('could not fetch progress:', error.message);
        return [];
    }

    return data;
}