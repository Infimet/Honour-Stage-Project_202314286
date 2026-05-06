// level select screen logic - phase 4.1

const DIFFICULTY_LABELS = {
    1: 'Beginner',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Expert'
};

// builds a single card element from a level row
// isLocked: true if the previous level in the category hasn't been completed yet
function buildLevelCard(level, progress, isLocked) {
    const card = document.createElement('div');
    card.className = isLocked ? 'ls-card ls-card--locked' : 'ls-card';

    if (isLocked) {
        card.innerHTML = `
            <div class="ls-card-badge">${DIFFICULTY_LABELS[level.difficulty] ?? 'Level ' + level.difficulty}</div>
            <div class="ls-card-title">${level.title}</div>
            <div class="ls-card-desc ls-card-lock-msg">🔒 Complete the previous level to unlock this one.</div>
        `;
        return card;
    }

    card.innerHTML = `
        <div class="ls-card-badge">${DIFFICULTY_LABELS[level.difficulty] ?? 'Level ' + level.difficulty}</div>
        <div class="ls-card-title">${level.title}</div>
        <div class="ls-card-desc">${level.description ?? ''}</div>
        <div class="ls-card-stars">
            ${[1, 2, 3].map(n => `<span class="ls-star ${n <= (progress?.stars_earned ?? 0) ? 'ls-star--earned' : ''}">★</span>`).join('')}
        </div>
    `;

    card.addEventListener('click', () => launchLevel(level));

    return card;
}

// fetches levels and populates the grid
async function renderLevelSelect(category = 'basics') {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    grid.dataset.activeCategory = category;

    const [levels, progressRows] = await Promise.all([
        fetchLevelsByCategory(category),
        fetchMyProgress()
    ]);

    window.currentCategoryLevels = levels;

    if (levels.length === 0) {
        grid.innerHTML = '<div class="ls-empty">No levels found for this category yet.</div>';
        return;
    }

    const progressMap = progressRows.reduce((map, row) => {
        map[row.level_id] = row;
        return map;
    }, {});

    levels.forEach((level, i) => {
        // first level in the category is always unlocked.
        // every subsequent level requires the previous one to be completed.
        // completed levels remain accessible for star improvement (Duolingo model —
        // low-stakes learning environment, progress never downgraded).
        const previousCompleted = i === 0 || progressMap[levels[i - 1].id]?.completed === true;
        const isLocked = !previousCompleted;

        grid.appendChild(buildLevelCard(level, progressMap[level.id] ?? null, isLocked));
    });

    updateFooterStats(progressRows);
}

// updates the footer stat counters
function updateFooterStats(progressRows) {
    const completed  = progressRows.filter(r => r.completed).length;
    const totalStars = progressRows.reduce((sum, r) => sum + (r.stars_earned ?? 0), 0);

    document.getElementById('lsTotalStars').textContent  = totalStars;
    document.getElementById('lsCompletedCount').textContent = completed;
}

// hides level select and launches the chosen level
// runs a brief full-screen transition between the two screens
// builds anticipation and signals a clear context change (Mayer & Moreno 2003)
function launchLevel(level) {
    const transition   = document.getElementById('levelTransition');
    const titleEl      = document.getElementById('transitionTitle');
    const levelSelect  = document.getElementById('levelSelectScreen');
    const gameContainer = document.getElementById('gameContainer');

    // set the level title in the transition screen before showing it
    titleEl.textContent = level.title ?? '';

    // phase 1: fade in the transition overlay (0.25s)
    transition.classList.remove('hidden', 'leaving');
    transition.classList.add('entering');

    // phase 2: after overlay is fully visible, prepare the game screen behind it
    setTimeout(() => {
        transition.classList.remove('entering');

        levelSelect.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        // clear any blocks left over from a previous level session
        if (typeof workspace !== 'undefined' && workspace) workspace.clear();

        // blockly resize fix - container was hidden so workspace has zero dimensions
        if (typeof workspace !== 'undefined' && workspace) Blockly.svgResize(workspace);

        if (typeof updateToolboxForCategory === 'function') updateToolboxForCategory(level.category);
        if (typeof updateObjectiveBanner    === 'function') updateObjectiveBanner(level);

        window.robotInstance.loadLevelFromDb(level);
        window.activeLevel = level;

    }, 300);

    // phase 3: hold for child to read the level title, then fade out (total ~1.2s)
    setTimeout(() => {
        transition.classList.add('leaving');

        transition.addEventListener('animationend', () => {
            transition.classList.add('hidden');
            transition.classList.remove('leaving');
        }, { once: true });

    }, 900);
}

// wire up category tab buttons
function initTabs() {
    const tabs = document.querySelectorAll('#lsTabs .ls-tab:not([disabled])');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#lsTabs .ls-tab').forEach(t => t.classList.remove('ls-tab--active'));
            tab.classList.add('ls-tab--active');
            renderLevelSelect(tab.dataset.category);
        });
    });
}

// checks which categories the student has unlocked and enables/disables tabs accordingly
// called on load and whenever returning to the level select screen
async function refreshCategoryTabs() {
    const unlocked = await fetchCategoryUnlockStatus();

    const tabMap = {
        loops:        document.querySelector('[data-category="loops"]'),
        obstacles:    document.querySelector('[data-category="obstacles"]'),
        conditionals: document.querySelector('[data-category="conditionals"]')
    };

    Object.entries(unlocked).forEach(([category, isUnlocked]) => {
        const tab = tabMap[category];
        if (!tab) return;

        if (isUnlocked) {
            tab.disabled = false;
            tab.classList.remove('ls-tab--locked');

            // remove the padlock icon - it was part of the locked state markup
            const lockIcon = tab.querySelector('.ls-tab-lock');
            if (lockIcon) lockIcon.remove();

            // wire up click handler if not already done
            if (!tab.dataset.wired) {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('#lsTabs .ls-tab').forEach(t => t.classList.remove('ls-tab--active'));
                    tab.classList.add('ls-tab--active');
                    renderLevelSelect(tab.dataset.category);
                });
                tab.dataset.wired = 'true';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // check if user is a teacher - redirect to dashboard if so
    const user = await getCurrentUser();
    if (user) {
        const { data: profile } = await db.from('profiles')
            .select('role, class_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profile?.role === 'teacher') {
            window.location.href = 'teacher.html';
            return;
        }

        // show join class prompt if student has no class yet
        if (!profile?.class_id) {
            renderJoinClassPrompt();
        }
    }

    initTabs();
    renderLevelSelect('basics');
    refreshCategoryTabs();
    populateGreeting();
    populateCategoryProgress();
});

// shows a small join class banner at the top if student hasn't joined a class
function renderJoinClassPrompt() {
    const el = document.getElementById('joinClassBanner');
    if (!el) return;
    el.classList.remove('hidden');
}

async function joinClass() {
    const input = document.getElementById('classCodeInput');
    const code  = input?.value?.trim().toUpperCase();
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-character class code.');
        return;
    }

    const { data: cls } = await db.from('classes')
        .select('id')
        .eq('class_code', code)
        .maybeSingle();

    if (!cls) {
        alert('Class code not found. Check with your teacher.');
        return;
    }

    const user = await getCurrentUser();
    const { error } = await db.from('profiles')
        .update({ class_id: cls.id })
        .eq('id', user.id);

    if (error) {
        alert('Failed to join class: ' + error.message);
        return;
    }

    document.getElementById('joinClassBanner').classList.add('hidden');
}

// sets the personalised greeting based on time of day and student name
async function populateGreeting() {
    const name = await fetchDisplayName();
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning'
                    : hour < 18 ? 'Good afternoon'
                    : 'Good evening';

    const el = document.getElementById('lsGreeting');
    if (el && name) el.textContent = `${timeOfDay}, ${name}!`;
}

// fetches and displays per-category progress counts inside each tab
async function populateCategoryProgress() {
    const progress = await fetchCategoryProgress();

    Object.entries(progress).forEach(([category, { total, completed }]) => {
        const el = document.getElementById(`progress-${category}`);
        if (!el) return;
        el.textContent = `${completed}/${total}`;
        if (completed === total && total > 0) el.classList.add('ls-tab-progress--done');
    });
}

// sign out button
document.getElementById('signOutBtn').addEventListener('click', async () => {
    await signOut();
    window.location.href = 'login.html';
});