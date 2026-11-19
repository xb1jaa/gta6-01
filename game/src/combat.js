// Combat: the pistol and the fists. Shooting raycasts from the player along
// the camera's aim; hits on enemies, pedestrians and cars are resolved here,
// and every shot or punch that lands on an innocent raises the wanted level.

import * as THREE from 'three';
import { COMBAT } from './config.js';

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();

/**
 * Fire the pistol along `dir` from the camera's position — the crosshair's
 * line of sight, so the bullet goes where the player is aiming. (A ray from
 * the player's chest along the camera's direction would angle into the
 * ground: the chase camera looks down at the player.) `targets` are
 * {mesh, onHit} entries. Returns the hit point, or null.
 */
export function shoot(originVec, dir, targets, scene) {
  origin.copy(originVec);
  direction.copy(dir).normalize();
  raycaster.set(origin, direction);
  raycaster.far = COMBAT.pistolRange;
  const meshes = targets.map((t) => t.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  if (!hits.length) {
    tracer(scene, origin, direction, COMBAT.pistolRange);
    return null;
  }
  const hit = hits[0];
  let target = null;
  let obj = hit.object;
  while (obj && !target) {
    target = targets.find((t) => t.mesh === obj);
    obj = obj.parent;
  }
  tracer(scene, origin, direction, hit.distance);
  if (target) target.onHit(hit.point);
  return hit.point;
}

const tracers = [];
/** A fading line that shows where a bullet went. */
export function tracer(scene, from, dir, length) {
  const end = from.clone().addScaledVector(dir, length);
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

export function updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const t = tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      t.line.parent?.remove(t.line);
      t.line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
}

/** Melee: anything within range in front of the player takes a hit. */
export function punch(playerPos, heading, targets) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let hitAny = false;
  for (const t of targets) {
    const dx = t.x - playerPos.x;
    const dz = t.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < COMBAT.fistRange && (dx * fx + dz * fz) > 0) {
      t.onHit(null);
      hitAny = true;
    }
  }
  return hitAny;
}
