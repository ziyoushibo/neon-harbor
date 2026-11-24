// Neon Harbor — drawing only: the camera, the city, the cars, the people,
// the effects, and the minimap. Flat shapes, no images, no network.
import { COLORS, ROAD_W, WORLD } from './config.js';
import { roadCenters } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas, minimap) {
  const ctx = canvas.getContext('2d');
  const mctx = minimap ? minimap.getContext('2d') : null;
  const fonts = new Map();
  function font(size) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
    return fonts.get(size);
  }
  function text(c, value, x, y, size, color, align) {
    c.font = font(size);
    c.fillStyle = color;
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillText(value, x, y);
  }
  function circle(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  function rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }

  function drawGround(G, cam, vw, vh) {
    // Grass base.
    rect(ctx, cam.x, cam.y, vw, vh, COLORS.grass);
    // Beach + sea (south).
    if (cam.y + vh > 3300) {
      rect(ctx, cam.x, 3300, vw, 220, COLORS.sand);
      const t = G.time;
      for (let i = 0; i < 5; i += 1) {
        const wy = 3530 + i * 14 + Math.sin(t * 1.4 + i) * 4;
        ctx.fillStyle = i % 2 ? COLORS.water : COLORS.waterDeep;
        ctx.fillRect(cam.x, wy, vw, 7);
      }
      rect(ctx, cam.x, 3520, vw, Math.max(0, cam.y + vh - 3520), COLORS.water);
    }
    // Harbor water (east).
    if (cam.x + vw > 3300) {
      rect(ctx, 3300, cam.y, 120, vh, '#c9b18a'); // docks
      rect(ctx, 3420, cam.y, 100, vh, COLORS.waterDeep);
      rect(ctx, 3520, cam.y, Math.max(0, cam.x + vw - 3520), COLORS.water);
    }
    // Parks.
    for (const p of G.city.parks) {
      if (p.x + p.w < cam.x || p.x > cam.x + vw || p.y + p.h < cam.y || p.y > cam.y + vh) continue;
      rect(ctx, p.x, p.y, p.w, p.h, COLORS.park);
    }
    // Central plaza.
    const pl = G.city.plaza;
    rect(ctx, pl.x, pl.y, pl.w, pl.h, COLORS.plaza);
    circle(ctx, pl.x + pl.w / 2, pl.y + pl.h / 2, 34, '#7fb8d9');
    circle(ctx, pl.x + pl.w / 2, pl.y + pl.h / 2, 22, '#a8d4ea');
  }

  function drawRoads(G, cam, vw, vh) {
    const centers = roadCenters();
    ctx.lineCap = 'butt';
    for (const c of centers) {
      // Vertical roads.
      if (c + 45 > cam.x && c - 45 < cam.x + vw) {
        rect(ctx, c - 45 - 8, cam.y, ROAD_W + 16, vh, COLORS.sidewalk);
        rect(ctx, c - 45, cam.y, ROAD_W, vh, COLORS.road);
        ctx.strokeStyle = COLORS.roadLine;
        ctx.lineWidth = 3;
        ctx.setLineDash([26, 22]);
        ctx.beginPath();
        ctx.moveTo(c, cam.y);
        ctx.lineTo(c, cam.y + vh);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Horizontal roads.
      if (c + 45 > cam.y && c - 45 < cam.y + vh) {
        rect(ctx, cam.x, c - 45 - 8, vw, ROAD_W + 16, COLORS.sidewalk);
        rect(ctx, cam.x, c - 45, vw, ROAD_W, COLORS.road);
        ctx.strokeStyle = COLORS.roadLine;
        ctx.lineWidth = 3;
        ctx.setLineDash([26, 22]);
        ctx.beginPath();
        ctx.moveTo(cam.x, c);
        ctx.lineTo(cam.x + vw, c);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawBuildings(G, cam, vw, vh) {
    for (const b of G.city.buildings) {
      if (b.x + b.w < cam.x || b.x > cam.x + vw || b.y + b.h < cam.y || b.y > cam.y + vh) continue;
      // Soft shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      rect(ctx, b.x, b.y, b.w, b.h, b.wall);
      const inset = b.tall ? 14 : 10;
      rect(ctx, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, b.roof);
      // Windows.
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 14 + i * 34, b.y + 12 + j * 30, 12, 10);
        }
      }
      if (b.name) {
        text(ctx, b.name, b.x + b.w / 2, b.y - 8, 15, '#1f2a33', 'center');
      }
    }
    // Trees.
    for (const t of G.city.trees) {
      if (t.x < cam.x || t.x > cam.x + vw || t.y < cam.y || t.y > cam.y + vh) continue;
      circle(ctx, t.x, t.y, t.s, '#3f7d33');
      circle(ctx, t.x - 3, t.y - 3, t.s * 0.6, '#5a9e47');
    }
  }

  function drawDistrictLabels(G, cam, vw, vh) {
    for (const d of G.city.districts) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      if (cx < cam.x || cx > cam.x + vw || cy < cam.y || cy > cam.y + vh) continue;
      text(ctx, d.name.toUpperCase(), cx, cy, 26, 'rgba(255,255,255,0.4)', 'center');
    }
  }

  function drawCar(G, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-22, -12, 46, 26);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(-4, -9, 14, 18);
    ctx.fillStyle = 'rgba(180,220,240,0.7)';
    ctx.fillRect(8, -8, 6, 16);
    // Wheels.
    ctx.fillStyle = '#151515';
    ctx.fillRect(-16, -13, 10, 4);
    ctx.fillRect(-16, 9, 10, 4);
    ctx.fillRect(8, -13, 10, 4);
    ctx.fillRect(8, 9, 10, 4);
    if (car.police) {
      // White doors + flashing light bar.
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-8, -11, 16, 22);
      const flash = Math.floor(G.time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-2, -13, 5, 5);
      ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-2, 8, 5, 5);
    }
    if (car.health < 50) {
      ctx.fillStyle = 'rgba(60,60,60,0.8)';
      ctx.fillRect(-20, -6, 8, 12);
    }
    ctx.restore();
  }

  function drawPerson(G, ped) {
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(0.7);
      rect(ctx, -9, -4, 18, 8, '#5a5a5a');
      ctx.restore();
      return;
    }
    circle(ctx, ped.x, ped.y, 11, ped.color);
    circle(ctx, ped.x, ped.y, 11, 'rgba(0,0,0,0.15)');
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ped.x, ped.y);
    ctx.lineTo(ped.x + Math.cos(ped.angle) * 13, ped.y + Math.sin(ped.angle) * 13);
    ctx.stroke();
    if (ped.cop) {
      text(ctx, 'PD', ped.x, ped.y - 16, 11, '#1f2a33', 'center');
    }
    if (ped.gang) {
      text(ctx, '!', ped.x, ped.y - 16, 16, '#c22e2e', 'center');
    }
  }

  function drawParticles(G) {
    for (const pt of G.particles) {
      const a = pt.life / pt.max;
      if (pt.kind === 'smoke') {
        circle(ctx, pt.x, pt.y, 8 + (1 - a) * 14, `rgba(120,120,120,${0.5 * a})`);
      } else if (pt.kind === 'spark') {
        circle(ctx, pt.x, pt.y, 4 * a + 2, '#ffd94f');
      } else if (pt.kind === 'muzzle') {
        circle(ctx, pt.x, pt.y, 7, '#ffe14f');
      } else if (pt.kind === 'tracer') {
        ctx.strokeStyle = `rgba(255,220,80,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x2, pt.y2);
        ctx.stroke();
      } else if (pt.kind === 'hit') {
        circle(ctx, pt.x, pt.y, 6 * a, '#ff4f4f');
      } else if (pt.kind === 'skid') {
        circle(ctx, pt.x, pt.y, 5, 'rgba(20,20,20,0.35)');
      }
    }
  }

  function drawMarker(G) {
    const m = G.missions.marker;
    if (!m) return;
    const pulse = 1 + Math.sin(G.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd94f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94f';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 14);
    ctx.lineTo(m.x + 10, m.y + 8);
    ctx.lineTo(m.x - 10, m.y + 8);
    ctx.closePath();
    ctx.fill();
    const d = Math.round(Math.hypot(G.player.x - m.x, G.player.y - m.y));
    text(ctx, `${d}m`, m.x, m.y - 34, 15, '#ffd94f', 'center');
  }

  function drawTalk(G) {
    const t = G.missions.talkTarget;
    if (!t || G.missions.active) return;
    const d = Math.hypot(G.player.x - t.x, G.player.y - t.y);
    if (d > 320) return;
    text(ctx, t.label, t.x, t.y - 30, 15, '#ffffff', 'center');
    circle(ctx, t.x, t.y, 12, '#ffd94f');
    text(ctx, 'M', t.x, t.y + 5, 13, '#1f2a33', 'center');
  }

  function drawMinimap(G) {
    if (!mctx) return;
    const S = 168;
    const scale = S / WORLD;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#2e4a3a';
    mctx.fillRect(0, 0, S, S);
    mctx.fillStyle = '#3a3f47';
    for (const c of roadCenters()) {
      mctx.fillRect(c * scale - 2, 0, 4, S);
      mctx.fillRect(0, c * scale - 2, S, 4);
    }
    mctx.fillStyle = '#2e7fb8';
    mctx.fillRect(0, 3520 * scale, S, S - 3520 * scale);
    mctx.fillRect(3520 * scale, 0, S - 3520 * scale, S);
    const dot = (x, y, r, color) => {
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.arc(x * scale, y * scale, r, 0, Math.PI * 2);
      mctx.fill();
    };
    if (G.missions.marker) dot(G.missions.marker.x, G.missions.marker.y, 4, '#ffd94f');
    for (const car of G.cars) {
      if (car.police) dot(car.x, car.y, 2.5, Math.floor(G.time * 4) % 2 ? '#ff2e2e' : '#2e6bff');
      else if (car.driver === 'player') dot(car.x, car.y, 3, '#ffffff');
    }
    for (const ped of G.peds) {
      if (ped.cop && !ped.dead) dot(ped.x, ped.y, 2, '#2e6bff');
      else if (ped.gang && !ped.dead) dot(ped.x, ped.y, 2, '#ff2e2e');
    }
    dot(G.player.x, G.player.y, 3.5, '#ffffff');
    mctx.strokeStyle = 'rgba(255,255,255,0.7)';
    mctx.lineWidth = 1.5;
    mctx.strokeRect(0.75, 0.75, S - 1.5, S - 1.5);
  }

  function draw(G, screen) {
    const vw = canvas.width / (window.devicePixelRatio || 1);
    const vh = canvas.height / (window.devicePixelRatio || 1);
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, vw, vh);
    const cam = G.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(G, cam, vw, vh);
    drawRoads(G, cam, vw, vh);
    drawDistrictLabels(G, cam, vw, vh);
    drawBuildings(G, cam, vw, vh);
    // Pickups.
    for (const pk of G.pickups) {
      if (pk.kind === 'cash') {
        circle(ctx, pk.x, pk.y, 10, '#2e9e4f');
        text(ctx, '$', pk.x, pk.y + 5, 14, '#ffffff', 'center');
      } else {
        rect(ctx, pk.x - 9, pk.y - 7, 18, 14, '#8a6f2e');
        text(ctx, 'AMMO', pk.x, pk.y + 4, 8, '#ffffff', 'center');
      }
    }
    drawMarker(G);
    drawTalk(G);
    for (const car of G.cars) drawCar(G, car);
    for (const ped of G.peds) drawPerson(G, ped);
    // Player.
    const p = G.player;
    if (!p.inCar) {
      if (p.punchT > 0) {
        ctx.strokeStyle = '#ffd94f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, p.angle - 0.9, p.angle + 0.9);
        ctx.stroke();
      }
      circle(ctx, p.x, p.y, 13, '#ff7b2e');
      circle(ctx, p.x, p.y, 6, '#ffd9b0');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 15, p.y + Math.sin(p.angle) * 15);
      ctx.stroke();
    }
    drawParticles(G);
    ctx.restore();
    drawMinimap(G);
    // Vignette for the menu backdrop.
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10,14,22,0.45)';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
