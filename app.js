// main application logic - foundation phase (phase 2)

// 1. define custom blicks
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

document.addEventListener('DOMContentLoaded', function() {
    // initislise the robit
    const canvas = document.getElementById('robotCanvas');
    window.robotInstance = new Robot(canvas); // make global for blockly access

    // initialise Blockly workspace
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        scrollbars: false
    });

    // button event listeners
    document.getElementById('runButton').addEventListener('click', runCode);
    document.getElementById('resetButton').addEventListener('click', resetApp);
});

// 4. execution logic
function runCode() {
    // generate js code from blocks
    var code = javascript.javascriptGenerator.workspaceToCode(workspace);
    
    // wrap in async function to allow animation delays if needed later
    try {
        console.log("Executing Code:\n" + code);
        eval(code); // execute generated code
    } catch (e) {
        console.error(e);
        alert('Error executing code: ' + e);
    }
}

function resetApp() {
    window.robotInstance.reset();
}
