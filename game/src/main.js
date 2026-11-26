// AERIS — Ridge Run: main loop, camera, game states, title and end screens.
import * as THREE from 'three';
import { CONFIG, MISSION_DEFS } from './config.js';
import { Input } from './input.js';
import { Terrain } from './terrain.js';
import { Aircraft } from './aircraft.js';
import { Physics, makeFlightState, forwardVector } from './physics.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Cockpit } from './cockpit.js';
import { AudioEngine } from './audio.js';
import { parseShotParams, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);
scene.add(camera); // the cockpit panel rides on the camera

const params = parseShotParams();
const terrain = new Terrain(scene, params.seed);
const aircraft = new Aircraft(scene);
const physics = new Physics(terrain);
const missions = new Missions(scene, terrain);
const hud = new Hud(document.getElementById('hud'));
const cockpit = new Cockpit(camera);
const audio = new AudioEngine();
const input = new Input(canvas);

let state = makeFlightState();
let mode = 'title';       // title | playing | paused | over
let viewMode = 'chase';   // chase | cockpit
let endReason = '';
let endScore = 0;
let shotMode = params.shot;
// Staged screenshots hold the flight state exactly where shots.js put it:
// the plane, the camera and the HUD render the staged moment deterministically
// instead of depending on how many frames the capture ran.
const frozen = !!shotMode;

// Mission progression: missions unlock in order, completed ones are marked.
// Kept in localStorage so a pilot's progress survives a reload.
// ?unlock=all (screenshot staging only) shows every mission unlocked.
const PROGRESS_KEY = 'aeris-v2-done';
const forceUnlockAll = params.unlock === 'all';
function completedIds() {
  if (forceUnlockAll) return new Set(MISSION_DEFS.map((d) => d.id));
  try {
    return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function markCompleted(defId) {
  const done = completedIds();
  if (done.has(defId)) return;
  done.add(defId);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...done])); } catch { /* private mode */ }
  refreshTitleButtons();
}
function isUnlocked(def, index) {
  if (index === 0) return true;
  const done = completedIds();
  return done.has(MISSION_DEFS[index - 1].id);
}
function refreshTitleButtons() {
  const done = completedIds();
  MISSION_DEFS.forEach((def, index) => {
    const btn = document.getElementById(`mission-${def.id}`);
    if (!btn) return;
    const unlocked = isUnlocked(def, index);
    btn.classList.toggle('locked', !unlocked);
    const key = btn.querySelector('.key');
    if (key) {
      key.textContent = unlocked ? def.key : '—';
      key.classList.toggle('locked-key', !unlocked);
    }
    let tag = btn.querySelector('.done-tag');
    if (done.has(def.id)) {
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'done-tag';
        tag.textContent = 'DONE';
        btn.insertBefore(tag, btn.querySelector('b').nextSibling);
      }
    } else if (tag) {
      tag.remove();
    }
  });
}

// Camera smoothing state.
const camPos = new THREE.Vector3(0, 12, 930);
const camTarget = new THREE.Vector3(0, 5, 880);

const titleEl = document.getElementById('title');
const endEl = document.getElementById('end-screen');
const pauseEl = document.getElementById('pause');

function showTitle() {
  mode = 'title';
  titleEl.classList.remove('hidden');
  endEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('hud').classList.add('title-mode');
  refreshTitleButtons();
}

function startMission(defId) {
  const index = MISSION_DEFS.findIndex((d) => d.id === defId);
  if (index < 0) return;
  if (!isUnlocked(MISSION_DEFS[index], index)) return; // locked until the previous mission is done
  state = makeFlightState();
  missions.start(defId);
  mode = 'playing';
  endReason = '';
  titleEl.classList.add('hidden');
  endEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  document.getElementById('hud').classList.remove('title-mode');
  hud.clearCentre();
  audio.start();
  // Snap the camera behind the plane for a clean start.
  const fwd = forwardVector(state);
  camPos.copy(state.position).addScaledVector(fwd, -CONFIG.camera.chaseDistance)
    .add(new THREE.Vector3(0, CONFIG.camera.chaseHeight, 0));
}

function endGame(reason, title, sub) {
  mode = 'over';
  endReason = reason;
  endScore = missions.score;
  if (reason === 'done') markCompleted(missions.def.id);
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-sub').textContent = sub;
  document.getElementById('end-score').textContent = `SCORE ${endScore.toLocaleString('en-US')}`;
  endEl.classList.remove('hidden');
  audio.thud(reason === 'crashed');
}

function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    pauseEl.classList.remove('hidden');
  } else if (mode === 'paused') {
    mode = 'playing';
    pauseEl.classList.add('hidden');
  }
}

// One place that switches the camera view: the 3D panel, the bodywork
// and the DOM bottom bar all follow it.
function setViewMode(v) {
  viewMode = v;
  cockpit.setVisible(v === 'cockpit');
  aircraft.setCockpitMode(v === 'cockpit');
  document.getElementById('hud').classList.toggle('cockpit-mode', v === 'cockpit');
}
for (const def of MISSION_DEFS) {
  const btn = document.getElementById(`mission-${def.id}`);
  if (btn) btn.addEventListener('click', () => startMission(def.id));
}
document.getElementById('restart-btn').addEventListener('click', () => {
  if (mode === 'over') startMission(missions.def.id);
});
document.getElementById('title-btn').addEventListener('click', () => {
  state = makeFlightState();
  missions.start(missions.def.id);
  showTitle();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') audio.toggleMute();
});

function updateCamera(dt) {
  const fwd = forwardVector(state);
  if (viewMode === 'cockpit') {
    const eye = state.position.clone().addScaledVector(fwd, 1.2);
    eye.y += 0.9;
    camera.position.copy(eye);
    camera.lookAt(eye.clone().addScaledVector(fwd, 40));
    // The panel is fixed to the aircraft, so the view rolls with the plane.
    camera.rotateZ(state.roll * 0.85);
    return;
  }
  const desired = state.position.clone()
    .addScaledVector(fwd, -CONFIG.camera.chaseDistance);
  desired.y += CONFIG.camera.chaseHeight;
  desired.x += state.shotCamX || 0; // staged shots may offset the camera sideways
  // Keep the camera above the ground.
  const ground = terrain.heightAt(desired.x, desired.z) + 3;
  if (desired.y < ground) desired.y = ground;
  const k = 1 - Math.exp(-CONFIG.camera.smoothing * dt);
  camPos.lerp(desired, k);
  const look = state.position.clone().addScaledVector(fwd, CONFIG.camera.lookAhead);
  camTarget.lerp(look, 1 - Math.exp(-8 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  // Gentle roll with the plane so the horizon tilts like a chase cam.
  camera.rotation.z += state.roll * 0.12;
}

function tick(timeMs) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (timeMs - (tick.last ?? timeMs)) / 1000 || 0.016);
  tick.last = timeMs;
  const t = timeMs / 1000;

  // Global keys.
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) togglePause();
  if (input.wasPressed('KeyC') && mode === 'playing') {
    setViewMode(viewMode === 'chase' ? 'cockpit' : 'chase');
  }
  if (input.wasPressed('KeyR') && (mode === 'over' || mode === 'playing')) {
    startMission(missions.def.id);
  }
  if (mode === 'title') {
    for (const def of MISSION_DEFS) {
      if (input.wasPressed(`Digit${def.key}`)) startMission(def.id);
    }
  }
  input.consumeMouse();

  if (mode === 'playing' && !frozen) {
    const prevDamage = state.damage;
    physics.step(state, input, dt);
    const event = missions.update(state, dt);
    if (event === 'ring') {
      audio.chime();
      hud.showCentre('RING!', `+${(1000).toLocaleString('en-US')} — next ring ahead`);
      setTimeout(() => { if (mode === 'playing') hud.clearCentre(); }, 1400);
    }
    if (state.damage > prevDamage) audio.thud(state.damage >= 100);
    if (state.crashed) {
      endGame('crashed', 'CRASHED', 'The ridge wins this time. Press R to fly again.');
    } else if (missions.status === 'done') {
      endGame('done', missions.message, 'Press R to fly again, or pick another mission.');
    } else if (missions.status === 'failed') {
      endGame('failed', missions.message, 'Press R to fly again.');
    } else if (state.fuel <= 0 && state.onGround && state.speed < 1) {
      endGame('outoffuel', 'OUT OF FUEL', 'You glided to a stop. Press R to fly again.');
    }
    audio.update(state);
  }

  // Idle title-screen drift: the plane sits on the runway, prop idling.
  if (mode === 'title' && shotMode !== 'start') {
    state.throttle = 0.12;
  }

  terrain.update(dt);
  aircraft.update(state, dt, t);
  updateCamera(dt);
  cockpit.update(state);
  hud.update(state, missions);
  input.clearPressed();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// First gesture unlocks audio.
window.addEventListener('pointerdown', () => audio.start(), { once: true });
window.addEventListener('keydown', () => audio.start(), { once: true });

// Boot: staged screenshot modes start straight into their scene.
if (shotMode) {
  const staged = stageShot(shotMode, state, missions, terrain);
  if (state.cockpitView) {
    setViewMode('cockpit');
  }
  if (staged === 'title') {
    showTitle();
    state.throttle = 0.22;
  } else {
    mode = 'playing';
    titleEl.classList.add('hidden');
    const fwd = forwardVector(state);
    camPos.copy(state.position).addScaledVector(fwd, -CONFIG.camera.chaseDistance)
      .add(new THREE.Vector3(0, CONFIG.camera.chaseHeight, 0));
    camTarget.copy(state.position).addScaledVector(fwd, CONFIG.camera.lookAhead);
    audio.start();
  }
  // Pre-roll a few frames so the prop is spinning and the HUD is live.
  // Staged shots stay frozen at their staged pose.
  for (let i = 0; i < 5; i++) {
    if (mode === 'playing' && !frozen) physics.step(state, input, 0.016);
    aircraft.update(state, 0.016, i * 0.016);
  }
} else {
  missions.start('rings');
  showTitle();
}

// A small handle for automated play-testing (keyboard, ring passes,
// landings) — it only reads the live game state, it changes nothing.
window.__aeris = {
  get state() { return state; },
  get missions() { return missions; },
  get mode() { return mode; },
  get viewMode() { return viewMode; },
  get terrain() { return terrain; },
  get aircraft() { return aircraft; },
};

requestAnimationFrame(tick);
