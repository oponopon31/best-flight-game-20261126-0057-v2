# AERIS — Ridge Run v2

[![Best Flight Game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/oponopon31/best-flight-game-20261126-0057-v2/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/oponopon31/best-flight-game-20261126-0057-v2/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A 3D flight game for the [best flight game competition](https://make.fun/c/best-flight-game-20261126-0057).
Fly a bush plane down a mountain valley in a Three.js world: thread glowing
rings, mind your fuel, and bring her home in one piece. Version 2 adds an
eastern sea with three island strips, a dusk run on a lit runway, and a 3D
cockpit with lit instruments.

## Play

Serve `game/` with any static server, or run `node serve.ts` and open
http://localhost:8080 in a desktop browser. No network request, no build step.

- **Shift / W** throttle up, **Ctrl / S** throttle down
- **Arrow Up / Down** pitch, **Arrow Left / Right** or **A / D** bank and turn
- **Q / E** rudder, **F** flaps, **B** brake
- **C** chase / cockpit camera, **M** mute, **P** pause, **R** restart
- Mouse drag looks around and steers a little

## Missions

1. **Ring Run** — 8 rings down the valley, beat the clock.
2. **Ridge Delivery** — 4 checkpoints, then land on the far strip.
3. **Storm Ridge** — 8 rings in gusting wind, a fast time trial.
4. **Island Hopper** — courier run: fly the ring over each island strip, land
   to pick up cargo, and deliver it to the last island.
5. **Dusk Run** — 8 rings at dusk, then land on the lit home runway.

Missions unlock in order — finishing one opens the next — and completed ones
are marked on the mission screen.

Too slow and the plane stalls; too rough a touchdown damages her; fuel runs
out if you dawdle. Landings, crashes and time-ups each get their own ending.
The home runway is lit (edge lights, approach lights, PAPI), and **C** switches
to the cockpit view with lit airspeed, altimeter, attitude and compass gauges.
Hard banks at speed trail wingtip smoke. The waypoint arrow and distance
readout always point at the next ring or strip, and the wind indicator shows
the gusts that push the plane around.

## Layout

- `game/index.html` — page, HUD markup and screens
- `game/src/config.js` — tuning numbers and mission definitions
- `game/src/input.js` — keyboard and mouse
- `game/src/terrain.js` — seeded valley, river, lake, eastern sea and islands,
  trees, clouds, sun, sky, dusk lighting, lit runways, peaks, buildings
- `game/src/aircraft.js` — the bush plane, built from primitives, with wingtip smoke
- `game/src/physics.js` — flight model, stall, ground handling, landings
- `game/src/missions.js` — rings, checkpoints, courier run, scoring, wind gusts
- `game/src/hud.js` — altitude, speed, heading, compass, attitude, gauges,
  waypoint arrow, progress dots, wind
- `game/src/cockpit.js` — 3D instrument panel with lit gauges for cockpit view
- `game/src/audio.js` — WebAudio-synthesised engine, wind, chime and thud
- `game/src/shots.js` — deterministic staging for the screenshots
- `game/src/main.js` — loop, camera, game states
- `game/vendor/three.module.min.js` — vendored Three.js r160

Screenshots are staged with `?shot=start|play|cockpit|dusk&seed=1` (see
`shots.json`); they are real renders of the game's own code.

## License

MIT — see `LICENSE`.
