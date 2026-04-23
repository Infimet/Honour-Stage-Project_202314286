// main application logic (phase 2 + sprint 5 animation + sprint 6 blocks + walls)

// --- toolbox definitions per category ---
// progressive disclosure: each category reveals only the blocks students need
// (Sweller 1988 - cognitive load theory: don't show complexity before it's relevant)

const TOOLBOX_BASICS = `<xml>
    <category name="Movement" colour="210">
        <block type="move_forward"></block>
        <block type="turn_right"></block>
        <block type="turn_left"></block>
    </category>
</xml>`;

const TOOLBOX_LOOPS = `<xml>
    <category name="Movement" colour="210">
        <block type="move_forward"></block>
        <block type="move_backward"></block>
        <block type="turn_right"></block>
        <block type="turn_left"></block>
    </category>
    <category name="Loops" colour="120">
        <block type="controls_repeat_ext">
            <value name="TIMES">
                <shadow type="math_number">
                    <field name="NUM">3</field>
                </shadow>
            </value>
        </block>
    </category>
</xml>`;

// obstacles uses same blocks as loops - conditionals not yet introduced
const TOOLBOX_OBSTACLES = TOOLBOX_LOOPS;

const TOOLBOX_CONDITIONALS = `<xml>
    <category name="Movement" colour="210">
        <block type="move_forward"></block>
        <block type="move_backward"></block>
        <block type="turn_right"></block>
        <block type="turn_left"></block>
    </category>
    <category name="Loops" colour="120">
        <block type="controls_repeat_ext">
            <value name="TIMES">
                <shadow type="math_number">
                    <field name="NUM">3</field>
                </shadow>
            </value>
        </block>
    </category>
    <category name="Sensors" colour="65">
        <block type="if_path_clear"></block>
    </category>
</xml>`;

const CATEGORY_TOOLBOXES = {
    basics:       TOOLBOX_BASICS,
    loops:        TOOLBOX_LOOPS,
    obstacles:    TOOLBOX_OBSTACLES,
    conditionals: TOOLBOX_CONDITIONALS
};

// --- custom block definitions ---

Blockly.Blocks['move_forward'] = {
    init: function() {
        this.appendDummyInput().appendField("Move Forward");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Moves the robot one step forward");
    }
};

Blockly.Blocks['move_backward'] = {
    init: function() {
        this.appendDummyInput().appendField("Move Backward");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Moves the robot one step backward");
    }
};

Blockly.Blocks['turn_right'] = {
    init: function() {
        this.appendDummyInput().appendField("Turn Right ↻");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Turns the robot 90 degrees right");
    }
};

Blockly.Blocks['turn_left'] = {
    init: function() {
        this.appendDummyInput().appendField("Turn Left ↺");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(160);
        this.setTooltip("Turns the robot 90 degrees left");
    }
};

// if_path_clear - checks robotInstance.isPathClear() before executing contained blocks
// teaches conditional logic: programs can make decisions based on sensor input
Blockly.Blocks['if_path_clear'] = {
    init: function() {
        this.appendDummyInput()
            .appendField("🔍 If path is clear");
        this.appendStatementInput('DO')
            .setCheck(null)
            .appendField("do");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(65);
        this.setTooltip("Only runs the blocks inside if the path ahead is clear");
    }
};

// --- javascript code generators ---

javascript.javascriptGenerator.forBlock['move_forward'] = function(block) {
    return 'window.robotInstance.moveForward();\n';
};

javascript.javascriptGenerator.forBlock['move_backward'] = function(block) {
    return 'window.robotInstance.moveBackward();\n';
};

javascript.javascriptGenerator.forBlock['turn_right'] = function(block) {
    return 'window.robotInstance.turnRight();\n';
};

javascript.javascriptGenerator.forBlock['turn_left'] = function(block) {
    return 'window.robotInstance.turnLeft();\n';
};

javascript.javascriptGenerator.forBlock['if_path_clear'] = function(block) {
    const branch = javascript.javascriptGenerator.statementToCode(block, 'DO');
    return `if (window.robotInstance.isPathClear()) {\n${branch}}\n`;
};

// --- block execution tracking ---
// STATEMENT_PREFIX injects _trackBlock before every statement so we know
// which block ran last - used to show amber highlight on error
// (Gapsy Studio 2026: amber highlight guides without punishing)
let _lastBlockId = null;

function _trackBlock(id) {
    _lastBlockId = id;
}

// --- initialise application ---

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

    // inject with the static toolbox defined in index.html
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        scrollbars: false
    });

    // inject block tracking before every statement
    javascript.javascriptGenerator.STATEMENT_PREFIX = '_trackBlock(%1);\n';
    javascript.javascriptGenerator.addReservedWords('_trackBlock');

    document.getElementById('runButton').addEventListener('click', runCode);
    document.getElementById('resetButton').addEventListener('click', resetApp);
    document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);
    document.getElementById('retryBtn').addEventListener('click', retryLevel);
    document.getElementById('backToMenuBtn').addEventListener('click', returnToLevelSelect);
    document.getElementById('backButton').addEventListener('click', returnToLevelSelect);
});

// canvas flash + try-again toast - triggered on failure only, not every run
// reserving it for failure makes it a meaningful signal (Mayer & Moreno 2003)
// the slow fade to black then back is inspired by bowling alley pin resets:
// the lane goes dark, then the pins return fresh - children understand this
// as "clean slate, have another go" (Gapsy Studio 2026)
function flashAndReset(onDone) {
    const canvasWrapper = document.getElementById('robotCanvas').parentElement;
    canvasWrapper.style.position = 'relative';

    // flash overlay
    const flash = document.createElement('div');
    flash.className = 'canvas-flash';
    canvasWrapper.appendChild(flash);

    // toast message shown over the dark canvas
    const toast = document.createElement('div');
    toast.className = 'try-again-toast';
    toast.innerHTML = `
        <span class="try-again-toast-text">Let's try that again!</span>
    `;
    canvasWrapper.appendChild(toast);

    // reset the robot at the midpoint when the canvas is fully dark
    // so the student sees it return to start, not snap mid-fade
    setTimeout(() => {
        window.robotInstance.reset();
    }, 576); // 18% of 3200ms - peak opacity point

    // clean up both elements after the animation
    flash.addEventListener('animationend', () => {
        flash.remove();
        toast.remove();
        if (onDone) onDone();
    });
}

// --- execution logic ---
// runs code immediately with no flash - flash is reserved for failure only
// (Sweller 1988: reduce extraneous load - routine actions should be invisible)
function runCode() {
    const runBtn = document.getElementById('runButton');
    runBtn.disabled = true;

    hideErrorBanner();
    _lastBlockId = null;

    // reset silently before each run - student focuses on the code,
    // not on tracking where the robot ended up (Lightbot/Code.org standard)
    window.robotInstance.reset();

    const code = javascript.javascriptGenerator.workspaceToCode(workspace);

    const onComplete = async () => {
        runBtn.disabled = false;

        if (window.robotInstance.checkWin()) {
            // filter out shadow blocks (e.g. the grey number input inside repeat)
            // getAllBlocks counts them but they are not user-placed blocks
            const blocksUsed = workspace.getAllBlocks(false).filter(b => !b.isShadow()).length;
            const optimal    = window.activeLevel?.optimal_block_count ?? blocksUsed;
            const stars      = calculateStars(blocksUsed, optimal);

            if (window.activeLevel) await saveProgress(window.activeLevel.id, stars);
            showWinStars(stars);

            // blockly appends floating widget divs (number inputs, dropdowns)
            // directly to document.body with very high z-index - they escape the
            // modal overlay and render on top of it. hide them before showing modal.
            try { Blockly.WidgetDiv.hide(); } catch (e) {}
            try { Blockly.dropDownDiv.hide(); } catch (e) {}

            document.getElementById('winModal').classList.remove('hidden');
        } else {
            // pause so the student can see where the robot ended up before the reset
            // this is the moment of understanding - seeing the final position
            // is what tells them what went wrong (Hattie 2009: immediate feedback
            // must be legible, not just fast)
            setTimeout(() => {
                flashAndReset(() => {
                    showErrorBanner("Hmm, not quite! Check your blocks and try again. 🤔");
                });
            }, 1200);
        }
    };

    window.robotInstance.onQueueComplete = onComplete;

    try {
        eval(code);

        if (!window.robotInstance.isAnimating && window.robotInstance.commandQueue.length === 0) {
            window.robotInstance.onQueueComplete = null;
            onComplete();
        }
    } catch (e) {
        window.robotInstance.onQueueComplete = null;
        runBtn.disabled = false;
        console.error('execution error:', e);
        if (_lastBlockId) workspace.highlightBlock(_lastBlockId);
        showErrorBanner('Something went wrong. Try resetting and building again.');
    }
}

// shows a non-punitive inline error banner beneath the objective banner
// replaces the browser alert() - avoids harsh fail signals (Gapsy Studio 2026)
function showErrorBanner(message) {
    let banner = document.getElementById('errorBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'errorBanner';
        banner.className = 'error-banner';
        const objective = document.getElementById('objectiveBanner');
        objective.insertAdjacentElement('afterend', banner);
    }
    banner.textContent = message;
    banner.classList.remove('hidden');
}

function hideErrorBanner() {
    const banner = document.getElementById('errorBanner');
    if (banner) banner.classList.add('hidden');
    // clear amber block highlight alongside the banner
    if (workspace) workspace.highlightBlock(null);
    _lastBlockId = null;
}

function resetApp() {
    hideErrorBanner();
    window.robotInstance.reset();
}

// closes the win modal and resets the robot so the student can iterate on their solution
// blocks are intentionally preserved - if a child got 2 stars they need to see
// what they coded in order to think about how to improve it (Gapsy Studio 2026)
function retryLevel() {
    document.getElementById('winModal').classList.add('hidden');
    hideErrorBanner();
    window.robotInstance.reset();
}

// --- level navigation ---

let currentLevel = 1;

function nextLevel() {
    document.getElementById('winModal').classList.add('hidden');
    workspace.clear();
    hideErrorBanner();

    const currentIndex = currentCategoryLevels.findIndex(l => l.id === window.activeLevel?.id);
    const next = currentCategoryLevels[currentIndex + 1];

    if (next) {
        window.robotInstance.loadLevelFromDb(next);
        window.activeLevel = next;
        updateObjectiveBanner(next);
        updateToolboxForCategory(next.category);
    } else {
        returnToLevelSelect();
    }
}

function returnToLevelSelect() {
    document.getElementById('winModal').classList.add('hidden');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('levelSelectScreen').classList.remove('hidden');

    const activeTab = document.querySelector('#lsTabs .ls-tab--active');
    if (activeTab) renderLevelSelect(activeTab.dataset.category);

    // re-check category unlocks in case the student just completed a category
    if (typeof refreshCategoryTabs === 'function') refreshCategoryTabs();
}

// updates the in-game objective banner text
function updateObjectiveBanner(level) {
    document.getElementById('objectiveTitle').textContent = level.title ?? '';
    document.getElementById('objectiveDesc').textContent  = level.description ?? '';
}

// dynamic toolbox switching deferred - all categories visible from the static toolbox in index.html
// the level descriptions guide students to the right blocks for each category
function updateToolboxForCategory(category) {
    // no-op for now
}

// --- win modal ---

// renders star icons with sequential pop-in animation
// 150ms gap between stars (Gelman 2014: each star should feel like a distinct achievement)
function showWinStars(stars) {
    const container = document.getElementById('winStars');
    container.innerHTML = [1, 2, 3]
        .map(n => `<span class="win-star ${n <= stars ? 'win-star--earned' : ''}">★</span>`)
        .join('');

    const starEls = container.querySelectorAll('.win-star');
    starEls.forEach((el, i) => {
        setTimeout(() => el.classList.add('win-star--animate'), i * 150);
    });

    setTimeout(() => spawnConfetti(), stars * 150 + 100);
}

// brief confetti burst inside the modal - pure js/css, no library needed
// multimodal reward signal (Gapsy Studio 2026; Khan Academy Kids session data)
function spawnConfetti() {
    const modal   = document.querySelector('.modal-content');
    const colours = ['#3DAA6E', '#4A90D9', '#F5A623', '#E53935', '#9B59B6'];
    const count   = 28;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-particle';
        el.style.left              = Math.random() * 100 + '%';
        el.style.top               = Math.random() * 40  + '%';
        el.style.backgroundColor   = colours[Math.floor(Math.random() * colours.length)];
        el.style.animationDelay    = Math.random() * 0.3 + 's';
        el.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
        el.style.transform         = `rotate(${Math.random() * 360}deg)`;
        modal.appendChild(el);

        el.addEventListener('animationend', () => el.remove());
    }
}