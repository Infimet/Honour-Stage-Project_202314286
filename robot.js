// robot state & canvas management (sprint 3 + animation queue sprint 5)

class Robot {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.activeLevel = null;

        // animation queue state
        this.commandQueue = [];
        this.isAnimating = false;
        this._animFrame = null;
        this.onQueueComplete = null;

        // logical state: tracks where robot WILL be after all queued commands
        // (separate from visual x/y/angle which lag behind during animation)
        this._lx = 0;
        this._ly = 0;
        this._lAngle = 0;

        this.reset();
    }

    loadLevel(levelNumber) {
        this.currentLevel = levelNumber;
        this.reset();
    }

    loadLevelFromDb(levelData) {
        this.activeLevel = levelData;
        this.currentLevel = levelData.id;
        this.reset();
    }

    reset() {
        // cancel any in-flight animation before clearing state
        if (this._animFrame) cancelAnimationFrame(this._animFrame);
        this.commandQueue = [];
        this.isAnimating = false;
        this.onQueueComplete = null;

        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        this.angle = 270;
        this.stepSize = 40;
        this.trail = [{ x: this.x, y: this.y }];

        // sync logical state to visual state on reset
        this._lx = this.x;
        this._ly = this.y;
        this._lAngle = this.angle;

        // level manager: change target based on level
        if (this.activeLevel) {
            this.target = { x: this.activeLevel.target_x, y: this.activeLevel.target_y };
        } else if (this.currentLevel === 2) {
            this.target = { x: this.x - 120, y: this.y + 80 };
        } else {
            this.target = { x: this.x + 80, y: this.y - 120 };
        }

        this.draw();
    }

    draw() {
        // clears canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw order matters: back to front
        this.drawGrid();
        this.drawTarget();
        this.drawTrail();
        this.drawRobot();
    }

    drawTarget() {
        this.ctx.fillStyle = '#4CAF50';
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

    // movement methods now write to logical state and enqueue commands
    // the visual state lags behind and is updated by the animation engine
    moveForward() {
        const rad = (this._lAngle * Math.PI) / 180;
        const newX = this._lx + this.stepSize * Math.cos(rad);
        const newY = this._ly + this.stepSize * Math.sin(rad);

        if (newX >= 20 && newX <= this.canvas.width - 20 &&
            newY >= 20 && newY <= this.canvas.height - 20) {
            this._lx = newX;
            this._ly = newY;
            this._enqueue({ type: 'move', toX: newX, toY: newY });
        }
    }

    moveBackward() {
        const rad = (this._lAngle * Math.PI) / 180;
        const newX = this._lx - this.stepSize * Math.cos(rad);
        const newY = this._ly - this.stepSize * Math.sin(rad);

        if (newX >= 20 && newX <= this.canvas.width - 20 &&
            newY >= 20 && newY <= this.canvas.height - 20) {
            this._lx = newX;
            this._ly = newY;
            this._enqueue({ type: 'move', toX: newX, toY: newY });
        }
    }

    turnLeft() {
        this._lAngle = (this._lAngle - 90 + 360) % 360;
        this._enqueue({ type: 'turn', toAngle: this._lAngle, delta: -90 });
    }

    turnRight() {
        this._lAngle = (this._lAngle + 90) % 360;
        this._enqueue({ type: 'turn', toAngle: this._lAngle, delta: 90 });
    }

    // 27/03/26: check if the robot is on the target
    // called after animation queue drains, so x/y are the final logical positions
    checkWin() {
        const distance = Math.sqrt(
            Math.pow(this.x - this.target.x, 2) +
            Math.pow(this.y - this.target.y, 2)
        );

        console.log(`robot at X:${this.x.toFixed(1)}, Y:${this.y.toFixed(1)}`);
        console.log(`target at X:${this.target.x}, Y:${this.target.y}`);
        console.log(`distance to target: ${distance.toFixed(2)}px`);

        return distance < 10;
    }

    // --- animation queue engine ---

    _enqueue(command) {
        this.commandQueue.push(command);
        if (!this.isAnimating) this._processQueue();
    }

    _processQueue() {
        if (this.commandQueue.length === 0) {
            this.isAnimating = false;
            if (this.onQueueComplete) {
                const cb = this.onQueueComplete;
                this.onQueueComplete = null;
                cb();
            }
            return;
        }

        this.isAnimating = true;
        const command = this.commandQueue.shift();
        this._runAnimation(command, () => this._processQueue());
    }

    _runAnimation(command, onDone) {
        // 400ms per cell is within the 350-450ms range from UX research
        // 200ms per turn keeps rotation snappy without being jarring
        const MOVE_MS = 400;
        const TURN_MS = 200;

        const duration = command.type === 'move' ? MOVE_MS : TURN_MS;
        const startTime = performance.now();
        const fromX = this.x;
        const fromY = this.y;
        const fromAngle = this.angle;

        const step = (now) => {
            const t = Math.min((now - startTime) / duration, 1);
            const ease = this._easeInOut(t);

            if (command.type === 'move') {
                this.x = fromX + (command.toX - fromX) * ease;
                this.y = fromY + (command.toY - fromY) * ease;
            } else {
                // interpolate using delta to avoid wrap-around issues at 0/360 boundary
                this.angle = fromAngle + command.delta * ease;
            }

            this.draw();

            if (t < 1) {
                this._animFrame = requestAnimationFrame(step);
            } else {
                // snap to exact values at end to avoid floating point drift
                if (command.type === 'move') {
                    this.x = command.toX;
                    this.y = command.toY;
                    this.trail.push({ x: this.x, y: this.y });
                } else {
                    this.angle = command.toAngle;
                }
                this.draw();
                onDone();
            }
        };

        this._animFrame = requestAnimationFrame(step);
    }

    _easeInOut(t) {
        // standard cubic ease-in-out
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}

// global functions for blockly to call
let robotInstance = null;

function moveForward()  { if (robotInstance) robotInstance.moveForward();  }
function moveBackward() { if (robotInstance) robotInstance.moveBackward(); }
function turnLeft()     { if (robotInstance) robotInstance.turnLeft();     }
function turnRight()    { if (robotInstance) robotInstance.turnRight();    }