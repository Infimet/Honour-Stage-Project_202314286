const SUPABASE_URL      = 'https://idhvfxbkfljtwjfvpulu.supabase.co';
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
    if (blocksUsed <= optimalBlockCount)        return 3; // perfect
    if (blocksUsed <= optimalBlockCount * 2)    return 2; // reasonable
    return 1;                                             // completed but very inefficient
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

// saves or updates a student's progress for a level
// upsert so replaying a level updates the row instead of duplicating it
// never downgrades stars - only keeps the best score (low-stakes learning environment)
async function saveProgress(levelId, starsEarned) {
    const user = await getCurrentUser();
    if (!user) {
        console.warn('saveProgress: no user logged in, skipping.');
        return;
    }

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
// rls ensures only ever getting back their own rows
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

// returns the student's display name from auth metadata
// already stored at signup - no separate profiles query needed
async function fetchDisplayName() {
    const user = await getCurrentUser();
    if (!user) return null;
    return user.user_metadata?.display_name
        ?? user.email?.split('@')[0]
        ?? 'there';
}

// returns level counts and completion counts per category
// used to show progress inside the category tabs
async function fetchCategoryProgress() {
    const user = await getCurrentUser();
    if (!user) return {};

    const [{ data: levels }, { data: progress }] = await Promise.all([
        db.from('levels').select('id, category'),
        db.from('student_progress')
            .select('level_id')
            .eq('student_id', user.id)
            .eq('completed', true)
    ]);

    if (!levels) return {};

    const completedIds = new Set((progress || []).map(p => p.level_id));
    const result = {};

    levels.forEach(l => {
        if (!result[l.category]) result[l.category] = { total: 0, completed: 0 };
        result[l.category].total++;
        if (completedIds.has(l.id)) result[l.category].completed++;
    });

    return result;
}
// returns { loops: bool, obstacles: bool, conditionals: bool }
// avoids hardcoding level IDs - derives unlock state from actual db counts
async function fetchCategoryUnlockStatus() {
    const user = await getCurrentUser();
    if (!user) return { loops: false, obstacles: false, conditionals: false };

    // fetch all level ids + categories, and all completed progress for this student
    const [{ data: levels }, { data: progress }] = await Promise.all([
        db.from('levels').select('id, category'),
        db.from('student_progress')
            .select('level_id')
            .eq('student_id', user.id)
            .eq('completed', true)
    ]);

    if (!levels) return { loops: false, obstacles: false, conditionals: false };

    const completedIds = new Set((progress || []).map(p => p.level_id));

    // count total and completed per category
    const counts     = {};
    const completed  = {};

    levels.forEach(l => {
        counts[l.category]    = (counts[l.category]    || 0) + 1;
        if (completedIds.has(l.id)) {
            completed[l.category] = (completed[l.category] || 0) + 1;
        }
    });

    const allDone = cat => (counts[cat] ?? 0) > 0 && completed[cat] === counts[cat];

    return {
        loops:        allDone('basics'),
        obstacles:    allDone('loops'),
        conditionals: allDone('obstacles')
    };
}