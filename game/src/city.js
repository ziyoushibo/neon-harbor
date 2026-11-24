// Neon Harbor — the city: roads, blocks, buildings, beach, harbor, landmarks.
// Everything is generated from a seed, so the same seed always builds the same city.
import { BLOCK, COLORS, DISTRICTS, ROAD_GAP, ROAD_HALF, ROAD_W, WORLD, mulberry32 } from './config.js';

export function roadCenters() {
  const list = [];
  for (let i = 0; i < 8; i += 1) list.push(225 + ROAD_GAP * i);
  return list;
}

// Fixed story places, all on or beside roads so missions can reach them.
export const LANDMARKS = {
  hideout: { name: "Mara's Garage", x: 700, y: 2950, kind: 'hideout' },
  sprayShop: { name: 'Neon Paint', x: 1150, y: 2050, kind: 'spray' },
  warehouse: { name: 'Harbor Warehouse', x: 2900, y: 1600, kind: 'warehouse' },
  pier9: { name: 'Pier 9', x: 3400, y: 2400, kind: 'pier' },
  hospital: { name: 'St. Marina Hospital', x: 700, y: 450, kind: 'hospital' },
  policeHQ: { name: 'NH Police HQ', x: 2050, y: 700, kind: 'police' },
  plaza: { name: 'Liberty Plaza', x: 1800, y: 1800, kind: 'plaza' },
  beachBar: { name: 'Sunset Bar', x: 1500, y: 3400, kind: 'bar' },
};

function blockRect(bx, by) {
  // Block (bx, by) spans between road centerlines; its buildable area starts after the road.
  return {
    x: 225 + ROAD_GAP * bx + ROAD_HALF + 8,
    y: 225 + ROAD_GAP * by + ROAD_HALF + 8,
    w: BLOCK - 16,
    h: BLOCK - 16,
  };
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const parks = new Set(['2,2', '5,5', '1,6']);
  const plazaBlock = '3,3';
  const landmarkBlocks = new Set(['1,6', '2,4', '6,3', '0,0', '4,1']);

  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const key = `${bx},${by}`;
      const r = blockRect(bx, by);
      if (key === plazaBlock) continue; // central plaza, kept open
      if (parks.has(key)) {
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: r.x + 30 + rng() * (r.w - 60), y: r.y + 30 + rng() * (r.h - 60), s: 10 + rng() * 10 });
        }
        continue;
      }
      if (landmarkBlocks.has(key)) continue; // story buildings go in by hand below
      // 1-3 buildings per block, with a margin for sidewalks.
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        const w = 90 + rng() * 130;
        const h = 80 + rng() * 120;
        const x = r.x + rng() * Math.max(1, r.w - w);
        const y = r.y + rng() * Math.max(1, r.h - h);
        const downtown = bx >= 3 && bx <= 4 && by >= 2 && by <= 4;
        buildings.push({
          x, y, w, h,
          roof: COLORS.buildingRoof[Math.floor(rng() * COLORS.buildingRoof.length)],
          wall: COLORS.buildingWall[Math.floor(rng() * COLORS.buildingWall.length)],
          tall: downtown && rng() < 0.6,
          name: null,
        });
      }
      if (rng() < 0.5) trees.push({ x: r.x + 20 + rng() * (r.w - 40), y: r.y + 20 + rng() * (r.h - 40), s: 9 + rng() * 8 });
    }
  }

  // Story buildings, drawn with signs.
  const story = [
    { ...LANDMARKS.hideout, w: 150, h: 100, roof: '#c96f4a', wall: '#e8dcc8' },
    { ...LANDMARKS.sprayShop, w: 130, h: 90, roof: '#5b7fa6', wall: '#d8e2ea' },
    { ...LANDMARKS.warehouse, w: 220, h: 140, roof: '#4a9e7d', wall: '#d5e0d2' },
    { ...LANDMARKS.hospital, w: 200, h: 130, roof: '#e8e8e8', wall: '#ffffff' },
    { ...LANDMARKS.policeHQ, w: 170, h: 120, roof: '#2e4a6b', wall: '#d8e2ea' },
    { ...LANDMARKS.beachBar, w: 120, h: 80, roof: '#b89a4a', wall: '#ead9c2' },
  ];
  for (const s of story) {
    buildings.push({ x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h, roof: s.roof, wall: s.wall, tall: false, name: s.name, kind: s.kind });
  }

  return {
    seed, buildings, trees,
    parks: [...parks].map((k) => { const [bx, by] = k.split(',').map(Number); return blockRect(bx, by); }),
    plaza: blockRect(3, 3),
    districts: DISTRICTS,
  };
}

/** True when a circle of radius r at (x, y) touches a building, the water, or the map edge. */
export function solidAt(city, x, y, r) {
  if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
  if (y > 3520 || x > 3520) return true; // the sea
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of whatever solid it overlaps (one pass, good enough for walking/driving). */
export function resolveCollision(city, e, r) {
  if (e.x < r) e.x = r;
  if (e.y < r) e.y = r;
  if (e.x > WORLD - r) e.x = WORLD - r;
  if (e.y > WORLD - r) e.y = WORLD - r;
  if (e.y > 3520 - r) e.y = 3520 - r;
  if (e.x > 3520 - r) e.x = 3520 - r;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
    } else if (d2 <= 0.01) {
      e.y = b.y - r;
    }
  }
}

export function onRoad(x, y) {
  const centers = roadCenters();
  for (const c of centers) {
    if (Math.abs(x - c) <= ROAD_HALF || Math.abs(y - c) <= ROAD_HALF) return true;
  }
  return false;
}

/** The nearest point on a road centerline to (x, y). */
export function nearestRoadPoint(x, y) {
  const centers = roadCenters();
  let best = null, bestD = Infinity;
  for (const cx of centers) {
    const d = Math.abs(x - cx);
    if (d < bestD) { bestD = d; best = { x: cx, y }; }
  }
  for (const cy of centers) {
    const d = Math.abs(y - cy);
    if (d < bestD) { bestD = d; best = { x, y: cy }; }
  }
  return best;
}

/** A random drivable spot on a road, for spawning traffic and parked cars. */
export function randomRoadSpot(rng) {
  const centers = roadCenters();
  if (rng() < 0.5) {
    return { x: centers[Math.floor(rng() * centers.length)], y: 150 + rng() * (WORLD - 300) };
  }
  return { x: 150 + rng() * (WORLD - 300), y: centers[Math.floor(rng() * centers.length)] };
}

export function isBeach(x, y) { return y > 3300 && x < 3300; }
export function isHarbor(x, y) { return x > 3300 && y < 3300; }
