// Neon Harbor — the wanted system: stars that rise on crime and fade when you lay low,
// and the police who answer them.
import { WANTED, angleTo, clamp, dist2 } from './config.js';
import { makeCar, nearestCar } from './vehicles.js';
import { makePed } from './people.js';
import { nearestRoadPoint, randomRoadSpot } from './city.js';

export function createWanted(G) {
  const w = {
    stars: 0,
    quietT: 0,
    add(n, reason) {
      if (G.mode !== 'playing') return;
      const before = w.stars;
      w.stars = clamp(w.stars + n, 0, WANTED.maxStars);
      w.quietT = 0;
      if (w.stars > before) {
        G.toast(`${'★'.repeat(w.stars)}  Wanted level ${w.stars} — ${reason}`);
        G.audio.siren(true, 0);
      }
    },
    clear() { w.stars = 0; w.quietT = 0; },
  };
  return w;
}

/** Fade stars when the player has been quiet and no cop is close. */
export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.stars === 0) return;
  let copNear = false;
  for (const car of G.cars) {
    if (car.police && dist2(car.x, car.y, G.player.x, G.player.y) < 420 * 420) { copNear = true; break; }
  }
  if (!copNear) {
    for (const ped of G.peds) {
      if (ped.cop && !ped.dead && dist2(ped.x, ped.y, G.player.x, G.player.y) < 300 * 300) { copNear = true; break; }
    }
  }
  if (copNear) { w.quietT = 0; return; }
  w.quietT += dt;
  if (w.quietT >= WANTED.decaySeconds) {
    w.quietT = 0;
    w.stars -= 1;
    G.toast(w.stars === 0 ? 'You lost them. The heat is off.' : `Wanted level fell to ${w.stars}.`);
  }
}

/** Keep the right number of police in the world for the current stars. */
export function dispatchPolice(G, dt) {
  const stars = G.wanted.stars;
  const wantCars = stars === 0 ? 0 : stars === 1 ? 0 : Math.min(5, stars);
  const wantFoot = stars === 0 ? 0 : stars === 1 ? 2 : stars === 2 ? 1 : 2;
  const policeCars = G.cars.filter((c) => c.police).length;
  const footCops = G.peds.filter((p) => p.cop && !p.dead).length;

  if (policeCars < wantCars) {
    const spot = randomRoadSpot(G.rng);
    const car = makeCar(spot.x, spot.y, G.rng() * Math.PI * 2, { police: true, driver: 'police', color: '#1f2a33' });
    // Spawn on a road near the player so the chase arrives fast.
    const near = nearestRoadPoint(G.player.x + (G.rng() - 0.5) * 900, G.player.y + (G.rng() - 0.5) * 900);
    car.x = near.x; car.y = near.y;
    car.speed = 300;
    car.siren = true;
    G.cars.push(car);
  }
  if (footCops < wantFoot) {
    const ped = makePed(G.player.x + (G.rng() - 0.5) * 500, G.player.y + (G.rng() - 0.5) * 500, { color: '#1f2a33' });
    ped.cop = true;
    ped.health = 80;
    G.peds.push(ped);
  }
  // Siren while any cruiser is hunting.
  G.audio.siren(policeCars > 0, dt);
}

/** Police cruisers ram the player's car; foot officers close in and arrest. */
export function updatePolice(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (!car.police || car.driver !== 'police') continue;
    const target = p.inCar || p;
    const d = Math.hypot(target.x - car.x, target.y - car.y);
    const wantAngle = angleTo(car.x, car.y, target.x, target.y);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const wantSpeed = d > 500 ? 560 : 480;
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram: hitting the player's car hurts it and the player.
    if (p.inCar && dist2(car.x, car.y, p.inCar.x, p.inCar.y) < 48 * 48) {
      p.inCar.health -= 14 * dt;
      if (p.inCar.health <= 0) {
        G.particles.push({ kind: 'smoke', x: p.inCar.x, y: p.inCar.y, life: 1, max: 1 });
        G.audio.crash();
        p.inCar.health = 20;
        p.inCar.speed *= 0.3;
      }
    }
  }
  for (const ped of G.peds) {
    if (!ped.cop || ped.dead) continue;
    const d = Math.hypot(p.x - ped.x, p.y - ped.y);
    if (p.inCar) {
      // Officers on foot chase the car on foot and try to drag the driver out.
      ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
      ped.x += Math.cos(ped.angle) * 200 * dt;
      ped.y += Math.sin(ped.angle) * 200 * dt;
      if (d < 60 && p.inCar.speed < 60) {
        G.onBusted('An officer dragged you out of the car.');
      }
      continue;
    }
    if (d < WANTED.bustDistance) {
      ped.arrestT = (ped.arrestT || 0) + dt;
      if (ped.arrestT >= WANTED.bustSeconds) {
        G.onBusted('Busted by the Neon Harbor PD.');
        return;
      }
    } else {
      ped.arrestT = 0;
      ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
      ped.x += Math.cos(ped.angle) * 205 * dt;
      ped.y += Math.sin(ped.angle) * 205 * dt;
    }
  }
}
