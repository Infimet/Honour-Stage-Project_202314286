// main application logic - foundation phase (phase 2)

document.addEventListener('DOMContentLoaded', function() {
    //initialise robot
    const canvas = document.getElementById('robotCanvas');
    robotInstance = new Robot(canvas);

    // resets button event listener
    document.getElementById('resetButton').addEventListener('click', function() {
        robotInstance.reset();
    });
});
