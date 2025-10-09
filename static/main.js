// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let lastTime = 0;
let progressAnimating = false;
let bird = { x: 80, y: H/2, vy: 0 };
let wingAngle = 0;
let wingVelocity = 0;

let pipes = [];
let frame = 0;
let score = 0;
let running = false;

const MAX_WING_ROT = 0.5; // ~30 degrees
const REST_ANGLE = 0;      // wings rest at 0 radians
const DAMPING = 0.15;      // how quickly velocity decays
const RETURN_SPEED = 0.08; // how quickly angle returns to rest


const scale_mult = 10; // score multiplier for distance from center of gap
const MIN_GAP = 110; // minimum gap size
const GAP_JITTER = 60; // range of gap size variation
const MAX_GAP = 170; // maximum gap size for scoring normalization

const BIRD_SIZE = 48;
const BIRD_HALF = BIRD_SIZE / 2;
const TOP_PADDING = 16;    // pixels to ignore above
const BOTTOM_PADDING = 4;  // pixels to ignore below
const SIDE_PADDING = 10;  // pixels to ignore side

const PIPE_WIDTH = 40;

const BASE_DELAY = 1400; // average pipe position variation
const PIPE_JITTER = 200; // range of pipe position variation
let nextPipeDelay = BASE_DELAY;
let pipeTimer = 0;

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
const SKIN_PREVIEW_SIZE = 144; // size of skin preview in menu

const ALL_SKINS = {
  "Classic": { 
    name: "Classic",
    body: "/static/assets/skins/classic_body.png",
    frontWing: "/static/assets/skins/front_wing.png",   // shared placeholder
    backWing:  "/static/assets/skins/back_wing.png"     // shared placeholder
  },
  "24k": {
    name: "24 Karat Sniffy",
    body: "/static/assets/skins/24k_body.png",
    frontWing: "/static/assets/skins/24k_front_wing.png",
    backWing:  "/static/assets/skins/24k_back_wing.png"
  },
  "Sniffyffy": {
    name: "Sniffyffy",
    body: "/static/assets/skins/sniffyffy_body.png",
    frontWing: "/static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "/static/assets/skins/sniffyffy_back_wing.png"
  },
  "Cute": {
    name: "Small and Cute Sniffy",
    body: "/static/assets/skins/cute_body.png",
    frontWing: "/static/assets/skins/cute_front_wing.png",
    backWing:  "/static/assets/skins/cute_back_wing.png"
  },
  "Impostor": {
    name: "Impostor Sniffy",
    body: "/static/assets/skins/impostor_body.png",
    frontWing: "/static/assets/skins/impostor_front_wing.png",
    backWing:  "/static/assets/skins/impostor_back_wing.png"
  }
};


// Preload all parts

const skinImages = {};

for (let key in ALL_SKINS) {
  const skin = ALL_SKINS[key];
  skinImages[key] = {
    body: new Image(),
    frontWing: new Image(),
    backWing: new Image()
  };
  skinImages[key].body.src = skin.body;
  skinImages[key].frontWing.src = skin.frontWing;
  skinImages[key].backWing.src = skin.backWing;
}


// unlocked skins saved in localStorage
let unlockedSkins = JSON.parse(localStorage.getItem('unlockedSkins') || '["Classic"]'); // always have Classic
if (unlockedSkins.length === 0) {
  // Give the player the default skin at start
  unlockedSkins.push('Classic');
  localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
}
updateSkinMenuArrows();

let currentSkin = localStorage.getItem('currentSkin') || 'Classic';
let currentSkinIndex = unlockedSkins.indexOf(currentSkin) || 0;


function createSkinPreview(skinKey) {
  const skin = skinImages[skinKey];

  // Create a canvas for the preview
  const canvas = document.createElement('canvas');
  canvas.width = SKIN_PREVIEW_SIZE;
  canvas.height = SKIN_PREVIEW_SIZE;
  const ctx = canvas.getContext('2d');

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const size = SKIN_PREVIEW_SIZE; // draw wings and body at full preview size

  // --- Back wing ---
  if (skin.backWing && skin.backWing.complete) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(0); // resting angle
    ctx.drawImage(skin.backWing, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // --- Body ---
  if (skin.body && skin.body.complete) {
    ctx.drawImage(skin.body, centerX - size / 2, centerY - size / 2, size, size);
  }

  // --- Front wing ---
  if (skin.frontWing && skin.frontWing.complete) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(0); // resting angle
    ctx.drawImage(skin.frontWing, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  return canvas.toDataURL(); // returns a preview image URL
}


function updateSkinDisplay() {
  if (unlockedSkins.length === 0) return;

  // clamp index
  if (currentSkinIndex < 0) currentSkinIndex = unlockedSkins.length - 1;
  if (currentSkinIndex >= unlockedSkins.length) currentSkinIndex = 0;

  currentSkin = unlockedSkins[currentSkinIndex];
  localStorage.setItem('currentSkin', currentSkin);

  const skinData = ALL_SKINS[currentSkin];
  const display = document.getElementById('current-skin-display');
  const nameDisplay = document.getElementById('skin-name');

  if (display && skinData) {
    nameDisplay.innerText = skinData.name;

    // Show preview of the skin (body + wings) at SKIN_PREVIEW_SIZE
    const previewURL = createSkinPreview(currentSkin);

    display.innerHTML = ''; // clear previous preview
    const img = document.createElement('img');
    img.src = previewURL;
    img.width = SKIN_PREVIEW_SIZE;
    img.height = SKIN_PREVIEW_SIZE;
    display.appendChild(img);
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
function updateProgressDisplay(animated = false, runScore = 0, prevTotal = null, onComplete = null) {
  if (!progressBar || !progressLabel) return;

  const newTotal = cumulativeScore;
  if (prevTotal === null) prevTotal = newTotal - runScore;

  if (!animated) {
    const remainder = newTotal % CUMULATIVE_SCORE_STEP;
    const percent = (remainder / CUMULATIVE_SCORE_STEP) * 100;
    progressBar.style.width = percent + "%";
    progressLabel.innerText = `${remainder} / ${CUMULATIVE_SCORE_STEP}`;
    if (onComplete) onComplete(); // <-- call immediately if not animated
    return;
  }

  progressAnimating = true;

  // Collect run-based messages
  const runMessages = [];
  for (let m of RUN_SCORE_MILESTONES) {
    if (runScore >= m && !reachedRunMilestones.includes(m)) {
      reachedRunMilestones.push(m);
      runMessages.push(`First time reaching ${m} points in a run!`);
    }
  }
  if (runMessages.length > 0) localStorage.setItem('reachedRunMilestones', JSON.stringify(reachedRunMilestones));

  // Cumulative milestones
  const prevStep = Math.floor(prevTotal / CUMULATIVE_SCORE_STEP);
  const newStep = Math.floor(newTotal / CUMULATIVE_SCORE_STEP);
  const cumulativeMilestones = [];
  for (let s = prevStep + 1; s <= newStep; s++) cumulativeMilestones.push(s * CUMULATIVE_SCORE_STEP);

  function processRunMessagesThenStart(index = 0) {
    if (index >= runMessages.length) {
      startNumericAnimation();
      return;
    }
    handleMilestoneMessage(runMessages[index], () => processRunMessagesThenStart(index + 1));
  }

  function startNumericAnimation() {
    const totalDelta = newTotal - prevTotal;
    const msPerPoint = 6;
    let animationStart = performance.now();
    let lastTime = animationStart;
    let currentTotal = prevTotal;
    let nextCumulativeIndex = 0;

    function frame(now) {
      const dt = now - lastTime;
      lastTime = now;

      const increment = dt / msPerPoint;
      currentTotal = Math.min(newTotal, currentTotal + increment);

      const remainder = Math.floor(currentTotal % CUMULATIVE_SCORE_STEP);
      const percent = (remainder / CUMULATIVE_SCORE_STEP) * 100;
      progressBar.style.width = percent + "%";
      progressLabel.innerText = `${remainder} / ${CUMULATIVE_SCORE_STEP}`;

      if (Math.random() < 0.6) spawnTinyProgressParticle();

      if (nextCumulativeIndex < cumulativeMilestones.length &&
          currentTotal >= cumulativeMilestones[nextCumulativeIndex]) {
        const milestoneValue = cumulativeMilestones[nextCumulativeIndex];
        spawnProgressBurstAtBar();
        triggerBarFlash(() => {
          handleMilestoneMessage(`Reached ${milestoneValue} total points!`, () => {
            nextCumulativeIndex++;
            lastTime = performance.now();
            requestAnimationFrame(frame);
          });
        });
        return; // pause until flash + loot box done
      }

      if (currentTotal < newTotal) {
        requestAnimationFrame(frame);
      } else {
        progressAnimating = false;
        if (onComplete) onComplete(); // <-- call after animation finishes
      }
    }

    requestAnimationFrame(frame);
  }

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
    leftArrow.style.opacity = 0;
    rightArrow.style.opacity = 0;
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

function showLootBox(onComplete, message = '') {
  lootBoxActive = true;
  const container = document.getElementById('game-container');
  if (!container) return;

  // Create loot box container
  const boxWrapper = document.createElement('div');
  boxWrapper.style.position = 'absolute';
  boxWrapper.style.left = '50%';
  boxWrapper.style.top = '50%';
  boxWrapper.style.transform = 'translate(-50%, -50%)';
  boxWrapper.style.display = 'flex';
  boxWrapper.style.flexDirection = 'column';
  boxWrapper.style.alignItems = 'center';
  boxWrapper.style.gap = '10px';
  boxWrapper.style.zIndex = 10000;

  // Message above box
  const msgDiv = document.createElement('div');
  msgDiv.style.color = 'gold'; // make text pop
  msgDiv.style.fontSize = '18px';
  msgDiv.style.textAlign = 'center';
  msgDiv.style.minHeight = '24px';
  msgDiv.innerText = message;

  // Box itself (scaled to SKIN_PREVIEW_SIZE)
  const box = document.createElement('div');
  box.style.width = SKIN_PREVIEW_SIZE + 'px';
  box.style.height = SKIN_PREVIEW_SIZE + 'px';
  box.style.background = '#333';
  box.style.border = '3px solid gold';
  box.style.borderRadius = '12px';
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.cursor = 'pointer';
  box.style.fontSize = Math.floor(SKIN_PREVIEW_SIZE * 0.22) + 'px'; // scale emoji
  box.style.color = 'white';
  box.innerText = '🎁'; // gift icon initially

  boxWrapper.appendChild(msgDiv);
  boxWrapper.appendChild(box);
  container.appendChild(boxWrapper);

  box.addEventListener('click', () => {
    // Get locked skins
    const lockedSkinKeys = Object.keys(ALL_SKINS).filter(key => !unlockedSkins.includes(key));
    let newSkinKey;
    if (lockedSkinKeys.length > 0) {
      newSkinKey = lockedSkinKeys[Math.floor(Math.random() * lockedSkinKeys.length)];
      const newSkin = ALL_SKINS[newSkinKey];

      // Unlock
      unlockedSkins.push(newSkinKey);
      localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
      updateSkinMenuArrows();

      // Set current
      currentSkin = newSkinKey;
      currentSkinIndex = unlockedSkins.indexOf(currentSkin);
      localStorage.setItem('currentSkin', currentSkin);
      updateSkinDisplay();

      msgDiv.innerText = `Unlocked: ${newSkin.name}`;

      // Show full preview (body + wings) inside box
      box.innerHTML = '';
      const previewURL = createSkinPreview(newSkinKey);
      const img = new Image();
      img.src = previewURL;
      img.style.width = SKIN_PREVIEW_SIZE * 0.9 + 'px';
      img.style.height = SKIN_PREVIEW_SIZE * 0.9 + 'px';
      box.appendChild(img);
    } else {
      // All skins unlocked: show rat emoji
      msgDiv.innerText = 'All skins unlocked!';
      box.style.background = '#666';
      box.innerText = '🐀';
    }

    // sparkles
    for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

    setTimeout(() => {
      boxWrapper.remove();
      lootBoxActive = false; // set inactive after box disappears
      if (onComplete) onComplete(); // call the callback after delay
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
  nextPipeDelay = BASE_DELAY;
  running = true;
  document.getElementById('submit-score').style.display = 'none';

  hideProgressUI(); // <--- hide bar while running

  // start game loop
  lastTime = 0;
  requestAnimationFrame(loop)
  document.getElementById('score').innerText = 'Score: 0';
}


// ---------------------------
// Small helper used for popups / loot box callbacks
// Replace the body later with your modal/lootbox flow; it must call onDone() when finished.
// For now it uses alert() so behavior is synchronous/blocking (keeps sequencing simple).
// ---------------------------
handleMilestoneMessage = function(message, onDone) {
  showLootBox(onDone, message); // pass the message here
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
      x: x + (Math.random() * BIRD_SIZE/4 - BIRD_SIZE/8), // ±BIRD_SIZE/8 horizontal
      y: y - BIRD_SIZE/6 + (Math.random() * BIRD_SIZE/6 - BIRD_SIZE/12), // above center
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

function update(dt) {
  if (!running) return;
  frame++;
  bird.vy += 0.25 * dt; // gravity
  bird.y  += bird.vy * dt;

  // --- Smooth tilt update ---
  const maxTilt = 0.5; // ~30° in radians
  const targetAngle = Math.max(-maxTilt, Math.min(maxTilt, bird.vy / 10));
  if (bird.angle === undefined) bird.angle = 0; // init once
  const smoothing = 0.15; // adjust for responsiveness
  bird.angle += (targetAngle - bird.angle) * smoothing;

  // --- Wing flap physics ---
  wingAngle += wingVelocity * dt;
  wingVelocity *= (1 - DAMPING * dt);
  wingAngle += (REST_ANGLE - wingAngle) * RETURN_SPEED;

  if (wingAngle > MAX_WING_ROT) wingAngle = MAX_WING_ROT;
  if (wingAngle < -MAX_WING_ROT) wingAngle = -MAX_WING_ROT;

  // --- Pipe spawning ---
  pipeTimer += dt * (1000 / 60);
  if (pipeTimer >= nextPipeDelay) {
    spawnPipe();
    pipeTimer = 0;
    nextPipeDelay = BASE_DELAY + (Math.random() * PIPE_JITTER * 2 - PIPE_JITTER);
  }

  // --- Move pipes ---
  for (let p of pipes) {
    p.x -= 4.5 * dt;
  }

  // --- Bounds check ---
  if (bird.y > H || bird.y < 0) endGame();

  // --- Collision detection + scoring ---
  for (let p of pipes) {
    if (bird.x + BIRD_HALF - SIDE_PADDING > p.x &&
        bird.x - BIRD_HALF + SIDE_PADDING < p.x + PIPE_WIDTH) {

      if (bird.y - BIRD_HALF + TOP_PADDING < p.top ||
          bird.y + BIRD_HALF - BOTTOM_PADDING > p.bottom) {
        endGame();
      } else if (!p.passed && bird.x > p.x + PIPE_WIDTH / 2) {
        const middleOfGap = (p.top + p.bottom) / 2;
        const gap = p.bottom - p.top;
        const distance = Math.round(scale_mult * Math.abs(middleOfGap - bird.y) / (gap / 2) / (gap / MAX_GAP));
        score += distance;
        if (distance >= 5) spawnSparkle(bird.x, bird.y);
        p.passed = true;
        document.getElementById('score').innerText = 'Score: ' + score;
      }
    }
  }

  pipes = pipes.filter(p => p.x > -50);
}


function drawBird(ctx, bird) {
  const skin = skinImages[currentSkin];

  const bodyImg = skin.body;
  const frontWingImg = skin.frontWing;
  const backWingImg  = skin.backWing;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.angle || 0); // use smoothed angle

  // --- Back wing ---
  if (backWingImg && backWingImg.complete) {
    ctx.save();
    ctx.rotate(wingAngle); // flap relative to tilted body
    ctx.drawImage(backWingImg, -BIRD_HALF, -BIRD_HALF, BIRD_SIZE, BIRD_SIZE);
    ctx.restore();
  }

  // --- Body ---
  if (bodyImg && bodyImg.complete) {
    ctx.drawImage(bodyImg, -BIRD_HALF, -BIRD_HALF, BIRD_SIZE, BIRD_SIZE);
  }

  // --- Front wing ---
  if (frontWingImg && frontWingImg.complete) {
    ctx.save();
    ctx.rotate(wingAngle); // flap relative to tilted body
    ctx.drawImage(frontWingImg, -BIRD_HALF, -BIRD_HALF, BIRD_SIZE, BIRD_SIZE);
    ctx.restore();
  }

  ctx.restore();
}



function draw() {
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0,0,W,H);

  // bird
  drawBird(ctx, bird);

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
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;  
  const dt = (timestamp - lastTime) / 16.67; // normalize so dt=1 ~ 60fps
  lastTime = timestamp;
  update(dt);
  draw();

  if (running) {
    requestAnimationFrame(loop);
  }
}

function flap() {
  bird.vy = -5; // existing lift
  wingVelocity = -0.25; // boost wing rotation
}

function endGame() {
  running = false;
  const prevTotal = cumulativeScore;
  cumulativeScore += score;
  localStorage.setItem('cumulativeScore', cumulativeScore);
  document.getElementById('submit-score').style.display = 'block';

  showProgressUI(); // <--- show bar again
  updateProgressDisplay(true, score, prevTotal, () => {
    // Only show menu after loot box / milestone animations finish
    showMenu();
  });
}

document.querySelector('#skin-menu #start').addEventListener('click', () => {
  if (lootBoxActive) return; // ignore clicks while loot box is open
  hideMenu();  // hide the menu
  reset();     // start the game
});

canvas.addEventListener('click', () => { if (running) flap()});
//canvas.addEventListener('click', () => { if (running) flap(); else reset(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (running) flap()} });

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