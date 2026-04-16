// level select screen logic - phase 4.1

const DIFFICULTY_LABELS = {
    1: 'Beginner',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Expert'
};

// builds a single card element from a level row
function buildLevelCard(level, index) {
    const card = document.createElement('div');
    card.className = 'ls-card';

    card.innerHTML = `
        <div class="ls-card-badge">${DIFFICULTY_LABELS[level.difficulty] ?? 'Level ' + level.difficulty}</div>
        <div class="ls-card-title">${level.title}</div>
        <div class="ls-card-desc">${level.description ?? ''}</div>
        <div class="ls-card-stars">
            <span class="ls-star">★</span>
            <span class="ls-star">★</span>
            <span class="ls-star">★</span>
        </div>
    `;

    card.addEventListener('click', () => launchLevel(level));

    return card;
}

// fetches levels and populates the grid
async function renderLevelSelect(category = 'basics') {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';

    const levels = await fetchLevelsByCategory(category);
    // make the level list available to app.js for next level navigation
    window.currentCategoryLevels = levels;
    
    if (levels.length === 0) {
        grid.innerHTML = '<div class="ls-empty">No levels found for this category yet.</div>';
        return;
    }

    levels.forEach((level, i) => {
        grid.appendChild(buildLevelCard(level, i));
    });
}

// hides level select and launches the chosen level
function launchLevel(level) {
    document.getElementById('levelSelectScreen').classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('hidden');

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