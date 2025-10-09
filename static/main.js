// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let bird = { x: 80, y: H/2, vy: 0 };
let pipes = [];
let frame = 0;
let score = 0;
let running = false;
const scale_mult = 10; // score multiplier for distance from center of gap
const MIN_GAP = 110; // minimum gap size
const GAP_JITTER = 60; // range of gap size variation
const MAX_GAP = 170; // maximum gap size for scoring normalization
const BASE_DELAY = 160; // average pipe position variation
const PIPE_JITTER = 20; // range of pipe position variation

let nextPipeFrame = BASE_DELAY;
let effects = []; // for sparkle effects

// --- MILESTONES CONFIG ---
const RUN_SCORE_MILESTONES = [10, 20, 30];   // first-time single-run milestones
const CUMULATIVE_SCORE_STEP = 100;           // every 100 cumulative points

// --- TRACKERS ---
let cumulativeScore = parseInt(localStorage.getItem('cumulativeScore') || '0');
let reachedRunMilestones = JSON.parse(localStorage.getItem('reachedRunMilestones') || '[]');


// --- PROGRESS BAR UI (safe, non-breaking) ---
let progressContainer, progressBar, progressLabel;

function createProgressUI() {
  const wrapper = document.createElement('div');
  wrapper.id = 'progress-wrapper';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '6px';
  wrapper.style.fontFamily = 'sans-serif';
  wrapper.style.zIndex = '999';
  wrapper.style.position = 'absolute';

  // progress bar container
  progressContainer = document.createElement('div');
  progressContainer.style.width = '200px';
  progressContainer.style.height = '20px';
  progressContainer.style.border = '1px solid #000';
  progressContainer.style.background = '#ddd';
  progressContainer.style.borderRadius = '4px';
  progressContainer.style.overflow = 'hidden';

  // fill bar
  progressBar = document.createElement('div');
  progressBar.style.height = '100%';
  progressBar.style.width = '0%';
  progressBar.style.background = 'green';
  progressBar.style.transition = 'width 300ms linear';

  // label
  progressLabel = document.createElement('div');
  progressLabel.style.marginTop = '4px';
  progressLabel.style.textAlign = 'center';
  progressLabel.style.width = '100%';

  progressContainer.appendChild(progressBar);
  wrapper.appendChild(progressContainer);
  wrapper.appendChild(progressLabel);

  document.body.appendChild(wrapper);

  // function to update position relative to canvas
  function updateProgressBarPosition() {
    const rect = canvas.getBoundingClientRect();
    wrapper.style.top = rect.top + 40 + 'px'; // 40px below top of canvas
    wrapper.style.left = rect.left + rect.width / 2 + 'px';
    wrapper.style.transform = 'translateX(-50%)';
  }

  // run initially and whenever window resizes
  updateProgressBarPosition();
  window.addEventListener('resize', updateProgressBarPosition);
}

// ensure DOM readiness before creating UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createProgressUI);
} else {
  createProgressUI();
}

// safe updater (no-op if UI not created)
function updateProgressDisplay() {
  if (!progressBar || !progressLabel) return;
  const progress = cumulativeScore % CUMULATIVE_SCORE_STEP;
  const percent = (progress / CUMULATIVE_SCORE_STEP) * 100;
  progressBar.style.width = percent + "%";
  progressLabel.innerText = `${progress} / ${CUMULATIVE_SCORE_STEP}`;
}

function showProgressUI() {
  const wrapper = document.getElementById('progress-wrapper');
  if (wrapper) wrapper.style.display = 'flex';
  updateProgressDisplay();
}

function hideProgressUI() {
  const wrapper = document.getElementById('progress-wrapper');
  if (wrapper) wrapper.style.display = 'none';
}

// --- GAME LOGIC ---

function reset() {
  bird = { x: 80, y: H/2, vy: 0 };
  pipes = [];
  frame = 0;
  score = 0;
  effects = [];
  nextPipeFrame = BASE_DELAY;
  running = true;
  document.getElementById('submit-score').style.display = 'none';

  hideProgressUI(); // <--- hide bar while running

  // start game loop
  loop();
  document.getElementById('score').innerText = 'Score: 0';
}

function showMilestonePopup(messages) {
  let i = 0;
  function nextPopup() {
    if (i < messages.length) {
      alert("🎉 " + messages[i]);
      i++;
      // queue the next popup after this one is dismissed
      nextPopup();
    }
  }
  nextPopup();
}


function checkMilestones(runScore, totalScore,prevTotal = totalScore - runScore) {
  let unlocked = [];

  // Check run-based milestones
  for (let milestone of RUN_SCORE_MILESTONES) {
    if (runScore >= milestone && !reachedRunMilestones.includes(milestone)) {
      reachedRunMilestones.push(milestone);
      unlocked.push(`First time reaching ${milestone} points in a run!`);
    }
  }
  localStorage.setItem('reachedRunMilestones', JSON.stringify(reachedRunMilestones));

  // cumulative-based milestones — detect crossings
  const prevStep = Math.floor(prevTotal / CUMULATIVE_SCORE_STEP);
  const newStep = Math.floor(totalScore / CUMULATIVE_SCORE_STEP);
  if (newStep > prevStep) {
    for (let s = prevStep + 1; s <= newStep; s++) {
      unlocked.push(`Reached ${s * CUMULATIVE_SCORE_STEP} total points!`);
    }
  }

  // If any unlocks happened
  if (unlocked.length > 0) {
    showMilestonePopup(unlocked);
  }
}

// --- SPARKLE EFFECT ---
function spawnSparkle(x, y) {
  for (let i = 0; i < 10; i++) {
    effects.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 20
    });
  }
}

function spawnPipe() {
  const gap = Math.random() * GAP_JITTER + MIN_GAP;
  const top = Math.random() * (H - gap - 100) + 50;
  pipes.push({ x: W, top, bottom: top + gap, passed: false });
}

function update() {
  if (!running) return;
  frame++;
  bird.vy += 0.1; // gravity
  bird.y += bird.vy;

  if (frame === nextPipeFrame) {
    spawnPipe();

    // pick next delay with jitter
    const jitter = Math.floor(Math.random() * (PIPE_JITTER * 2 + 1)) - PIPE_JITTER;
    const delay = BASE_DELAY + jitter;

    nextPipeFrame = frame + delay;
  }

  for (let p of pipes) {
    p.x -= 2.5;
  }

  if (bird.y > H || bird.y < 0) endGame();

  for (let p of pipes) {
    if (bird.x + 12 > p.x && bird.x - 12 < p.x + 40) {
      if (bird.y - 12 < p.top || bird.y + 12 > p.bottom) endGame();
      else if (!p.passed && bird.x + 2 > p.x && bird.x - 2 < p.x + 40) {
        const middleOfGap = (p.top + p.bottom) / 2;
        const gap = p.bottom - p.top;
        const distance = Math.round(scale_mult * Math.abs(middleOfGap - bird.y) / (gap/2) / (gap/MAX_GAP));
        score += distance;

      
        // spawn sparkle if high precision
        if (distance >= 5) spawnSparkle(bird.x, bird.y);

        p.passed = true; 
        document.getElementById('score').innerText = 'Score: ' + score; 
      }
    }
  }

  pipes = pipes.filter(p => p.x > -50);
}

function draw() {
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0,0,W,H);

  // bird
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(bird.x, bird.y, 12, 0, Math.PI*2);
  ctx.fill();

  // pipes
  ctx.fillStyle = 'green';
  for (let p of pipes) {
    ctx.fillRect(p.x, 0, 40, p.top);
    ctx.fillRect(p.x, p.bottom, 40, H - p.bottom);
  }

  // Draw sparkles
for (let s of effects) {
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
  ctx.fill();

  s.x += s.vx;
  s.y += s.vy;
  s.life--;
}

// Remove dead sparkles
effects = effects.filter(s => s.life > 0);


  if (running) requestAnimationFrame(loop);
}

function loop() {
  update();
  draw();
}

function flap() { bird.vy = -4; }

function endGame() {
  running = false;
  cumulativeScore += score;
  localStorage.setItem('cumulativeScore', cumulativeScore);
  document.getElementById('submit-score').style.display = 'block';

  checkMilestones(score, cumulativeScore);
  showProgressUI(); // <--- show bar again
}

document.getElementById('start').addEventListener('click', () => { reset(); });
canvas.addEventListener('click', () => { if (running) flap(); else reset(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (running) flap(); else reset(); } });

// leaderboard
async function fetchLeaderboard() {
  const res = await fetch('/api/leaderboard?limit=10');
  const data = await res.json();
  const ol = document.getElementById('leaders');
  ol.innerHTML = '';
  data.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.name} — ${s.score}`;
    ol.appendChild(li);
  });
}

document.getElementById('submit').addEventListener('click', async () => {
  const name = document.getElementById('player-name').value || 'Anon';
  await fetch('/api/score', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, score }) });
  fetchLeaderboard();
  document.getElementById('submit-score').style.display = 'none';
});

fetchLeaderboard();