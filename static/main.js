// Minimal Flappy Bird-like game
let progressAnimating = false;
// --- MILESTONES CONFIG ---
const RUN_SCORE_MILESTONES = [10, 20, 30];   // first-time single-run milestones
const CUMULATIVE_SCORE_STEP = 100;           // every 100 cumulative points

// window.addEventListener('load', () => {
//   showMenu();  // show the skin selection menu at the very start
// });

// // ensure DOM readiness before creating UI
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', createProgressUI);
// } else {
//   createProgressUI();
// }

let lastTime;
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 16.67; // normalize so dt=1 ~ 60fps
  lastTime = timestamp;
  game.update(dt);
  game.draw();

  if (game.running) {
    requestAnimationFrame(gameLoop);
  }
}


let game = new Game();
game.menu.show();
function startGame() {
  game.start();
  requestAnimationFrame(gameLoop);
}

// document.querySelector('#skin-menu #start').addEventListener('click', () => {
//   if (lootBoxActive) return; // ignore clicks while loot box is open
//   hideMenu();  // hide the menu
//   reset();     // start the game
// });

// canvas.addEventListener('click', () => { if (game.running) flap() });
//canvas.addEventListener('click', () => { if (running) flap(); else reset(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); if (game.running) game.flap(); else startGame(); } });
document.getElementById('start').addEventListener('click', () => { game.menu.hide(); startGame(); });

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
  await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score }) });
  fetchLeaderboard();
  document.getElementById('submit-score').style.display = 'none';
});

fetchLeaderboard();