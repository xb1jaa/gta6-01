# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xb1jaa/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xb1jaa/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay — a 3D open-world crime game in the spirit of GTA 6, built for the make.fun "Make GTA 6" bounty. Explore a procedural sunset city on foot and by car, steal cars, run four story missions for Rico, fight rival gangs, and lose the Solmar PD when your wanted level climbs. Three.js is vendored under `game/vendor/`; everything else — city, characters, vehicles, story, art and sound — is original.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD move / drive · Shift run · Space jump · E enter / steal car · mouse drag to look · click to shoot · 1 fists · 2 pistol · P pause · M mute. Progress saves to localStorage; Continue on the title screen picks it up.

## How it works

- `game/src/city.js` — the procedural city: road grid, buildings, beach, marina, landmarks
- `game/src/vehicles.js` — car models, arcade driving, traffic AI, police chases
- `game/src/people.js` — pedestrians, officers, rival gang members
- `game/src/missions.js` — the four-mission story
- `game/src/combat.js` — pistol and fists, raycast shooting, tracers
- `game/src/hud.js` — wanted stars, money, health, clock, live minimap
- `game/src/audio.js` — procedural WebAudio sound: engine, sirens, gunshots
- `game/src/main.js` — boot, the fixed-step loop, camera, save/load, screenshot staging

---

<sub>Entered on [make.fun](https://make.fun/?ref=4r01e97f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
