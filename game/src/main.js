// Neon Harbor — boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps, the renderer paints what is there. Screens: menu, playing,
// paused, busted, wasted. ?seed=N fixes the city; ?shot=cover|mission|chase|start
// stages that scene, plays it forward, and sets window.__shotReady for a screenshot.
import { CAR, PLAYER, WORLD, clamp, lerp, mulberry32 } from './config.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createWanted, dispatchPolice, updatePolice, updateWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { collideCars, drivePlayerCar, spawnParked, spawnTraffic, updateTraffic } from './vehicles.js';
import { enterCar, exitCar, hurtPlayer, spawnPeds, updatePeds, updatePlayerOnFoot } from './people.js';
import { stageShot, createShotInput } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'neon-harbor-save-v1';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const status = document.getElementById('status');
const el = (id) => document.getElementById(id);

const city = buildCity(seed);
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas, minimap);

// ---- game state ------------------------------------------------------------
const G = {
  time: 0,
  seed,
  rng: null, // set below (mulberry32 from config via city seed)
  city,
  input,
  audio,
  camera: { x: 1200, y: 1200 },
  mode: 'menu',
  player: {
    x: 1800, y: 1800, angle: 0, health: PLAYER.maxHealth,
    cash: 150, ammo: PLAYER.startAmmo, inCar: null,
    moving: false, punchT: 0, invulnerable: 0,
  },
  cars: [],
  peds: [],
  particles: [],
  pickups: [],
  shootCooldown: 0,
  stats: { carsStolen: 0, kills: 0, missionsDone: 0 },
  muted: false,
  shotMode: false, // true while a screenshot scene plays in: no busted/wasted overlays
  toast(msg) { showToast(msg); },
  saveGame() { save(); },
  onBusted(reason) { busted(reason); },
  onWasted() { wasted(); },
};
G.rng = mulberry32(seed);
G.wanted = createWanted(G);
G.missions = createMissions(G);

// Cash and ammo pickups scattered around the map.
function scatterPickups() {
  for (let i = 0; i < 14; i += 1) {
    G.pickups.push({ x: 200 + G.rng() * 3200, y: 200 + G.rng() * 3200, kind: 'cash', value: 25 + Math.floor(G.rng() * 75) });
  }
  for (let i = 0; i < 5; i += 1) {
    G.pickups.push({ x: 200 + G.rng() * 3200, y: 200 + G.rng() * 3200, kind: 'ammo', value: 12 });
  }
}

function save() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash,
      ammo: G.player.ammo,
      idx: G.missions.idx,
      done: G.missions.done,
    }));
  } catch { /* storage off: progress lasts this visit only */ }
}

function load() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    G.player.cash = s.cash ?? 150;
    G.player.ammo = s.ammo ?? PLAYER.startAmmo;
    G.missions.idx = s.idx ?? 0;
    G.missions.done = s.done ?? [false, false, false, false];
    G.stats.missionsDone = G.missions.done.filter(Boolean).length;
  } catch { /* ignore a broken save */ }
}

let toastTimer = null;
function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  status.textContent = msg;
}

function showScreen(name) {
  for (const id of ['menu', 'pause', 'end']) el(id).classList.remove('show');
  if (name) el(name).classList.add('show');
}

function startGame() {
  audio.unlock();
  audio.startMusic();
  G.mode = 'playing';
  showScreen(null);
  status.textContent = 'Playing. Talk to Mara at the garage for work.';
}

function busted(reason) {
  if (G.mode !== 'playing' || G.shotMode) return;
  G.mode = 'busted';
  const lost = Math.min(150, G.player.cash);
  G.player.cash -= lost;
  if (G.player.inCar) { G.player.inCar.driver = null; G.player.inCar.speed = 0; G.player.inCar = null; }
  G.wanted.clear();
  G.player.health = PLAYER.maxHealth;
  G.player.x = 2050; G.player.y = 760; // outside Police HQ
  audio.engineStop();
  audio.busted();
  el('end-title').textContent = 'BUSTED';
  el('end-text').textContent = `${reason} You lost $${lost}. The cops let you go outside HQ.`;
  showScreen('end');
  save();
}

function wasted() {
  if (G.mode !== 'playing' || G.shotMode) return;
  G.mode = 'wasted';
  const lost = Math.min(100, G.player.cash);
  G.player.cash -= lost;
  if (G.player.inCar) { G.player.inCar.driver = null; G.player.inCar.speed = 0; G.player.inCar = null; }
  G.wanted.clear();
  G.player.health = PLAYER.maxHealth;
  G.player.x = 700; G.player.y = 560; // outside the hospital
  audio.engineStop();
  el('end-title').textContent = 'WASTED';
  el('end-text').textContent = `You woke up at St. Marina Hospital, $${lost} lighter.`;
  showScreen('end');
  save();
}

function resumeFromEnd() {
  G.mode = 'playing';
  showScreen(null);
}

// ---- simulation ------------------------------------------------------------
function updateCamera(dt) {
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);
  const p = G.player;
  const tx = clamp(p.x - vw / 2, 0, WORLD - vw);
  const ty = clamp(p.y - vh / 2, 0, WORLD - vh);
  const k = 1 - Math.pow(0.001, dt);
  G.camera.x = lerp(G.camera.x, tx, k);
  G.camera.y = lerp(G.camera.y, ty, k);
}

function updatePickups(dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 34) {
      if (pk.kind === 'cash') {
        p.cash += pk.value;
        showToast(`+$${pk.value}`);
      } else {
        p.ammo += pk.value;
        showToast(`+${pk.value} ammo`);
      }
      audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}

function step(dt) {
  G.time += dt;
  const p = G.player;
  if (p.punchT > 0) p.punchT -= dt;
  if (G.mode === 'menu') {
    // Living backdrop behind the title: traffic cruises, camera drifts downtown.
    for (const car of G.cars) {
      if (car.driver === 'traffic') updateTraffic(G, car, dt);
    }
    updateCamera(dt);
    return;
  }
  if (G.mode !== 'playing') return;

  if (p.inCar) {
    drivePlayerCar(G, p.inCar, dt);
    if (input.wasPressed('KeyE')) exitCar(G);
    if (input.wasPressed('KeyF')) audio.horn();
  } else {
    updatePlayerOnFoot(G, dt);
  }
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTraffic(G, car, dt);
    else if (car.driver === 'police') { /* police handled below */ }
  }
  collideCars(G);
  updatePeds(G, dt);
  updateWanted(G, dt);
  dispatchPolice(G, dt);
  updatePolice(G, dt);
  G.missions.update(dt);
  updatePickups(dt);
  audio.music(dt);
  audio.siren(G.cars.some((c) => c.police), dt);
  if (!p.inCar) audio.engine(0, false);

  // Particles age.
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const pt = G.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  updateCamera(dt);
  updateHUD();
}

function updateHUD() {
  const p = G.player;
  el('hud-cash').textContent = `$${p.cash}`;
  el('hud-stars').textContent = '★'.repeat(G.wanted.stars) + '☆'.repeat(5 - G.wanted.stars);
  el('hud-stars').style.color = G.wanted.stars > 0 ? '#ffd94f' : 'rgba(255,255,255,0.55)';
  el('hud-health-fill').style.width = `${Math.max(0, p.health)}%`;
  el('hud-ammo').textContent = p.inCar ? '—' : `Ammo ${p.ammo}`;
  const speed = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.22) : 0;
  el('hud-speed').textContent = p.inCar ? `${speed} km/h` : '';
  el('hud-objective').textContent = G.missions.active
    ? `JOB: ${G.missions.text}`
    : (G.missions.idx >= 4 ? 'King of Neon Harbor — free roam' : (G.missions.text || 'Talk to Mara at the garage (follow the yellow M)'));
  el('hud-missions').textContent = `Jobs done: ${G.stats.missionsDone}/4`;
}

// ---- boot ------------------------------------------------------------------
function resetWorld() {
  G.cars = [];
  G.peds = [];
  G.particles = [];
  G.pickups = [];
  G.player.x = 1800; G.player.y = 1800; G.player.angle = 0;
  G.player.health = PLAYER.maxHealth;
  G.player.inCar = null;
  G.wanted.clear();
  scatterPickups();
  spawnTraffic(G, 14);
  spawnParked(G, 18);
  spawnPeds(G, 30);
}

function runGame() {
  load();
  resetWorld();
  let screen = SCREEN_TITLE;
  showScreen('menu');
  status.textContent = 'Neon Harbor. Press Enter or click Start.';

  el('start-btn').addEventListener('click', () => { audio.unlock(); startGame(); });
  el('resume-btn').addEventListener('click', () => resumeFromEnd());
  el('end-btn').addEventListener('click', () => resumeFromEnd());
  el('menu-btn').addEventListener('click', () => { G.mode = 'menu'; resetWorld(); showScreen('menu'); });
  el('mute-btn').addEventListener('click', () => {
    G.muted = !G.muted;
    audio.setMuted(G.muted);
    el('mute-btn').textContent = G.muted ? '🔇 Unmute (M)' : '🔊 Mute (M)';
  });

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      if (G.mode === 'menu') startGame();
      else if (G.mode === 'busted' || G.mode === 'wasted') resumeFromEnd();
    }
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      if (G.mode === 'playing') { G.mode = 'paused'; showScreen('pause'); }
      else if (G.mode === 'paused') { G.mode = 'playing'; showScreen(null); }
    }
    if (input.wasPressed('KeyM')) {
      G.muted = !G.muted;
      audio.setMuted(G.muted);
    }
    if (G.mode === 'playing' || G.mode === 'menu') {
      while (accumulator >= STEP && (G.mode === 'playing' || G.mode === 'menu')) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const scr = G.mode === 'menu' ? SCREEN_TITLE : G.mode === 'paused' ? SCREEN_PAUSED : (G.mode === 'busted' || G.mode === 'wasted') ? SCREEN_OVER : SCREEN_PLAY;
    renderer.draw(G, scr);
    input.endFrame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'playing') { G.mode = 'paused'; showScreen('pause'); }
  });
  requestAnimationFrame(frame);
}

function runShot(name) {
  load();
  resetWorld();
  G.shotMode = true;
  const screenName = stageShot(G, name);
  showScreen(screenName === 'title' ? 'menu' : null);
  const realInput = G.input;
  G.input = createShotInput(G);
  const steps = name === 'start' ? 90 : 170;
  for (let i = 0; i < steps; i += 1) {
    if (name !== 'start') step(STEP);
    else { G.time += STEP; updateCamera(STEP); }
  }
  G.input = realInput;
  G.shotMode = false;
  // Snap the camera onto the player for the frame: the staged shot should be
  // centred on the action, not trailing it.
  G.camera.x = clamp(G.player.x - 640, 0, WORLD - 1280);
  G.camera.y = clamp(G.player.y - 400, 0, WORLD - 800);
  window.__shotDebug = {
    px: Math.round(G.player.x), py: Math.round(G.player.y),
    camx: Math.round(G.camera.x), camy: Math.round(G.camera.y),
    speed: G.player.inCar ? Math.round(G.player.inCar.speed) : 0,
    color: G.player.inCar ? G.player.inCar.color : 'on-foot',
    stars: G.wanted.stars,
  };
  const scr = screenName === 'title' ? SCREEN_TITLE : SCREEN_PLAY;
  let painted = 0;
  function paint() {
    renderer.draw(G, scr);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
