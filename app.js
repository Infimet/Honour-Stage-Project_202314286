// main application logic - foundation phase (phase 2) + animation queue wiring (sprint 5)

// 1. define custom blocks
Blockly.Blocks['move_forward'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Move Forward");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Moves the robot one step forward");
    }
};

Blockly.Blocks['turn_right'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Turn Right ↻");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Turns the robot 90 degrees right");
    }
};

Blockly.Blocks['turn_left'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("Turn Left ↺");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Turns the robot 90 degrees left");
    }
};

// 2. define javascript generation for blocks
javascript.javascriptGenerator.forBlock['move_forward'] = function(block) {
    return 'window.robotInstance.moveForward();\n';
};

javascript.javascriptGenerator.forBlock['turn_right'] = function(block) {
    return 'window.robotInstance.turnRight();\n';
};

javascript.javascriptGenerator.forBlock['turn_left'] = function(block) {
    return 'window.robotInstance.turnLeft();\n';
};

// 3. initialise application
var workspace = null;

document.addEventListener('DOMContentLoaded', async function() {
    // bounce unauthenticated users back to the login page
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const canvas = document.getElementById('robotCanvas');
    window.robotInstance = new Robot(canvas);

    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        scrollbars: false
    });

    document.getElementById('runButton').addEventListener('click', runCode);
    document.getElementById('resetButton').addEventListener('click', resetApp);
    document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);
    document.getElementById('backToMenuBtn').addEventListener('click', returnToLevelSelect);
    document.getElementById('backButton').addEventListener('click', returnToLevelSelect);
});

// 4. execution logic
// runCode now sets a completion callback on the robot rather than using setTimeout
// the callback fires after the animation queue fully drains
function runCode() {
    const code = javascript.javascriptGenerator.workspaceToCode(workspace);

    // disable run button for the duration of the animation sequence
    const runBtn = document.getElementById('runButton');
    runBtn.disabled = true;

    const onComplete = async () => {
        runBtn.disabled = false;

        if (window.robotInstance.checkWin()) {
            const blocksUsed = workspace.getAllBlocks(false).length;
            const optimal = window.activeLevel?.optimal_block_count ?? blocksUsed;
            const stars = calculateStars(blocksUsed, optimal);

            if (window.activeLevel) await saveProgress(window.activeLevel.id, stars);
            showWinStars(stars);
            document.getElementById('winModal').classList.remove('hidden');
        }
    };

    // set callback before eval — rAF is async so it cannot fire before eval returns
    window.robotInstance.onQueueComplete = onComplete;

    try {
        eval(code);

        // edge case: empty workspace produces no commands, so queue never drains
        // fire the callback immediately in that case
        if (!window.robotInstance.isAnimating && window.robotInstance.commandQueue.length === 0) {
            window.robotInstance.onQueueComplete = null;
            onComplete();
        }
    } catch (e) {
        window.robotInstance.onQueueComplete = null;
        runBtn.disabled = false;
        console.error('Execution Error:', e);
        alert('Error executing code: ' + e);
    }
}

function resetApp() {
    window.robotInstance.reset();
}

// next level logic
let currentLevel = 1;

function nextLevel() {
    document.getElementById('winModal').classList.add('hidden');
    workspace.clear();

    // find the next level in the current category's fetched list
    const currentIndex = currentCategoryLevels.findIndex(l => l.id === window.activeLevel?.id);
    const next = currentCategoryLevels[currentIndex + 1];

    if (next) {
        window.robotInstance.loadLevelFromDb(next);
        window.activeLevel = next;
    } else {
        // no more levels in this category — return to menu
        returnToLevelSelect();
    }
}

function returnToLevelSelect() {
    document.getElementById('winModal').classList.add('hidden');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('levelSelectScreen').classList.remove('hidden');

    const activeTab = document.querySelector('#lsTabs .ls-tab--active');
    if (activeTab) renderLevelSelect(activeTab.dataset.category);
}

// renders star icons in the win modal with sequential pop-in animation
// 150ms gap between each star per UX research (Gelman 2014)
function showWinStars(stars) {
    const container = document.getElementById('winStars');

    // build all three stars first, unearned ones stay faded
    container.innerHTML = [1, 2, 3]
        .map(n => `<span class="win-star ${n <= stars ? 'win-star--earned' : ''}">★</span>`)
        .join('');

    // trigger pop-in animation sequentially with 150ms stagger
    const starEls = container.querySelectorAll('.win-star');
    starEls.forEach((el, i) => {
        setTimeout(() => {
            el.classList.add('win-star--animate');
        }, i * 150);
    });

    // fire confetti burst after the last star lands
    setTimeout(() => spawnConfetti(), stars * 150 + 100);
}

// spawns a brief confetti burst inside the modal
// pure js/css — no library needed for this scale (Gapsy Studio 2026)
function spawnConfetti() {
    const modal   = document.querySelector('.modal-content');
    const colours = ['#3DAA6E', '#4A90D9', '#F5A623', '#E53935', '#9B59B6'];
    const count   = 28;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        el.style.left             = Math.random() * 100 + '%';
        el.style.top              = Math.random() * 40 + '%';
        el.style.backgroundColor  = colours[Math.floor(Math.random() * colours.length)];
        el.style.animationDelay   = Math.random() * 0.3 + 's';
        el.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
        el.style.transform        = `rotate(${Math.random() * 360}deg)`;
        modal.appendChild(el);

        // clean up after animation completes
        el.addEventListener('animationend', () => el.remove());
    }
}