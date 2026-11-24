// Neon Harbor — cars: player driving physics, traffic that follows the roads,
// parked cars to steal, and police cruisers.
import { CAR, WORLD, angDiff, clamp, dist2 } from './config.js';
import { randomRoadSpot, resolveCollision, roadCenters as centers } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b73d', '#7dd94f', '#b84fd9', '#e8e8e8', '#2b2b2b', '#d97b3d'];
const CAR_MODELS = ['Sedan', 'Coupe', 'Van', 'Pickup', 'Sport'];

let nextCarId = 1;

export function makeCar(x, y, angle, opts = {}) {
  return {
    id: nextCarId += 1,
    x, y, angle, speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    model: opts.model || CAR_MODELS[Math.floor(Math.random() * CAR_MODELS.length)],
    traffic: !!opts.traffic,
    police: !!opts.police,
    parked: !!opts.parked,
    health: CAR.health,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null
    // traffic brain
    dir: opts.dir ?? (Math.random() < 0.5 ? 0 : Math.PI / 2),
    targetSpeed: 120 + Math.random() * 60,
    turnAt: 0,
    smoke: 0,
    siren: false,
  };
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i += 1) {
    const spot = randomRoadSpot(G.rng);
    const vertical = Math.abs(spot.x - centers()[0]) < 1 || G.rng() < 0.5;
    const car = makeCar(spot.x, spot.y, vertical ? Math.PI / 2 : 0, { traffic: true, driver: 'traffic' });
    // Put it on a lane: right-hand side of its road.
    if (vertical) car.x += 22;
    else car.y += 22;
    car.speed = car.targetSpeed;
    G.cars.push(car);
  }
}

export function spawnParked(G, n) {
  for (let i = 0; i < n; i += 1) {
    const spot = randomRoadSpot(G.rng);
    const vertical = G.rng() < 0.5;
    const car = makeCar(spot.x, spot.y, vertical ? 0 : Math.PI / 2, { parked: true });
    if (vertical) car.x += 34;
    else car.y += 34;
    G.cars.push(car);
  }
}

function carForward(car) { return { x: Math.cos(car.angle), y: Math.sin(car.angle) }; }

/** Arcade driving: accelerate, steer by speed, drift on handbrake, collide with buildings. */
export function drivePlayerCar(G, car, dt) {
  const input = G.input;
  const axis = input.axis();
  const fwd = carForward(car);
  const forwardSpeed = car.speed;
  let accel = 0;
  if (axis.y < 0) accel = CAR.accel;
  else if (axis.y > 0) accel = -CAR.brake;
  if (input.isDown('Space')) accel = -Math.sign(forwardSpeed) * CAR.brake * 1.2; // handbrake

  car.speed = clamp(car.speed + accel * dt, -CAR.maxReverse, CAR.maxSpeed);
  if (accel === 0) car.speed *= Math.pow(0.4, dt); // rolling drag
  const steerInput = axis.x;
  const grip = input.isDown('Space') ? CAR.handbrakeGrip : CAR.grip;
  const steerAmount = steerInput * CAR.steer * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt;
  if (Math.abs(steerAmount) > 0.1 && Math.abs(car.speed) > 300) {
    G.particles.push({ kind: 'skid', x: car.x, y: car.y, life: 0.5, max: 0.5 });
  }
  const nf = carForward(car);
  car.x += nf.x * car.speed * dt;
  car.y += nf.y * car.speed * dt;
  // Lateral slide: keep some of the old direction for drift feel.
  car.x += (fwd.x - nf.x) * car.speed * dt * (1 - grip) * 0.5;
  car.y += (fwd.y - nf.y) * car.speed * dt * (1 - grip) * 0.5;
  resolveCollision(G.city, car, CAR.radius);
  car.x = clamp(car.x, CAR.radius, WORLD - CAR.radius);
  car.y = clamp(car.y, CAR.radius, WORLD - CAR.radius);
  // The driver rides with the car: keep the player position on it, so the camera,
  // the minimap and the police all track the car, not where the player got in.
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
  if (car.health < 40) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      G.particles.push({ kind: 'smoke', x: car.x, y: car.y, life: 0.9, max: 0.9 });
    }
  }
  G.audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
}

/** Traffic cars cruise their road and turn at intersections; they brake for the car ahead. */
export function updateTraffic(G, car, dt) {
  // At an intersection, sometimes turn.
  const nearX = centers().some((c) => Math.abs(car.x - c) < 6);
  const nearY = centers().some((c) => Math.abs(car.y - c) < 6);
  if (nearX && nearY && G.time > car.turnAt) {
    car.turnAt = G.time + 2 + G.rng() * 4;
    if (G.rng() < 0.45) {
      car.dir += (G.rng() < 0.5 ? -1 : 1) * Math.PI / 2;
    }
  }
  // Steer toward the chosen heading, snapped to the grid.
  const target = Math.round(car.dir / (Math.PI / 2)) * (Math.PI / 2);
  car.angle += clamp(angDiff(car.angle, target), -2.2 * dt, 2.2 * dt);
  // Slow for the car ahead.
  let blocked = false;
  for (const other of G.cars) {
    if (other === car) continue;
    const d2 = dist2(car.x, car.y, other.x, other.y);
    if (d2 < 70 * 70) {
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      if (ahead > 0) { blocked = true; break; }
    }
  }
  // Slow for a pedestrian ahead, too.
  if (!blocked) {
    for (const ped of G.peds) {
      if (ped.dead) continue;
      const dx = ped.x - car.x, dy = ped.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 20) { blocked = true; break; }
    }
  }
  const want = blocked ? 0 : car.targetSpeed;
  car.speed += clamp(want - car.speed, -300 * dt, 180 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  resolveCollision(G.city, car, CAR.radius);
  // Despawn far traffic, respawn near the player so the streets stay alive.
  const pd = Math.hypot(car.x - G.player.x, car.y - G.player.y);
  if (pd > 1600) {
    const spot = randomRoadSpot(G.rng);
    const near = { x: G.player.x + (G.rng() - 0.5) * 1400, y: G.player.y + (G.rng() - 0.5) * 1400 };
    car.x = Math.max(100, Math.min(WORLD - 100, near.x));
    car.y = Math.max(100, Math.min(WORLD - 100, near.y));
    car.angle = G.rng() < 0.5 ? 0 : Math.PI / 2;
    car.dir = car.angle;
    car.speed = car.targetSpeed;
  }
}

/** Simple car-vs-car bump: push apart and trade a little speed. The speed and damage
 *  hit applies at most once per half second per pair, so a ram does not grind both
 *  cars to a halt while they stay in contact. */
export function collideCars(G) {
  const cars = G.cars;
  G.carHitT = G.carHitT || {};
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 44;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (impact > 150 && G.time - (G.carHitT[key] || 0) > 0.5) {
          G.carHitT[key] = G.time;
          a.health -= 6; b.health -= 6;
          G.audio.crash();
          G.particles.push({ kind: 'spark', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: 0.4, max: 0.4 });
          if ((a.driver === 'player' || b.driver === 'player') && impact > 260) {
            G.player.health -= 4;
          }
          a.speed *= 0.7; b.speed *= 0.7;
        }
      }
    }
  }
}

export function nearestCar(G, x, y, maxDist, filter) {
  let best = null, bestD = maxDist * maxDist;
  for (const car of G.cars) {
    if (filter && !filter(car)) continue;
    const d2 = dist2(x, y, car.x, car.y);
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}
