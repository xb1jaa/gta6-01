// The HUD: wanted stars, money, health, the clock, the mission objective,
// the speedometer, and a live minimap of the city with the player, traffic,
// police and the mission marker on it.

import { CITY } from './config.js';

export function createHud() {
  const hud = document.getElementById('hud');
  const wantedEl = document.getElementById('wanted');
  const moneyEl = document.getElementById('money');
  const healthFill = document.getElementById('healthfill');
  const clockEl = document.getElementById('clock');
  const objectiveEl = document.getElementById('objective');
  const speedoEl = document.getElementById('speedo');
  const weaponEl = document.getElementById('weapon');
  const crosshairEl = document.getElementById('crosshair');
  const toastEl = document.getElementById('toast');
  const map = document.getElementById('minimap');
  const mapCtx = map.getContext('2d');
  let toastTimer = 0;

  function show(on) {
    hud.classList.toggle('on', on);
  }

  function toast(text, seconds = 2.5) {
    toastEl.textContent = text;
    toastTimer = seconds;
  }

  function update(state, dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.textContent = '';
    }
    let stars = '';
    for (let i = 0; i < 5; i += 1) {
      stars += i < state.wanted ? '★' : '<span class="off">★</span>';
    }
    wantedEl.innerHTML = stars;
    moneyEl.textContent = `$${state.money.toLocaleString('en-US')}`;
    healthFill.style.width = `${Math.max(0, state.health)}%`;
    healthFill.style.background = state.health > 50
      ? 'linear-gradient(90deg, #37d67a, #7dff9a)'
      : 'linear-gradient(90deg, #d63737, #ff7d7d)';
    const hours = Math.floor(state.clock / 60) % 24;
    const minutes = Math.floor(state.clock % 60);
    clockEl.textContent = `Solmar Bay · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} · Day ${Math.floor(state.clock / 1440) + 1}`;
    objectiveEl.innerHTML = state.objective
      ? `${state.objective}<span class="sub">${state.objectiveSub || ''}</span>`
      : '';
    if (state.inCar) {
      speedoEl.style.display = 'block';
      speedoEl.innerHTML = `${Math.round(Math.abs(state.speed) * 2.4)} <small>mph</small>`;
    } else {
      speedoEl.style.display = 'none';
    }
    weaponEl.textContent = state.inCar ? '' : (state.weapon === 'pistol' ? `Pistol · ${state.ammo} / 12` : 'Fists');
    crosshairEl.style.display = !state.inCar && state.weapon === 'pistol' ? 'block' : 'none';
  }

  /** Draw the minimap. `view` carries the world the map shows. */
  function drawMinimap(view) {
    const W = map.width;
    const H = map.height;
    const span = CITY.half * 2 + 90;
    const scale = W / span;
    const toMap = (x, z) => [(x + span / 2) * scale, (z + span / 2) * scale];
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = '#1c2a1c';
    mapCtx.fillRect(0, 0, W, H);
    // Sea at the south edge.
    mapCtx.fillStyle = '#1e5f8a';
    const [, seaY] = toMap(0, CITY.half + 10);
    mapCtx.fillRect(0, seaY, W, H - seaY);
    // Blocks.
    mapCtx.fillStyle = '#3a3f46';
    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const [x, y] = toMap(-CITY.half + i * CITY.block + 7, -CITY.half + j * CITY.block + 7);
        mapCtx.fillRect(x, y, (CITY.block - 14) * scale, (CITY.block - 14) * scale);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#6a6f76';
    mapCtx.lineWidth = 2;
    for (let k = 0; k <= 8; k += 1) {
      const at = -CITY.half + k * CITY.block;
      const [x1, y1] = toMap(at, -CITY.half);
      const [x2, y2] = toMap(at, CITY.half);
      mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
      const [x3, y3] = toMap(-CITY.half, at);
      const [x4, y4] = toMap(CITY.half, at);
      mapCtx.beginPath(); mapCtx.moveTo(x3, y3); mapCtx.lineTo(x4, y4); mapCtx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    if (view.marker) {
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      dot(view.marker.x, view.marker.z, '#ffd23e', pulse);
      mapCtx.strokeStyle = '#ffd23e';
      mapCtx.lineWidth = 2;
      const [mx, my] = toMap(view.marker.x, view.marker.z);
      mapCtx.beginPath();
      mapCtx.arc(mx, my, pulse + 5, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    for (const e of view.enemies || []) dot(e.x, e.z, '#ff4444', 3);
    for (const c of view.cars || []) dot(c.x, c.z, c.isPolice ? '#4488ff' : '#ffd23e', 2.5);
    // Player arrow.
    const [px, py] = toMap(view.player.x, view.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(view.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return { show, toast, update, drawMinimap };
}
