// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// === CRT FILTER SYSTEM ===
let crtEnabled = false;
let crtCanvas, gl, crtProgram, crtTexture, positionBuffer;

// === CANVAS UI STATE ===
let canvasProgressBar = { visible: false, progress: 0, message: '' };
let canvasCelebrationMessage = { visible: false, text: '', color: '#fff', startTime: 0 };
let canvasLootBox = { visible: false, message: '', isSecret: false, onComplete: null };

// WebGL Shaders for CRT effect
const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y; // Flip Y coordinate to fix upside-down texture
  gl_Position = vec4(a_position, 0, 1);
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;

varying vec2 v_uv;

void main() {
    vec2 uv = v_uv;

    // --- barrel distortion ---
    vec2 centered = uv - 0.5;
    float r2 = dot(centered, centered);
    centered *= 1.0 + 0.08 * r2; // further reduced distortion factor
    uv = centered + 0.5;

    // --- chromatic aberration ---
    float chroma = 0.003; // further reduced chromatic aberration
    vec3 color;
    color.r = texture2D(u_texture, uv + vec2(chroma,0)).r;
    color.g = texture2D(u_texture, uv).g;
    color.b = texture2D(u_texture, uv - vec2(chroma,0)).b;

    // --- scanlines ---
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.02;
    color -= scanline;

    // --- vignette ---
    float dist = distance(uv, vec2(0.5));
    color *= smoothstep(0.9, 0.6, dist);

    // --- flicker / noise ---
    float noise = (fract(sin(dot(uv* u_resolution.xy , vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.01;
    float flicker = 0.008 * sin(u_time * 8.0);
    color += noise + flicker;

    gl_FragColor = vec4(color,1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
  }
  return program;
}

function resizeCRT() {
  if (!crtCanvas || !gl) return;
  
  // Get exact canvas positioning and size
  const rect = canvas.getBoundingClientRect();
  const canvasStyle = window.getComputedStyle(canvas);
  const width = parseInt(canvasStyle.width);
  const height = parseInt(canvasStyle.height);
  
  // Only resize if dimensions actually changed
  if (crtCanvas.width !== width || crtCanvas.height !== height) {
    crtCanvas.width = width;
    crtCanvas.height = height;
    crtCanvas.style.width = width + 'px';
    crtCanvas.style.height = height + 'px';
    
    gl.viewport(0, 0, width, height);
  }
  
  // Ensure exact positioning on top of game canvas
  crtCanvas.style.left = rect.left + 'px';
  crtCanvas.style.top = rect.top + 'px';
}

function initCRTFilter() {
  try {
    // Create WebGL CRT overlay canvas
    crtCanvas = document.createElement('canvas');
    crtCanvas.id = 'crt-webgl';
    crtCanvas.style.position = 'fixed';
    crtCanvas.style.left = '0';
    crtCanvas.style.top = '0';
    crtCanvas.style.pointerEvents = 'none';
    crtCanvas.style.zIndex = '10000';
    
    gl = crtCanvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported, CRT filter disabled');
      return false;
    }
    
    // Setup resize handler
    window.addEventListener('resize', resizeCRT);
    resizeCRT();
    
    // Create shader program
    crtProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    
    // Fullscreen quad
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 1,-1, -1,1,
      -1,1, 1,-1, 1,1
    ]), gl.STATIC_DRAW);
    
    // Texture setup
    crtTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, crtTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return true;
  } catch (error) {
    console.warn('CRT filter initialization failed:', error);
    return false;
  }
}

function drawCRTWebGL(time) {
  if (!crtEnabled || !gl || !crtProgram) return;
  
  // Ensure CRT canvas stays synchronized with game canvas
  resizeCRT();
  
  gl.bindTexture(gl.TEXTURE_2D, crtTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

  gl.useProgram(crtProgram);

  // bind position
  const posLoc = gl.getAttribLocation(crtProgram, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // uniforms
  gl.uniform1f(gl.getUniformLocation(crtProgram, 'u_time'), time * 0.001);
  gl.uniform2f(gl.getUniformLocation(crtProgram, 'u_resolution'), crtCanvas.width, crtCanvas.height);
  gl.uniform1i(gl.getUniformLocation(crtProgram, 'u_texture'), 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function applyStaticCRTFilter() {
  // Helper function to apply CRT filter to static content
  if (crtEnabled) {
    // Use setTimeout to ensure canvas has finished drawing
    setTimeout(() => {
      drawCRTWebGL(performance.now());
    }, 0);
  }
}

// Enhanced drawCanvasUI wrapper that applies CRT filter
function drawCanvasUIWithCRT() {
  drawCanvasUI();
  applyStaticCRTFilter();
}

function toggleCRTFilter() {
  crtEnabled = !crtEnabled;
  
  if (crtEnabled) {
    if (!crtCanvas) {
      if (!initCRTFilter()) {
        crtEnabled = false;
        return false;
      }
    }
    
    // Insert WebGL canvas after the 2D canvas
    canvas.parentNode.insertBefore(crtCanvas, canvas.nextSibling);
    crtCanvas.style.display = 'block';
    
    // Apply filter to current content
    applyStaticCRTFilter();
  } else {
    if (crtCanvas) {
      crtCanvas.style.display = 'none';
    }
  }
  
  return crtEnabled;
}

// === FIXED HIGH-RESOLUTION RENDERING SYSTEM ===
// Game renders at fixed high resolution, CSS handles scaling to display size
const GAME_WIDTH = 1200;  // Fixed high-resolution width
const GAME_HEIGHT = 1800; // Fixed high-resolution height (maintains 2:3 aspect ratio)

function updateCanvasSize() {
  // Use visual viewport if available (better for mobile with virtual keyboards)
  const viewport = window.visualViewport || window;
  const viewportWidth = viewport.width || window.innerWidth;
  const viewportHeight = viewport.height || window.innerHeight;
  
  // Get the CSS-computed display size, but ensure we're using full viewport
  const rect = canvas.getBoundingClientRect();
  
  // Canvas internal resolution is always fixed at high resolution
  canvas.width = GAME_WIDTH;  // This clears the canvas!
  canvas.height = GAME_HEIGHT;
  
  // For canvas sizing, recalculate based on current viewport to avoid keyboard issues
  // Use the same responsive logic as CSS but with current viewport dimensions
  let displayWidth, displayHeight;
  
  if (viewportWidth <= 480) {
    // Mobile phones - use most of the screen but be conservative
    displayWidth = Math.min(viewportWidth * 0.9, 400);
    displayHeight = Math.min(displayWidth * 1.5, 600, viewportHeight * 0.8);
  } else {
    displayWidth = rect.width;
    displayHeight = rect.height;
  }
  
  // CSS handles all the scaling from internal resolution to display size
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  
  // Auto-redraw background if we're in menu mode (not running the game)
  if (typeof running !== 'undefined' && !running && typeof drawStaticBackground === 'function') {
    setTimeout(() => {
      drawStaticBackground();
      drawCanvasUI();
      applyStaticCRTFilter();
    }, 0);
  }
  
  return { width: displayWidth, height: displayHeight };
}

// Canvas will be properly sized after login is complete
// Set up internal resolution without sizing display yet
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Enable high-quality rendering for crisp graphics
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
ctx.textBaseline = 'top';
ctx.textAlign = 'left';

// Update canvas size on window resize (only after login is complete)
window.addEventListener('resize', () => {
  if (!isLoginComplete) return; // Don't resize until login is finished
  
  const newDisplaySize = updateCanvasSize();
  
  // Restore rendering settings after resize
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
});

// Handle mobile keyboard appearance/disappearance with visual viewport API
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (!isLoginComplete) return; // Don't resize until login is finished
    
    // Debounce viewport changes to avoid excessive updates
    clearTimeout(window.viewportResizeTimeout);
    window.viewportResizeTimeout = setTimeout(() => {
      const newDisplaySize = updateCanvasSize();
      
      // Restore rendering settings after resize
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
    }, 100);
  });
}

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
let isLoginComplete = false; // Track if login/initialization is finished

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

// Canvas skin preview animation variables
let skinPreviewAnimation = {
  active: false,
  startTime: 0,
  duration: 300, // 300ms total animation
  jumpHeight: 15 // pixels to jump up
};



// --- WEB AUDIO API SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};
const soundVolumes = {
  music: 0.05,    
  flap: 0.15,     
  death: 0.8,
  sparkle: 0.4,
  victory: 0.45,
  leaderboard: 0.6,
  grandchampion: 0.8
};

// Music handling - still use HTML5 Audio for background music loop
const musicAudio = new Audio('static/assets/audio/music.wav');
musicAudio.loop = true;
musicAudio.volume = soundVolumes.music;

// Mute state
let audioMuted = localStorage.getItem('audioMuted') === 'true' || false;

// Load sound into Web Audio API
async function loadSound(name, url) {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    sounds[name] = await audioCtx.decodeAudioData(arrayBuffer);
    console.log(`Loaded sound: ${name}`);
  } catch (err) {
    console.log(`Failed to load sound ${name}:`, err);
  }
}

// Initialize all sounds
async function initAudio() {
  const soundFiles = [
    ['flap', 'static/assets/audio/flap.wav'],
    ['death', 'static/assets/audio/death.wav'],
    ['sparkle', 'static/assets/audio/sparkle.wav'],
    ['victory', 'static/assets/audio/victory.wav'],
    ['leaderboard', 'static/assets/audio/leaderboard.wav'],
    ['grandchampion', 'static/assets/audio/grandchampion.wav']
  ];
  
  // Load all sounds in parallel
  await Promise.all(soundFiles.map(([name, url]) => loadSound(name, url)));
  console.log('All sounds loaded');
}

// Play sound using Web Audio API
function playSound(soundName) {
  if (audioMuted) return; // Skip if muted
  
  // Special handling for music
  if (soundName === 'music') {
    musicAudio.play().catch(err => console.log('Music play failed:', err));
    return;
  }
  
  // Web Audio API for all other sounds
  if (!sounds[soundName]) {
    console.log(`Sound ${soundName} not loaded yet`);
    return;
  }
  
  try {
    // Resume audio context if needed (required for user interaction)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Create buffer source and gain node for volume control
    const source = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    
    source.buffer = sounds[soundName];
    gainNode.gain.value = soundVolumes[soundName] || 0.5;
    
    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Play immediately - no lag!
    source.start(0);
  } catch (err) {
    console.log(`Web Audio play failed for ${soundName}:`, err);
  }
}

// Sparkle loop control
let sparkleLoopInterval = null;

function loopSound(soundName) {
  if (audioMuted) return; // Skip if muted
  
  if (soundName === 'music') {
    musicAudio.loop = true;
    musicAudio.play().catch(err => console.log('Music loop failed:', err));
  } else if (soundName === 'sparkle') {
    // Start sparkle loop using Web Audio API
    if (!sparkleLoopInterval) {
      playSound('sparkle'); // Play immediately
      sparkleLoopInterval = setInterval(() => {
        if (!audioMuted) {
          playSound('sparkle');
        }
      }, 600); // Play every 600ms for a nice sparkle effect
    }
  }
}

// Initialize audio system
initAudio();

function stopSound(soundName) {
  // For music, stop the HTML5 audio element
  if (soundName === 'music') {
    musicAudio.pause();
    musicAudio.currentTime = 0;
    return;
  }
  
  // For sparkle loop, clear the interval
  if (soundName === 'sparkle' && sparkleLoopInterval) {
    clearInterval(sparkleLoopInterval);
    sparkleLoopInterval = null;
    console.log('Sparkle loop stopped');
    return;
  }
  
  // For other Web Audio API sounds, they auto-cleanup
  console.log(`Stop requested for ${soundName} - Web Audio sources auto-cleanup`);
}

// Mute/unmute functionality
function toggleMute() {
  audioMuted = !audioMuted;
  localStorage.setItem('audioMuted', audioMuted.toString());
  
  if (audioMuted) {
    // Stop music when muting
    musicAudio.pause();
  } else {
    // Resume background music when unmuting
    musicAudio.play().catch(err => console.log('Music resume failed:', err));
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
    musicAudio.play().catch(err => {
      console.log('Background music blocked by browser - will start on first user interaction');
    });
  }
});

// Ensure music starts on first user interaction if blocked initially
let musicStarted = false;
document.addEventListener('click', () => {
  if (!musicStarted && !audioMuted) {
    musicAudio.play().catch(err => console.log('Music start failed:', err));
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
  
  // Restore canvas sizing and rendering settings after reset
  updateCanvasSize();
  
  // Restore rendering settings that may have been lost
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
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
    
    // Initialize canvas properly when starting game with stored credentials
    // No keyboard delay needed here since no input fields were active
    requestAnimationFrame(() => {
      // Force reflow to ensure overlay is completely removed
      overlay.offsetHeight;
      
      // Now properly size the canvas for gameplay
      updateCanvasSize();
      
      // Mark login as complete to enable resize handling
      isLoginComplete = true;
      
      // Restore rendering settings after canvas is properly sized
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      
      // Redraw background since updateCanvasSize() clears the canvas
      drawStaticBackground();
      
      // Draw background now that canvas is properly configured
      drawStaticBackground();
      
      // Explicitly draw canvas UI after login completion
      setTimeout(() => {
        drawCanvasUI();
      }, 100);
    });
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

  const loginOverlay = document.getElementById("login-overlay");
  
  // Show loading state instead of hiding overlay immediately
  loginOverlay.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;">
      <div style="font-size: 24px; font-weight: bold; color: white;">Loading Game...</div>
      <div style="width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  // Wait for mobile keyboard to disappear and DOM to settle before sizing canvas
  setTimeout(() => {
    // Force reflow to ensure keyboard is gone
    loginOverlay.offsetHeight;
    
    // Additional wait to ensure mobile keyboard has fully retracted
    setTimeout(() => {
      // Now hide the overlay completely
      loginOverlay.style.display = "none";
      
      // Now that login is complete and keyboard is gone, properly size the canvas
      updateCanvasSize();
      
      // Mark login as complete to enable resize handling
      isLoginComplete = true;
      
      // Restore rendering settings after canvas is properly sized
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      
      // Draw background now that canvas is properly configured
      drawStaticBackground();
      
      // Additional fallback since this is where the issue occurs on mobile
      setTimeout(() => {
        drawStaticBackground();
        
        // Explicitly draw canvas UI after login completion
        drawCanvasUI();
      }, 50);
    }, 300); // Additional delay for keyboard retraction
  }, 100); // Initial delay for overlay removal
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
const RUN_SCORE_MILESTONES = [100, 200, 400, 800, 900, 1000, 2000, 4000, 8000, 16000];   // first-time single-run milestones
const CUMULATIVE_SCORE_STEP = 250;           // every 200 cumulative points

// --- SKIN SYSTEM ---
// Define available skins (add more as needed)
let lootBoxActive = false;
let postGameSequenceActive = false;
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
  
  // Redraw canvas background and UI if in menu mode
  if (!running) {
    drawStaticBackground();
    drawCanvasUI();
  }
}

function animateSkinPreview() {
  // Start canvas-based skin preview animation
  skinPreviewAnimation.active = true;
  skinPreviewAnimation.startTime = performance.now();
  
  // Start animation loop if not already running
  if (!window.skinAnimationId) {
    animateSkinPreviewLoop();
  }
}

function animateSkinPreviewLoop() {
  const currentTime = performance.now();
  const elapsed = currentTime - skinPreviewAnimation.startTime;
  
  if (skinPreviewAnimation.active && elapsed < skinPreviewAnimation.duration) {
    // Continue animation
    drawStaticBackground();
    drawCanvasUI();
    applyStaticCRTFilter(); // Apply CRT filter during animation
    
    window.skinAnimationId = requestAnimationFrame(animateSkinPreviewLoop);
  } else {
    // Animation finished
    skinPreviewAnimation.active = false;
    window.skinAnimationId = null;
    
    // Final redraw to ensure clean state
    drawStaticBackground();
    drawCanvasUI();
  }
}

function getSkinPreviewAnimationOffset() {
  if (!skinPreviewAnimation.active) return 0;
  
  const elapsed = performance.now() - skinPreviewAnimation.startTime;
  const progress = Math.min(elapsed / skinPreviewAnimation.duration, 1);
  
  // Eased jump animation: up quickly, then down
  let animationValue;
  if (progress < 0.5) {
    // First half: jump up (ease-out)
    const t = progress * 2;
    animationValue = skinPreviewAnimation.jumpHeight * (1 - (1 - t) * (1 - t));
  } else {
    // Second half: fall down (ease-in)
    const t = (progress - 0.5) * 2;
    animationValue = skinPreviewAnimation.jumpHeight * (1 - t * t);
  }
  
  return -animationValue; // Negative because we're moving up
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
  postGameSequenceActive = false; // Post-game sequence complete, allow skin menu
  const menu = document.getElementById('skin-menu');
  if (menu) menu.style.display = 'block'; // Keep for state detection
  updateSkinDisplay();
  
  // Show leaderboard button now that player can interact
  showLeaderboardButton();
  
  // Draw background
  drawStaticBackground();
  
  // Draw canvas UI elements (leaderboard button and skin menu)
  drawCanvasUI();
}

function hideMenu() {
  const menu = document.getElementById('skin-menu');
  if (menu) menu.style.display = 'none';
}

window.addEventListener('load', () => {
  // Initialize CRT filter system
  initCRTFilter();
  
  showMenu();  // show the skin selection menu at the very start
});

// --- PROGRESS BAR UI (safe, non-breaking) ---
// Old HTML progress bar variables removed - now using canvas-based UI

function createProgressUI() {
  // Canvas-based progress bar - no HTML elements needed
  canvasProgressBar.visible = true;
  canvasProgressBar.progress = 0;
  canvasProgressBar.message = 'Submitting score...';
}

// Canvas-based progress UI - no DOM setup needed

function triggerBarFlash(onComplete) {
  // Canvas-based flash effect - could add a flash animation to the canvas progress bar
  // For now, just call the completion callback
  if (onComplete) onComplete();
}


// Canvas-based progress particles (removed HTML version)

// Canvas-based progress burst effect
function spawnProgressBurstAtBar() {
  // Canvas-based burst effect - could add particle effects to canvas
  // For now, this is a placeholder function
}

function spawnTinyProgressParticle() {
  // Small progress particle effect - placeholder function
  // Could add canvas-based particle effects here if desired
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
  // If all skins are unlocked, show golden completed bar without animation
  if (allSkinsUnlockedShown) {
    canvasProgressBar.progress = 100;
    canvasProgressBar.message = "COLLECTION COMPLETE!";
    if (!running) {
      draw(); // Draw complete game state
      drawCanvasUIWithCRT();
    }
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
    
    canvasProgressBar.progress = percent;
    canvasProgressBar.message = `${progress} / ${milestoneRange}`;
    if (!running) {
      draw(); // Draw complete game state  
      drawCanvasUIWithCRT();
    }
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
      // Stop animation if progressAnimating was set to false externally
      if (!progressAnimating) {
        stopSound('sparkle');
        if (onComplete) onComplete(); // Call the callback to continue the game flow
        return;
      }
      
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
      
      canvasProgressBar.progress = percent;
      canvasProgressBar.message = `${Math.floor(progress)} / ${milestoneRange}`;
      
      // Refresh canvas display with full game state
      if (!running) {
        draw(); // Draw complete game state (bird, pipes, score, etc.)
        drawCanvasUIWithCRT();
      }

      if (Math.random() < 0.6) spawnTinyProgressParticle();

      if (nextCumulativeIndex < cumulativeMilestones.length &&
          currentTotal >= cumulativeMilestones[nextCumulativeIndex]) {
        try {
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
        } catch (error) {
          console.error('Milestone handling error:', error);
          // Continue animation if there's an error
          nextCumulativeIndex++;
          requestAnimationFrame(frame);
        }
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
  canvasProgressBar.visible = true;
  canvasProgressBar.progress = 0;
  canvasProgressBar.message = 'Submitting score...';
  
  // Redraw canvas to show progress bar
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
  }
}

function hideProgressUI() {
  canvasProgressBar.visible = false;
  
  // Redraw canvas to hide progress bar
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
  }
}

function showLeaderboardButton() {
  // Leaderboard button now drawn on canvas
}

function hideLeaderboardButton() {
  // Leaderboard button now drawn on canvas
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
  try {
    lootBoxActive = true;
    
    // Canvas-based loot box
    canvasLootBox.visible = true;
    canvasLootBox.message = message;
    canvasLootBox.isSecret = secretSkinKey && secretSkinData;
    canvasLootBox.onComplete = onComplete;
    canvasLootBox.secretSkinKey = secretSkinKey;
    canvasLootBox.secretSkinData = secretSkinData;
    canvasLootBox.clicked = false;

    // Refresh canvas display
    if (!running) {
      drawStaticBackground();
      drawCanvasUIWithCRT();
    }
  } catch (error) {
    console.error('Loot box display error:', error);
    // Fallback: call completion callback to prevent game freeze
    lootBoxActive = false;
    if (onComplete) onComplete();
  }
}



// --- GAME LOGIC ---

function reset() {
  if (progressAnimating) return; // block new game until animation finishes
  
  // Reset milestone processing flag (in case user reset their data)
  milestoneProcessingActive = true;
  
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
  
  // Reset audio states to prevent carryover issues from previous game
  // Web Audio API sounds auto-cleanup, just ensure music keeps playing
  // No reset needed for Web Audio API sounds as they're one-shot
  
  running = true;
  postGameSequenceActive = false; // Reset post-game sequence flag for new game

  hideProgressUI(); // <--- hide bar while running
  hideLeaderboardButton(); // hide leaderboard button while playing
  hideMuteButton(); // hide mute button during gameplay
  hideMenu(); // hide skin selection menu when starting game

  // start game loop
  lastTime = 0;
  requestAnimationFrame(loop)
  // Score now drawn on canvas
}


// ---------------------------
// Small helper used for popups / loot box callbacks
// Replace the body later with your modal/lootbox flow; it must call onDone() when finished.
// For now it uses alert() so behavior is synchronous/blocking (keeps sequencing simple).
// ---------------------------
let milestoneProcessingActive = true; // Flag to control milestone processing

function handleMilestoneMessage(message, onDone) {
  // Skip milestone messages if collection is complete
  if (!milestoneProcessingActive) {
    if (onDone) onDone();
    return;
  }
  showLootBox(onDone, message); // pass the message here
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
      x: x + (Math.random() * BIRD_SIZE/4 - BIRD_SIZE/8), // ±BIRD_SIZE/8 horizontal
      y: y - BIRD_SIZE/6 + (Math.random() * BIRD_SIZE/6 - BIRD_SIZE/12), // above center
      vx: (Math.random() - 0.5) * (BIRD_SIZE * 0.083), // Scale velocity with bird size (6/72 ≈ 0.083)
      vy: (Math.random() - 0.5) * (BIRD_SIZE * 0.083), // Scale velocity with bird size
      life: 30,
      size: BIRD_SIZE * 0.055 // Scale size with bird size (4/72 ≈ 0.055)
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
        // Score now drawn on canvas
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
      ctx.shadowBlur = 40;
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
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); // Use the size from the sparkle object
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
  
  // Draw UI elements on canvas
  drawCanvasUI();
}

// Canvas UI drawing function
function drawCanvasUI() {
  // Check what UI elements should be shown
  const completionMsg = document.getElementById('completion-message');
  const freezeFrameMsg = document.getElementById('freeze-frame-message');
  const showCompletionMsg = completionMsg && completionMsg.style.display !== 'none';
  const showFreezeFrame = freezeFrameMsg && document.body.contains(freezeFrameMsg);
  
  // Show canvas skin menu only when login complete, game not running, and no post-game sequence active
  const showSkinMenu = isLoginComplete && !running && !postGameSequenceActive && !lootBoxActive && !showCompletionMsg && !showFreezeFrame;
  
  // Show score during game, completion message, or freeze frame
  const showScore = running || showCompletionMsg || showFreezeFrame;
  
  // Show leaderboard button ONLY during skin menu (not during game)
  const showLeaderboard = showSkinMenu;
  
  if (!showScore && !showLeaderboard) return;
  
  ctx.save();
  
  // Draw score (top left) if appropriate
  if (showScore) {
    ctx.fillStyle = '#fff';
    ctx.font = `${BIRD_SIZE * 0.25}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${score}`, BIRD_SIZE * 0.15, BIRD_SIZE * 0.4);
  }
  
  // Draw leaderboard button (top right) if appropriate
  if (showLeaderboard) {
    const buttonText = 'Leaderboard';
    const buttonPadding = BIRD_SIZE * 0.15;
    const buttonHeight = BIRD_SIZE * 0.4;
    
    // Measure text to size button
    ctx.font = `${BIRD_SIZE * 0.2}px Arial`;
    const textMetrics = ctx.measureText(buttonText);
    const buttonWidth = textMetrics.width + buttonPadding * 2;
    
    // Button position (top right)
    const buttonX = canvas.width - buttonWidth - BIRD_SIZE * 0.15;
    const buttonY = BIRD_SIZE * 0.15;
    
    // Store button bounds for click detection
    window.leaderboardButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
    
    // Draw button background
    ctx.fillStyle = '#fff8d6';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Draw button text (perfectly centered)
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const leaderboardMetrics = ctx.measureText(buttonText);
    const leaderboardTextHeight = leaderboardMetrics.actualBoundingBoxAscent + leaderboardMetrics.actualBoundingBoxDescent;
    ctx.fillText(buttonText, buttonX + buttonWidth/2, buttonY + buttonHeight/2 + leaderboardTextHeight/2);
  } else {
    // Clear button bounds when not visible
    window.leaderboardButtonBounds = null;
  }
  
  // Draw skin menu if visible
  if (showSkinMenu) {
    drawCanvasSkinMenu();
  } else {
    // Clear skin menu button bounds when not visible
    window.skinLeftButtonBounds = null;
    window.skinRightButtonBounds = null;
    window.skinPlayButtonBounds = null;
    window.crtToggleButtonBounds = null;
    window.crtScanlineMinusButtonBounds = null;
    window.crtScanlinePlusButtonBounds = null;
  }
  
  // Draw canvas-based UI elements
  drawCanvasProgressBar();
  drawCanvasCelebrationMessage();
  drawCanvasLootBox();
  
  ctx.restore();
}

// Canvas-based UI element drawing functions
function drawCanvasProgressBar() {
  if (!canvasProgressBar.visible) return;
  
  const centerX = canvas.width / 2;
  const barWidth = BIRD_SIZE * 3;
  const barHeight = BIRD_SIZE * 0.3;
  const barX = centerX - barWidth / 2;
  const barY = BIRD_SIZE * 1.5;
  
  // Progress bar background
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  
  // Progress bar fill
  const fillWidth = (canvasProgressBar.progress / 100) * barWidth;
  ctx.fillStyle = '#00aaff';
  ctx.fillRect(barX, barY, fillWidth, barHeight);
  
  // Progress bar border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Progress message
  ctx.fillStyle = '#fff';
  ctx.font = `${BIRD_SIZE * 0.2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(canvasProgressBar.message, centerX, barY + barHeight + BIRD_SIZE * 0.1);
}

function drawCanvasCelebrationMessage() {
  if (!canvasCelebrationMessage.visible) return;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height * 0.4;
  
  // Add pulsing effect
  const elapsed = performance.now() - canvasCelebrationMessage.startTime;
  const pulseScale = 1 + 0.1 * Math.sin(elapsed * 0.01);
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(pulseScale, pulseScale);
  
  // Message text
  ctx.fillStyle = canvasCelebrationMessage.color;
  ctx.font = `bold ${BIRD_SIZE * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(canvasCelebrationMessage.text, 0, 0);
  ctx.fillText(canvasCelebrationMessage.text, 0, 0);
  
  ctx.restore();
}

function drawCanvasLootBox() {
  if (!canvasLootBox.visible) return;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const boxSize = BIRD_SIZE * 1.5;
  
  // Loot box background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Loot box container
  const boxX = centerX - boxSize / 2;
  const boxY = centerY - boxSize / 2;
  
  // Box background
  ctx.fillStyle = canvasLootBox.isSecret ? '#1a237e' : '#bf6900';
  ctx.fillRect(boxX, boxY, boxSize, boxSize);
  
  // Box border
  ctx.strokeStyle = canvasLootBox.isSecret ? '#3f51b5' : '#ff9800';
  ctx.lineWidth = 4;
  ctx.strokeRect(boxX, boxY, boxSize, boxSize);
  
  // Box shine effect
  const gradient = ctx.createLinearGradient(boxX, boxY, boxX + boxSize, boxY + boxSize);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(boxX, boxY, boxSize, boxSize);
  
  // Message above box
  if (canvasLootBox.message) {
    ctx.fillStyle = canvasLootBox.isSecret ? '#00aaff' : '#ffd700';
    ctx.font = `${BIRD_SIZE * 0.25}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(canvasLootBox.message, centerX, boxY - BIRD_SIZE * 0.2);
    ctx.fillText(canvasLootBox.message, centerX, boxY - BIRD_SIZE * 0.2);
  }
  
  // Click to open text
  ctx.fillStyle = '#fff';
  ctx.font = `${BIRD_SIZE * 0.2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeText('Click to open!', centerX, boxY + boxSize + BIRD_SIZE * 0.2);
  ctx.fillText('Click to open!', centerX, boxY + boxSize + BIRD_SIZE * 0.2);
  
  // Store click bounds for loot box
  window.lootBoxBounds = {
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize
  };
}

// Canvas-based skin menu drawing
function drawCanvasSkinMenu() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // No background overlay - keep the game background visible
  
  // Check if arrows should be shown (only if more than 1 skin unlocked)
  const showArrows = unlockedSkins.length > 1;
  
  if (showArrows) {
    // Arrow button size
    const arrowSize = BIRD_SIZE * 0.8;
    const arrowSpacing = BIRD_SIZE * 2; // Reduced from 3 to 2
    
    // Left arrow button
    const leftArrowX = centerX - arrowSpacing;
    const leftArrowY = centerY - arrowSize/2;
    
    // Store button bounds for click detection
    window.skinLeftButtonBounds = {
      x: leftArrowX,
      y: leftArrowY,
      width: arrowSize,
      height: arrowSize
    };
    
    // Draw left arrow background
    ctx.fillStyle = '#444';
    ctx.fillRect(leftArrowX, leftArrowY, arrowSize, arrowSize);
    
    // Draw left arrow text (perfectly centered)
    ctx.fillStyle = '#fff';
    ctx.font = `${BIRD_SIZE * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Get text metrics for perfect centering
    const metrics = ctx.measureText('◀');
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    ctx.fillText('◀', leftArrowX + arrowSize/2, leftArrowY + arrowSize/2 + textHeight/2);
    
    // Right arrow button
    const rightArrowX = centerX + arrowSpacing - arrowSize;
    const rightArrowY = centerY - arrowSize/2;
    
    window.skinRightButtonBounds = {
      x: rightArrowX,
      y: rightArrowY,
      width: arrowSize,
      height: arrowSize
    };
    
    // Draw right arrow background
    ctx.fillStyle = '#444';
    ctx.fillRect(rightArrowX, rightArrowY, arrowSize, arrowSize);
    
    // Draw right arrow text (perfectly centered)
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('▶', rightArrowX + arrowSize/2, rightArrowY + arrowSize/2 + textHeight/2);
  } else {
    // Clear button bounds when arrows are not shown
    window.skinLeftButtonBounds = null;
    window.skinRightButtonBounds = null;
  }
  
  // Current skin display (center circle) - made larger
  const skinDisplaySize = BIRD_SIZE * 1.8; // Increased from 1.2 to 1.8
  const animationOffset = getSkinPreviewAnimationOffset();
  const animatedCenterY = centerY + animationOffset;
  const skinDisplayX = centerX - skinDisplaySize/2;
  const skinDisplayY = animatedCenterY - skinDisplaySize/2;
  
  // Draw skin display background (circle) with animation
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(centerX, animatedCenterY, skinDisplaySize/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw current skin preview (using actual skin images) with animation
  if (currentSkin && getAllSkinsData()[currentSkin] && typeof createSkinPreview === 'function') {
    // Store the preview image if not already stored
    if (!window.cachedSkinPreview || window.cachedSkinPreview.skinKey !== currentSkin) {
      const previewURL = createSkinPreview(currentSkin);
      const img = new Image();
      img.onload = () => {
        window.cachedSkinPreview = { skinKey: currentSkin, image: img };
        // Redraw to show the loaded image
        drawStaticBackground();
        drawCanvasUI();
      };
      img.src = previewURL;
    }
    
    // Draw the cached preview image if available (with animation offset)
    if (window.cachedSkinPreview && window.cachedSkinPreview.skinKey === currentSkin && window.cachedSkinPreview.image) {
      const img = window.cachedSkinPreview.image;
      const imgSize = skinDisplaySize * 0.8; // Make it slightly smaller than the circle
      ctx.drawImage(img, centerX - imgSize/2, animatedCenterY - imgSize/2, imgSize, imgSize);
    }
  }
  
  // Skin name below the preview (also animated)
  ctx.fillStyle = '#fff';
  ctx.font = `${BIRD_SIZE * 0.3}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top'; // Reset to top for skin name
  if (currentSkin && getAllSkinsData()[currentSkin]) {
    ctx.fillText(getAllSkinsData()[currentSkin].name, centerX, animatedCenterY + skinDisplaySize/2 + BIRD_SIZE * 0.6);
  }
  
  // Play button
  const playButtonWidth = BIRD_SIZE * 2.5;
  const playButtonHeight = BIRD_SIZE * 0.8;
  const playButtonX = centerX - playButtonWidth/2;
  const playButtonY = centerY + skinDisplaySize/2 + BIRD_SIZE * 1.2;
  
  window.skinPlayButtonBounds = {
    x: playButtonX,
    y: playButtonY,
    width: playButtonWidth,
    height: playButtonHeight
  };
  
  // Draw play button background
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(playButtonX, playButtonY, playButtonWidth, playButtonHeight);
  
  // Draw play button text (perfectly centered)
  ctx.fillStyle = '#fff';
  ctx.font = `${BIRD_SIZE * 0.35}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const playMetrics = ctx.measureText('PLAY');
  const playTextHeight = playMetrics.actualBoundingBoxAscent + playMetrics.actualBoundingBoxDescent;
  ctx.fillText('PLAY', centerX, playButtonY + playButtonHeight/2 + playTextHeight/2);
  
  // CRT Filter Controls
  const crtButtonWidth = BIRD_SIZE * 2;
  const crtButtonHeight = BIRD_SIZE * 0.6;
  const crtButtonY = playButtonY + playButtonHeight + BIRD_SIZE * 0.5;
  
  // CRT Toggle Button
  const crtToggleX = centerX - crtButtonWidth/2;
  
  window.crtToggleButtonBounds = {
    x: crtToggleX,
    y: crtButtonY,
    width: crtButtonWidth,
    height: crtButtonHeight
  };
  
  // Draw CRT toggle button
  ctx.fillStyle = crtEnabled ? '#2196F3' : '#666';
  ctx.fillRect(crtToggleX, crtButtonY, crtButtonWidth, crtButtonHeight);
  
  // Draw CRT toggle text
  ctx.fillStyle = '#fff';
  ctx.font = `${BIRD_SIZE * 0.25}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const crtMetrics = ctx.measureText('CRT FILTER');
  const crtTextHeight = crtMetrics.actualBoundingBoxAscent + crtMetrics.actualBoundingBoxDescent;
  ctx.fillText('CRT FILTER', centerX, crtButtonY + crtButtonHeight/2 + crtTextHeight/2);
}



function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 16.67;
  lastTime = timestamp;
  
  update(dt);
  draw();
  
  // Apply CRT filter if enabled
  if (crtEnabled) {
    drawCRTWebGL(timestamp);
  }
  
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
  postGameSequenceActive = true; // Prevent skin menu during post-game sequence
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
  showMuteButton(); // show mute button when game ends
  updateProgressDisplay(true, score, prevTotal, () => {
    showFreezeFrame(() => {
      showMenu();
    });
  });
}

function showFreezeFrame(onContinue) {
  // Create subtle click to continue message without overlay
  const message = document.createElement('div');
  message.id = 'freeze-frame-message';
  message.style.position = 'fixed';
  message.style.bottom = '20px';
  message.style.left = '50%';
  message.style.transform = 'translateX(-50%)';
  message.style.color = 'white';
  message.style.fontSize = '18px';
  message.style.fontWeight = 'bold';
  message.style.textAlign = 'center';
  message.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  message.style.background = 'rgba(0, 0, 0, 0.6)';
  message.style.padding = '12px 20px';
  message.style.borderRadius = '8px';
  message.style.border = '2px solid rgba(255, 255, 255, 0.3)';
  message.style.zIndex = '10002';
  message.style.cursor = 'pointer';
  message.style.animation = 'pulse 2s infinite';
  message.textContent = 'Press to continue...';
  
  // Add pulsing animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(message);
  
  // Redraw canvas to show score during freeze frame
  setTimeout(() => {
    drawCanvasUI();
  }, 0);
  
  // Declare event handler functions at top level for proper cleanup
  function handleScreenInteraction(e) {
    e.preventDefault();
    cleanupAndContinue();
  }
  
  function handleKeyPress(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      cleanupAndContinue();
    }
  }
  
  // Centralized cleanup and continue function
  function cleanupAndContinue() {
    // Remove all event listeners
    document.removeEventListener('click', handleScreenInteraction);
    document.removeEventListener('touchstart', handleScreenInteraction);
    document.removeEventListener('keydown', handleKeyPress);
    message.removeEventListener('click', cleanupAndContinue);
    
    // Remove DOM elements
    message.remove();
    style.remove();
    
    // Continue to next step
    if (onContinue) onContinue();
  }
  
  // Add click listener to message
  message.addEventListener('click', cleanupAndContinue);
  
  // Add keyboard listener immediately
  document.addEventListener('keydown', handleKeyPress);
  
  // Add screen interaction listeners with delay to avoid immediate triggering
  setTimeout(() => {
    document.addEventListener('click', handleScreenInteraction);
    document.addEventListener('touchstart', handleScreenInteraction, { passive: false });
  }, 200);
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
  // Canvas-based celebration message
  canvasCelebrationMessage.visible = true;
  canvasCelebrationMessage.text = text;
  canvasCelebrationMessage.color = color;
  canvasCelebrationMessage.startTime = performance.now();
  
  // Redraw canvas to show message
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
  }
}

function hideCelebrationMessage() {
  canvasCelebrationMessage.visible = false;
  
  // Redraw canvas to hide message
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
  }
}

function showAllSkinsUnlockedMessage(onComplete) {
  // Mark that we've shown this message
  allSkinsUnlockedShown = true;
  localStorage.setItem('allSkinsUnlockedShown', 'true');
  
  // Stop any ongoing progress animation immediately
  progressAnimating = false;
  
  // Stop any queued milestone messages/loot boxes
  milestoneProcessingActive = false;
  
  // Stop sparkle sound if it's playing
  stopSound('sparkle');
  
  // Immediately update progress bar to completed state
  canvasProgressBar.progress = 100;
  canvasProgressBar.message = "COLLECTION COMPLETE!";
  
  // Show canvas-based completion message
  canvasCelebrationMessage.visible = true;
  canvasCelebrationMessage.text = "ALL SKINS UNLOCKED!";
  canvasCelebrationMessage.color = "#FFD700";
  
  // Refresh canvas display
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
  }
  
  // Play victory sound for collection completion
  playSound('leaderboard');
  
  let messageShown = false;
  let minTimeElapsed = false;
  
  // Minimum 1 second timer
  setTimeout(() => {
    minTimeElapsed = true;
    if (messageShown) {
      hideCanvasCompletionMessage();
      if (onComplete) onComplete();
    }
  }, 1000);
  
  // Click handler
  function handleClick() {
    if (minTimeElapsed) {
      document.removeEventListener('click', handleClick);
      hideCanvasCompletionMessage();
      if (onComplete) onComplete();
    } else {
      messageShown = true;
    }
  }
  
  document.addEventListener('click', handleClick);
}

function hideCanvasCompletionMessage() {
  canvasCelebrationMessage.visible = false;
  
  // Refresh canvas display
  if (!running) {
    drawStaticBackground();
    drawCanvasUIWithCRT();
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
  if (e) {
    e.preventDefault();
    
    // Check loot box click first
    if (canvasLootBox.visible && window.lootBoxBounds && !canvasLootBox.clicked) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const bounds = window.lootBoxBounds;
      
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        // Handle loot box click
        canvasLootBox.clicked = true;
        playSound('sparkle');
        
        let newSkinKey, newSkin;
        
        if (canvasLootBox.secretSkinKey && canvasLootBox.secretSkinData) {
          // This is a secret skin unlock
          newSkinKey = canvasLootBox.secretSkinKey;
          newSkin = canvasLootBox.secretSkinData;
        } else {
          // Regular loot box - get locked regular skins
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

          canvasLootBox.message = `Unlocked: ${newSkin.name}`;
          
          // Check if this was the last regular skin to unlock
          const allRegularSkinKeys = Object.keys(ALL_SKINS);
          const regularSkinsUnlocked = unlockedSkins.filter(skin => allRegularSkinKeys.includes(skin));
          const justUnlockedAll = regularSkinsUnlocked.length === allRegularSkinKeys.length && !allSkinsUnlockedShown;
          
          // Sparkles
          for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

          // Update canvas display with new message
          drawStaticBackground();
          drawCanvasUIWithCRT();

          setTimeout(() => {
            canvasLootBox.visible = false;
            lootBoxActive = false;
            window.lootBoxBounds = null;
            
            // Redraw without loot box
            drawStaticBackground();
            drawCanvasUIWithCRT();
            
            if (justUnlockedAll) {
              showAllSkinsUnlockedMessage(canvasLootBox.onComplete);
            } else if (canvasLootBox.onComplete) {
              canvasLootBox.onComplete();
            }
          }, 1500);
        } else {
          // No skin to unlock
          canvasLootBox.message = 'All skins unlocked!';
          
          // Sparkles
          for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

          // Update canvas display with new message
          drawStaticBackground();
          drawCanvasUIWithCRT();

          setTimeout(() => {
            canvasLootBox.visible = false;
            lootBoxActive = false;
            window.lootBoxBounds = null;
            
            // Redraw without loot box
            drawStaticBackground();
            drawCanvasUIWithCRT();
            
            if (canvasLootBox.onComplete) {
              canvasLootBox.onComplete();
            }
          }, 1500);
        }
        return;
      }
    }
    
    // Check if click is on leaderboard button (only available during skin menu)
    if (window.leaderboardButtonBounds && !running) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const bounds = window.leaderboardButtonBounds;
      
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        // Open leaderboard in new tab
        window.open('leaderboard', '_blank', 'noopener');
        return;
      }
    }
    
    // Check canvas skin menu clicks (only when skin menu is visible and game not running)
    if (!running) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      // Left arrow click (only if arrows are visible)
      if (window.skinLeftButtonBounds && unlockedSkins.length > 1) {
        const bounds = window.skinLeftButtonBounds;
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          currentSkinIndex--;
          updateSkinDisplay();
          animateSkinPreview(); // Trigger jump animation
          // Redraw with CRT filter
          drawStaticBackground();
          drawCanvasUIWithCRT();
          playSound('flap');
          return;
        }
      }
      
      // Right arrow click (only if arrows are visible)
      if (window.skinRightButtonBounds && unlockedSkins.length > 1) {
        const bounds = window.skinRightButtonBounds;
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          currentSkinIndex++;
          updateSkinDisplay();
          animateSkinPreview(); // Trigger jump animation
          // Redraw with CRT filter
          drawStaticBackground();
          drawCanvasUIWithCRT();
          playSound('flap');
          return;
        }
      }
      
      // Play button click
      if (window.skinPlayButtonBounds) {
        const bounds = window.skinPlayButtonBounds;
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          if (lootBoxActive) return; // ignore clicks while loot box is open
          playSound('flap'); // Play flap sound when starting the game
          hideMenu();  // hide the menu
          reset();     // start the game
          return;
        }
      }
      
      // CRT toggle button click
      if (window.crtToggleButtonBounds) {
        const bounds = window.crtToggleButtonBounds;
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          if (lootBoxActive) return; // ignore clicks while loot box is open
          playSound('flap');
          toggleCRTFilter();
          // Redraw the menu with updated CRT state
          drawStaticBackground();
          drawCanvasUIWithCRT();
          return;
        }
      }
      

    }
  }
  
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
    if (running) {
      // During game: make the bird flap
      flap();
    } else {
      // In menu: start the game (same as clicking Play button)
      const menu = document.getElementById('skin-menu');
      if (menu && menu.style.display !== 'none' && !lootBoxActive) {
        playSound('flap'); // Play flap sound when starting the game
        hideMenu();  // hide the menu
        reset();     // start the game
      }
    }
  } 
});

// Web Audio Context fix - resume audio context on first user interaction
let audioContextResumed = false;
function resumeAudioContext() {
  if (!audioContextResumed) {
    // Resume Web Audio Context for mobile browsers
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        audioContextResumed = true;
        console.log('Web Audio Context resumed');
      }).catch(() => {});
    }
  }
}

document.addEventListener('touchstart', resumeAudioContext, { once: true });
document.addEventListener('click', resumeAudioContext, { once: true });
