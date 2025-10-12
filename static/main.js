// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// === FIXED HIGH-RESOLUTION RENDERING SYSTEM ===
// Game renders at fixed high resolution, CSS handles scaling to display size
const GAME_WIDTH = 2400;  // Fixed high-resolution width
const GAME_HEIGHT = 3600; // Fixed high-resolution height (maintains 2:3 aspect ratio)

function updateCanvasSize() {
  // Get the CSS-computed display size
  const rect = canvas.getBoundingClientRect();
  
  // Canvas internal resolution is always fixed at high resolution
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  
  // CSS handles all the scaling from internal resolution to display size
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  return { width: rect.width, height: rect.height };
}

// Initialize canvas with fixed internal resolution
const displaySize = updateCanvasSize();

// Enable high-quality rendering for crisp graphics
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// Additional canvas optimizations for mobile
ctx.textBaseline = 'top';
ctx.textAlign = 'left';

// Update canvas size on window resize
window.addEventListener('resize', () => {
  const newDisplaySize = updateCanvasSize();
  
  // Restore rendering settings after resize
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  
  // Note: Game logic continues to use fixed GAME_WIDTH/GAME_HEIGHT
  // CSS automatically handles scaling to new display size
});

// === RELATIVE SIZING SYSTEM ===
// All measurements are now based on dynamic canvas size and bird proportions
// to maintain consistent gameplay feel across different screen sizes

// Base bird size as a proportion of game height (72/600 = 0.12)
const BIRD_SIZE_RATIO = 0.12; // Bird size relative to game height
const BIRD_SIZE = GAME_HEIGHT * BIRD_SIZE_RATIO;
const BIRD_HALF = BIRD_SIZE / 2;

// Bird position as proportion of game width (80/400 = 0.2)
const BIRD_X_RATIO = 0.2; // Bird X position relative to game width
const BIRD_X = GAME_WIDTH * BIRD_X_RATIO;

// Set the canvas logical size once
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Player Info

let playerName = localStorage.getItem("playerName") || null;
let playerSection = localStorage.getItem("playerSection") || null;
let bestScore = localStorage.getItem("bestScore") || 0;

// --- TRACKERS ---
let cumulativeScore = parseInt(localStorage.getItem('cumulativeScore') || '0');
let reachedRunMilestones = JSON.parse(localStorage.getItem('reachedRunMilestones') || '[]');

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

// --- AUDIO SYSTEM ---
const audio = {
  music: new Audio('static/assets/audio/music.wav'),
  flap: new Audio('static/assets/audio/flap.wav'),
  death: new Audio('static/assets/audio/death.wav'),
  sparkle: new Audio('static/assets/audio/sparkle.wav'),
  victory: new Audio('static/assets/audio/victory.wav'),
  leaderboard: new Audio('static/assets/audio/leaderboard.wav'),
  grandchampion: new Audio('static/assets/audio/grandchampion.wav')
};

// Configure audio properties
audio.music.loop = true; // Music should loop continuously
audio.music.volume = 0.05; // Lower volume for background music
audio.flap.volume = 0.05;
audio.death.volume = 0.4;
audio.sparkle.volume = 0.4;
audio.victory.volume = 0.6;
audio.leaderboard.volume = 0.6;
audio.grandchampion.volume = 0.8;

// Mute state
let audioMuted = localStorage.getItem('audioMuted') === 'true' || false;

// Audio management functions
function playSound(soundName) {
  if (audioMuted) return; // Skip if muted
  const sound = audio[soundName];
  if (sound) {
    // Ensure sound doesn't loop for single plays
    sound.loop = false;
    // For flap and sparkle sound, reset to beginning if already playing to avoid stacking
    if (soundName === 'flap' || soundName === 'sparkle') {
      sound.currentTime = 0;
    }
    sound.play().catch(err => console.log(`Audio play failed for ${soundName}:`, err));
  }
}

function loopSound(soundName) {
  if (audioMuted) return; // Skip if muted
  const sound = audio[soundName];
  if (sound) {
    sound.loop = true;
    sound.play().catch(err => console.log(`Audio loop failed for ${soundName}:`, err));
  }
}

function stopSound(soundName) {
  const sound = audio[soundName];
  if (sound) {
    sound.pause();
    sound.currentTime = 0;
    sound.loop = false; // Reset loop flag to prevent state issues
  }
}

// Mute/unmute functionality
function toggleMute() {
  audioMuted = !audioMuted;
  localStorage.setItem('audioMuted', audioMuted.toString());
  
  if (audioMuted) {
    // Stop all currently playing sounds when muting
    Object.keys(audio).forEach(soundName => {
      stopSound(soundName);
    });
  } else {
    // Resume background music when unmuting
    audio.music.play().catch(err => console.log('Music resume failed:', err));
  }
  
  updateMuteButton();
}

function updateMuteButton() {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.textContent = audioMuted ? '🔇' : '🔊';
    muteBtn.title = audioMuted ? 'Unmute sounds' : 'Mute sounds';
  }
}

// Start background music when the game loads
document.addEventListener('DOMContentLoaded', () => {
  // Set up mute button event listener and initial state
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
    updateMuteButton();
  }
  
  // Try to start music - modern browsers may block autoplay until user interaction
  if (!audioMuted) {
    audio.music.play().catch(err => {
      console.log('Background music blocked by browser - will start on first user interaction');
    });
  }
});

// Ensure music starts on first user interaction if blocked initially
let musicStarted = false;
document.addEventListener('click', () => {
  if (!musicStarted && !audioMuted) {
    audio.music.play().catch(err => console.log('Music start failed:', err));
    musicStarted = true;
  }
}, { once: true });

// --- reset function ---
function resetPlayerData() {
  // Clear relevant localStorage items
  localStorage.removeItem("playerName");
  localStorage.removeItem("playerSection");
  localStorage.removeItem("bestScore");
  localStorage.removeItem("currentSkin");
  localStorage.removeItem("unlockedSkins");
  localStorage.removeItem("cumulativeScore");
  localStorage.removeItem("reachedRunMilestones");
  localStorage.removeItem("allSkinsUnlockedShown");

  // Reset JS variables
  playerName = null;
  playerSection = null;
  bestScore = 0;
  cumulativeScore = 0;
  reachedRunMilestones = [];
  allSkinsUnlockedShown = false;

  // Reset skins
  unlockedSkins = ["Classic"];
  currentSkin = "Classic";
  currentSkinIndex = 0;

  // Update UI
  updateSkinMenuArrows();
  updateSkinDisplay(); // make sure this redraws the skin to 'Classic'
}

// --- login system ---
function showLoginForm() {
  const overlay = document.getElementById("login-overlay");
  overlay.innerHTML = `
    <img src="static/assets/flappysniffy.png" alt="Flappy Sniffy" style="width:200px; margin-bottom:16px; display:block; margin-left:auto; margin-right:auto;" />
    <h2 style="margin:0 0 6px 0;">Welcome to Flappy Sniffy!</h2>
    <input id="player-name" placeholder="Your name" type="text" autocomplete="name" />
    <input id="player-section" placeholder="Your section number" type="text" autocomplete="off" />
    <div style="display:flex; gap:12px; align-items:center; justify-content:center;">
      <button id="login-btn" type="button">Start</button>
    </div>
    <small style="opacity:0.85;">Your name & section will be used for leaderboard submissions.</small>
  `;
  
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  overlay.style.display = "flex";
}

function showWelcomeScreen() {
  const overlay = document.getElementById("login-overlay");
  overlay.innerHTML = `
    <img src="static/assets/flappysniffy.png" alt="Flappy Sniffy" style="width:200px; margin-bottom:16px; display:block; margin-left:auto; margin-right:auto;" />
    <h2 style="margin:0 0 6px 0;">Welcome, ${playerName}!</h2>
    <p style="margin:0 0 20px 0; opacity:0.9;">Section: ${playerSection}</p>
    <div style="display:flex; gap:12px; align-items:center; justify-content:center; flex-direction:column;">
      <button id="start-game-btn" type="button" style="font-size:18px; padding:12px 24px;">Start Game</button>
      <button id="logout-btn" type="button" style="font-size:14px; padding:8px 16px; background:#ff6b6b; border:none; color:white; border-radius:6px; cursor:pointer;">Log Out</button>
    </div>
    <small style="opacity:0.7; margin-top:8px; text-align:center; color:#ff6b6b;">⚠️ Logging out will reset unlocked skins</small>
  `;
  
  document.getElementById("start-game-btn").addEventListener("click", () => {
    overlay.style.display = "none";
  });
  
  document.getElementById("logout-btn").addEventListener("click", () => {
    resetPlayerData();
    showLoginForm();
  });
  
  overlay.style.display = "flex";
}

function validateSection(section) {
  // Convert "Ta" to "TA"
  if (section.toLowerCase() === "ta") {
    return "TA";
  }
  
  // Check if it's "TA" (already uppercase)
  if (section === "TA") {
    return "TA";
  }
  
  // Check if it's a number between 10-70 inclusive
  const num = parseInt(section, 10);
  if (!isNaN(num) && num >= 10 && num <= 70) {
    return num.toString();
  }
  
  // If none of the above, return "0"
  return "0";
}

function handleLogin() {
  const inputName = document.getElementById("player-name").value.trim();
  let inputSection = document.getElementById("player-section").value.trim();

  if (!inputName || !inputSection) return;

  // Validate and normalize section number
  inputSection = validateSection(inputSection);

  // Save player info
  localStorage.setItem("playerName", inputName);
  localStorage.setItem("playerSection", inputSection);
  playerName = inputName;
  playerSection = inputSection;

  document.getElementById("login-overlay").style.display = "none";
}

// Initialize login system on page load
document.addEventListener('DOMContentLoaded', () => {
  const storedName = localStorage.getItem("playerName");
  const storedSection = localStorage.getItem("playerSection");
  
  if (storedName && storedSection) {
    playerName = storedName;
    playerSection = storedSection;
    showWelcomeScreen();
  } else {
    showLoginForm();
  }
});
// Game Info

let lastTime = 0;
let progressAnimating = false;
let bird = { x: BIRD_X, y: canvas.height/2, vy: 0 };
let wingAngle = 0;
let wingVelocity = 0;

let barsGlowing = false
let shockTimer = 0;
let bgOffset = 0;

let pipes = [];
let frame = 0;
let score = 0;
let running = false;

// Physics constants - made relative to maintain exact gameplay feel across different sizes
const GRAVITY_RATIO = 0.22 / 72; // Original gravity (0.22) relative to original bird size (72px)
const FLAP_VELOCITY_RATIO = -5 / 72; // Original flap velocity (-5) relative to original bird size (72px)
const WING_VELOCITY_RATIO = -0.5; // Wing velocity remains as angular velocity (not size-dependent)

// Movement speed constants - made relative to maintain consistent game pace
const PIPE_SPEED_RATIO = 4 / 72; // Original pipe speed (4) relative to original bird size (72px)
const BG_SPEED_RATIO = 2.7 / 72; // Original background speed (2.7) relative to original bird size (72px)

const MAX_WING_ROT = 1.5; // Maximum wing rotation in radians (angular, not size-dependent)
const REST_ANGLE = 0;      // wings rest at 0 radians
const DAMPING = 0.15;      // how quickly velocity decays (ratio, not size-dependent)
const RETURN_SPEED = 0.08; // how quickly angle returns to rest (ratio, not size-dependent)

// Calculated physics constants based on current game size
const GRAVITY = GRAVITY_RATIO * BIRD_SIZE;
const FLAP_VELOCITY = FLAP_VELOCITY_RATIO * BIRD_SIZE;
const PIPE_SPEED = PIPE_SPEED_RATIO * BIRD_SIZE;
const BG_SPEED = BG_SPEED_RATIO * BIRD_SIZE;

// Collision padding as ratios of bird size to maintain proportions

const TOP_PADDING = BIRD_SIZE * 0.33;
const BOTTOM_PADDING = BIRD_SIZE * 0.22;
const RIGHT_PADDING = BIRD_SIZE * 0.33;
const LEFT_PADDING = BIRD_SIZE * 0.61;

const scale_mult = 10; // score multiplier for distance from center of gap
const MIN_GAP = BIRD_SIZE*1.7; // minimum gap size
const GAP_JITTER = BIRD_SIZE; // range of gap size variation
const MAX_GAP = MIN_GAP + GAP_JITTER; // maximum gap size for scoring normalization


// Pipe width as ratio of bird size (40/72 = 0.56)
const PIPE_WIDTH = BIRD_SIZE * 0.56

// Pipe timing - based on pipe speed to maintain consistent spacing
// Original: 1400ms base delay with 4 pixel/frame speed = ~350px spacing
const PIPE_SPACING_RATIO = 350 / 72; // Desired spacing relative to bird size
const BASE_DELAY = (PIPE_SPACING_RATIO * BIRD_SIZE) / PIPE_SPEED * (1000 / 60); // Convert to timer units
const PIPE_JITTER = BASE_DELAY * 0.14; // 14% jitter (200/1400 from original)

// Background pattern spacing as ratio of game width (120/400 = 0.3)
const BG_PATTERN_SIZE = GAME_WIDTH * 0.3;

// Pipe boundary margins as ratios of game height (50/600 = 0.083)
const PIPE_MARGIN = GAME_HEIGHT * 0.083;

// Pipe cleanup distance as ratio of pipe width (-50/-40 = 1.25)
const PIPE_CLEANUP_DISTANCE = PIPE_WIDTH * 1.25;

// Background decoration sizes as ratios of pattern size
const BG_DECORATION_OFFSET = BG_PATTERN_SIZE * 0.5;
const BG_DECORATION_RADIUS = BG_PATTERN_SIZE * 0.167;

// Square decoration ratios (40/120 = 0.333 for offset and size)
const BG_SQUARE_OFFSET = BG_PATTERN_SIZE * 0.333;
const BG_SQUARE_SIZE = BG_PATTERN_SIZE * 0.333;
const BG_SQUARE_HALF = BG_PATTERN_SIZE * 0.167;

// Background line width based on bird size (original: 2px for 72px bird)
const BG_LINE_WIDTH = BIRD_SIZE * (2 / 72);

// UI positioning - positioned high up, near top of screen
const UI_OFFSET = GAME_HEIGHT * 0.02; // Internal canvas offset (not used for HTML positioning)
let nextPipeDelay = BASE_DELAY;
let pipeTimer = 0;

const GOLDEN_PIPE_CHANCE = 1/30; // chance for a pipe to be golden (1 in 30)
const DISTANCE_MULT = 10; // every X pipes passed increases base score by 1

// Color progression for base score multiplier visual indicator
const SCORE_MULT_COLORS = [
  '#00aaff', // 1x - blue (starting color)
  '#00ff00', // 2x - green
  '#ffff00', // 3x - yellow
  '#ff8800', // 4x - orange
  '#ff0000', // 5x - red
  '#ff00ff', // 6x - magenta
  '#8800ff', // 7x - purple
  '#00ffff', // 8x - cyan
  '#ff0088', // 9x - pink
  '#88ff00'  // 10x - lime
];

// Pipe gap distribution types
const DISTRIBUTION_TYPES = {
  UNIFORM: 'uniform',
  BIMODAL: 'bimodal', 
  TOP_SKEWED: 'top_skewed',
  BOTTOM_SKEWED: 'bottom_skewed'
};

let effects = []; // for sparkle effects
let scorePopups = []; // for floating score text
let pipesPassedCount = 0; // track how many pipes have been passed
let currentDistribution = DISTRIBUTION_TYPES.UNIFORM; // track active distribution
let pipesSpawnedCount = 0; // track how many pipes have been spawned

// --- MILESTONES CONFIG ---
const RUN_SCORE_MILESTONES = [50, 100, 200, 400, 800, 900, 1000, 2000, 4000, 8000];   // first-time single-run milestones
const CUMULATIVE_SCORE_STEP = 100;           // every 100 cumulative points

// --- SKIN SYSTEM ---
// Define available skins (add more as needed)
let lootBoxActive = false;
let allSkinsUnlockedShown = localStorage.getItem('allSkinsUnlockedShown') === 'true' || false;
// Skin preview rendering system - high resolution rendering with CSS scaling
const SKIN_PREVIEW_RENDER_SIZE = 480; // High resolution internal rendering (4x scale)
const SKIN_PREVIEW_DISPLAY_SIZE = 120; // Display size after CSS scaling

// Secret skins unlocked by leaderboard achievements
const SECRET_SKINS = {
  "24k": {
    name: "24 Karat Sniffy",
    body: "static/assets/skins/24k_body.png",
    frontWing: "static/assets/skins/24k_front_wing.png",
    backWing:  "static/assets/skins/24k_back_wing.png",
    requirement: "top5", // Top 5 in section
    unlockMessage: "🏆 Amazing! You reached Top 5 in your section!"
  },
  "Number1": { 
    name: "Number 1 Sniffy",
    body: "static/assets/skins/number1_body.png",
    frontWing: "static/assets/skins/front_wing.png",   
    backWing:  "static/assets/skins/back_wing.png",
    requirement: "number1", // #1 overall
    unlockMessage: "👑 LEGENDARY! You achieved #1 overall!"
  }
};

const ALL_SKINS = {
  "Classic": { 
    name: "Flappy Sniffy",
    body: "static/assets/skins/classic_body.png",
    frontWing: "static/assets/skins/front_wing.png",   // shared placeholder
    backWing:  "static/assets/skins/back_wing.png"     // shared placeholder
  },
  "Idol": { 
    name: "Idol Sniffy",
    body: "static/assets/skins/idol_body.png",
    frontWing: "static/assets/skins/idol_front_wing.png",   
    backWing:  "static/assets/skins/idol_back_wing.png"     
  },
  "Bald": { 
    name: "Bald Sniffy",
    body: "static/assets/skins/bald_body.png",
    frontWing: "static/assets/skins/front_wing.png",  
    backWing:  "static/assets/skins/back_wing.png"     
  },
  "Sniffyffy": {
    name: "Sniffyffy",
    body: "static/assets/skins/sniffyffy_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
  "Cute": {
    name: "Small and Cute Sniffy",
    body: "static/assets/skins/cute_body.png",
    frontWing: "static/assets/skins/cute_front_wing.png",
    backWing:  "static/assets/skins/cute_back_wing.png"
  },
  "Impostor": {
    name: "Impostor Sniffy",
    body: "static/assets/skins/impostor_body.png",
    frontWing: "static/assets/skins/impostor_front_wing.png",
    backWing:  "static/assets/skins/impostor_back_wing.png"
  },
    "Princess": {
    name: "Princess Sniffy",
    body: "static/assets/skins/princess_body.png",
    frontWing: "static/assets/skins/cute_front_wing.png",
    backWing:  "static/assets/skins/cute_back_wing.png"
  },
    "Swiffy": {
    name: "Taylor Sniffy",
    body: "static/assets/skins/swiffy_body.png",
    frontWing: "static/assets/skins/cute_front_wing.png",
    backWing:  "static/assets/skins/cute_back_wing.png"
  },
  "Mustang": {
    name: "Mustang Sniffy",
    body: "static/assets/skins/mustang_body.png",
    frontWing: "static/assets/skins/mustang_front_wing.png",
    backWing:  "static/assets/skins/mustang_back_wing.png"
  },
  "Canada": {
    name: "Team Canada Sniffy",
    body: "static/assets/skins/canada_body.png",
    frontWing: "static/assets/skins/canada_front_wing.png",
    backWing:  "static/assets/skins/canada_back_wing.png"
  },
  "Spooky": {
    name: "Spooky Sniffy",
    body: "static/assets/skins/spooky_body.png",
    frontWing: "static/assets/skins/impostor_front_wing.png",
    backWing:  "static/assets/skins/impostor_back_wing.png"
  },
  "Retro": {
    name: "Steamboat Sniffy",
    body: "static/assets/skins/retro_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
  "Hello": {
    name: "Hello Sniffy",
    body: "static/assets/skins/hello_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
    "OG": {
    name: "OG Sniffy",
    body: "static/assets/skins/og_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
    "Strawhat": {
    name: "Strawhat Sniffy",
    body: "static/assets/skins/strawhat_body.png",
    frontWing: "static/assets/skins/empty.png", // no front wing for this skin
    backWing:  "static/assets/skins/strawhat_back_wing.png"
  },
    "Hedgehog": {
    name: "Sniffy the Hedgehog",
    body: "static/assets/skins/hedgehog_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
    "Sniffychu": {
    name: "Sniffychu",
    body: "static/assets/skins/sniffychu_body.png",
    frontWing: "static/assets/skins/sniffyffy_front_wing.png",
    backWing:  "static/assets/skins/sniffyffy_back_wing.png"
  },
    "Superstar": {
    name: "Superstar Sniffy",
    body: "static/assets/skins/superstar_body.png",
    frontWing: "static/assets/skins/front_wing.png",
    backWing:  "static/assets/skins/back_wing.png"
  },
    "Astronaut": {
    name: "Astronaut Sniffy",
    body: "static/assets/skins/astronaut_body.png",
    frontWing: "static/assets/skins/empty.png",
    backWing:  "static/assets/skins/empty.png"
  },
  "Tanuki": {
    name: "Tanuki Sniffy",
    body: "static/assets/skins/tanuki_body.png",
    frontWing: "static/assets/skins/empty.png",
    backWing:  "static/assets/skins/tanuki_back_wing.png"
  },
  "Hollow": {
    name: "Hollow Sniffy",
    body: "static/assets/skins/hollow_body.png",
    frontWing: "static/assets/skins/empty.png",
    backWing:  "static/assets/skins/hollow_back_wing.png"
  }
};


// Helper function to get all skins (regular + secret)
function getAllSkinsData() {
  return { ...ALL_SKINS, ...SECRET_SKINS };
}

// Check and unlock secret skins based on achievements
function checkSecretSkinUnlocks(scoreData) {
  const newlyUnlocked = [];
  
  // Check 24 Karat Sniffy (Top 5 in section)
  if ((scoreData.is_section_top5 || scoreData.is_overall_top5) && !unlockedSkins.includes('24k')) {
    unlockedSkins.push('24k');
    newlyUnlocked.push({
      key: '24k',
      skin: SECRET_SKINS['24k']
    });
  }
  
  // Check Number 1 Sniffy (#1 overall)
  if (scoreData.is_overall_best && !unlockedSkins.includes('Number1')) {
    unlockedSkins.push('Number1');
    newlyUnlocked.push({
      key: 'Number1',
      skin: SECRET_SKINS['Number1']
    });
  }
  
  // Save unlocked skins if any were unlocked
  if (newlyUnlocked.length > 0) {
    localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
  }
  
  return newlyUnlocked;
}

// Preload all parts (including secret skins)
const skinImages = {};
const allSkinsData = getAllSkinsData();

for (let key in allSkinsData) {
  const skin = allSkinsData[key];
  skinImages[key] = {
    body: new Image(),
    frontWing: new Image(),
    backWing: new Image()
  };
  skinImages[key].body.src = skin.body;
  skinImages[key].frontWing.src = skin.frontWing;
  skinImages[key].backWing.src = skin.backWing;
}


function createSkinPreview(skinKey) {
  const skin = skinImages[skinKey];

  // Create a high-resolution canvas for crisp rendering
  const canvas = document.createElement('canvas');
  canvas.width = SKIN_PREVIEW_RENDER_SIZE;
  canvas.height = SKIN_PREVIEW_RENDER_SIZE;
  const ctx = canvas.getContext('2d');
  
  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const size = SKIN_PREVIEW_RENDER_SIZE; // draw wings and body at full render size

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

  const skinData = getAllSkinsData()[currentSkin];
  const display = document.getElementById('current-skin-display');
  const nameDisplay = document.getElementById('skin-name');

  if (display && skinData) {
    nameDisplay.innerText = skinData.name;

    // Show preview of the skin (body + wings) at high resolution
    const previewURL = createSkinPreview(currentSkin);

    display.innerHTML = ''; // clear previous preview
    const img = document.createElement('img');
    img.src = previewURL;
    // Set display size (CSS will scale down the high-res image)
    img.width = SKIN_PREVIEW_DISPLAY_SIZE;
    img.height = SKIN_PREVIEW_DISPLAY_SIZE;
    // Enable smooth scaling
    img.style.imageRendering = 'auto';
    display.appendChild(img);
  }
}

function animateSkinPreview() {
  const display = document.getElementById('current-skin-display');
  if (!display) return;
  
  // Create jump animation using CSS transform
  display.style.transition = 'transform 0.3s ease-out';
  display.style.transform = 'translateY(-15px)';
  
  // Return to original position
  setTimeout(() => {
    display.style.transform = 'translateY(0px)';
  }, 150);
  
  // Clean up transition after animation
  setTimeout(() => {
    display.style.transition = '';
  }, 300);
}

// switch left
document.getElementById('skin-left').addEventListener('click', () => {
  currentSkinIndex--;
  updateSkinDisplay();
  playSound('flap'); // Play flap sound on skin switch
  animateSkinPreview(); // Animate the preview
});

// switch right
document.getElementById('skin-right').addEventListener('click', () => {
  currentSkinIndex++;
  updateSkinDisplay();
  playSound('flap'); // Play flap sound on skin switch
  animateSkinPreview(); // Animate the preview
});

function showMenu() {
  const menu = document.getElementById('skin-menu');
  if (menu) menu.style.display = 'block';
  updateSkinDisplay();
  drawStaticBackground(); // Draw static background when menu is first shown
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
  wrapper.style.marginTop = '80px'; 


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
  progressBar.style.background = '#00aaff'; // blue instead of green
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
    // Use display-relative offset instead of internal canvas resolution
    const displayOffset = rect.height * 0.02; // 2% of display height
    wrapper.style.top = rect.top + displayOffset + 'px';
    wrapper.style.left = rect.left + rect.width / 2 + 'px';
    wrapper.style.transform = 'translateX(-50%)';
  }

  // run initially and whenever window resizes
  updateProgressBarPosition();
  window.addEventListener('resize', updateProgressBarPosition);
}

// ensure DOM readiness before creating UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createProgressUI();
    hideProgressUI(); // start hidden until game ends
  });
} else {
  createProgressUI();
  hideProgressUI(); // start hidden until game ends
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
// Helper functions for progressive milestone calculation
// ---------------------------
function getNextMilestone(score) {
  let milestone = CUMULATIVE_SCORE_STEP; // start at 100
  let milestoneNumber = 1;
  
  while (milestone <= score) {
    milestoneNumber++;
    milestone += milestoneNumber * CUMULATIVE_SCORE_STEP;
  }
  
  return milestone;
}

function getPreviousMilestone(score) {
  if (score < CUMULATIVE_SCORE_STEP) return 0;
  
  let milestone = 0;
  let nextMilestone = CUMULATIVE_SCORE_STEP;
  let milestoneNumber = 1;
  
  while (nextMilestone <= score) {
    milestone = nextMilestone;
    milestoneNumber++;
    nextMilestone += milestoneNumber * CUMULATIVE_SCORE_STEP;
  }
  
  return milestone;
}

// ---------------------------
// REPLACEMENT: updateProgressDisplay(animated, runScore, prevTotal)
// - animated: boolean, animate the fill if true
// - runScore: the score from the run that just ended (used for run-based milestones)
// - prevTotal: previous cumulativeScore before adding runScore
// ---------------------------
function updateProgressDisplay(animated = false, runScore = 0, prevTotal = null, onComplete = null) {
  if (!progressBar || !progressLabel) return;

  // If all skins are unlocked, show golden completed bar without animation
  if (allSkinsUnlockedShown) {
    progressBar.style.width = "100%";
    progressBar.style.background = "gold";
    progressLabel.innerText = "COLLECTION COMPLETE!";
    progressLabel.style.color = "gold"; // Make the text gold too
    if (onComplete) onComplete();
    return;
  }

  const newTotal = cumulativeScore;
  if (prevTotal === null) prevTotal = newTotal - runScore;

  if (!animated) {
    // Calculate progress toward next milestone
    const nextMilestone = getNextMilestone(newTotal);
    const prevMilestone = getPreviousMilestone(newTotal);
    const progress = newTotal - prevMilestone;
    const milestoneRange = nextMilestone - prevMilestone;
    const percent = (progress / milestoneRange) * 100;
    
    progressBar.style.width = percent + "%";
    progressLabel.innerText = `${progress} / ${milestoneRange}`;
    if (onComplete) onComplete(); // <-- call immediately if not animated
    return;
  }

  progressAnimating = true;

  // Collect run-based messages
  const runMessages = [];
  console.log("Checking run milestones:", { runScore, reachedRunMilestones, RUN_SCORE_MILESTONES });
  for (let m of RUN_SCORE_MILESTONES) {
    if (runScore >= m && !reachedRunMilestones.includes(m)) {
      console.log(`New milestone reached: ${m}`);
      reachedRunMilestones.push(m);
      runMessages.push(`First time reaching ${m} points in a run!`);
    }
  }
  if (runMessages.length > 0) localStorage.setItem('reachedRunMilestones', JSON.stringify(reachedRunMilestones));

  // Cumulative milestones with increasing thresholds (100, 200, 300, 400, ...)
  const cumulativeMilestones = [];
  
  // Calculate which milestone we should be checking
  let milestone = CUMULATIVE_SCORE_STEP; // start at 100
  let milestoneNumber = 1;
  
  // Find all milestones between prevTotal and newTotal
  while (milestone <= newTotal) {
    if (milestone > prevTotal) {
      cumulativeMilestones.push(milestone);
    }
    // Increase by an additional 100 each time: 100, 200, 300, 400, 500...
    milestoneNumber++;
    milestone += milestoneNumber * CUMULATIVE_SCORE_STEP;
  }

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
    
    // Start looping sparkle sound for progress animation
    loopSound('sparkle');

    function frame(now) {
      const dt = now - lastTime;
      lastTime = now;

      const increment = dt / msPerPoint;
      currentTotal = Math.min(newTotal, currentTotal + increment);

      // Calculate progress toward next milestone
      const nextMilestone = getNextMilestone(currentTotal);
      const prevMilestone = getPreviousMilestone(currentTotal);
      const progress = currentTotal - prevMilestone;
      const milestoneRange = nextMilestone - prevMilestone;
      const percent = (progress / milestoneRange) * 100;
      
      progressBar.style.width = percent + "%";
      //progressLabel.innerText = `${Math.floor(progress)} / ${milestoneRange}`;

      if (Math.random() < 0.6) spawnTinyProgressParticle();

      if (nextCumulativeIndex < cumulativeMilestones.length &&
          currentTotal >= cumulativeMilestones[nextCumulativeIndex]) {
        const milestoneValue = cumulativeMilestones[nextCumulativeIndex];
        spawnProgressBurstAtBar();
        stopSound('sparkle'); // Stop sparkle sound during loot box
        triggerBarFlash(() => {
          handleMilestoneMessage(`Reached ${milestoneValue} total points!`, () => {
            nextCumulativeIndex++;
            lastTime = performance.now();
            loopSound('sparkle'); // Resume sparkle sound after loot box
            requestAnimationFrame(frame);
          });
        });
        return; // pause until flash + loot box done
      }

      if (currentTotal < newTotal) {
        requestAnimationFrame(frame);
      } else {
        stopSound('sparkle'); // Stop sparkle sound when animation ends
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

function showLeaderboardButton() {
  const leaderboardBtn = document.getElementById('leaderboard-btn');
  if (leaderboardBtn) leaderboardBtn.style.display = 'block';
}

function hideLeaderboardButton() {
  const leaderboardBtn = document.getElementById('leaderboard-btn');
  if (leaderboardBtn) leaderboardBtn.style.display = 'none';
}

function showMuteButton() {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.style.setProperty('display', 'flex', 'important');
    muteBtn.style.visibility = 'visible';
  }
}

function hideMuteButton() {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.style.setProperty('display', 'none', 'important');
    muteBtn.style.visibility = 'hidden';
  }
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

function showLootBox(onComplete, message = '', secretSkinKey = null, secretSkinData = null) {
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
  const isSecretSkin = secretSkinKey && secretSkinData;
  msgDiv.style.color = isSecretSkin ? '#00aaff' : 'gold'; // blue for secret skins, gold for regular
  msgDiv.style.fontSize = '16px';
  msgDiv.style.fontWeight = 'bold';
  msgDiv.style.textAlign = 'center';
  msgDiv.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.7)';
  msgDiv.style.padding = '8px 16px';
  msgDiv.style.background = 'rgba(0, 0, 0, 0.3)';
  msgDiv.style.borderRadius = '8px';
  msgDiv.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  msgDiv.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
  msgDiv.style.backdropFilter = 'blur(5px)';
  msgDiv.style.webkitBackdropFilter = 'blur(5px)';
  msgDiv.style.whiteSpace = 'nowrap'; // prevent text wrapping
  msgDiv.innerText = message;

  // Box itself (scaled to display size)
  const box = document.createElement('div');
  box.style.width = SKIN_PREVIEW_DISPLAY_SIZE + 'px';
  box.style.height = SKIN_PREVIEW_DISPLAY_SIZE + 'px';
  box.style.background = '#333';
  box.style.border = isSecretSkin ? '3px solid #00aaff' : '3px solid gold'; // blue border for secret skins
  box.style.borderRadius = '12px';
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.cursor = 'pointer';
  box.style.fontSize = Math.floor(SKIN_PREVIEW_DISPLAY_SIZE * 0.35) + 'px'; // scale emoji (increased from 0.22)
  box.style.color = 'white';

  // Fix the emoji assignment before appending
  box.innerText = isSecretSkin ? '⭐' : '🎁'; // star for secret skins, gift for regular
  
  boxWrapper.appendChild(msgDiv);
  boxWrapper.appendChild(box);
  container.appendChild(boxWrapper);

  let boxClicked = false; // prevent multiple clicks

  box.addEventListener('click', () => {
    if (boxClicked) return; // ignore if already clicked
    boxClicked = true;
    playSound('sparkle'); // Play sparkle sound when loot box is clicked

    let newSkinKey, newSkin;
    
    if (secretSkinKey && secretSkinData) {
      // This is a secret skin unlock
      newSkinKey = secretSkinKey;
      newSkin = secretSkinData;
      // Secret skin is already unlocked in unlockedSkins by checkSecretSkinUnlocks
    } else {
      // Regular loot box - get locked regular skins (not secret skins)
      const lockedSkinKeys = Object.keys(ALL_SKINS).filter(key => !unlockedSkins.includes(key));
      if (lockedSkinKeys.length > 0) {
        newSkinKey = lockedSkinKeys[Math.floor(Math.random() * lockedSkinKeys.length)];
        newSkin = ALL_SKINS[newSkinKey];

        // Unlock regular skin
        unlockedSkins.push(newSkinKey);
        localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
      }
    }
    
    if (newSkinKey && newSkin) {
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
      img.style.width = SKIN_PREVIEW_DISPLAY_SIZE * 0.9 + 'px';
      img.style.height = SKIN_PREVIEW_DISPLAY_SIZE * 0.9 + 'px';
      img.style.imageRendering = 'auto'; // Enable smooth scaling
      box.appendChild(img);
      
      // Check if this was the last regular skin to unlock (secret skins don't count)
      const allRegularSkinKeys = Object.keys(ALL_SKINS);
      const regularSkinsUnlocked = unlockedSkins.filter(skin => allRegularSkinKeys.includes(skin));
      const justUnlockedAll = regularSkinsUnlocked.length === allRegularSkinKeys.length && !allSkinsUnlockedShown;
      
      // sparkles
      for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

      setTimeout(() => {
        boxWrapper.remove();
        lootBoxActive = false; // set inactive after box disappears
        
        if (justUnlockedAll) {
          // Show special completion message
          showAllSkinsUnlockedMessage(onComplete);
        } else {
          if (onComplete) onComplete(); // call the callback after delay
        }
      }, 1500);
    } else {
      // No skin to unlock or all skins unlocked: show rat emoji
      msgDiv.innerText = 'All skins unlocked!';
      box.style.background = '#666';
      box.innerText = '🐀';
      
      // sparkles
      for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

      setTimeout(() => {
        boxWrapper.remove();
        lootBoxActive = false; // set inactive after box disappears
        if (onComplete) onComplete(); // call the callback after delay
      }, 1500);
    }
  });
}



// --- GAME LOGIC ---

function reset() {
  if (progressAnimating) return; // block new game until animation finishes
  bird = { x: BIRD_X, y: canvas.height/2, vy: 0 };
  pipes = [];
  frame = 0;
  score = 0;
  effects = [];
  scorePopups = []; // clear score popups
  pipesPassedCount = 0; // reset pipes passed counter
  pipesSpawnedCount = 0; // reset pipes spawned counter
  currentDistribution = DISTRIBUTION_TYPES.UNIFORM; // reset to uniform
  nextPipeDelay = BASE_DELAY;
  barsGlowing = false;
  
  // Reset audio states to prevent carryover issues from previous game (except music)
  Object.entries(audio).forEach(([soundName, sound]) => {
    if (soundName !== 'music') { // Keep music playing between games
      if (sound.currentTime > 0 && !sound.paused) {
        sound.pause();
      }
      sound.currentTime = 0;
      sound.loop = false; // Reset loop flag
    }
  });
  
  running = true;

  hideProgressUI(); // <--- hide bar while running
  hideLeaderboardButton(); // hide leaderboard button while playing
  hideMuteButton(); // hide mute button during gameplay

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
      vx: (Math.random() - 0.5) * 6, 
      vy: (Math.random() - 0.5) * 6, 
      life: 30,
      size: 4 // increased sparkle size
    });
  }
}

// --- SCORE POPUP EFFECT ---
function spawnScorePopup(x, y, points, isGolden = false) {
  scorePopups.push({
    x: x,
    y: y,
    text: `+${points}`,
    life: 60, // frames to display
    maxLife: 60,
    color: isGolden ? '#ffd700' : '#00aaff' // gold for golden pipes, blue for regular
  });
}

// --- PIPE DISTRIBUTION FUNCTIONS ---
// Helper function for gaussian distribution (Box-Muller transform)
function randomGaussian(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std + mean;
}

// Helper function to clamp values within valid range
function clampToValidRange(value, minY, maxY) {
  return Math.max(minY, Math.min(maxY, value));
}

// Uniform distribution (original random behavior)
function getUniformGapPosition(minY, maxY) {
  return Math.random() * (maxY - minY) + minY;
}

// Bimodal distribution (more gaps at top and bottom, fewer in center)
function getBimodalGapPosition(minY, maxY) {
  const centerY = (minY + maxY) / 2;
  const range = maxY - minY;
  
  // Create two peaks at 25% and 75% of the range
  const peak1 = minY + range * 0.25;
  const peak2 = minY + range * 0.75;
  
  // Randomly choose which peak to sample from
  const usePeak1 = Math.random() < 0.5;
  const targetPeak = usePeak1 ? peak1 : peak2;
  
  // Add gaussian noise around the chosen peak
  const std = range * 0.15; // 15% of range as standard deviation
  const position = randomGaussian(targetPeak, std);
  
  return clampToValidRange(position, minY, maxY);
}

// Top-skewed distribution (gaussian skewed toward upper third)
function getTopSkewedGapPosition(minY, maxY) {
  const range = maxY - minY;
  const upperThirdCenter = minY + range * 0.25; // Center at upper quarter
  const std = range * 0.2; // 20% of range as standard deviation
  
  const position = randomGaussian(upperThirdCenter, std);
  return clampToValidRange(position, minY, maxY);
}

// Bottom-skewed distribution (gaussian skewed toward lower third)
function getBottomSkewedGapPosition(minY, maxY) {
  const range = maxY - minY;
  const lowerThirdCenter = minY + range * 0.75; // Center at lower quarter
  const std = range * 0.2; // 20% of range as standard deviation
  
  const position = randomGaussian(lowerThirdCenter, std);
  return clampToValidRange(position, minY, maxY);
}

// Select distribution type based on current multiplier
function getDistributionType() {
  const currentMultiplier = 1 + Math.floor(pipesPassedCount / DISTANCE_MULT);
  const distributionTypes = Object.values(DISTRIBUTION_TYPES);
  
  // Weight distributions based on multiplier level
  if (currentMultiplier <= 2) {
    // Early game: mostly uniform
    return Math.random() < 0.7 ? DISTRIBUTION_TYPES.UNIFORM : 
           distributionTypes[Math.floor(Math.random() * distributionTypes.length)];
  } else if (currentMultiplier <= 5) {
    // Mid game: balanced mix
    return distributionTypes[Math.floor(Math.random() * distributionTypes.length)];
  } else {
    // Late game: favor challenging distributions
    const challengingTypes = [DISTRIBUTION_TYPES.BIMODAL, DISTRIBUTION_TYPES.TOP_SKEWED, DISTRIBUTION_TYPES.BOTTOM_SKEWED];
    return Math.random() < 0.8 ? 
           challengingTypes[Math.floor(Math.random() * challengingTypes.length)] :
           DISTRIBUTION_TYPES.UNIFORM;
  }
}

// Get gap position based on selected distribution
function getGapPosition(minY, maxY, distributionType) {
  switch (distributionType) {
    case DISTRIBUTION_TYPES.UNIFORM:
      return getUniformGapPosition(minY, maxY);
    case DISTRIBUTION_TYPES.BIMODAL:
      return getBimodalGapPosition(minY, maxY);
    case DISTRIBUTION_TYPES.TOP_SKEWED:
      return getTopSkewedGapPosition(minY, maxY);
    case DISTRIBUTION_TYPES.BOTTOM_SKEWED:
      return getBottomSkewedGapPosition(minY, maxY);
    default:
      return getUniformGapPosition(minY, maxY);
  }
}

function spawnPipe() {
  // Calculate progressive difficulty: reduce gap jitter over time
  const difficultyLevel = Math.floor(pipesPassedCount / DISTANCE_MULT);
  const jitterReduction = difficultyLevel * (BIRD_SIZE / 10); // 1/10 BIRD_SIZE per DISTANCE_MULT
  const currentGapJitter = Math.max(0, GAP_JITTER - jitterReduction); // cap at 0
  
  const gap = Math.random() * currentGapJitter + MIN_GAP;
  
  // Check if we need to pick a new distribution (every DISTANCE_MULT pipes)
  if (pipesSpawnedCount % DISTANCE_MULT === 0) {
    currentDistribution = getDistributionType();
  }
  
  // Define valid range for gap center position
  const minY = PIPE_MARGIN + gap / 2; // ensure gap doesn't go above screen
  const maxY = canvas.height - gap / 2 - PIPE_MARGIN; // ensure gap doesn't go below screen
  
  // Use current distribution for gap positioning
  const gapCenter = getGapPosition(minY, maxY, currentDistribution);
  
  // Calculate top pipe height from gap center
  const top = gapCenter - gap / 2;
  
  const isGolden = Math.random() < GOLDEN_PIPE_CHANCE;
  
  // Store the glow color that was active when this pipe was spawned
  const currentMultiplier = 1 + Math.floor(pipesPassedCount / DISTANCE_MULT);
  const colorIndex = (currentMultiplier - 1) % SCORE_MULT_COLORS.length;
  const spawnGlowColor = SCORE_MULT_COLORS[colorIndex];
  
  pipes.push({ 
    x: canvas.width, 
    top, 
    bottom: top + gap, 
    passed: false, 
    golden: isGolden,
    glowColor: spawnGlowColor // store the glow color from when it was spawned
  });
  shockTimer = 25; // ~15 frames of glow
  
  pipesSpawnedCount++; // increment spawned pipe counter
}

function update(dt) {
  if (!running) return;
  frame++;
  bird.vy += GRAVITY * dt; // gravity (now relative to bird size)
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
    p.x -= PIPE_SPEED * dt;
  }

  // --- Move background (frame-rate independent) ---
  bgOffset -= BG_SPEED * dt; // slower than pipes for depth
  bgOffset = Math.round(bgOffset); // Round to integer pixels to prevent sub-pixel rendering issues
  if (bgOffset <= -BG_PATTERN_SIZE) bgOffset += Math.round(BG_PATTERN_SIZE); // Maintain smooth scrolling

  // --- Bounds check ---
  if (bird.y > canvas.height || bird.y < 0) endGame();

  // --- Collision detection + scoring ---
  for (let p of pipes) {
    if (
      bird.x + BIRD_HALF - RIGHT_PADDING > p.x &&
      bird.x - BIRD_HALF + LEFT_PADDING < p.x + PIPE_WIDTH
    ) {

      if (bird.y - BIRD_HALF + TOP_PADDING < p.top ||
          bird.y + BIRD_HALF - BOTTOM_PADDING > p.bottom) {
        barsGlowing = true;
        endGame();
      } else if (!p.passed && bird.x > p.x + PIPE_WIDTH / 2) {
        const middleOfGap = (p.top + p.bottom) / 2;
        const gap = p.bottom - p.top;
        
        // Calculate raw distance multiplier (for precision bonus)
        const rawDistanceMultiplier = Math.round(scale_mult * Math.abs(middleOfGap - bird.y) / (gap / 2) / (gap / MAX_GAP));
        const distanceMultiplier = Math.max(1, rawDistanceMultiplier); // minimum 1x multiplier
        
        // Calculate progressive base score
        const baseScore = 1 + Math.floor(pipesPassedCount / DISTANCE_MULT);
        
        // Calculate final score: baseScore * distance * goldenMultiplier
        let finalScore = baseScore * distanceMultiplier;
        
        // Triple points for golden pipes
        if (p.golden) {
          finalScore *= 3;
        }
        
        score += finalScore;
        
        // Show score popup slightly to the right of the bird
        spawnScorePopup(bird.x + BIRD_HALF + 10, bird.y - BIRD_HALF, finalScore, p.golden);
        
        // Sparkles based on raw distance, not final score
        if (rawDistanceMultiplier >= 5) {
          playSound('sparkle'); // Play sparkle sound for close passes
          if (p.golden) {
            // More sparkles for golden pipes
            spawnSparkle(bird.x, bird.y);
            spawnSparkle(bird.x, bird.y);
            spawnSparkle(bird.x, bird.y);
          } else {
            spawnSparkle(bird.x, bird.y);
          }
        }
        p.passed = true;
        pipesPassedCount++; // increment the pipes passed counter
        document.getElementById('score').innerText = 'Score: ' + score;
      }
    }
  }

  pipes = pipes.filter(p => p.x > -PIPE_CLEANUP_DISTANCE);
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



function drawStaticBackground() {
  // --- Chamber background (metallic) - static version for skin menu ---
  let bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#555');
  bg.addColorStop(0.5, '#888');
  bg.addColorStop(1, '#555');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Static panel patterns (uniform distribution) ---
  ctx.strokeStyle = '#444';
  ctx.lineWidth = BG_LINE_WIDTH;

  // Draw regular vertical lines (no movement offset)
  for (let i = 0; i < canvas.width; i += BG_PATTERN_SIZE) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
}

function draw() {
  // --- Chamber background (metallic) ---
  let bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#555');
  bg.addColorStop(0.5, '#888');
  bg.addColorStop(1, '#555');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Panel patterns based on distribution type ---

  ctx.strokeStyle = '#444';
  ctx.lineWidth = BG_LINE_WIDTH;

  // Draw different patterns based on current distribution
  switch (currentDistribution) {
    case DISTRIBUTION_TYPES.UNIFORM:
      // Regular vertical lines (original pattern)
      for (let i = bgOffset; i < canvas.width + BG_PATTERN_SIZE; i += BG_PATTERN_SIZE) {
        if (i >= -BG_PATTERN_SIZE) { // Only draw visible lines
          const x = Math.round(i); // Round to avoid sub-pixel rendering
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
      }
      break;

    case DISTRIBUTION_TYPES.BIMODAL:
      // Regular vertical lines (same as uniform)
      for (let i = bgOffset; i < canvas.width + BG_PATTERN_SIZE; i += BG_PATTERN_SIZE) {
        if (i >= -BG_PATTERN_SIZE) { // Only draw visible lines
          const x = Math.round(i); // Round to avoid sub-pixel rendering
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
      }
      
      // Add 3 horizontal lines to emphasize the bimodal nature
      ctx.strokeStyle = '#555'; // slightly lighter than normal for subtle distinction
      ctx.globalAlpha = 1; // make them faint
      
      // Top horizontal line (around 25% height)
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.25);
      ctx.lineTo(canvas.width, canvas.height * 0.25);
      ctx.stroke();
      
      // Middle horizontal line (50% height)
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.5);
      ctx.lineTo(canvas.width, canvas.height * 0.5);
      ctx.stroke();
      
      // Bottom horizontal line (around 75% height)
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.75);
      ctx.lineTo(canvas.width, canvas.height * 0.75);
      ctx.stroke();
      
      ctx.globalAlpha = 1; // reset alpha
      ctx.strokeStyle = '#444'; // reset to normal
      break;

    case DISTRIBUTION_TYPES.TOP_SKEWED:
      // Regular vertical lines with faint circles in middle of each panel
      for (let i = bgOffset; i < canvas.width + BG_PATTERN_SIZE; i += BG_PATTERN_SIZE) {
        if (i >= -BG_PATTERN_SIZE) { // Only draw visible lines
          const x = Math.round(i); // Round to avoid sub-pixel rendering
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
          
          // Faint circle in center of panel
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(x + BG_DECORATION_OFFSET, canvas.height / 2, BG_DECORATION_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      break;

    case DISTRIBUTION_TYPES.BOTTOM_SKEWED:
      // Regular vertical lines with faint squares in middle of each panel
      for (let i = bgOffset; i < canvas.width + BG_PATTERN_SIZE; i += BG_PATTERN_SIZE) {
        if (i >= -BG_PATTERN_SIZE) { // Only draw visible lines
          const x = Math.round(i); // Round to avoid sub-pixel rendering
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
          
          // Faint square in center of panel
          ctx.globalAlpha = 0.2;
          ctx.strokeRect(x + BG_SQUARE_OFFSET, canvas.height / 2 - BG_SQUARE_HALF, BG_SQUARE_SIZE, BG_SQUARE_SIZE);
          ctx.globalAlpha = 1;
        }
      }
      break;

    default:
      // Fallback to uniform pattern
      for (let i = bgOffset; i < canvas.width + BG_PATTERN_SIZE; i += BG_PATTERN_SIZE) {
        if (i >= -BG_PATTERN_SIZE) { // Only draw visible lines
          const x = Math.round(i); // Round to avoid sub-pixel rendering
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
      }
      break;
  }

  // --- Bird ---
  drawBird(ctx, bird);

  // --- Bars (shock electrodes) ---
  for (let p of pipes) {
    // Use relative sizing for bar width and bolt radius
    const BAR_WIDTH = PIPE_WIDTH; // relative to bird size
    const BOLT_RADIUS = BIRD_SIZE * 0.055; // 4/72 ≈ 0.055
    const BOLT_OFFSET = BIRD_SIZE * 0.14;   // 10/72 ≈ 0.14

    let barGradient = ctx.createLinearGradient(p.x, 0, p.x + BAR_WIDTH, 0);

    if (p.golden) {
      // Golden pipe gradient
      barGradient.addColorStop(0, '#b8860b'); // dark gold
      barGradient.addColorStop(0.5, '#ffd700'); // bright gold
      barGradient.addColorStop(1, '#b8860b'); // dark gold
    } else {
      // Regular metallic gradient
      barGradient.addColorStop(0, '#7a7a7a');
      barGradient.addColorStop(0.5, '#d9d9d9');
      barGradient.addColorStop(1, '#7a7a7a');
    }

    ctx.fillStyle = barGradient;

    if (shockTimer > 0 || barsGlowing) {
      // Use the glow color that was stored when this pipe was spawned
      ctx.shadowColor = p.glowColor;
      ctx.shadowBlur = 15;
    } else {
      ctx.shadowBlur = 0;
    }

    // Top bar
    ctx.fillRect(p.x, 0, BAR_WIDTH, p.top);
    // Bottom bar
    ctx.fillRect(p.x, p.bottom, BAR_WIDTH, canvas.height - p.bottom);

    ctx.shadowBlur = 0; // reset

    // Bolts (relative positions)
    ctx.fillStyle = '#333';
    for (let y of [BOLT_OFFSET, p.top - BOLT_OFFSET]) {
      ctx.beginPath();
      ctx.arc(p.x + BAR_WIDTH / 2, y, BOLT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let y of [p.bottom + BOLT_OFFSET, canvas.height - BOLT_OFFSET]) {
      ctx.beginPath();
      ctx.arc(p.x + BAR_WIDTH / 2, y, BOLT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Sparkles ---
  for (let s of effects) {
    ctx.fillStyle = 'gold';
    ctx.beginPath();
    ctx.arc(s.x, s.y, BIRD_SIZE * 0.028, 0, Math.PI * 2); // 2/72 ≈ 0.028
    ctx.fill();

    s.x += s.vx;
    s.y += s.vy;
    s.life--;
  }
  effects = effects.filter(s => s.life > 0);

  // --- Score Popups ---
  for (let popup of scorePopups) {
    const alpha = popup.life / popup.maxLife; // fade out over time
    ctx.fillStyle = popup.color;
    ctx.globalAlpha = alpha;
    ctx.font = `${Math.floor(BIRD_SIZE * 0.28)}px Arial`; // 20/72 ≈ 0.28
    ctx.textAlign = 'center';
    ctx.fillText(popup.text, popup.x, popup.y);

    // Float upward
    popup.y -= BIRD_SIZE * 0.021; // 1.5/72 ≈ 0.021
    popup.life--;
  }
  scorePopups = scorePopups.filter(p => p.life > 0);
  ctx.globalAlpha = 1; // reset alpha

  // Decrease shock timer
  if (shockTimer > 0) shockTimer--;
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
  bird.vy = FLAP_VELOCITY; // existing lift
  wingVelocity = WING_VELOCITY_RATIO; // boost wing rotation
  playSound('flap'); // Play flap sound effect
}

function endGame() {
  running = false;
  playSound('death'); // Play death sound effect
  const prevTotal = cumulativeScore;
  cumulativeScore += score;
  localStorage.setItem('cumulativeScore', cumulativeScore);

  // Get stored player info
  const playerName = localStorage.getItem('playerName');
  const playerSection = localStorage.getItem('playerSection');
  let bestScore = parseInt(localStorage.getItem('bestScore') || "0", 10);

  // If this run is a personal best, submit automatically
  if (score > bestScore && playerName && playerSection) {
    bestScore = score;
    localStorage.setItem('bestScore', bestScore);

    fetch("submit_score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: playerName,
        section: playerSection,
        score: score,
        skin: currentSkin
      })
    }).then(response => response.json())
      .then(data => {
        // Start celebration system for personal best
        startCelebration(data);
      })
      .catch(err => {
        console.error("Error submitting score:", err);
        // Continue normally if submission fails
        continueEndGame(prevTotal);
      });
  } else {
    // No personal best, continue normally
    continueEndGame(prevTotal);
  }
}

function continueEndGame(prevTotal) {
  showProgressUI();
  showLeaderboardButton();
  showMuteButton(); // show mute button when game ends
  updateProgressDisplay(true, score, prevTotal, () => {
    showMenu();
  });
}

function startCelebration(scoreData) {
  // Hide UI elements during celebration
  hideProgressUI();
  hideLeaderboardButton();
  
  // Show personal best message and play victory sound
  showCelebrationMessage("New personal best!", "#00aaff");
  playSound('victory');
  
  // Wait for victory sound duration, then check for rankings
  setTimeout(() => {
    if (scoreData.is_overall_top5 || scoreData.is_section_top5) {
      // Additional celebration for rankings
      let rankingMessage = "";
      let celebrationSound = "";
      let celebrationDuration = 2000; // default 2 seconds
      
      if (scoreData.is_overall_best) {
        rankingMessage = "YOU ARE #1!";
        celebrationSound = 'grandchampion';
        celebrationDuration = 10000; // 10 seconds for grand champion
      } else if (scoreData.is_overall_top5) {
        rankingMessage = "Top 5 overall!";
        celebrationSound = 'leaderboard';
        celebrationDuration = 2000; // 2 seconds
      } else {
        rankingMessage = "Top 5 in your section!";
        celebrationSound = 'leaderboard';
        celebrationDuration = 2000; // 2 seconds
      }
      
      showCelebrationMessage(rankingMessage, "#FFD700");
      playSound(celebrationSound);
      
      // Wait for celebration duration, then check for secret skins
      setTimeout(() => {
        checkAndShowSecretSkins(scoreData);
      }, celebrationDuration);
    } else {
      // Just personal best, check for secret skins
      setTimeout(() => {
        checkAndShowSecretSkins(scoreData);
      }, 2000);
    }
  }, 2000); // 2 second minimum for personal best celebration
}

function checkAndShowSecretSkins(scoreData) {
  // Hide the congratulatory message first
  hideCelebrationMessage();
  
  const newlyUnlocked = checkSecretSkinUnlocks(scoreData);
  
  if (newlyUnlocked.length > 0) {
    // Wait a moment for the congratulatory message to fade, then show secret skin unlock
    setTimeout(() => {
      showSecretSkinUnlock(newlyUnlocked, 0);
    }, 500);
  } else {
    endCelebration();
  }
}

function showSecretSkinUnlock(unlockedSkins, index) {
  if (index >= unlockedSkins.length) {
    endCelebration();
    return;
  }
  
  const unlock = unlockedSkins[index];
  const skinKey = unlock.key;
  const skin = unlock.skin;
  
  // Show special loot box for secret skin
  showLootBox(() => {
    // Continue to next secret skin or end
    showSecretSkinUnlock(unlockedSkins, index + 1);
  }, skin.unlockMessage, skinKey, skin);
}

function endCelebration() {
  hideCelebrationMessage();
  const prevTotal = cumulativeScore - score; // Recalculate since we already added it
  continueEndGame(prevTotal);
}

function showCelebrationMessage(text, color) {
  // Create or update celebration message
  let celebMsg = document.getElementById('celebration-message');
  if (!celebMsg) {
    celebMsg = document.createElement('div');
    celebMsg.id = 'celebration-message';
    celebMsg.style.position = 'absolute';
    celebMsg.style.top = '40%';
    celebMsg.style.left = '50%';
    celebMsg.style.transform = 'translate(-50%, -50%)';
    celebMsg.style.fontSize = '32px';
    celebMsg.style.fontWeight = 'bold';
    celebMsg.style.textAlign = 'center';
    celebMsg.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    celebMsg.style.zIndex = '1000';
    celebMsg.style.pointerEvents = 'none';
    document.body.appendChild(celebMsg);
  }
  
  celebMsg.textContent = text;
  celebMsg.style.color = color;
  celebMsg.style.display = 'block';
}

function hideCelebrationMessage() {
  const celebMsg = document.getElementById('celebration-message');
  if (celebMsg) {
    celebMsg.style.display = 'none';
  }
}

function showAllSkinsUnlockedMessage(onComplete) {
  // Mark that we've shown this message
  allSkinsUnlockedShown = true;
  localStorage.setItem('allSkinsUnlockedShown', 'true');
  
  // Create completion message
  let completionMsg = document.getElementById('completion-message');
  if (!completionMsg) {
    completionMsg = document.createElement('div');
    completionMsg.id = 'completion-message';
    completionMsg.style.position = 'absolute';
    completionMsg.style.top = '40%';
    completionMsg.style.left = '50%';
    completionMsg.style.transform = 'translate(-50%, -50%)';
    completionMsg.style.fontSize = '30px';
    completionMsg.style.fontWeight = 'bold';
    completionMsg.style.textAlign = 'center';
    completionMsg.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    completionMsg.style.zIndex = '1001';
    completionMsg.style.pointerEvents = 'none';
    document.body.appendChild(completionMsg);
  }
  
  completionMsg.textContent = "ALL SKINS UNLOCKED!";
  completionMsg.style.color = "#FFD700"; // gold color like #1 message
  completionMsg.style.display = 'block';
  
  // Play victory sound for collection completion
  playSound('leaderboard');
  
  let messageShown = false;
  let minTimeElapsed = false;
  
  // Minimum 1 second timer
  setTimeout(() => {
    minTimeElapsed = true;
    if (messageShown) {
      hideCompletionMessage();
      if (onComplete) onComplete();
    }
  }, 1000);
  
  // Click handler
  function handleClick() {
    if (minTimeElapsed) {
      document.removeEventListener('click', handleClick);
      hideCompletionMessage();
      if (onComplete) onComplete();
    } else {
      messageShown = true;
    }
  }
  
  document.addEventListener('click', handleClick);
}

function hideCompletionMessage() {
  const completionMsg = document.getElementById('completion-message');
  if (completionMsg) {
    completionMsg.style.display = 'none';
  }
}

document.querySelector('#skin-menu #start').addEventListener('click', () => {
  if (lootBoxActive) return; // ignore clicks while loot box is open
  playSound('flap'); // Play flap sound when starting the game
  hideMenu();  // hide the menu
  reset();     // start the game
});

// Enhanced input handling for mobile optimization
function handleFlap(e) {
  if (e) e.preventDefault();
  if (running) flap();
}

// Touch events for mobile (no 300ms delay)
canvas.addEventListener('touchstart', handleFlap, { passive: false });
canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

// Click events for desktop/fallback
canvas.addEventListener('click', handleFlap);

// Keyboard events
document.addEventListener('keydown', (e) => { 
  if (e.code === 'Space') { 
    e.preventDefault(); 
    if (running) flap();
  } 
});

// iOS Audio Context fix - resume audio context on first user interaction
let audioContextResumed = false;
function resumeAudioContext() {
  if (!audioContextResumed && typeof webkitAudioContext !== 'undefined') {
    // Try to resume audio context for iOS
    if (audio.music.readyState >= 2) {  // HAVE_ENOUGH_DATA
      audio.music.play().then(() => {
        audio.music.pause();
        audioContextResumed = true;
      }).catch(() => {});
    }
  }
}

document.addEventListener('touchstart', resumeAudioContext, { once: true });
document.addEventListener('click', resumeAudioContext, { once: true });
