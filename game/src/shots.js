// Neon Harbor — the screenshot scenes behind ?shot=cover|mission|chase|start.
// Each one stages a real, playable moment (a chase, a mission, the title screen)
// from a fresh game, so the frame is what the game really looks like.
import { LANDMARKS } from './city.js';
import { makeCar } from './vehicles.js';
import { makePed } from './people.js';
import { angDiff, clamp } from './config.js';

// A simple autopilot for the screenshot scenes: hold the throttle, steer back to
// heading east, and swerve around any car directly ahead. It only drives the
// player's car while a shot plays in.
export function createShotInput(G) {
  return {
    axis() {
      const car = G.player.inCar;
      if (!car) return { x: 0, y: 0 };
      let steer = 0;
      let ahead = null;
      for (const c of G.cars) {
        if (c === car) continue;
        const dx = c.x - car.x, dy = c.y - car.y;
        const fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (fwd > 0 && fwd < 150 && Math.abs(side) < 55) { ahead = { side }; break; }
      }
      if (ahead) steer = ahead.side > 0 ? -1 : 1;
      else steer = clamp(angDiff(car.angle, 0) * 2, -1, 1);
      return { x: steer, y: -1 };
    },
    isDown: () => false,
    wasPressed: () => false,
    mouse: { x: 640, y: 400, clicked: false },
    endFrame: () => {},
  };
}

function placePlayerInCar(G, x, y, angle, color, model, speed) {
  const car = makeCar(x, y, angle, { color, model });
  car.driver = 'player';
  car.speed = speed;
  G.cars.push(car);
  G.player.inCar = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function addPoliceChase(G, spots, speed) {
  for (const [x, y] of spots) {
    const car = makeCar(x, y, 0, { police: true, driver: 'police', color: '#1f2a33' });
    car.speed = speed;
    car.siren = true;
    G.cars.push(car);
  }
}

export function stageShot(G, name) {
  G.mode = 'playing';
  if (name === 'cover') {
    // The cover: tearing down Ocean Drive in a red sportscar, two stars, cruisers behind.
    placePlayerInCar(G, 1200, 3375, 0, '#d94f3d', 'Sport', 430);
    G.wanted.stars = 2;
    addPoliceChase(G, [[1060, 3375], [980, 3375]], 540);
    for (let i = 0; i < 4; i += 1) {
      const t = makeCar(1900 + i * 160, 3375 + (i % 2 ? 22 : -22), 0, { traffic: true, driver: 'traffic' });
      t.speed = 130;
      G.cars.push(t);
    }
    G.missions.text = 'Free roam — talk to Mara at the garage for work';
    return 'play';
  }
  if (name === 'mission') {
    // The turf war: on foot at Liberty Plaza, five Red Jackals closing in.
    G.player.x = 1650;
    G.player.y = 1800;
    G.player.angle = 0.6;
    G.player.ammo = 24;
    const M = G.missions;
    M.idx = 2;
    M.active = true;
    M.step = 1;
    M.gangLeft = 5;
    for (let i = 0; i < 5; i += 1) {
      const g = makePed(LANDMARKS.plaza.x + (G.rng() - 0.5) * 260, LANDMARKS.plaza.y + (G.rng() - 0.5) * 260, { gang: true, color: '#c22e2e' });
      g.state = 'chase';
      g.target = G.player;
      G.peds.push(g);
    }
    M.text = 'Take back the plaza — 5 Jackals left';
    return 'play';
  }
  if (name === 'chase') {
    // Three stars, three cruisers, a smoking getaway car downtown.
    const car = placePlayerInCar(G, 1400, 1575, 0, '#3d7dd9', 'Sedan', 500);
    car.health = 55;
    G.wanted.stars = 3;
    addPoliceChase(G, [[1280, 1575], [1220, 1530], [1300, 1620]], 520);
    G.particles.push({ kind: 'smoke', x: car.x, y: car.y, life: 0.9, max: 0.9 });
    G.missions.text = 'Lose the cops — get your wanted level to zero';
    return 'play';
  }
  // start: the title screen over a living downtown.
  G.mode = 'menu';
  G.player.x = 1800;
  G.player.y = 1800;
  G.camera.x = 1350;
  G.camera.y = 1000;
  return 'title';
}
