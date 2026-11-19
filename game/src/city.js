// Solmar Bay: the city itself. A seeded procedural build — roads on a 60 m grid,
// buildings with canvas window textures, a beach and marina on the south edge,
// downtown towers in the middle, streetlights, palms and landmarks. Everything
// the simulation needs to collide with or drive on is returned alongside the
// THREE group: solid AABBs, the road graph, and named landmark positions.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildingTexture(base, lit) {
  const tex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 12; y += 22) {
      for (let x = 10; x < w - 10; x += 18) {
        const on = ((x * 7 + y * 13) % 10) < (lit ? 6 : 3);
        g.fillStyle = on ? '#ffd98a' : '#1d2f45';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
  // Tile the facade so windows stay about a metre across on any building.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33373e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8a83a';
    g.fillRect(w / 2 - 2, 0, 4, h);
    g.fillStyle = '#e8e8e8';
    for (let y = 0; y < h; y += 32) {
      g.fillRect(18, y + 8, 3, 16);
      g.fillRect(w - 21, y + 8, 3, 16);
    }
  });
}

const BUILDING_COLORS = ['#9a8f80', '#7d8aa0', '#b09a7a', '#8a7f96', '#6f7f6a', '#a07a6a'];

export function buildCity(scene, random) {
  const group = new THREE.Group();
  scene.add(group);
  const solids = [];
  const roads = [];
  const landmarks = {};

  // Ground: grass base, then road strips, sidewalks and the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 160, CITY.half * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x4d7a3f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water });

  const lines = [];
  for (let k = 0; k <= 8; k += 1) lines.push(-CITY.half + k * CITY.block);
  for (const at of lines) {
    for (const axis of ['x', 'z']) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.road), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (axis === 'x') {
        road.position.set(0, 0, at);
        roadTex.repeat.set(CITY.half * 2 / 14, 1);
      } else {
        road.rotation.z = Math.PI / 2;
        road.position.set(at, 0, 0);
      }
      road.receiveShadow = true;
      group.add(road);
      roads.push({ axis, at, from: -CITY.half, to: CITY.half });
    }
  }
  // Sidewalk squares at each block corner.
  const blockCentres = [];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      blockCentres.push({ x: -CITY.half + CITY.block * (i + 0.5), z: -CITY.half + CITY.block * (j + 0.5) });
    }
  }
  for (const b of blockCentres) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block - 2, CITY.block - 2), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(b.x, 0.01, b.z);
    walk.receiveShadow = true;
    group.add(walk);
  }

  // Beach and sea on the south edge (z beyond the last road).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 160, 46), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.half + 23);
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 400, 300), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.half + 46 + 150);
  group.add(sea);

  // Buildings, one or four per block. Downtown (near the centre) goes tall.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of blockCentres) {
    const downtown = Math.abs(b.x) < 100 && Math.abs(b.z) < 100;
    const marina = b.z > 180;
    if (marina && random() < 0.6) continue; // open marina plots
    if (b.x === -210 && b.z === -210) continue; // the old warehouse lot: kept open for the Payback mission
    const count = downtown ? 1 : (random() < 0.5 ? 1 : 4);
    const spots = count === 1
      ? [{ dx: 0, dz: 0, w: 34, d: 34 }]
      : [
        { dx: -11, dz: -11, w: 18, d: 18 }, { dx: 11, dz: -11, w: 18, d: 18 },
        { dx: -11, dz: 11, w: 18, d: 18 }, { dx: 11, dz: 11, w: 18, d: 18 },
      ];
    for (const s of spots) {
      const height = downtown ? 28 + random() * 62 : 8 + random() * 22;
      const color = BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)];
      const facade = buildingTexture(color, downtown);
      facade.repeat.set(Math.max(1, Math.round(s.w / 9)), Math.max(1, Math.round(height / 9)));
      const mat = new THREE.MeshLambertMaterial({
        map: facade,
        color: 0xffffff,
      });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.scale.set(s.w, height, s.d);
      mesh.position.set(b.x + s.dx, height / 2, b.z + s.dz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      // Roof trim.
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
      roof.scale.set(s.w + 1, 0.8, s.d + 1);
      roof.position.set(b.x + s.dx, height + 0.4, b.z + s.dz);
      group.add(roof);
      solids.push({
        minX: b.x + s.dx - s.w / 2, maxX: b.x + s.dx + s.w / 2,
        minZ: b.z + s.dz - s.d / 2, maxZ: b.z + s.dz + s.d / 2,
      });
    }
  }

  // Landmark towers: the Solmar Tower downtown, the casino on the east strip.
  function landmarkTower(x, z, height, color, name) {
    const facade = buildingTexture(color, true);
    facade.repeat.set(3, Math.max(1, Math.round(height / 9)));
    const mat = new THREE.MeshLambertMaterial({ map: facade });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(30, height, 30);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
    solids.push({ minX: x - 15, maxX: x + 15, minZ: z - 15, maxZ: z + 15 });
    landmarks[name] = new THREE.Vector3(x, 0, z);
  }
  landmarkTower(-30, -30, 110, '#5a6f8a', 'tower');
  landmarkTower(210, -30, 34, '#c94f7a', 'casino');

  // The old warehouse: a low shed at the back of its open lot, with crates.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const shed = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x7a6a55 }));
  shed.scale.set(36, 9, 16);
  shed.position.set(-210, 4.5, -228);
  shed.castShadow = true;
  shed.receiveShadow = true;
  group.add(shed);
  solids.push({ minX: -228, maxX: -192, minZ: -236, maxZ: -220 });
  for (let i = 0; i < 6; i += 1) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    crate.scale.set(1.6, 1.6, 1.6);
    crate.position.set(-228 + i * 6, 0.8, -200 + (i % 2) * 6);
    crate.castShadow = true;
    group.add(crate);
  }

  // Marina pier.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 60), new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
  pier.position.set(-150, 0.5, CITY.half + 20);
  group.add(pier);
  landmarks.marina = new THREE.Vector3(-150, 0, CITY.half + 10);
  // Mission markers sit on roads or open ground, never inside a building.
  // (The casino tower itself stands at 210, -30; its marker is on the road.)
  landmarks.casino = new THREE.Vector3(180, 0, -30);
  landmarks.club = new THREE.Vector3(150, 0, 180);
  landmarks.warehouse = new THREE.Vector3(-210, 0, -210);
  landmarks.garage = new THREE.Vector3(210, 0, 180);
  landmarks.hospital = new THREE.Vector3(-210, 0, 0);
  landmarks.police = new THREE.Vector3(0, 0, -210);

  // Streetlights along every road, palms on the beach.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  for (const at of lines) {
    for (let t = -CITY.half + 30; t < CITY.half; t += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(t, 3, at + 9);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(t, 6.1, at + 9);
      group.add(lamp);
    }
  }
  for (let i = 0; i < 40; i += 1) {
    const x = -CITY.half + random() * CITY.half * 2;
    const z = CITY.half + 6 + random() * 34;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 5, 6), trunkMat);
    trunk.position.set(x, 2.5, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 7), leafMat);
    leaves.position.set(x, 6, z);
    group.add(leaves);
  }

  // A few parked benches and crates as props near the marina.
  for (let i = 0; i < 10; i += 1) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    crate.scale.set(1.4, 1.4, 1.4);
    crate.position.set(-170 + random() * 40, 0.7, CITY.half - 20 + random() * 20);
    crate.castShadow = true;
    group.add(crate);
  }

  return { group, solids, roads, landmarks };
}
