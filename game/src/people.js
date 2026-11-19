// People: the player character, wandering pedestrians, on-foot police officers
// and the rival gang members a combat mission fights.

import * as THREE from 'three';
import { CITY } from './config.js';

const SKINS = [0xd9a066, 0x8a5a3b, 0xe8b98a, 0x6b3f2a, 0xc98d64];
const SHIRTS = [0x3b6fc2, 0xc23b3b, 0x4f8a4f, 0xd8a13b, 0x7a4f9a, 0xe8e8e8, 0x2f8a7a];

export function makePersonMesh(shirt, pants = 0x2c2f36, skin = 0xd9a066) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  cap.position.y = 1.93;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pantsMat);
  legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legL, legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armL, armR);
  group.userData.parts = { legL, legR, armL, armR, torso };
  return group;
}

/** Walk-cycle swing for a person mesh. */
export function animateWalk(mesh, phase, amount = 1) {
  const p = mesh.userData.parts;
  const swing = Math.sin(phase) * 0.6 * amount;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.8;
  p.armR.rotation.x = swing * 0.8;
}

export function makePedestrian(random) {
  const x = -CITY.half + 20 + random() * (CITY.half * 2 - 40);
  const z = -CITY.half + 20 + random() * (CITY.half * 2 - 40);
  const shirt = SHIRTS[Math.floor(random() * SHIRTS.length)];
  const skin = SKINS[Math.floor(random() * SKINS.length)];
  return {
    kind: 'ped',
    mesh: makePersonMesh(shirt, 0x2c2f36, skin),
    x, z, heading: random() * Math.PI * 2,
    targetX: x, targetZ: z,
    speed: 1.2 + random() * 0.8,
    phase: random() * 6,
    flee: 0,
  };
}

/** Wander: pick a nearby sidewalk point, walk to it, pick another. */
export function updatePedestrian(ped, dt, random, threat) {
  if (threat) {
    const dx = ped.x - threat.x;
    const dz = ped.z - threat.z;
    const d = Math.hypot(dx, dz);
    if (d < 12) {
      ped.flee = 2;
      ped.targetX = ped.x + (dx / (d || 1)) * 20;
      ped.targetZ = ped.z + (dz / (d || 1)) * 20;
    }
  }
  if (ped.flee > 0) ped.flee -= dt;
  const dx = ped.targetX - ped.x;
  const dz = ped.targetZ - ped.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.5) {
    ped.targetX = Math.max(-CITY.half + 10, Math.min(CITY.half - 10, ped.x + (random() - 0.5) * 80));
    ped.targetZ = Math.max(-CITY.half + 10, Math.min(CITY.half - 10, ped.z + (random() - 0.5) * 80));
    return;
  }
  const speed = ped.flee > 0 ? ped.speed * 3 : ped.speed;
  ped.heading = Math.atan2(dx, dz);
  ped.x += (dx / d) * speed * dt;
  ped.z += (dz / d) * speed * dt;
  ped.phase += dt * speed * 3;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
  animateWalk(ped.mesh, ped.phase, Math.min(1, speed / 2));
}

export function makeOfficer(x, z) {
  return {
    kind: 'officer',
    mesh: makePersonMesh(0x1a2f5e, 0x1a2f5e, 0xd9a066),
    x, z, heading: 0, speed: 5.2, phase: 0,
    punchCooldown: 0, busted: 0,
  };
}

/** An officer runs at the player and punches when close. Returns 'busted' when caught. */
export function updateOfficer(off, px, pz, dt, onPunch) {
  const dx = px - off.x;
  const dz = pz - off.z;
  const d = Math.hypot(dx, dz) || 1;
  off.heading = Math.atan2(dx, dz);
  if (d > 1.6) {
    off.x += (dx / d) * off.speed * dt;
    off.z += (dz / d) * off.speed * dt;
    off.phase += dt * 9;
  }
  off.mesh.position.set(off.x, 0, off.z);
  off.mesh.rotation.y = off.heading;
  animateWalk(off.mesh, off.phase, 1);
  off.punchCooldown -= dt;
  if (d < 1.8 && off.punchCooldown <= 0) {
    off.punchCooldown = 1.1;
    onPunch();
  }
  if (d < 1.4) {
    off.busted += dt;
    if (off.busted > 1.2) return 'busted';
  } else {
    off.busted = Math.max(0, off.busted - dt * 2);
  }
  return null;
}

export function makeEnemy(x, z) {
  return {
    kind: 'enemy',
    mesh: makePersonMesh(0x8a1f1f, 0x1a1a1a, 0xc98d64),
    x, z, heading: 0, health: 60, phase: 0,
    shootCooldown: 1 + Math.random() * 1.5,
    alive: true,
  };
}

/** An enemy holds its ground and shoots at the player inside 30 m. */
export function updateEnemy(enemy, px, pz, dt, onShoot) {
  if (!enemy.alive) return;
  const dx = px - enemy.x;
  const dz = pz - enemy.z;
  const d = Math.hypot(dx, dz) || 1;
  enemy.heading = Math.atan2(dx, dz);
  enemy.mesh.rotation.y = enemy.heading;
  enemy.shootCooldown -= dt;
  if (d < 30 && enemy.shootCooldown <= 0) {
    enemy.shootCooldown = 1.6 + Math.random();
    onShoot(enemy);
  }
}
