// Neon Harbor — tuning constants. One place for every number the game balances on.
export const WORLD = 3600;            // world is WORLD x WORLD px
export const ROAD_GAP = 450;          // distance between road centerlines
export const ROAD_W = 90;             // road width
export const ROAD_HALF = ROAD_W / 2;
export const BLOCK = ROAD_GAP - ROAD_W; // 360 px of buildable block

export const PLAYER = {
  walkSpeed: 190,
  sprintSpeed: 285,
  radius: 14,
  maxHealth: 100,
  punchDamage: 30,
  punchRange: 48,
  punchArc: 1.2,
  pistolDamage: 34,
  pistolRange: 420,
  startAmmo: 24,
};

export const CAR = {
  accel: 640,
  brake: 950,
  maxSpeed: 560,
  maxReverse: 230,
  steer: 2.7,          // rad/s at full speed factor
  grip: 0.94,          // lateral velocity kept per frame factor
  handbrakeGrip: 0.80,
  radius: 20,
  health: 100,
};

export const WANTED = {
  decaySeconds: 26,    // one star fades after this long with no crime and no cop near
  maxStars: 5,
  bustDistance: 44,
  bustSeconds: 1.4,
};

export const COLORS = {
  grass: '#79a85e',
  sand: '#e8d39a',
  water: '#2e7fb8',
  waterDeep: '#1f5f92',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  sidewalk: '#b9bec6',
  buildingRoof: ['#c96f4a', '#5b7fa6', '#8a6fb8', '#4a9e7d', '#b89a4a', '#a65b6e'],
  buildingWall: ['#e8dcc8', '#d8e2ea', '#ead9c2', '#d5e0d2'],
  park: '#5f9e4d',
  plaza: '#c9c2b2',
};

export const DISTRICTS = [
  { name: 'North Hills', x: 0, y: 0, w: 1500, h: 900 },
  { name: 'Downtown', x: 1350, y: 900, w: 900, h: 900 },
  { name: 'Old Town', x: 0, y: 900, w: 1350, h: 1500 },
  { name: 'The Docks', x: 3150, y: 900, w: 450, h: 2100 },
  { name: 'Marina Bay', x: 900, y: 3000, w: 1800, h: 600 },
];

// Seeded RNG (mulberry32) so the city and screenshots are stable per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
