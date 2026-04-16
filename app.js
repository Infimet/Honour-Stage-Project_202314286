// main application logic - foundation phase (phase 2)

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
function runCode() {
    var code = javascript.javascriptGenerator.workspaceToCode(workspace);
    
    try {
        eval(code); 
        
        // win state
        if (window.robotInstance.checkWin()) {
            setTimeout(async () => {
                const blocksUsed = workspace.getAllBlocks(false).length;
                const optimal    = window.activeLevel?.optimal_block_count ?? blocksUsed;
                const stars      = calculateStars(blocksUsed, optimal);

                if (window.activeLevel && typeof saveProgress === 'function') {
                    await saveProgress(window.activeLevel.id, stars);
              }

                document.getElementById('winModal').classList.remove('hidden');
            }, 100);
        }
    } catch (e) {
        console.error("Execution Error:", e);
        alert('Error executing code: ' + e);
    }
}

function resetApp() {
    window.robotInstance.reset();
}

// next level logic
let currentLevel = 1;
let activeLevel = null;

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
        // no more levels in this category, go back to menu
        returnToLevelSelect();
    }
}


function resetApp() {
    window.robotInstance.reset();
}

function returnToLevelSelect() {
    document.getElementById('winModal').classList.add('hidden');
    document.getElementById('gameContainer').classList.add('hidden');
    document.getElementById('levelSelectScreen').classList.remove('hidden');

    const activeTab = document.querySelector('#lsTabs .ls-tab--active');
    if (activeTab) renderLevelSelect(activeTab.dataset.category);
}
