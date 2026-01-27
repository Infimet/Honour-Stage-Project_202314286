// robot state & canvas management (phase 2)

class Robot {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }

    reset() {
        // starting position (centre of canvas)
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        // starting angle (0 = facing right, 90 = facing down, 180 = facing left, 270 = facing up)
        this.angle = 270; // start by  facing upwards
        this.stepSize = 40;
        this.trail = []; // store trail positions for visualisation
        this.trail.push({x: this.x, y: this.y});
        this.draw();
    }

    draw() {
        // clears canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // draws grid
        this.drawGrid();
        
        // draws the trail
        this.drawTrail();
        
        //robot
        this.drawRobot();
    }

    drawGrid() {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        // for vert lines
        for (let x = 0; x <= this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // horizontal lines
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
        
        // draws the robot's body (as a triangle)
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
        
        // draw robot 'eyes' / (essentially a front indicator indicating orientation)
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
        
        // checks boundaries
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
        
        // check boundaries
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
        if (this.angle < 0) {
            this.angle += 360;
        }
        this.draw();
    }

    turnRight() {
        this.angle += 90;
        if (this.angle >= 360) {
            this.angle -= 360;
        }
        this.draw();
    }
}


let robotInstance = null;

// global functions for blockly to call
function moveForward() {
    if (robotInstance) {
        robotInstance.moveForward();
    }
}

function moveBackward() {
    if (robotInstance) {
        robotInstance.moveBackward();
    }
}

function turnLeft() {
    if (robotInstance) {
        robotInstance.turnLeft();
    }
}

function turnRight() {
    if (robotInstance) {
        robotInstance.turnRight();
    }
}
