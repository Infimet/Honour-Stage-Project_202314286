// robot state & canvas management (sprint 3)

class Robot {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }

loadLevel(levelNumber) {
    this.currentLevel = levelNumber;
    this.reset();
}

  reset() {
    this.x = this.canvas.width / 2;
    this.y = this.canvas.height / 2;
    this.angle = 270; 
    this.stepSize = 40;
    this.trail = [{x: this.x, y: this.y}];

    // LEVEL MANAGER: change target based on level
    if (this.currentLevel === 2) {
        // level 2: 3 steps Left, 2 steps Down
        this.target = { x: this.x - 120, y: this.y + 80 };
    } else {
        // level 1 (Default): 2 steps Right, 3 steps Up
        this.target = { x: this.x + 80, y: this.y - 120 };
    }

    this.draw();
}

    draw() {
        // clears canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // draw order matters: back to front
        this.drawGrid();
        this.drawTarget(); // draws the goal
        this.drawTrail();
        this.drawRobot();
    }

    drawTarget() {
        this.ctx.fillStyle = '#4CAF50'; // green goal
        this.ctx.strokeStyle = '#388E3C';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(this.target.x, this.target.y, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawGrid() {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawTrail() {
        if (this.trail.length < 2) return;
        
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.trail[0].x, this.trail[0].y);
        
        for (let i = 1; i < this.trail.length; i++) {
            this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        
        this.ctx.stroke();
    }

    drawRobot() {
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.rotate((this.angle * Math.PI) / 180);
        
        this.ctx.fillStyle = '#FF5722';
        this.ctx.strokeStyle = '#D84315';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(15, 0);
        this.ctx.lineTo(-10, -10);
        this.ctx.lineTo(-10, 10);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(8, 0, 3, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    moveForward() {
        const radians = (this.angle * Math.PI) / 180;
        const newX = this.x + this.stepSize * Math.cos(radians);
        const newY = this.y + this.stepSize * Math.sin(radians);
        
        if (newX >= 20 && newX <= this.canvas.width - 20 && 
            newY >= 20 && newY <= this.canvas.height - 20) {
            this.x = newX;
            this.y = newY;
            this.trail.push({x: this.x, y: this.y});
            this.draw();
        }
    }

    moveBackward() {
        const radians = (this.angle * Math.PI) / 180;
        const newX = this.x - this.stepSize * Math.cos(radians);
        const newY = this.y - this.stepSize * Math.sin(radians);
        
        if (newX >= 20 && newX <= this.canvas.width - 20 && 
            newY >= 20 && newY <= this.canvas.height - 20) {
            this.x = newX;
            this.y = newY;
            this.trail.push({x: this.x, y: this.y});
            this.draw();
        }
    }

    turnLeft() {
        this.angle -= 90;
        if (this.angle < 0) this.angle += 360;
        this.draw();
    }

    turnRight() {
        this.angle += 90;
        if (this.angle >= 360) this.angle -= 360;
        this.draw();
    }

    // 27/03/26: check if the robot is on the target
    checkWin() {
        // calculate the exact distance between robot and target
        const distance = Math.sqrt(Math.pow(this.x - this.target.x, 2) + Math.pow(this.y - this.target.y, 2));
        
        console.log(`Robot is at X:${this.x.toFixed(1)}, Y:${this.y.toFixed(1)}`);
        console.log(`Target is at X:${this.target.x}, Y:${this.target.y}`);
        console.log(`Distance to target: ${distance.toFixed(2)}px`);
        
        // ff the robot is within 10 pixels of the center of the target, it's a win (a win is a win)
        return distance < 10; 
    }
}

// global functions for blockly to call
let robotInstance = null;

function moveForward() { if (robotInstance) robotInstance.moveForward(); }
function moveBackward() { if (robotInstance) robotInstance.moveBackward(); }
function turnLeft() { if (robotInstance) robotInstance.turnLeft(); }
function turnRight() { if (robotInstance) robotInstance.turnRight(); }