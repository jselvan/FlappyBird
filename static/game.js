class Progress {
    CUMULATIVE_SCORE_STEP = 100;
    RUN_SCORE_MILESTONES = [
        { score: 1, message: "Great job! You scored 1 point!" },
        { score: 100, message: "Awesome! You scored 100 points!" },
        { score: 200, message: "Incredible! You scored 200 points!" }
    ];
    constructor() {
        this.progressBar = document.getElementById('progress-bar');
        this.progressLabel = document.getElementById('progress-label');
        this.progressContainer = document.getElementById('progress-container');
        this.progressWrapper = document.getElementById('progress-wrapper');

        this.canvas = document.getElementById('game');
        this.setPosition();
        window.addEventListener('resize', () => this.setPosition());
        this.messageBox = document.getElementById('message-box');
    }
    setPosition() {
        if (!this.progressWrapper || !this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        this.progressWrapper.style.top = rect.top + 40 + 'px'; // 40px below top of canvas
        this.progressWrapper.style.left = rect.left + rect.width / 2 + 'px';
        this.progressWrapper.style.transform = 'translateX(-50%)';
    }
    hide() {
        if (this.progressWrapper) this.progressWrapper.style.display = 'none';
    }
    show() {
        if (this.progressWrapper) this.progressWrapper.style.display = 'flex';
    }
    progressParticle(onComplete) {
        if (!this.progressWrapper) return;
        const rect = this.progressWrapper.getBoundingClientRect();
        const x = rect.left + (Math.random() * rect.width); // random x along the bar
        const y = rect.top + rect.height / 2 + (Math.random() * 10 - 5);

        const p = document.createElement('div');
        p.style.position = 'absolute';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = '6px';
        p.style.height = '6px';
        p.style.pointerEvents = 'none';
        p.style.borderRadius = '50%';
        p.style.background = 'white';
        p.style.opacity = '1';
        p.style.transform = 'translate(-50%, -50%)';
        p.style.zIndex = '10000';

        document.body.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        p.animate(
            [
            { transform: 'translate(0,0)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }
            ],
            { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.1,.9,.2,1)' }
        ).onfinish = () => {
            p.remove();
            if (onComplete) onComplete();
        };
    }
    progressBurst() {
        if (!this.progressWrapper) return;
        const rect = this.progressWrapper.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        for (let i = 0; i < 14; i++) {
            const p = document.createElement('div');
            p.style.position = 'absolute';
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.width = '8px';
            p.style.height = '8px';
            p.style.pointerEvents = 'none';
            p.style.borderRadius = '50%';
            p.style.background = 'gold';
            p.style.opacity = '1';
            p.style.transform = 'translate(-50%, -50%)';
            p.style.zIndex = '10000';
            document.body.appendChild(p);

            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;

            p.animate(
            [
                { transform: 'translate(0,0)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 }
            ],
            { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.1,.9,.2,1)' }
            ).onfinish = () => p.remove();
        }
    }
    flash(onComplete) {
        if (!this.progressContainer) return;

        // Save original background
        const originalBg = this.progressContainer.style.background;

        // Flash the container background
        this.progressContainer.style.transition = 'background 0.3s';
        this.progressContainer.style.background = 'gold';

        setTimeout(() => {
            // Revert to original background (gray or whatever you have)
            this.progressContainer.style.background = originalBg || '#ddd';
            if (onComplete) onComplete();
        }, 800); // duration of flash
            
    }

    update(animated, runScore, cumulativeScore, onComplete) {
        if (!this.progressBar || !this.progressLabel) return;
        this.cumulativeScore = cumulativeScore;
        let prevTotal = cumulativeScore - runScore;
        let newTotal = cumulativeScore;
        this.currentTotal = prevTotal;
        this.prevStep = Math.floor(prevTotal / this.CUMULATIVE_SCORE_STEP);
        this.newStep = Math.floor(newTotal / this.CUMULATIVE_SCORE_STEP);
        this.cumulativeMilestones = [];
        for (let s = this.prevStep + 1; s <= this.newStep; s++) {
            this.cumulativeMilestones.push(s * this.CUMULATIVE_SCORE_STEP);
        }

        if (!animated) {
            const remainder = newTotal % this.CUMULATIVE_SCORE_STEP;
            const percent = (remainder / this.CUMULATIVE_SCORE_STEP) * 100;
            this.progressBar.style.width = percent + "%";
            this.progressLabel.innerText = `${remainder} / ${this.CUMULATIVE_SCORE_STEP}`;
            if (onComplete) onComplete(); // <-- call immediately if not animated
            return;
        }
        this.animating = true;

        let messages = [];
        let reachedRunMilestones = JSON.parse(localStorage.getItem('reachedRunMilestones') || '[]');
        for (let m of this.RUN_SCORE_MILESTONES) {
            if (runScore >= m.score && !reachedRunMilestones.includes(m.score)) {
                reachedRunMilestones.push(m.score);
                messages.push(m.message);
            }
        }
        localStorage.setItem('reachedRunMilestones', JSON.stringify(reachedRunMilestones));

        this.processMessages(messages, 0, () => this.startAnimation(onComplete));
    }

    processMessages(messages, index, onComplete) {
        if (index >= messages.length) {
            onComplete();
            return;
        }
        this.submitMessage(messages[index], () => this.processMessages(messages, index + 1, onComplete));
    }

    startAnimation(onComplete) {
        this.startTime = null;
        this.msPerPoint = 6;
        this.nextCumulativeIndex = 0;
        requestAnimationFrame((t) => this.animation_step(t, onComplete));
    }

    animation_step(now, onComplete = null) {
        console.log("animation_step", now, this.currentTotal, this.cumulativeScore);
        if (!this.startTime) this.startTime = now;
        const elapsed = now - this.startTime;
        const increment = elapsed / this.msPerPoint;
        this.currentTotal += increment;
        this.currentTotal = Math.min(this.currentTotal, this.cumulativeScore);
        const remainder = Math.floor(this.currentTotal % this.CUMULATIVE_SCORE_STEP);
        const percent = (remainder / this.CUMULATIVE_SCORE_STEP) * 100;
        this.progressBar.style.width = percent + "%";
        this.progressLabel.innerText = `${remainder} / ${this.CUMULATIVE_SCORE_STEP}`;
        
        if (this.nextCumulativeIndex < this.cumulativeMilestones.length
            && this.currentTotal >= this.cumulativeMilestones[this.nextCumulativeIndex]) {
            const milestoneValue = this.cumulativeMilestones[this.nextCumulativeIndex];
            // this.progressBurst();
            this.flash(() => {
                this.submitMessage(`Reached ${milestoneValue} total points!`, () => {
                    this.nextCumulativeIndex++;
                    requestAnimationFrame((t) => this.animation_step(t, onComplete));
                }); 
            });
            return;
        }

        if (this.currentTotal < this.cumulativeScore) {
            if (Math.random() < .6) {
                this.progressParticle(() => {
                    requestAnimationFrame((t) => this.animation_step(t, onComplete));
                });
            } else {
                requestAnimationFrame((t) => this.animation_step(t, onComplete));
            }
        } else {
            this.animating = false;
            this.processMessages([`Cumulative score: ${this.cumulativeScore}`], 0, () => {
                if (onComplete) onComplete();
            });
        }
    }

    submitMessage(message, onComplete = null) {
        console.log(message);
        if (!this.messageBox) {
            if (onComplete) onComplete();
            return;
        }
        this.messageBox.innerText = message;
        this.messageBox.style.opacity = '1';
        this.messageBox.style.transform = 'translate(0, 0)';
        setTimeout(() => {
            this.messageBox.style.opacity = '0';
            this.messageBox.style.transform = 'translate(0, -20px)';
            if (onComplete) onComplete();
        }, 1000);
    }
}

class Game {
    BASE_DELAY = 1400; // ms between pipes
    PIPE_JITTER = 200; // ms of random jitter

    GAP_JITTER = 60; // range of gap size variation
    MIN_GAP = 110; // minimum gap size

    SCALE_MULT = 10; // score multiplier for distance from center of gap
    MAX_GAP = this.MIN_GAP + this.GAP_JITTER; // maximum gap size for scoring normalization

    PIPE_WIDTH = 40;
    BIRD_SIZE = 48;

    constructor() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d');
        this.score_elem = document.getElementById('score');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.running = false;
        this.progress = new Progress();
        this.menu = new Menu();
        this.progress.hide();
        this.menu.hide();
    }

    // --- SPARKLE EFFECT ---
    spawnSparkle(x, y) {
        for (let i = 0; i < 10; i++) {
            this.effects.push({
                x: x + (Math.random() * this.bird.size / 4 - this.bird.size / 8), // ±this.bird.size/8 horizontal
                y: y - this.bird.size / 6 + (Math.random() * this.bird.size / 6 - this.bird.size / 12), // above center
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 20
            });
        }
    }

    spawnPipe() {
        const gap = Math.random() * this.GAP_JITTER + this.MIN_GAP;
        const top = Math.random() * (this.height - gap - 100) + 50;
        this.pipes.push({ x: this.width, top, bottom: top + gap, passed: false });
    }

    resetPipeTimer() {
        this.pipeTimer = 0;
        this.nextPipeDelay = this.BASE_DELAY + (Math.random() * this.PIPE_JITTER * 2 - this.PIPE_JITTER);
    }

    start() {
        this.progress.hide(); // <--- hide bar during game
        this.menu.hide();

        this.cumulativeScore = parseInt(localStorage.getItem('cumulativeScore') || '0');
        this.reachedRunMilestones = JSON.parse(localStorage.getItem('reachedRunMilestones') || '[]');

        this.running = true;
        this.bird = new Bird(80, this.height / 2, this.BIRD_SIZE, skinImages[currentSkin]);
        this.resetPipeTimer();
        this.pipes = [];
        this.effects = [];
        this.score = 0;
        this.score_elem.innerText = 'Score: 0';
        this.lastTime = null;
    }

    endGame() {
        this.running = false;
        
        this.cumulativeScore += this.score;
        localStorage.setItem('cumulativeScore', this.cumulativeScore);
        document.getElementById('submit-score').style.display = 'block';
        
        this.progress.show();
        // message = 'Game Over! Final Score: ' + this.score;
        // this.progress.processMessages([message], 0, () => this.showMenu());
        this.progress.update(true, this.score, this.cumulativeScore, () => this.menu.show());
    }

    update(dt) {

        if (!this.running) return;
        this.bird.update(dt);

        //update pipes
        this.pipeTimer += dt * (1000 / 60);
        if (this.pipeTimer >= this.nextPipeDelay) {
            this.spawnPipe();
            this.resetPipeTimer();
        }

        for (let p of this.pipes) {
            p.x -= 4.5 * dt;
        }

        // update sparkles
        for (let s of this.effects) {
            s.x += s.vx;
            s.y += s.vy;
            s.life--;
        }

        // check collisions
        if (this.bird.y > this.height || this.bird.y < 0) this.endGame();

        for (let p of this.pipes) {
            // Horizontal overlap
            const birdBounds = this.bird.getBounds();
            if (birdBounds.right > p.x && birdBounds.left < p.x + this.PIPE_WIDTH) {
                // Vertical overlap
                if (birdBounds.top < p.top || birdBounds.bottom > p.bottom) {
                    this.endGame();
                } else if (!p.passed && this.bird.x > p.x + this.PIPE_WIDTH / 2) {
                    // Passed the pipe center: score
                    const middleOfGap = (p.top + p.bottom) / 2;
                    const gap = p.bottom - p.top;
                    const distance = Math.round(this.SCALE_MULT * Math.abs(middleOfGap - this.bird.y) / (gap / 2) / (gap / this.MAX_GAP));
                    this.score += distance;

                    if (distance >= 5) this.spawnSparkle(this.bird.x, this.bird.y);

                    p.passed = true;
                    this.score_elem.innerText = 'Score: ' + this.score;
                }
            }
        }

        // remove offscreen pipes and dead sparkles
        this.pipes = this.pipes.filter(p => p.x > -50);
        this.effects = this.effects.filter(s => s.life > 0);
    }

    flap() {
        this.bird.vy = -5;
        this.bird.wing.velocity = -0.25; // boost wing rotation
    }

    drawPipes(ctx) {
        ctx.fillStyle = 'green';
        for (let p of this.pipes) {
            ctx.fillRect(p.x, 0, this.PIPE_WIDTH, p.top);
            ctx.fillRect(p.x, p.bottom, this.PIPE_WIDTH, this.height - p.bottom);
        }
    }
    drawSparkles(ctx) {
        for (let s of this.effects) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    draw() {
        this.ctx.fillStyle = '#70c5ce';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.bird.draw(this.ctx);
        this.drawPipes(this.ctx);
        this.drawSparkles(this.ctx);
    }
}
