// Neon Harbor — people: the player on foot, pedestrians with daily routines,
// gang members, and police officers. Combat lives here too.
import { CAR, PLAYER, WANTED, angDiff, angleTo, clamp, dist2 } from './config.js';
import { resolveCollision, solidAt } from './city.js';
import { nearestCar } from './vehicles.js';

const PED_COLORS = ['#e8a34f', '#4f9ed9', '#9e4fd9', '#4fd9a5', '#d94f7d', '#8a6f4f', '#5f6f8a'];
const GANG_COLORS = ['#c22e2e', '#8a1f1f'];

export function makePed(x, y, opts = {}) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 40,
    color: opts.color || PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
    gang: !!opts.gang,
    health: opts.gang ? 60 : 100,
    state: 'walk',       // walk | flee | chase | attack | dead
    stateT: 0,
    target: null,
    shootT: 0,
    dead: false,
    scared: 0,
  };
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i += 1) {
    const x = 150 + G.rng() * 3300;
    const y = 150 + G.rng() * 3300;
    if (solidAt(G.city, x, y, 16)) continue;
    G.peds.push(makePed(x, y));
  }
}

/** The player on foot: WASD/arrows to walk, Shift to sprint, E to enter a car. */
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const axis = G.input.axis();
  const sprint = G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    const nx = axis.x / len, ny = axis.y / len;
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
    p.angle = Math.atan2(ny, nx);
    p.moving = true;
  } else {
    p.moving = false;
  }
  resolveCollision(G.city, p, PLAYER.radius);
  // Enter the nearest car.
  if (G.input.wasPressed('KeyE')) {
    const car = nearestCar(G, p.x, p.y, 70, (c) => c.driver !== 'player');
    if (car) {
      enterCar(G, car);
      return;
    }
    // Or talk to a mission contact.
    if (G.missions.talkTarget && dist2(p.x, p.y, G.missions.talkTarget.x, G.missions.talkTarget.y) < 70 * 70) {
      G.missions.onTalk(G);
    }
  }
  // Punch.
  if (G.input.wasPressed('KeyF')) punch(G);
  // Shoot toward the mouse.
  if (G.input.mouse.clicked && p.ammo > 0 && G.shootCooldown <= 0) shoot(G);
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (G.shootCooldown > 0) G.shootCooldown -= dt;
}

export function enterCar(G, car) {
  car.driver = 'player';
  car.parked = false;
  G.player.inCar = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.audio.click();
  if (car.police) {
    // Stealing a police cruiser is a crime the whole city notices.
    G.wanted.add(2, 'Stole a police cruiser');
  } else if (car.traffic || car.parked) {
    G.wanted.add(1, 'Stole a car');
    G.stats.carsStolen += 1;
  }
}

export function exitCar(G) {
  const car = G.player.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  G.player.inCar = null;
  // Step out to the side of the car.
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  if (!solidAt(G.city, side.x, side.y, PLAYER.radius)) {
    G.player.x = side.x; G.player.y = side.y;
  } else {
    G.player.x = car.x + Math.sin(car.angle) * 34;
    G.player.y = car.y - Math.cos(car.angle) * 34;
  }
  G.player.angle = car.angle;
  G.audio.engineStop();
  G.audio.click();
}

function punch(G) {
  const p = G.player;
  p.punchT = 0.18;
  G.audio.punch();
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.punchRange) {
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      if (Math.abs(angDiff(p.angle, a)) < PLAYER.punchArc) {
        hurtPed(G, ped, PLAYER.punchDamage, p.angle);
      }
    }
  }
}

function shoot(G) {
  const p = G.player;
  p.ammo -= 1;
  G.shootCooldown = 0.22;
  G.audio.shoot();
  const cam = G.camera;
  const wx = cam.x + G.input.mouse.x;
  const wy = cam.y + G.input.mouse.y;
  const aim = Math.atan2(wy - p.y, wx - p.x);
  p.angle = aim;
  // Hitscan: the first person or car in the line of fire takes the hit.
  let best = null, bestD = PLAYER.pistolRange;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > bestD) continue;
    const a = angleTo(p.x, p.y, ped.x, ped.y);
    if (Math.abs(angDiff(aim, a)) < 0.12) { best = ped; bestD = d; }
  }
  G.particles.push({ kind: 'muzzle', x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20, life: 0.08, max: 0.08 });
  G.particles.push({ kind: 'tracer', x: p.x, y: p.y, x2: p.x + Math.cos(aim) * bestD, y2: p.y + Math.sin(aim) * bestD, life: 0.1, max: 0.1 });
  if (best) {
    hurtPed(G, best, PLAYER.pistolDamage, aim);
    G.wanted.add(1, 'Fired a weapon');
  }
}

export function hurtPed(G, ped, dmg, fromAngle) {
  ped.health -= dmg;
  ped.scared = 1;
  if (ped.gang) {
    ped.state = 'chase';
    ped.target = G.player;
  } else if (ped.health > 0) {
    ped.state = 'flee';
    ped.fleeAngle = fromAngle;
    ped.stateT = 2.5;
  }
  G.particles.push({ kind: 'hit', x: ped.x, y: ped.y, life: 0.3, max: 0.3 });
  if (ped.health <= 0 && !ped.dead) {
    ped.dead = true;
    ped.state = 'dead';
    G.stats.kills += 1;
    if (ped.cop) {
      G.wanted.add(2, 'Took down an officer');
    } else if (!ped.gang) {
      G.wanted.add(1, 'Hurt a bystander');
    }
    // Cash drops from gang members.
    if (ped.gang && G.rng() < 0.7) {
      G.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', value: 40 + Math.floor(G.rng() * 60) });
    }
  }
}

/** Pedestrians stroll the sidewalks, flee from danger, gang members hunt the player. */
export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    // Flee a fast car bearing down: step aside before it arrives.
    if (ped.state !== 'flee' && ped.state !== 'chase') {
      for (const car of G.cars) {
        if (Math.abs(car.speed) < 150) continue;
        const d = Math.hypot(car.x - ped.x, car.y - ped.y);
        if (d > 90) continue;
        const approaching = (car.x - ped.x) * Math.cos(car.angle) + (car.y - ped.y) * Math.sin(car.angle) > 0;
        if (approaching) {
          ped.state = 'flee';
          ped.fleeAngle = Math.atan2(ped.y - car.y, ped.x - car.x) + (G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
          ped.stateT = 1.2;
          break;
        }
      }
    }
    if (ped.stateT > 0) ped.stateT -= dt;
    if (ped.state === 'flee') {
      ped.angle = ped.fleeAngle ?? ped.angle;
      ped.x += Math.cos(ped.angle) * 170 * dt;
      ped.y += Math.sin(ped.angle) * 170 * dt;
      resolveCollision(G.city, ped, 12);
      if (ped.stateT <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.state === 'chase' && ped.target) {
      const t = ped.target;
      const d = Math.hypot(t.x - ped.x, t.y - ped.y);
      ped.angle = angleTo(ped.x, ped.y, t.x, t.y);
      if (d > 40) {
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
        resolveCollision(G.city, ped, 12);
      } else if (ped.shootT <= 0) {
        ped.shootT = 1.1;
        G.particles.push({ kind: 'muzzle', x: ped.x, y: ped.y, life: 0.08, max: 0.08 });
        if (G.rng() < 0.55) {
          hurtPlayer(G, 8, ped);
          G.audio.shoot();
        }
      }
      if (ped.shootT > 0) ped.shootT -= dt;
      continue;
    }
    // Stroll: wander, changing direction at random.
    if (G.rng() < dt * 0.25) ped.angle = G.rng() * Math.PI * 2;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (solidAt(G.city, ped.x, ped.y, 12)) {
      ped.x -= Math.cos(ped.angle) * ped.speed * dt * 2;
      ped.y -= Math.sin(ped.angle) * ped.speed * dt * 2;
      ped.angle += Math.PI / 2;
    }
    // Run over by a fast car: only the player's (or a police) car counts as a crime.
    // Traffic never runs anyone over — it brakes for pedestrians instead.
    // During a screenshot scene the car passes through harmlessly: the staged stars
    // are the ones that must show.
    for (const car of G.cars) {
      if (G.shotMode) break;
      if (Math.abs(car.speed) < 120) continue;
      if (car.driver !== 'player' && car.driver !== 'police') continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26) {
        hurtPed(G, ped, 100, car.angle);
        if (car.driver === 'player') G.wanted.add(1, 'Ran someone over');
        break;
      }
    }
  }
  // Keep the streets populated.
  const alive = G.peds.filter((p) => !p.dead).length;
  if (alive < 26 && G.rng() < dt * 0.5) {
    const x = G.player.x + (G.rng() - 0.5) * 1400;
    const y = G.player.y + (G.rng() - 0.5) * 1400;
    if (!solidAt(G.city, x, y, 16)) G.peds.push(makePed(x, y));
  }
}

export function hurtPlayer(G, dmg, from) {
  const p = G.player;
  if (p.invulnerable > 0 || G.mode !== 'playing') return;
  p.health -= dmg;
  p.invulnerable = 0.5;
  G.particles.push({ kind: 'hit', x: p.x, y: p.y, life: 0.3, max: 0.3 });
  if (p.health <= 0) {
    p.health = 0;
    G.onWasted();
  }
}
