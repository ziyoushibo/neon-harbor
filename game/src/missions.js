// Neon Harbor — the story: four missions from Mara, the fixer at the garage.
// Talk to Mara (E) to start the next job; each job pays cash and unlocks the next.
import { LANDMARKS } from './city.js';
import { makePed } from './people.js';
import { dist2 } from './config.js';

export const MISSIONS = [
  {
    name: 'First Wheels',
    brief: 'Mara needs a driver. Steal any car, then bring it to Neon Paint for a fresh coat.',
    reward: 200,
  },
  {
    name: 'Harbor Run',
    brief: 'Pick up the package at the Harbor Warehouse and deliver it to Pier 9 in 90 seconds. The cops will be watching.',
    reward: 400,
  },
  {
    name: 'Turf War',
    brief: 'The Red Jackals took Liberty Plaza. Take it back — all five of them.',
    reward: 600,
  },
  {
    name: 'The Big Getaway',
    brief: 'Three stars and the whole PD on you. Get back to the garage, then lose them. Survive and the city is yours.',
    reward: 1000,
  },
];

export function createMissions(G) {
  const M = {
    idx: 0,            // which mission is next
    active: false,
    step: 0,
    timer: 0,
    done: [false, false, false, false],
    talkTarget: { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, label: "Mara — press E to talk" },
    marker: null,
    text: '',
    gangLeft: 0,

    onTalk() {
      if (M.active) return;
      if (M.idx >= MISSIONS.length) {
        G.toast('Mara: You run this city now. Enjoy it, kid.');
        return;
      }
      M.active = true;
      M.step = 0;
      M.timer = 0;
      const m = MISSIONS[M.idx];
      G.toast(`New job: ${m.name} — ${m.brief}`);
      G.audio.jingle();
      if (M.idx === 0) {
        M.text = 'Steal a car (walk up to one, press E)';
        M.marker = null;
      } else if (M.idx === 1) {
        M.text = 'Go to the Harbor Warehouse (E to pick up the package)';
        M.talkTarget = { x: LANDMARKS.warehouse.x, y: LANDMARKS.warehouse.y, label: 'Warehouse — press E' };
        M.marker = { x: LANDMARKS.warehouse.x, y: LANDMARKS.warehouse.y };
      } else if (M.idx === 2) {
        M.text = 'Go to Liberty Plaza';
        M.marker = { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y };
      } else if (M.idx === 3) {
        M.text = 'Get back to the garage — with the cops on you';
        M.marker = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y };
        G.wanted.add(3, 'The Big Getaway');
      }
    },

    complete() {
      const m = MISSIONS[M.idx];
      G.player.cash += m.reward;
      G.stats.missionsDone += 1;
      M.done[M.idx] = true;
      M.idx += 1;
      M.active = false;
      M.step = 0;
      M.marker = null;
      M.text = '';
      G.toast(`Job done: ${m.name}. +$${m.reward}.`);
      G.audio.jingle();
      G.saveGame();
      if (M.idx >= MISSIONS.length) {
        G.toast('KING OF NEON HARBOR — every job done. The city is yours.');
      } else {
        M.talkTarget = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, label: "Mara — press E for the next job" };
      }
    },

    update(dt) {
      if (!M.active) return;
      if (M.idx === 0) {
        if (M.step === 0) {
          if (G.player.inCar) {
            M.step = 1;
            M.text = 'Drive to Neon Paint (the spray shop)';
            M.marker = { x: LANDMARKS.sprayShop.x, y: LANDMARKS.sprayShop.y };
          }
        } else if (dist2(G.player.x, G.player.y, LANDMARKS.sprayShop.x, LANDMARKS.sprayShop.y) < 90 * 90) {
          G.toast('Fresh paint, clean plates. Nice wheels.');
          M.complete();
        }
      } else if (M.idx === 1) {
        if (M.step === 0) {
          if (dist2(G.player.x, G.player.y, LANDMARKS.warehouse.x, LANDMARKS.warehouse.y) < 80 * 80) {
            M.step = 1;
            M.timer = 90;
            M.text = 'Deliver to Pier 9 — 90 seconds!';
            M.marker = { x: LANDMARKS.pier9.x, y: LANDMARKS.pier9.y };
            G.wanted.add(2, 'The package is hot');
            G.toast('Package secured. Go, go, go!');
          }
        } else {
          M.timer -= dt;
          M.text = `Deliver to Pier 9 — ${Math.max(0, Math.ceil(M.timer))}s left`;
          if (dist2(G.player.x, G.player.y, LANDMARKS.pier9.x, LANDMARKS.pier9.y) < 90 * 90) {
            M.complete();
          } else if (M.timer <= 0) {
            M.active = false;
            M.step = 0;
            M.marker = null;
            M.text = '';
            G.wanted.clear();
            G.toast('Too slow — the buyer walked. Talk to Mara to try again.');
            M.talkTarget = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, label: "Mara — press E to retry" };
          }
        }
      } else if (M.idx === 2) {
        if (M.step === 0) {
          if (dist2(G.player.x, G.player.y, LANDMARKS.plaza.x, LANDMARKS.plaza.y) < 160 * 160) {
            M.step = 1;
            M.gangLeft = 5;
            for (let i = 0; i < 5; i += 1) {
              const gx = LANDMARKS.plaza.x + (G.rng() - 0.5) * 260;
              const gy = LANDMARKS.plaza.y + (G.rng() - 0.5) * 260;
              const g = makePed(gx, gy, { gang: true, color: '#c22e2e' });
              g.state = 'chase';
              g.target = G.player;
              G.peds.push(g);
            }
            M.text = 'Take back the plaza — defeat all 5 Jackals';
            G.toast('The Red Jackals are here. Take the plaza back!');
          }
        } else {
          const left = G.peds.filter((p) => p.gang && !p.dead).length;
          M.gangLeft = left;
          M.text = `Take back the plaza — ${left} Jackals left`;
          if (left === 0) {
            G.player.ammo += 24;
            M.complete();
          }
        }
      } else if (M.idx === 3) {
        if (M.step === 0) {
          if (dist2(G.player.x, G.player.y, LANDMARKS.hideout.x, LANDMARKS.hideout.y) < 100 * 100) {
            M.step = 1;
            M.text = 'Now lose the cops — get your wanted level to zero';
            M.marker = null;
          }
        } else if (G.wanted.stars === 0) {
          M.complete();
        }
      }
    },
  };
  return M;
}
