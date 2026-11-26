// AERIS — Ridge Run: all tuning numbers in one place.
// Units: metres, seconds, knots for display, feet for altitude display.
export const CONFIG = {
  world: {
    size: 4200,          // terrain spans -2100..2100 on x and z
    segments: 180,
    maxHeight: 260,
    valleyHalfWidth: 260, // flat valley floor around x = 0
    runway: { x: 0, z: 900, length: 420, width: 34, heading: 0 },
    farStrip: { x: -140, z: -1150, length: 340, width: 30, heading: 0.12 },
    // Island airstrips out in the eastern sea, for the courier run.
    islands: [
      { id: 'isle1', name: 'PALM ISLE', x: 1650, z: 300, length: 300, width: 26, heading: 0.35 },
      { id: 'isle2', name: 'CORAL ISLE', x: 1820, z: -480, length: 300, width: 26, heading: -0.3 },
      { id: 'isle3', name: 'TURTLE ISLE', x: 1620, z: -1180, length: 300, width: 26, heading: 0.15 },
    ],
  },
  plane: {
    cruiseSpeed: 62,     // m/s at full throttle, level
    maxSpeed: 95,
    stallSpeed: 26,
    accel: 14,           // m/s^2 at full throttle
    drag: 0.0025,        // quadratic drag; full-throttle level speed ≈ 75 m/s
    climbRate: 0.55,     // pitch authority factor
    rollRate: 1.9,       // rad/s
    pitchRate: 0.9,
    yawRate: 0.45,
    turnCoordination: 0.55,
    fuelCapacity: 100,
    fuelBurn: 0.55,      // per second at full throttle
    fuelBurnIdle: 0.08,
    damagePerHit: 34,
    gearDrag: 0.004,
  },
  missions: {
    ringRun:    { rings: 8,  timeLimit: 240, fuel: 100 },
    delivery:   { checkpoints: 4, timeLimit: 300, fuel: 100 },
    storm:      { rings: 8,  timeLimit: 200, fuel: 90, gust: 9 },
    islands:    { strips: 3, timeLimit: 420, fuel: 100 },
    dusk:       { rings: 8,  timeLimit: 240, fuel: 100, dusk: true },
  },
  camera: {
    chaseDistance: 13,
    chaseHeight: 4.2,
    lookAhead: 26,
    smoothing: 6.5,
  },
  colours: {
    skyTop: 0x2f6fb2,
    skyBottom: 0xcfe8f5,
    fog: 0xbdd7e8,
    sun: 0xfff2c8,
    grass: 0x5d8a4a,
    rock: 0x8a7f74,
    snow: 0xf2f5f7,
    water: 0x3a7ca8,
    runway: 0x3c3f45,
    ring: 0xffb020,
    ringNext: 0x37e08a,
    // Dusk palette for the night run: low orange sun, violet sky.
    duskSkyTop: 0x1d2a55,
    duskSkyBottom: 0xff9a5c,
    duskFog: 0x8a6a72,
    duskSun: 0xff8a4a,
    sea: 0x2f6f9e,
  },
};

export const MISSION_DEFS = [
  {
    id: 'rings',
    key: '1',
    name: 'RING RUN',
    tag: '8 rings down the valley — beat the clock',
    timeLimit: 240,
    fuel: 100,
    gust: 0,
    goal: 'rings',
  },
  {
    id: 'delivery',
    key: '2',
    name: 'RIDGE DELIVERY',
    tag: '4 checkpoints, then land on the far strip',
    timeLimit: 300,
    fuel: 100,
    gust: 0,
    goal: 'delivery',
  },
  {
    id: 'storm',
    key: '3',
    name: 'STORM RIDGE',
    tag: '8 rings in gusting wind — a fast time trial',
    timeLimit: 200,
    fuel: 90,
    gust: 9,
    goal: 'rings',
  },
  {
    id: 'islands',
    key: '4',
    name: 'ISLAND HOPPER',
    tag: 'Courier run: ring, land and pick up on 3 island strips',
    timeLimit: 420,
    fuel: 100,
    gust: 0,
    goal: 'courier',
  },
  {
    id: 'dusk',
    key: '5',
    name: 'DUSK RUN',
    tag: '8 rings at dusk — land on the lit home runway',
    timeLimit: 240,
    fuel: 100,
    gust: 0,
    goal: 'rings',
    dusk: true,
  },
];

// Every landable strip in the world, with an id the courier run uses to
// tell which island the plane just touched down on.
export function allStrips() {
  const strips = [
    { id: 'home', name: 'HOME RUNWAY', ...CONFIG.world.runway },
    { id: 'far', name: 'FAR STRIP', ...CONFIG.world.farStrip },
  ];
  for (const isle of CONFIG.world.islands) strips.push({ ...isle });
  return strips;
}

export function stripById(id) {
  return allStrips().find((s) => s.id === id) || null;
}

// True when (x, z) lies on the given strip (strip centre + heading).
// The strip's long axis runs (sin h, cos h), matching the runway mesh,
// its dashes and its lights.
export function onStripAt(x, z, strip) {
  const dx = x - strip.x;
  const dz = z - strip.z;
  const along = Math.abs(dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading));
  const across = Math.abs(dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading));
  return along < strip.length / 2 && across < strip.width / 2;
}

// Deterministic seeded RNG (mulberry32) so ?shot= staging is repeatable.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
