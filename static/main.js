// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let progressAnimating = false;
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

// --- SKIN SYSTEM ---
// Define available skins (add more as needed)
let lootBoxActive = false;
const ALL_SKINS = [
  { name: 'Classic', color: 'yellow' }, 
  { name: 'Red Blaze', color: 'red' },
  { name: 'Blue Ice', color: 'blue' },
  { name: 'Green Neon', color: 'lime' },
  { name: 'Purple Spark', color: 'purple' }
];

// unlocked skins saved in localStorage
let unlockedSkins = JSON.parse(localStorage.getItem('unlockedSkins') || '["Classic"]'); // always have Classic
if (unlockedSkins.length === 0) {
  // Give the player the default skin at start
  unlockedSkins.push('Default');
  localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
}
updateSkinMenuArrows();
let currentSkin = localStorage.getItem('currentSkin') || 'Classic';
let currentSkinIndex = unlockedSkins.indexOf(currentSkin) || 0;


function updateSkinDisplay() {
  if (unlockedSkins.length === 0) return;

  // clamp index
  if (currentSkinIndex < 0) currentSkinIndex = unlockedSkins.length - 1;
  if (currentSkinIndex >= unlockedSkins.length) currentSkinIndex = 0;

  currentSkin = unlockedSkins[currentSkinIndex];
  localStorage.setItem('currentSkin', currentSkin);

  const skinData = ALL_SKINS.find(s => s.name === currentSkin);
  const display = document.getElementById('current-skin-display');
  const nameDisplay = document.getElementById('skin-name');
  if (display && skinData) {
    display.style.background = skinData.color;
    nameDisplay.innerText = skinData.name;
  }
}

// switch left
document.getElementById('skin-left').addEventListener('click', () => {
  currentSkinIndex--;
  updateSkinDisplay();
});

// switch right
document.getElementById('skin-right').addEventListener('click', () => {
  currentSkinIndex++;
  updateSkinDisplay();
});

function showMenu() {
  const menu = document.getElementById('skin-menu');
  if (menu) menu.style.display = 'block';
  updateSkinDisplay();
}

function hideMenu() {
  const menu = document.getElementById('skin-menu');
  if (menu) menu.style.display = 'none';
}

window.addEventListener('load', () => {
  showMenu();  // show the skin selection menu at the very start
});

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

function triggerBarFlash(onComplete) {
  if (!progressContainer) return;

  // Save original background
  const originalBg = progressContainer.style.background;

  // Flash the container background
  progressContainer.style.transition = 'background 0.3s';
  progressContainer.style.background = 'gold';

  setTimeout(() => {
    // Revert to original background (gray or whatever you have)
    progressContainer.style.background = originalBg || '#555';
    if (onComplete) onComplete();
  }, 800); // duration of flash
}


// ---------------------------
// Small particles around the bar while it's filling
// Spawns a single small particle from the middle of the bar outward
// ---------------------------
function spawnTinyProgressParticle() {
  if (!progressContainer) return;
  const rect = progressContainer.getBoundingClientRect();
  const x = rect.left + (Math.random() * rect.width); // random x along the bar
  const y = rect.top + rect.height/2 + (Math.random() * 10 - 5);

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
  ).onfinish = () => p.remove();
}

// ---------------------------
// Burst used when crossing a cumulative milestone (100, 200, ...)
// ---------------------------
function spawnProgressBurstAtBar() {
  if (!progressContainer) return;
  const rect = progressContainer.getBoundingClientRect();
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

// ---------------------------
// REPLACEMENT: updateProgressDisplay(animated, runScore, prevTotal)
// - animated: boolean, animate the fill if true
// - runScore: the score from the run that just ended (used for run-based milestones)
// - prevTotal: previous cumulativeScore before adding runScore
// ---------------------------
function updateProgressDisplay(animated = false, runScore = 0, prevTotal = null) {
  if (!progressBar || !progressLabel) return; // safe-guard

  const newTotal = cumulativeScore;
  if (prevTotal === null) prevTotal = newTotal - runScore;

  // INSTANT update (no animation)
  if (!animated) {
    const remainder = newTotal % CUMULATIVE_SCORE_STEP;
    const percent = (remainder / CUMULATIVE_SCORE_STEP) * 100;
    progressBar.style.width = percent + "%";
    progressLabel.innerText = `${remainder} / ${CUMULATIVE_SCORE_STEP}`;
    return;
  }

  // --- ANIMATED FLOW ---
  progressAnimating = true;

  // 1) collect run-based messages (first-time run milestones)
  const runMessages = [];
  for (let m of RUN_SCORE_MILESTONES) {
    if (runScore >= m && !reachedRunMilestones.includes(m)) {
      reachedRunMilestones.push(m);
      runMessages.push(`First time reaching ${m} points in a run!`);
    }
  }
  if (runMessages.length > 0) {
    // persist right away so we don't show run-milestone twice on reload
    localStorage.setItem('reachedRunMilestones', JSON.stringify(reachedRunMilestones));
  }

  // 2) compute which cumulative milestones are crossed between prevTotal -> newTotal
  const prevStep = Math.floor(prevTotal / CUMULATIVE_SCORE_STEP);
  const newStep = Math.floor(newTotal / CUMULATIVE_SCORE_STEP);
  const cumulativeMilestones = [];
  for (let s = prevStep + 1; s <= newStep; s++) {
    cumulativeMilestones.push(s * CUMULATIVE_SCORE_STEP);
  }

  // Helper: process runMessages sequentially, then start the numeric animation
  function processRunMessagesThenStart(index = 0) {
    if (index >= runMessages.length) {
      startNumericAnimation();
      return;
    }
    handleMilestoneMessage(runMessages[index], () => processRunMessagesThenStart(index + 1));
  }

  // numeric animation from prevTotal -> newTotal, pausing each time we hit a cumulative milestone
function startNumericAnimation() {
  const totalDelta = newTotal - prevTotal;
  const msPerPoint = 6; // animation speed
  let animationStart = performance.now();
  let lastTime = animationStart;
  let currentTotal = prevTotal;
  let nextCumulativeIndex = 0;

  function frame(now) {
    const dt = now - lastTime;
    lastTime = now;

    // increment proportionally to elapsed time
    const increment = dt / msPerPoint;
    currentTotal = Math.min(newTotal, currentTotal + increment);

    // update display based on the currentTotal's remainder inside the 100-step window
    const remainder = Math.floor(currentTotal % CUMULATIVE_SCORE_STEP);
    const percent = (remainder / CUMULATIVE_SCORE_STEP) * 100;
    progressBar.style.width = percent + "%";
    progressLabel.innerText = `${remainder} / ${CUMULATIVE_SCORE_STEP}`;

    // spawn small particles continuously as it fills
    if (Math.random() < 0.6) spawnTinyProgressParticle();

    // If we are due to hit the next cumulative milestone, pause and show its popup + burst
    if (nextCumulativeIndex < cumulativeMilestones.length &&
        currentTotal >= cumulativeMilestones[nextCumulativeIndex]) {

      const milestoneValue = cumulativeMilestones[nextCumulativeIndex];

      // spawn burst visually at the bar
      spawnProgressBurstAtBar();

      // pause animation and flash
      triggerBarFlash(() => {
        // after flash completes, show popup
        handleMilestoneMessage(`Reached ${milestoneValue} total points!`, () => {
          // resume animation
          nextCumulativeIndex++;
          lastTime = performance.now();
          requestAnimationFrame(frame);
        });
      });

      // return early; animation is paused until flash + popup complete
      return;
    }

    // continue animating until we reach newTotal
    if (currentTotal < newTotal) {
      requestAnimationFrame(frame);
    } else {
      // done
      progressAnimating = false;
    }
  }

  requestAnimationFrame(frame);
}

  // Kick off: process any run-based milestones first, then numeric animation
  processRunMessagesThenStart();
}


function showProgressUI() {
  const wrapper = document.getElementById('progress-wrapper');
  if (wrapper) wrapper.style.display = 'flex';
}

function hideProgressUI() {
  const wrapper = document.getElementById('progress-wrapper');
  if (wrapper) wrapper.style.display = 'none';
}


function updateSkinMenuArrows() {
  const leftArrow = document.getElementById('skin-left');
  const rightArrow = document.getElementById('skin-right');

  if (unlockedSkins.length <= 1) { 
    // Only one skin: disable arrows
    leftArrow.disabled = true;
    rightArrow.disabled = true;
    leftArrow.style.opacity = 0.3;
    rightArrow.style.opacity = 0.3;
    leftArrow.style.cursor = 'default';
    rightArrow.style.cursor = 'default';
  } else {
    leftArrow.disabled = false;
    rightArrow.disabled = false;
    leftArrow.style.opacity = 1;
    rightArrow.style.opacity = 1;
    leftArrow.style.cursor = 'pointer';
    rightArrow.style.cursor = 'pointer';
  }
}

function showLootBox(onComplete) {
  lootBoxActive = true;
  const container = document.getElementById('game-container');
  if (!progressContainer) return; // safe-guard

  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.left = '50%';
  box.style.top = '50%';
  box.style.transform = 'translate(-50%, -50%)';
  box.style.width = '100px';
  box.style.height = '100px';
  box.style.background = '#333';
  box.style.border = '3px solid gold';
  box.style.borderRadius = '12px';
  box.style.zIndex = 10000;
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.fontSize = '16px';
  box.style.color = 'white';
  box.style.cursor = 'pointer';
  box.innerText = '🎁';

  container.appendChild(box);

  box.addEventListener('click', () => {
    const lockedSkins = ALL_SKINS.filter(s => !unlockedSkins.includes(s.name));
    let message;
    let newSkin;

    if (lockedSkins.length > 0) {
      newSkin = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
      unlockedSkins.push(newSkin.name);
      localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
      updateSkinMenuArrows();
      currentSkin = newSkin.name;
      localStorage.setItem('currentSkin', currentSkin);
      message = `Unlocked: ${newSkin.name}`;
      box.style.background = newSkin.color;
    } else {
      // All skins unlocked: simple message instead of loot box animation
      message = 'All skins unlocked!';
      box.style.background = '#666';
    }

    box.innerText = message;

    // small sparkles
    for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

    setTimeout(() => {
      box.remove();
      lootBoxActive = false;
      if (onComplete) onComplete();
    }, 1500);
  });
}


// --- GAME LOGIC ---

function reset() {
  if (progressAnimating) return; // block new game until animation finishes
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


// ---------------------------
// Small helper used for popups / loot box callbacks
// Replace the body later with your modal/lootbox flow; it must call onDone() when finished.
// For now it uses alert() so behavior is synchronous/blocking (keeps sequencing simple).
// ---------------------------
handleMilestoneMessage = function(message, onDone) {
  showLootBox(() => {
    //alert(message); // optional, you can skip if the loot box already says it
    if (onDone) onDone();
  });
};


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
  const skin = ALL_SKINS.find(s => s.name === currentSkin) || ALL_SKINS[0];
  ctx.fillStyle = skin.color;
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
  const prevTotal = cumulativeScore;
  cumulativeScore += score;
  localStorage.setItem('cumulativeScore', cumulativeScore);
  document.getElementById('submit-score').style.display = 'block';

  showProgressUI(); // <--- show bar again
  updateProgressDisplay(true, score, prevTotal); // animate fill-up + effects

  // show skin menu for next run
  showMenu();
}

document.querySelector('#skin-menu #start').addEventListener('click', () => {
  if (lootBoxActive) return; // ignore clicks while loot box is open
  hideMenu();  // hide the menu
  reset();     // start the game
});

canvas.addEventListener('click', () => { if (running) flap()});
//canvas.addEventListener('click', () => { if (running) flap(); else reset(); });
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