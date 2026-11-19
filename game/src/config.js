// Every tuning number in one place. Solmar Bay is a square city, 480 m across,
// laid out on a 60 m block grid: 8 blocks a side, roads between them, a marina
// and a beach on the south edge, a downtown of tall towers in the middle.

export const STEP = 1 / 60;
export const CITY = { half: 240, block: 60, road: 14, lanes: 2 };
export const SAVE_KEY = 'solmar-bay.save.v1';

export const PLAYER = {
  walkSpeed: 6, runSpeed: 10, accel: 40, jumpSpeed: 8.5, radius: 0.55,
  height: 1.8, health: 100,
};

export const CAR = {
  accel: 16, brake: 30, reverseAccel: 9, maxSpeed: 38, maxReverse: 10,
  turn: 1.9, grip: 6, drag: 0.35,
};

export const TRAFFIC = { count: 14, speed: 9, minGap: 9 };
export const PEDS = { count: 26, speed: 1.6 };

export const WANTED = {
  decayDelay: 14, decayRate: 0.25, maxStars: 5,
  // Police cars on the street per star level.
  policeCars: [0, 1, 2, 3, 4, 5],
  // On-foot officers per star level.
  policeFoot: [0, 1, 2, 2, 3, 4],
};

export const COMBAT = {
  pistolDamage: 34, pistolRange: 60, pistolRate: 0.22, pistolAmmo: 12,
  fistDamage: 12, fistRange: 2.2, fistRate: 0.45,
  enemyHealth: 60, enemyDamage: 8,
};

export const PALETTE = {
  sky: 0x87b5e0, duskSky: 0xff9a5c, ground: 0x3a3f46, road: 0x23262c,
  sidewalk: 0x8a8f96, building: [0x9a8f80, 0x7d8aa0, 0xb09a7a, 0x8a7f96, 0x6f7f6a],
  glass: 0x2c4a6b, grass: 0x4d7a3f, sand: 0xd9c28a, water: 0x1e5f8a,
  police: 0x1a2f5e, taxi: 0xf2c230,
};

export const MISSION_REWARDS = [400, 700, 900, 2500];
