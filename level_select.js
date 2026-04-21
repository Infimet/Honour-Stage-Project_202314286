// level select screen logic - phase 4.1

const DIFFICULTY_LABELS = {
    1: 'Beginner',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Expert'
};

// builds a single card element from a level row
function buildLevelCard(level, progress, index) {
    const card = document.createElement('div');
    card.className = 'ls-card';

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
        grid.appendChild(buildLevelCard(level, progressMap[level.id] ?? null, i));
    });

    updateFooterStats(progressRows);
}

// updates the footer stat counters
function updateFooterStats(progressRows) {
    const completed = progressRows.filter(r => r.completed).length;
    const totalStars = progressRows.reduce((sum, r) => sum + (r.stars_earned ?? 0), 0);

    document.getElementById('lsTotalStars').textContent = totalStars;
    document.getElementById('lsCompletedCount').textContent = completed;
}

// hides level select and launches the chosen level
function launchLevel(level) {
    document.getElementById('levelSelectScreen').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');

    // populate the objective banner with this level's title and description
    document.getElementById('objectiveTitle').textContent = level.title ?? '';
    document.getElementById('objectiveDesc').textContent = level.description ?? '';

    window.robotInstance.loadLevelFromDb(level);
    window.activeLevel = level;
}

// wire up tab buttons
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

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    renderLevelSelect('basics');
});

// sign out button
document.getElementById('signOutBtn').addEventListener('click', async () => {
    await signOut();
    window.location.href = 'login.html';
});