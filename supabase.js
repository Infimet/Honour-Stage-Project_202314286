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

    const previousStars = existing?.stars_earned ?? 0;
    const finalStars    = Math.max(previousStars, starsEarned);
    const starsDelta    = finalStars - previousStars; // only award new stars

    const { error } = await db
        .from('student_progress')
        .upsert(
            { student_id: user.id, level_id: levelId, completed: true, stars_earned: finalStars },
            { onConflict: 'student_id,level_id' }
        );

    if (error) {
        console.error('could not save progress:', error.message);
        return;
    }

    // update total_stars on profiles if stars improved
    // and update streak + last_active_date
    if (starsDelta > 0 || !existing) {
        await updateProfileOnCompletion(user.id, starsDelta);
    } else {
        // still update streak even if no new stars
        await updateStreak(user.id);
    }

    // check and award any badges earned by this completion, return new ones for toast
    const newBadges = await checkAndAwardBadges(user.id, levelId);
    return newBadges;
}

// updates total_stars and streak fields on the profiles table after level completion
async function updateProfileOnCompletion(userId, starsDelta) {
    const { data: profile } = await db
        .from('profiles')
        .select('total_stars, streak_current, streak_longest, last_active_date')
        .eq('id', userId)
        .maybeSingle();

    if (!profile) return;

    const today         = new Date().toISOString().split('T')[0];
    const lastActive    = profile.last_active_date;
    const yesterday     = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let streakCurrent = profile.streak_current ?? 0;

    if (lastActive === today) {
        // already active today - streak unchanged
    } else if (lastActive === yesterday) {
        // consecutive day - increment streak
        streakCurrent += 1;
    } else {
        // streak broken or first time
        streakCurrent = 1;
    }

    const streakLongest = Math.max(profile.streak_longest ?? 0, streakCurrent);

    await db.from('profiles').update({
        total_stars:      (profile.total_stars ?? 0) + starsDelta,
        streak_current:   streakCurrent,
        streak_longest:   streakLongest,
        last_active_date: today
    }).eq('id', userId);
}

// updates streak only (called when level replayed with no new stars)
async function updateStreak(userId) {
    const { data: profile } = await db
        .from('profiles')
        .select('streak_current, streak_longest, last_active_date')
        .eq('id', userId)
        .maybeSingle();

    if (!profile) return;

    const today      = new Date().toISOString().split('T')[0];
    const yesterday  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastActive = profile.last_active_date;

    if (lastActive === today) return; // already updated today

    let streakCurrent = profile.streak_current ?? 0;
    streakCurrent = lastActive === yesterday ? streakCurrent + 1 : 1;
    const streakLongest = Math.max(profile.streak_longest ?? 0, streakCurrent);

    await db.from('profiles').update({
        streak_current:   streakCurrent,
        streak_longest:   streakLongest,
        last_active_date: today
    }).eq('id', userId);
}

// checks which badges the student has earned and awards any new ones
// called after every level completion - uses upsert via unique constraint
// so running it multiple times is safe (no duplicate badges)
async function checkAndAwardBadges(userId, levelId) {
    try {
        // fetch everything we need in parallel
        const [
            { data: allProgress },
            { data: allLevels },
            { data: profile },
            { data: aideLog },
            { data: earnedBadges }
        ] = await Promise.all([
            db.from('student_progress').select('level_id, completed, stars_earned').eq('student_id', userId),
            db.from('levels').select('id, category'),
            db.from('profiles').select('streak_current').eq('id', userId).maybeSingle(),
            db.from('aide_interactions').select('level_id').eq('student_id', userId),
            db.from('student_badges').select('badge_key').eq('student_id', userId)
        ]);

        if (!allProgress || !allLevels) return;

        const completedIds  = new Set(allProgress.filter(p => p.completed).map(p => p.level_id));
        const alreadyEarned = new Set((earnedBadges || []).map(b => b.badge_key));
        const hintLevelIds  = new Set((aideLog || []).map(a => a.level_id));
        const toAward       = [];

        const award = key => { if (!alreadyEarned.has(key)) toAward.push(key); };

        // completion badges
        if (completedIds.size >= 1)           award('first_steps');
        if (completedIds.has(levelId))        award('speed_coder'); // first attempt handled separately

        // category completion badges
        const byCategory = {};
        allLevels.forEach(l => {
            if (!byCategory[l.category]) byCategory[l.category] = { total: 0, done: 0 };
            byCategory[l.category].total++;
            if (completedIds.has(l.id)) byCategory[l.category].done++;
        });

        if (byCategory.basics?.done       === byCategory.basics?.total)       award('movement_master');
        if (byCategory.loops?.done        === byCategory.loops?.total)         award('loop_legend');
        if (byCategory.obstacles?.done    === byCategory.obstacles?.total)     award('obstacle_overcomer');
        if (byCategory.conditionals?.done === byCategory.conditionals?.total)  award('conditional_commander');

        // curriculum complete
        const totalLevels   = allLevels.length;
        const totalComplete = completedIds.size;
        if (totalComplete >= totalLevels && totalLevels > 0) award('curriculum_complete');

        // perfect run: 3 stars on current level with no hints used on that level
        const thisProgress = allProgress.find(p => p.level_id === levelId);
        if (thisProgress?.stars_earned === 3 && !hintLevelIds.has(levelId)) {
            award('perfect_run');
        }

        // no hints needed: full category with no hints on any level in it
        const currentLevel = allLevels.find(l => l.id === levelId);
        if (currentLevel) {
            const catLevels = allLevels.filter(l => l.category === currentLevel.category).map(l => l.id);
            const allCatComplete  = catLevels.every(id => completedIds.has(id));
            const noHintsInCat    = catLevels.every(id => !hintLevelIds.has(id));
            if (allCatComplete && noHintsInCat) award('no_hints_needed');
        }

        // streak badges
        const streak = profile?.streak_current ?? 0;
        if (streak >= 3)  award('streak_3');
        if (streak >= 7)  award('streak_7');
        if (streak >= 30) award('streak_30');

        // insert all new badges
        if (toAward.length > 0) {
            await db.from('student_badges').insert(
                toAward.map(key => ({ student_id: userId, badge_key: key }))
            );
        }

        return toAward; // return newly awarded keys so the caller can show notifications
    } catch (e) {
        // badge failures should never break the level completion flow
        console.error('badge check failed:', e.message);
        return [];
    }
}

// logs an AIDE hint interaction to the aide_interactions table
// used by the teacher dashboard to show where students needed help
async function recordAideInteraction(levelId, hintText, blocksUsed, optimal) {
    const user = await getCurrentUser();
    if (!user) return;

    await db.from('aide_interactions').insert({
        student_id:  user.id,
        level_id:    levelId,
        hint_text:   hintText,
        blocks_used: blocksUsed,
        optimal
    });
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

// fetches class leaderboard for the student's current class
// returns { rows: [{id, display_name, total_stars}], myId }
// empty rows if the student hasn't joined a class yet
async function fetchClassLeaderboard() {
    const user = await getCurrentUser();
    if (!user) return { rows: [], myId: null };

    const { data: profile } = await db.from('profiles')
        .select('class_id')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile?.class_id) return { rows: [], myId: user.id };

    const { data: rows } = await db.from('profiles')
        .select('id, display_name, total_stars')
        .eq('class_id', profile.class_id)
        .eq('role', 'student')
        .order('total_stars', { ascending: false });

    return { rows: rows ?? [], myId: user.id };
}

// fetches all earned badges for the current student, joined with badge definitions
async function fetchMyEarnedBadges() {
    const user = await getCurrentUser();
    if (!user) return [];

    const [{ data: earned }, { data: defs }] = await Promise.all([
        db.from('student_badges').select('badge_key, earned_at').eq('student_id', user.id),
        db.from('badges').select('key, title, icon')
    ]);

    if (!earned || !defs) return [];

    const defMap = Object.fromEntries(defs.map(d => [d.key, d]));
    return earned
        .map(e => ({ ...defMap[e.badge_key], earned_at: e.earned_at }))
        .filter(b => b.key); // filter out any orphaned rows
}