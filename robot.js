// robot state & canvas management (sprint 3 + animation queue sprint 5 + walls sprint 6)

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

        // wall data - array of {x, y} pixel positions of blocked grid squares
        this.walls = [];

        this.reset();
    }

    loadLevel(levelNumber) {
        this.currentLevel = levelNumber;
        this.reset();
    }

    loadLevelFromDb(levelData) {
        this.activeLevel = levelData;
        this.currentLevel = levelData.id;
        this.walls = levelData.walls || [];
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

        // level manager: set target from db data or fallback defaults
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw order: grid -> walls -> target -> trail -> robot (back to front)
        this.drawGrid();
        this.drawWalls();
        this.drawTarget();
        this.drawTrail();
        this.drawRobot();
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

    // walls rendered as dark filled squares - visually distinct from the grid
    drawWalls() {
        if (!this.walls || this.walls.length === 0) return;

        const half = this.stepSize / 2;
        const inset = 2;

        this.walls.forEach(wall => {
            this.ctx.fillStyle = '#4A5568';
            this.ctx.beginPath();
            this.ctx.roundRect(
                wall.x - half + inset,
                wall.y - half + inset,
                this.stepSize - inset * 2,
                this.stepSize - inset * 2,
                4
            );
            this.ctx.fill();

            // subtle highlight on top edge
            this.ctx.fillStyle = 'rgba(255,255,255,0.12)';
            this.ctx.beginPath();
            this.ctx.roundRect(
                wall.x - half + inset,
                wall.y - half + inset,
                this.stepSize - inset * 2,
                8,
                [4, 4, 0, 0]
            );
            this.ctx.fill();
        });
    }

    drawTarget() {
        this.ctx.fillStyle = '#3DAA6E';
        this.ctx.strokeStyle = '#2e8a57';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.arc(this.target.x, this.target.y, 15, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();

        // small white centre dot - makes the target easier to spot
        this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        this.ctx.beginPath();
        this.ctx.arc(this.target.x, this.target.y, 4, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawTrail() {
        if (this.trail.length < 2) return;

        this.ctx.strokeStyle = '#4A90D9';
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
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.angle * Math.PI) / 180);

        // Robot faces RIGHT at angle 0 — visor on right, antenna on left.
        // The canvas rotation handles all other directions automatically.
        const s = 13; // half-size of body

        // ── body ─────────────────────────────────────────────────
        ctx.fillStyle = '#ECEEF4';
        ctx.strokeStyle = '#CDD0E3';
        ctx.lineWidth = 1.5;
        this._rrect(-s, -s, s * 2, s * 2, 6);
        ctx.fill();
        ctx.stroke();

        // lower body slightly darker — single tone like the SVG
        ctx.fillStyle = '#DEE0EF';
        this._rrect(-s, 3, s * 2, s - 3, [0, 0, 6, 6]);
        ctx.fill();

        // ── visor — amber band on front (right side) ─────────────
        ctx.fillStyle = '#F5A623';
        this._rrect(2, -s + 2, s - 3, (s - 2) * 2, [0, 5, 5, 0]);
        ctx.fill();

        // ── upper LED hole ────────────────────────────────────────
        ctx.fillStyle = '#1A1A2E';
        ctx.beginPath(); ctx.arc(8, -5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFD060';
        ctx.beginPath(); ctx.arc(8, -5, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(6.5, -6.5, 1, 0, Math.PI * 2); ctx.fill();

        // ── lower LED hole ────────────────────────────────────────
        ctx.fillStyle = '#1A1A2E';
        ctx.beginPath(); ctx.arc(8, 5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFD060';
        ctx.beginPath(); ctx.arc(8, 5, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(6.5, 3.5, 1, 0, Math.PI * 2); ctx.fill();

        // ── antenna ball on back ──────────────────────────────────
        ctx.fillStyle = '#3DAA6E';
        ctx.beginPath(); ctx.arc(-9, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5DC98A';
        ctx.beginPath(); ctx.arc(-10.5, -1.5, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    // Rounded rectangle path helper (r can be a number or [tl, tr, br, bl] array)
    _rrect(x, y, w, h, r) {
        const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
        this.ctx.beginPath();
        this.ctx.moveTo(x + tl, y);
        this.ctx.lineTo(x + w - tr, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.ctx.lineTo(x + w, y + h - br);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.ctx.lineTo(x + bl, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.ctx.lineTo(x, y + tl);
        this.ctx.quadraticCurveTo(x, y, x + tl, y);
        this.ctx.closePath();
    }

    moveForward() {
        const rad = (this._lAngle * Math.PI) / 180;
        const newX = this._lx + this.stepSize * Math.cos(rad);
        const newY = this._ly + this.stepSize * Math.sin(rad);

        const blocked = this._isBlocked(newX, newY);

        if (!blocked) {
            this._lx = newX;
            this._ly = newY;
            this._enqueue({ type: 'move', toX: newX, toY: newY });
        } else {
            this._enqueue({ type: 'wobble', rad });
        }
    }

    moveBackward() {
        const rad = (this._lAngle * Math.PI) / 180;
        const newX = this._lx - this.stepSize * Math.cos(rad);
        const newY = this._ly - this.stepSize * Math.sin(rad);

        const blocked = this._isBlocked(newX, newY);

        if (!blocked) {
            this._lx = newX;
            this._ly = newY;
            this._enqueue({ type: 'move', toX: newX, toY: newY });
        } else {
            this._enqueue({ type: 'wobble', rad: rad + Math.PI });
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

    // 180 degree turn - teaches composition (two turnRight calls under the hood)
    // the turn_around block generates two turnRight() calls so this animates as two turns
    turnAround() {
        this.turnRight();
        this.turnRight();
    }

    // returns true if the path directly ahead is clear
    // used by the if_path_clear blockly block
    // checks logical position so it respects already-queued moves
    isPathClear() {
        const rad = (this._lAngle * Math.PI) / 180;
        const nextX = this._lx + this.stepSize * Math.cos(rad);
        const nextY = this._ly + this.stepSize * Math.sin(rad);
        return !this._isBlocked(nextX, nextY);
    }

    // shared boundary + wall check
    _isBlocked(x, y) {
        if (x < 20 || x > this.canvas.width - 20 ||
            y < 20 || y > this.canvas.height - 20) {
            return true;
        }

        if (this.walls && this.walls.length > 0) {
            return this.walls.some(w =>
                Math.abs(w.x - x) < 5 && Math.abs(w.y - y) < 5
            );
        }

        return false;
    }

    checkWin() {
        const distance = Math.sqrt(
            Math.pow(this.x - this.target.x, 2) +
            Math.pow(this.y - this.target.y, 2)
        );

        console.log(`robot at X:${this.x.toFixed(1)}, Y:${this.y.toFixed(1)}`);
        console.log(`target at X:${this.target.x}, Y:${this.target.y}`);
        console.log(`distance: ${distance.toFixed(2)}px`);

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
        // 400ms per cell - within the 350-450ms UX research range (Gouws et al. 2013)
        // 200ms per turn - snappy but visible
        const MOVE_MS = 400;
        const TURN_MS = 200;

        if (command.type === 'wobble') {
            this._runWobble(command, onDone);
            return;
        }

        const duration  = command.type === 'move' ? MOVE_MS : TURN_MS;
        const startTime = performance.now();
        const fromX     = this.x;
        const fromY     = this.y;
        const fromAngle = this.angle;

        // sound fires at animation start - feels more immediate than firing on completion
        if (window.soundManager) {
            if (command.type === 'move') window.soundManager.step();
            else if (command.type === 'turn') window.soundManager.turn();
        }

        const step = (now) => {
            const t    = Math.min((now - startTime) / duration, 1);
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

    // gentle nudge in the attempted direction - non-punitive boundary/wall feedback
    // "mistakes should never feel like failure" (Gapsy Studio 2026)
    _runWobble(command, onDone) {
        const WOBBLE_MS   = 320;
        const WOBBLE_DIST = 10;
        const startTime   = performance.now();
        const fromX       = this.x;
        const fromY       = this.y;
        const nudgeX      = Math.cos(command.rad) * WOBBLE_DIST;
        const nudgeY      = Math.sin(command.rad) * WOBBLE_DIST;

        // non-punitive audio - gentle, not a harsh buzzer
        if (window.soundManager) window.soundManager.wallHit();

        const step = (now) => {
            const t = Math.min((now - startTime) / WOBBLE_MS, 1);
            const offset = Math.sin(t * Math.PI) * (1 - t * 0.5);

            this.x = fromX + nudgeX * offset;
            this.y = fromY + nudgeY * offset;
            this.draw();

            if (t < 1) {
                this._animFrame = requestAnimationFrame(step);
            } else {
                this.x = fromX;
                this.y = fromY;
                this.draw();
                onDone();
            }
        };

        this._animFrame = requestAnimationFrame(step);
    }

    _easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}

// global functions for blockly to call
let robotInstance = null;

function moveForward()  { if (robotInstance) robotInstance.moveForward();  }
function moveBackward() { if (robotInstance) robotInstance.moveBackward(); }
function turnLeft()     { if (robotInstance) robotInstance.turnLeft();     }
function turnRight()    { if (robotInstance) robotInstance.turnRight();    }