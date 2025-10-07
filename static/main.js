// Minimal Flappy Bird-like game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let bird = { x: 80, y: H/2, vy: 0 };
let pipes = [];
let frame = 0;
let score = 0;
let running = false;

function reset() {
  bird = { x: 80, y: H/2, vy: 0 };
  pipes = [];
  frame = 0;
  score = 0;
  running = true;
  document.getElementById('submit-score').style.display = 'none';
  // start game loop
  loop();
  document.getElementById('score').innerText = 'Score: 0';
}

function spawnPipe() {
  const gap = 140;
  const top = Math.random() * (H - gap - 100) + 50;
  pipes.push({ x: W, top, bottom: top + gap, passed: false });
}

function update() {
  if (!running) return;
  frame++;
  bird.vy += 0.1; // gravity
  bird.y += bird.vy;

  if (frame % 140 === 0) spawnPipe(); // was 90

  for (let p of pipes) {
    p.x -= 2.5;
    if (!p.passed && p.x + 30 < bird.x) { score++; p.passed = true; document.getElementById('score').innerText = 'Score: ' + score; }
  }

  // collision
  if (bird.y > H || bird.y < 0) endGame();

  for (let p of pipes) {
    if (bird.x + 12 > p.x && bird.x - 12 < p.x + 40) {
      if (bird.y - 12 < p.top || bird.y + 12 > p.bottom) endGame();
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

  // Only continue the animation loop while the game is running.
  // If we always call requestAnimationFrame unconditionally, multiple
  // overlapping loops can be created by calling reset(), which causes
  // gravity (vy) to be applied more than once per frame and the bird
  // to fall very fast immediately after resetting.
  if (running) requestAnimationFrame(loop);
}

function loop() {
  update();
  draw();
}

function flap() { bird.vy = -4; }

function endGame() {
  running = false;
  document.getElementById('submit-score').style.display = 'block';
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