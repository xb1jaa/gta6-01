// Cars: the model builder, the player's arcade driving, traffic that follows
// the road grid, parked cars, and police cars that chase the player.

import * as THREE from 'three';
import { CAR, CITY } from './config.js';

const CAR_COLORS = [0xc23b3b, 0x3b6fc2, 0xd8d8d8, 0x2f2f33, 0xd8a13b, 0x4f8a4f, 0x7a4f9a, 0xc2c2c2];
const TAXI_COLOR = 0xf2c230;

export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), new THREE.MeshLambertMaterial({ color: 0x22384f }));
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(x, 0.62, 2.21);
    group.add(light);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.3;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.45, -0.2);
    group.add(lightBar);
    group.userData.policeLights = [red, blue];
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(kind, x, z, heading, color, isPolice = false) {
  return {
    kind, // 'traffic' | 'police' | 'parked' | 'player'
    mesh: makeCarMesh(color, isPolice),
    x, z, heading, speed: 0,
    color, isPolice,
    driver: kind === 'traffic',
    road: null, roadDir: 1, turnCooldown: 0,
    stuck: 0, flash: 0,
  };
}

/** Place a car mesh from its state. */
export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.016;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
  if (car.isPolice) {
    car.flash += 0.016;
    const on = Math.floor(car.flash * 6) % 2 === 0;
    const [red, blue] = car.mesh.userData.policeLights;
    red.material.color.setHex(on ? 0xff2222 : 0x440000);
    blue.material.color.setHex(on ? 0x1133aa : 0x2266ff);
  }
}

const ROADS_AT = [];
for (let k = 0; k <= 8; k += 1) ROADS_AT.push(-CITY.half + k * CITY.block);

/** Pick a road and a lane offset for a traffic car at a random spot. */
export function spawnTrafficCar(random) {
  const axis = random() < 0.5 ? 'x' : 'z';
  const at = ROADS_AT[Math.floor(random() * ROADS_AT.length)];
  const along = -CITY.half + 20 + random() * (CITY.half * 2 - 40);
  const dir = random() < 0.5 ? 1 : -1;
  const color = random() < 0.12 ? TAXI_COLOR : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)];
  const car = makeCar('traffic', axis === 'x' ? along : at, axis === 'x' ? at : along, 0, color);
  car.road = { axis, at };
  car.roadDir = dir;
  car.speed = 7 + random() * 4;
  car.lane = 3.5;
  car.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  return car;
}

/** Drive a traffic car along its road; at intersections it may turn. */
export function updateTrafficCar(car, dt, random, cars) {
  if (!car.road) return; // parked or abandoned: nothing to follow
  car.turnCooldown -= dt;
  const forward = car.speed * dt;
  const dx = Math.sin(car.heading) * forward;
  const dz = Math.cos(car.heading) * forward;
  car.x += dx;
  car.z += dz;
  // Right-hand traffic: hold the lane offset from the road's centre line.
  if (car.road.axis === 'x') car.z = car.road.at + (car.roadDir > 0 ? -3.5 : 3.5);
  else car.x = car.road.at + (car.roadDir > 0 ? 3.5 : -3.5);
  // Slow for a car ahead on the same road.
  for (const other of cars) {
    if (other === car || other.kind === 'parked') continue;
    const ddx = other.x - car.x;
    const ddz = other.z - car.z;
    const ahead = ddx * Math.sin(car.heading) + ddz * Math.cos(car.heading);
    const side = Math.abs(ddx * Math.cos(car.heading) - ddz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 12 && side < 3) {
      car.speed = Math.max(0, car.speed - 12 * dt);
      return;
    }
  }
  car.speed = Math.min(car.speed + 3 * dt, 11);
  // Turn at an intersection, or turn around at the city edge.
  const along = car.road.axis === 'x' ? car.x : car.z;
  const nearLine = ROADS_AT.find((v) => Math.abs(along - v) < 1.2);
  if (car.turnCooldown <= 0 && nearLine !== undefined && random() < 0.35) {
    const newAxis = car.road.axis === 'x' ? 'z' : 'x';
    const newAt = nearLine;
    const newDir = random() < 0.5 ? 1 : -1;
    car.road = { axis: newAxis, at: newAt };
    car.roadDir = newDir;
    car.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
    car.turnCooldown = 4;
  }
  if (along > CITY.half - 8 || along < -CITY.half + 8) {
    car.roadDir *= -1;
    car.heading += Math.PI;
    car.turnCooldown = 4;
  }
}

/** Arcade driving for the player's car. Returns true on a hard hit. */
export function drivePlayerCar(car, input, dt, solids, cars, onCrash) {
  const up = input.held.up ? 1 : 0;
  const down = input.held.down ? 1 : 0;
  const steer = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0);
  if (up) car.speed += CAR.accel * dt;
  if (down) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  if (!up && !down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const turnRate = CAR.turn * steer * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 8);
  car.heading += turnRate * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  let hit = false;
  car.x = nx;
  car.z = nz;
  // City bounds.
  car.x = Math.max(-CITY.half - 30, Math.min(CITY.half + 30, car.x));
  car.z = Math.max(-CITY.half - 30, Math.min(CITY.half + 40, car.z));
  // Building collision: circle vs AABB, push out and bleed speed.
  for (const s of solids) {
    const cx = Math.max(s.minX, Math.min(car.x, s.maxX));
    const cz = Math.max(s.minZ, Math.min(car.z, s.maxZ));
    const ddx = car.x - cx;
    const ddz = car.z - cz;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 < 1.6 * 1.6) {
      const d = Math.sqrt(d2) || 0.01;
      const push = 1.6 - d;
      car.x += (ddx / d) * push;
      car.z += (ddz / d) * push;
      if (Math.abs(car.speed) > 8) {
        hit = true;
        onCrash();
      }
      car.speed *= 0.55;
    }
  }
  // Bump other cars.
  for (const other of cars) {
    if (other === car) continue;
    const ddx = car.x - other.x;
    const ddz = car.z - other.z;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 < 3.4 * 3.4 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (3.4 - d) / 2;
      car.x += (ddx / d) * push;
      car.z += (ddz / d) * push;
      other.x -= (ddx / d) * push;
      other.z -= (ddz / d) * push;
      if (Math.abs(car.speed) > 10) hit = true;
      car.speed *= 0.8;
    }
  }
  return hit;
}

/** Police chase: steer toward the target, faster than traffic, rams the player. */
export function updatePoliceCar(car, tx, tz, dt) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const target = dist > 60 ? 30 : 22;
  car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  return dist;
}
