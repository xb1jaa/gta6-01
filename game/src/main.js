// Solmar Bay: boot and the one loop. The game moves between title, play, paused,
// busted and wasted screens. The world advances in fixed 1/60 s steps; the
// renderer paints what is there. ?shot=start|play|chase|mission stages a scene
// for a screenshot instead of running the loop, and sets window.__shotReady.
//
// ?seed=N fixes the city's random layout.

import * as THREE from 'three';
import { STEP, CITY, PLAYER, CAR, TRAFFIC, PEDS, WANTED, COMBAT, SAVE_KEY, MISSION_REWARDS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, ACTION_WEAPON1, ACTION_WEAPON2, ACTION_MUTE, ACTION_CONFIRM, ACTION_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { makeCar, makeCarMesh, spawnTrafficCar, updateTrafficCar, drivePlayerCar, updatePoliceCar, syncCarMesh } from './vehicles.js';
import { makePersonMesh, makePedestrian, updatePedestrian, makeOfficer, updateOfficer, makeEnemy, updateEnemy, animateWalk } from './people.js';
import { MISSIONS, missionById, nextMissionId } from './missions.js';
import { shoot, punch, updateTracers } from './combat.js';
import { createHud } from './hud.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;
const random = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const screenEl = document.getElementById('screen');
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

// --- Three.js setup: dusk light over the bay. ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff9a5c);
scene.fog = new THREE.Fog(0xffb37a, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a5a, 1.15);
scene.add(hemi);
// Fill light from the north so the shadow sides of buildings still read.
const fill = new THREE.DirectionalLight(0x9ab8e0, 0.55);
fill.position.set(120, 90, -220);
scene.add(fill);
const sun = new THREE.DirectionalLight(0xffb37a, 1.6);
sun.position.set(-180, 120, 260);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
scene.add(sun);

const { solids, landmarks } = buildCity(scene, random);

// --- World state. ---
const state = {
  screen: 'title', // title | play | paused | busted | wasted
  money: 250,
  health: PLAYER.health,
  wanted: 0,
  wantedTimer: 0,
  clock: 17 * 60 + 32, // 17:32, sunset over the bay
  weapon: 'fists',
  ammo: COMBAT.pistolAmmo,
  reloadTimer: 0,
  shootCooldown: 0,
  punchCooldown: 0,
  missionId: 0, // next mission to start; -1 when the story is done
  missionActive: null, // {mission, step}
  missionDone: [],
  objective: 'Explore Solmar Bay',
  objectiveSub: 'Walk into the yellow marker to start your first job',
  toast: '',
};

const player = {
  mesh: makePersonMesh(0x2f6fb2, 0x2c2f36, 0xd9a066),
  x: 0, z: 120, y: 0, vy: 0, heading: Math.PI, camYaw: Math.PI,
  camPitch: 0.32, walkPhase: 0, onGround: true, inCar: null, speed: 0,
};
scene.add(player.mesh);

const cars = [];
const peds = [];
const officers = [];
const enemies = [];
let targetCar = null; // the yellow Comet GT for mission 1
let rico = null; // Rico, waiting at the marina for mission 0

function spawnTraffic() {
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const car = spawnTrafficCar(random);
    cars.push(car);
    scene.add(car.mesh);
    syncCarMesh(car);
  }
  // Parked cars along the roads.
  for (let i = 0; i < 10; i += 1) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const at = -CITY.half + Math.floor(random() * 9) * CITY.block;
    const along = -CITY.half + 20 + random() * (CITY.half * 2 - 40);
    const car = makeCar('parked', axis === 'x' ? along : at + 5.5, axis === 'x' ? at + 5.5 : along, axis === 'x' ? Math.PI / 2 : 0, [0xc23b3b, 0x3b6fc2, 0xd8d8d8, 0x2f8a7a][i % 4]);
    car.driver = false;
    cars.push(car);
    scene.add(car.mesh);
    syncCarMesh(car);
  }
}

function spawnPeds() {
  for (let i = 0; i < PEDS.count; i += 1) {
    const ped = makePedestrian(random);
    peds.push(ped);
    scene.add(ped.mesh);
    ped.mesh.position.set(ped.x, 0, ped.z);
  }
}

function addWanted(stars) {
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.wantedTimer = 0;
}

function announce(message) {
  status.textContent = message;
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, health: state.health, missionId: state.missionId,
      missionDone: state.missionDone, x: player.x, z: player.z, wanted: state.wanted,
      clock: state.clock,
    }));
  } catch { /* storage off: the save lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(save) {
  state.money = save.money;
  state.health = save.health;
  state.missionId = save.missionId;
  state.missionDone = save.missionDone || [];
  player.x = save.x;
  player.z = save.z;
  state.wanted = save.wanted || 0;
  state.clock = save.clock || state.clock;
}

// --- Mission markers: a yellow beacon pillar + light at the current target. ---
const markerGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const marker = new THREE.Mesh(markerGeo, markerMat);
marker.visible = false;
scene.add(marker);
const markerLight = new THREE.PointLight(0xffd23e, 1.2, 30);
scene.add(markerLight);

function markerTarget() {
  if (state.missionActive) {
    const step = state.missionActive.mission.steps[state.missionActive.step];
    return landmarks[step.target];
  }
  if (state.missionId >= 0) {
    return landmarks[MISSIONS[state.missionId].steps[0].target];
  }
  return null;
}

function updateMarker() {
  const target = markerTarget();
  if (!target) {
    marker.visible = false;
    markerLight.visible = false;
    return;
  }
  marker.visible = true;
  markerLight.visible = true;
  marker.position.set(target.x, 30, target.z);
  markerLight.position.set(target.x, 4, target.z);
  marker.rotation.y += 0.02;
}

// --- Missions. ---
function startMission(id) {
  const mission = missionById(id);
  if (!mission) return;
  state.missionActive = { mission, step: 0 };
  state.objective = mission.title;
  state.objectiveSub = mission.steps[0].text;
  hud.toast(`${mission.title} — ${mission.briefing}`, 5);
  announce(`Mission started: ${mission.title}. ${mission.steps[0].text}`);
  audio.pickup();
  if (id === 0 && !rico) {
    rico = makePersonMesh(0xc23b3b, 0x2c2f36, 0x8a5a3b);
    const m = landmarks.marina;
    rico.position.set(m.x + 3, 0, m.z - 3);
    scene.add(rico);
  }
  if (id === 1 && !targetCar) {
    // The Comet GT is parked on the road by the casino, in the open.
    targetCar = makeCar('parked', landmarks.casino.x - 4, landmarks.casino.z, Math.PI, 0xf2c230);
    targetCar.driver = false;
    targetCar.isTarget = true;
    cars.push(targetCar);
    scene.add(targetCar.mesh);
    syncCarMesh(targetCar);
  }
}

function advanceStep() {
  const active = state.missionActive;
  if (!active) return;
  active.step += 1;
  const mission = active.mission;
  if (active.step >= mission.steps.length) {
    completeMission(mission);
    return;
  }
  const step = mission.steps[active.step];
  state.objectiveSub = step.text;
  announce(step.text);
  if (mission.id === 2 && step.type === 'kill') spawnEnemies();
  if (mission.id === 3 && step.type === 'escape') {
    addWanted(4);
    hud.toast('The whole Solmar PD is on you — RUN!', 4);
  }
}

function completeMission(mission) {
  state.money += mission.reward;
  state.missionDone.push(mission.id);
  state.missionActive = null;
  state.missionId = nextMissionId(mission.id);
  state.objective = state.missionId >= 0
    ? `${MISSIONS[state.missionId].title} — walk to the yellow marker`
    : 'Story complete — Solmar Bay is yours';
  state.objectiveSub = state.missionId >= 0 ? MISSIONS[state.missionId].briefing : 'Free roam: explore, earn, survive';
  hud.toast(`Mission complete — $${mission.reward}`, 4);
  audio.missionDone();
  announce(`Mission complete. Earned $${mission.reward}.`);
  saveGame();
}

function spawnEnemies() {
  // The Vipers hold the road by the old warehouse, in the open where the
  // player can see and shoot them — never inside a building.
  const base = landmarks.warehouse;
  for (let i = 0; i < 4; i += 1) {
    const enemy = makeEnemy(base.x - 12 + i * 8, base.z + (i % 2 === 0 ? 2 : -2));
    enemies.push(enemy);
    scene.add(enemy.mesh);
    enemy.mesh.position.set(enemy.x, 0, enemy.z);
  }
}

function checkMissionStep(dt) {
  const active = state.missionActive;
  if (!active) {
    // Walk (or drive) into the start marker to begin the next mission.
    if (state.missionId >= 0) {
      const target = landmarks[MISSIONS[state.missionId].steps[0].target];
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      if (Math.hypot(px - target.x, pz - target.z) < 6) startMission(state.missionId);
    }
    return;
  }
  const step = active.mission.steps[active.step];
  const target = landmarks[step.target];
  // The player's effective position: the car, when driving, else on foot.
  // (Driving to a mission marker must count, or a delivery by car could
  // never complete.)
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  const dist = Math.hypot(px - target.x, pz - target.z);
  if (step.type === 'reach') {
    if (dist < step.radius) advanceStep();
  } else if (step.type === 'steal') {
    if (player.inCar === targetCar) {
      addWanted(2);
      hud.toast('Car stolen! The cops are coming.', 3);
      advanceStep();
    }
  } else if (step.type === 'deliver') {
    if (player.inCar === targetCar && dist < step.radius) advanceStep();
  } else if (step.type === 'kill') {
    if (enemies.every((e) => !e.alive)) advanceStep();
  } else if (step.type === 'escape') {
    if (dist < step.radius) advanceStep();
  }
}

// --- Player on foot. ---
function collideCircle(x, z, radius) {
  for (const s of solids) {
    const cx = Math.max(s.minX, Math.min(x, s.maxX));
    const cz = Math.max(s.minZ, Math.min(z, s.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.01;
      const push = radius - d;
      x += (dx / d) * push;
      z += (dz / d) * push;
    }
  }
  return { x, z };
}

function updatePlayerOnFoot(dt, actions) {
  const drag = input.takeDrag();
  player.camYaw -= drag.x * 0.005;
  player.camPitch = Math.max(-0.15, Math.min(0.9, player.camPitch + drag.y * 0.003));
  const fwdX = Math.sin(player.camYaw);
  const fwdZ = Math.cos(player.camYaw);
  const rightX = Math.cos(player.camYaw);
  const rightZ = -Math.sin(player.camYaw);
  let mx = 0;
  let mz = 0;
  if (input.held.up) { mx += fwdX; mz += fwdZ; }
  if (input.held.down) { mx -= fwdX; mz -= fwdZ; }
  if (input.held.right) { mx += rightX; mz += rightZ; }
  if (input.held.left) { mx -= rightX; mz -= rightZ; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    mx /= len;
    mz /= len;
    const next = collideCircle(player.x + mx * speed * dt, player.z + mz * speed * dt, PLAYER.radius);
    player.x = next.x;
    player.z = next.z;
    player.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * speed * 1.6;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  // Jump and gravity.
  if (player.onGround && player.vy === 0 && (actions & ACTION_JUMP)) {
    player.vy = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= 22 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.heading;
  animateWalk(player.mesh, player.walkPhase, len > 0 ? 1 : 0);
}

// --- Entering and leaving cars. ---
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(car) {
  if (car.driver) {
    // Steal it: the driver flees on foot, the law notices.
    car.driver = false;
    const ped = makePedestrian(random);
    ped.x = car.x + 2;
    ped.z = car.z + 2;
    ped.flee = 3;
    peds.push(ped);
    scene.add(ped.mesh);
    addWanted(1);
    hud.toast('Car stolen!', 2.5);
  } else {
    hud.toast(car.isTarget ? 'That\'s the Comet GT!' : 'In the car', 1.5);
  }
  car.kind = 'player';
  player.inCar = car;
  player.mesh.visible = false;
  audio.carDoor();
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  // An abandoned car stays parked where it is: it has no road to follow,
  // and a parked car the traffic update would crash on a null road.
  car.kind = 'parked';
  car.speed = 0;
  const side = collideCircle(car.x + Math.cos(car.heading) * 2.5, car.z - Math.sin(car.heading) * 2.5, PLAYER.radius);
  player.x = side.x;
  player.z = side.z;
  player.y = 0;
  player.mesh.visible = true;
  player.camYaw = car.heading;
  audio.carDoor();
}

// --- Combat. ---
function fireWeapon() {
  if (state.weapon === 'pistol') {
    if (state.ammo <= 0) return;
    if (state.shootCooldown > 0) return;
    state.shootCooldown = COMBAT.pistolRate;
    state.ammo -= 1;
    audio.shoot();
    // Aim at the crosshair's point: 10 m ahead of the player at chest
    // height, so the bullet converges where the crosshair points instead of
    // angling into the ground under the chase camera.
    const aim = new THREE.Vector3(
      player.x + Math.sin(player.camYaw) * 10, 1.6,
      player.z + Math.cos(player.camYaw) * 10,
    );
    const origin = new THREE.Vector3(player.x, 1.4, player.z);
    const dir = aim.sub(origin).normalize();
    const targets = [];
    for (const e of enemies) {
      if (e.alive) targets.push({ mesh: e.mesh, onHit: () => damageEnemy(e, COMBAT.pistolDamage) });
    }
    for (const ped of peds) {
      targets.push({ mesh: ped.mesh, onHit: () => hitPed(ped, COMBAT.pistolDamage) });
    }
    for (const car of cars) {
      if (car !== player.inCar) targets.push({ mesh: car.mesh, onHit: () => {} });
    }
    shoot(origin, dir, targets, scene);
    if (state.ammo === 0) {
      state.reloadTimer = 1.5;
      hud.toast('Reloading…', 1.5);
    }
  } else {
    if (state.punchCooldown > 0) return;
    state.punchCooldown = COMBAT.fistRate;
    audio.punch();
    const targets = [];
    for (const e of enemies) {
      if (e.alive) targets.push({ x: e.x, z: e.z, onHit: () => damageEnemy(e, COMBAT.fistDamage) });
    }
    for (const ped of peds) {
      targets.push({ x: ped.x, z: ped.z, onHit: () => hitPed(ped, COMBAT.fistDamage) });
    }
    punch({ x: player.x, z: player.z }, player.heading, targets);
  }
}

function damageEnemy(enemy, amount) {
  enemy.health -= amount;
  if (enemy.health <= 0 && enemy.alive) {
    enemy.alive = false;
    enemy.mesh.rotation.x = -Math.PI / 2;
    enemy.mesh.position.y = 0.3;
    state.money += 50;
    hud.toast('Viper down — +$50', 1.5);
  }
}

function hitPed(ped, amount) {
  // Hurting a civilian is a crime, and the victim runs.
  addWanted(1);
  ped.flee = 3;
  ped.targetX = ped.x + (ped.x - player.x) * 3;
  ped.targetZ = ped.z + (ped.z - player.z) * 3;
  if (amount >= COMBAT.pistolDamage) {
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
    ped.dead = true;
  }
}

function damagePlayer(amount) {
  state.health -= amount;
  if (state.health <= 0) {
    state.health = 0;
    state.screen = 'wasted';
  }
}

// --- Police. ---
function syncPolice() {
  const wantCars = WANTED.policeCars[state.wanted];
  const wantFoot = WANTED.policeFoot[state.wanted];
  const policeCars = cars.filter((c) => c.kind === 'police');
  while (policeCars.length < wantCars) {
    const angle = random() * Math.PI * 2;
    const car = makeCar('police', player.x + Math.sin(angle) * 45, player.z + Math.cos(angle) * 45, angle, 0x1a2f5e, true);
    car.speed = 10;
    cars.push(car);
    scene.add(car.mesh);
    policeCars.push(car);
  }
  while (policeCars.length > wantCars) {
    const car = policeCars.pop();
    cars.splice(cars.indexOf(car), 1);
    scene.remove(car.mesh);
  }
  while (officers.length < wantFoot) {
    const angle = random() * Math.PI * 2;
    const off = makeOfficer(player.x + Math.sin(angle) * 30, player.z + Math.cos(angle) * 30);
    officers.push(off);
    scene.add(off.mesh);
  }
  while (officers.length > wantFoot) {
    const off = officers.pop();
    scene.remove(off.mesh);
  }
}

function updatePolice(dt) {
  const target = player.inCar || { x: player.x, z: player.z };
  let seen = false;
  for (const car of cars) {
    if (car.kind !== 'police') continue;
    const dist = updatePoliceCar(car, target.x, target.z, dt);
    if (dist < 45) seen = true;
    if (player.inCar && dist < 3.2) {
      // Rammed: the chase car slows the player down.
      player.inCar.speed *= 0.94;
    }
    if (!player.inCar && dist < 2.2) {
      damagePlayer(0); // contact alone does not hurt; officers do the busting
    }
    syncCarMesh(car);
  }
  for (const off of officers) {
    const result = updateOfficer(off, player.x, player.z, dt, () => {
      if (!player.inCar) damagePlayer(COMBAT.enemyDamage);
    });
    if (result === 'busted' && !player.inCar) {
      state.screen = 'busted';
      return;
    }
    if (Math.hypot(off.x - player.x, off.z - player.z) < 45) seen = true;
  }
  // Wanted decay: out of sight for a while, one star at a time.
  if (state.wanted > 0) {
    if (seen) state.wantedTimer = 0;
    else {
      state.wantedTimer += dt;
      if (state.wantedTimer > WANTED.decayDelay) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        hud.toast('You lost them — wanted level down', 2);
      }
    }
  }
}

// --- Screens. ---
function showScreen(html) {
  screenEl.innerHTML = html;
  screenEl.style.display = html ? 'flex' : 'none';
  hud.show(state.screen === 'play');
}

function showTitle() {
  const save = loadSave();
  showScreen(`
    <h1>SOLMAR <span class="bay">BAY</span></h1>
    <h2>An open-world crime game — explore the city, take jobs, lose the cops.</h2>
    <p class="story">Jax Moreno is out of prison and in debt to Rico, the man who got him out.
    Solmar Bay is yours: steal cars, run missions, and stay one step ahead of the Solmar PD.</p>
    <div>
      <button class="btn" id="btn-new">New Game</button>
      ${save ? '<button class="btn ghost" id="btn-continue">Continue</button>' : ''}
    </div>
    <div class="keys">WASD move / drive &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; Space jump &nbsp;·&nbsp; E enter / steal car<br>
    Mouse drag to look &nbsp;·&nbsp; Click to shoot &nbsp;·&nbsp; 1 fists · 2 pistol &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M mute</div>`);
  document.getElementById('btn-new').addEventListener('click', () => {
    audio.unlock();
    audio.click();
    startPlay(false);
  });
  const cont = document.getElementById('btn-continue');
  if (cont) cont.addEventListener('click', () => {
    audio.unlock();
    audio.click();
    startPlay(true);
  });
}

function showPaused() {
  showScreen(`
    <h1>PAUSED</h1>
    <h2>Solmar Bay waits for no one — except right now.</h2>
    <div><button class="btn" id="btn-resume">Resume</button></div>
    <div class="keys">Money $${state.money.toLocaleString('en-US')} &nbsp;·&nbsp; Missions done: ${state.missionDone.length} / ${MISSIONS.length}</div>`);
  document.getElementById('btn-resume').addEventListener('click', () => {
    audio.click();
    state.screen = 'play';
    showScreen('');
    hud.show(true);
  });
}

function showBusted() {
  const fine = Math.min(state.money, 200);
  state.money -= fine;
  state.wanted = 0;
  state.health = PLAYER.health;
  player.x = landmarks.hospital.x;
  player.z = landmarks.hospital.z;
  if (player.inCar) { player.inCar.kind = 'traffic'; player.inCar = null; player.mesh.visible = true; }
  audio.busted();
  saveGame();
  showScreen(`
    <h1>BUSTED</h1>
    <h2>The Solmar PD caught you. Fine: $${fine}. Back on the street at the hospital.</h2>
    <div><button class="btn" id="btn-back">Back to the streets</button></div>`);
  document.getElementById('btn-back').addEventListener('click', () => {
    audio.click();
    state.screen = 'play';
    showScreen('');
    hud.show(true);
  });
}

function showWasted() {
  const lost = Math.min(state.money, 300);
  state.money -= lost;
  state.wanted = Math.max(0, state.wanted - 2);
  state.health = PLAYER.health;
  player.x = landmarks.hospital.x;
  player.z = landmarks.hospital.z;
  if (player.inCar) { player.inCar.kind = 'traffic'; player.inCar = null; player.mesh.visible = true; }
  saveGame();
  showScreen(`
    <h1>WASTED</h1>
    <h2>You flatlined. The hospital patched you up — minus $${lost}.</h2>
    <div><button class="btn" id="btn-back">Back to the streets</button></div>`);
  document.getElementById('btn-back').addEventListener('click', () => {
    audio.click();
    state.screen = 'play';
    showScreen('');
    hud.show(true);
  });
}

function startPlay(fromSave) {
  if (fromSave) {
    const save = loadSave();
    if (save) applySave(save);
  } else {
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  input.takeActions(); // flush any clicks made on the title screen
  state.screen = 'play';
  showScreen('');
  hud.show(true);
  announce('Playing. Walk into the yellow marker to start your first job.');
}

// --- Camera. ---
function updateCamera(dt) {
  const target = player.inCar
    ? { x: player.inCar.x, z: player.inCar.z, heading: player.inCar.heading, speed: player.inCar.speed }
    : { x: player.x, z: player.z + player.y, heading: player.camYaw, speed: player.speed };
  const dist = player.inCar ? 11 : 8;
  const height = player.inCar ? 4.5 : 3.2 + player.camPitch * 3;
  const backX = target.x - Math.sin(target.heading) * dist;
  const backZ = target.z - Math.cos(target.heading) * dist;
  const desired = new THREE.Vector3(backX, height, backZ);
  camera.position.lerp(desired, Math.min(1, dt * 10));
  // Look 10 m ahead of the player: the crosshair and the bullet converge
  // there, and the view stays level instead of staring at the ground.
  camera.lookAt(target.x + Math.sin(target.heading) * 10, 1.8, target.z + Math.cos(target.heading) * 10);
}

// --- One fixed step. ---
function step(dt) {
  state.clock = (state.clock + dt * 0.5) % 1440;
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    state.screen = 'paused';
    showPaused();
    saveGame();
    return;
  }
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound off' : 'Sound on', 1);
  }
  if (actions & ACTION_WEAPON1) state.weapon = 'fists';
  if (actions & ACTION_WEAPON2) state.weapon = 'pistol';
  if (actions & ACTION_ENTER) {
    if (player.inCar) exitCar();
    else {
      const car = nearestCar(4);
      if (car) enterCar(car);
    }
  }
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  state.punchCooldown = Math.max(0, state.punchCooldown - dt);
  if (state.reloadTimer > 0) {
    state.reloadTimer -= dt;
    if (state.reloadTimer <= 0) state.ammo = COMBAT.pistolAmmo;
  }
  if (input.isMouseDown() && !player.inCar) fireWeapon();
  if ((actions & ACTION_SHOOT) && !player.inCar) fireWeapon();

  if (player.inCar) {
    const drag = input.takeDrag();
    player.camYaw -= drag.x * 0.005;
    const hit = drivePlayerCar(player.inCar, input, dt, solids, cars, () => audio.crash());
    if (hit) audio.crash();
    syncCarMesh(player.inCar);
    audio.engine(Math.abs(player.inCar.speed) / CAR.maxSpeed, true);
    // Running over a pedestrian at speed is a crime.
    for (const ped of peds) {
      if (!ped.dead && Math.hypot(ped.x - player.inCar.x, ped.z - player.inCar.z) < 2 && Math.abs(player.inCar.speed) > 6) {
        hitPed(ped, COMBAT.pistolDamage);
      }
    }
  } else {
    updatePlayerOnFoot(dt, actions);
    audio.engine(0, false);
  }

  for (const car of cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, dt, random, cars);
    if (car.kind !== 'player') syncCarMesh(car);
  }
  for (const ped of peds) {
    if (!ped.dead) updatePedestrian(ped, dt, random, player.inCar || { x: player.x, z: player.z });
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    updateEnemy(enemy, player.x, player.z, dt, (e) => {
      if (random() < 0.5) {
        damagePlayer(COMBAT.enemyDamage);
        hud.toast('You\'re taking fire!', 1);
      }
    });
  }
  syncPolice();
  updatePolice(dt);
  checkMissionStep(dt);
  updateMarker();
  updateTracers(dt);
  audio.siren(state.wanted > 0, dt);
  hud.update({
    wanted: state.wanted, money: state.money, health: state.health, clock: state.clock,
    objective: state.objective, objectiveSub: state.objectiveSub,
    inCar: !!player.inCar, speed: player.inCar ? player.inCar.speed : 0,
    weapon: state.weapon, ammo: state.ammo,
  }, dt);
  hud.drawMinimap({
    player: { x: player.x, z: player.z, heading: player.inCar ? player.inCar.heading : player.camYaw },
    cars, enemies: enemies.filter((e) => e.alive),
    marker: markerTarget(),
  });
  if (state.screen === 'busted') showBusted();
  else if (state.screen === 'wasted') showWasted();
  updateCamera(dt);
}

// --- Shot staging: real renders of the game, driven by a fixed script. ---
function stageShot(name) {
  state.screen = 'play';
  showScreen('');
  hud.show(true);
  if (name === 'start') {
    // Title screen over a city vista.
    state.screen = 'title';
    showTitle();
    camera.position.set(-120, 60, 320);
    camera.lookAt(0, 20, 0);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }
  if (name === 'play') {
    // On foot, mid-street downtown, looking north down the road as traffic
    // and pedestrians go by.
    player.x = 0;
    player.z = 150;
    player.camYaw = Math.PI;
    player.mesh.position.set(player.x, 0, player.z);
    // Two cars on the same road — one northbound ahead, one southbound
    // coming toward the player — and a pedestrian on the sidewalk.
    for (const [cx, cz, heading, dir] of [[-3.5, 118, Math.PI, -1], [3.5, 90, 0, 1]]) {
      const tc = makeCar('traffic', cx, cz, heading, 0x3b6fc2);
      tc.road = { axis: 'z', at: 0 };
      tc.roadDir = dir;
      tc.speed = 9;
      cars.push(tc);
      scene.add(tc.mesh);
    }
    const wp = makePedestrian(random);
    wp.x = 12;
    wp.z = 132;
    wp.targetX = 12;
    wp.targetZ = 90;
    peds.push(wp);
    scene.add(wp.mesh);
    for (let i = 0; i < 180; i += 1) step(STEP);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }
  if (name === 'chase') {
    const car = makeCar('player', 0, 180, Math.PI, 0xc23b3b);
    cars.push(car);
    scene.add(car.mesh);
    player.inCar = car;
    player.mesh.visible = false;
    car.speed = 24;
    state.wanted = 3;
    state.objective = 'Lose the cops!';
    state.objectiveSub = 'Three stars — outrun the Solmar PD';
    syncPolice();
    // Police right behind the player, in frame.
    let placed = 0;
    for (const pc of cars) {
      if (pc.kind === 'police') {
        pc.x = car.x + (placed === 0 ? -4 : 4);
        pc.z = car.z + 16 + placed * 8;
        pc.heading = Math.PI;
        pc.speed = 22;
        placed += 1;
      }
    }
    input.held.up = true;
    for (let i = 0; i < 240; i += 1) step(STEP);
    input.held.up = false;
    // A reverse angle for the shot: the car drives toward the camera with the
    // police chase visible behind it. (Shot mode renders with this camera.)
    camera.position.set(car.x - 12, 5.5, car.z - 26);
    camera.lookAt(car.x, 1.5, car.z + 12);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }
  if (name === 'mission') {
    startMission(2);
    spawnEnemies();
    state.missionActive.step = 1;
    state.objectiveSub = 'Take out the Vipers';
    // On the road south of the warehouse, close enough to see the Vipers.
    player.x = landmarks.warehouse.x;
    player.z = landmarks.warehouse.z + 13;
    player.camYaw = Math.atan2(landmarks.warehouse.x - player.x, landmarks.warehouse.z - player.z);
    player.mesh.position.set(player.x, 0, player.z);
    state.weapon = 'pistol';
    for (let i = 0; i < 120; i += 1) step(STEP);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }
  window.__shotReady = true;
}

// --- Boot. ---
// A small handle for automated play-testing (and curious players in devtools).
window.__solmar = { state, player, cars, peds, officers, enemies, landmarks, startMission, enterCar, exitCar, spawnEnemies };
spawnTraffic();
spawnPeds();
syncCarMesh && cars.forEach(syncCarMesh);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play') {
    state.screen = 'paused';
    showPaused();
    saveGame();
  }
});

if (shot) {
  // Render the staged scene twice (like the starter) and flag readiness.
  stageShot(shot);
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    window.__shotReady = true;
  });
} else {
  showTitle();
  announce('Solmar Bay. Press New Game to start.');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (state.screen === 'play') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
        if (state.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
      if (state.screen === 'title') {
        // Slow orbit behind the title screen.
        const t = now / 1000;
        camera.position.set(Math.sin(t * 0.05) * 260, 70, Math.cos(t * 0.05) * 260);
        camera.lookAt(0, 25, 0);
      }
      renderer.render(scene, camera);
    }
    if (state.screen === 'play') renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
