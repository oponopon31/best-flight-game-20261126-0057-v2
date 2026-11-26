// Flight model for AERIS — Ridge Run: arcade physics with a real stall,
// ground handling, terrain impact, and runway landings.
import * as THREE from 'three';
import { CONFIG, allStrips } from './config.js';

export function makeFlightState() {
  return {
    position: new THREE.Vector3(0, 4.2, 900), // on the home runway
    heading: 0,         // facing -Z: down the valley toward the rings and the far strip
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    stalled: false,
    crashed: false,
    landed: false,
    flaps: false,
    brake: false,
    wind: new THREE.Vector3(0, 0, 0),
    time: 0,
  };
}

// Forward direction from heading (yaw around Y) and pitch.
export function forwardVector(state) {
  const cp = Math.cos(state.pitch);
  return new THREE.Vector3(
    -Math.sin(state.heading) * cp,
    Math.sin(state.pitch),
    -Math.cos(state.heading) * cp,
  );
}

export class Physics {
  constructor(terrain) {
    this.terrain = terrain;
  }

  step(state, input, dt) {
    const P = CONFIG.plane;
    state.time += dt;

    // --- Throttle -----------------------------------------------------------
    const tAxis = input.throttleAxis();
    state.throttle = Math.max(0, Math.min(1, state.throttle + tAxis * dt * 0.9));
    state.flaps = input.down('KeyF');
    state.brake = input.down('KeyB');

    // --- Attitude -----------------------------------------------------------
    const pitchIn = input.pitchAxis();
    const rollIn = input.rollAxis();
    const yawIn = input.yawAxis();
    const authority = Math.min(1, state.speed / 18 + 0.25); // controls answer at every speed, weakly when slow
    state.roll += rollIn * P.rollRate * authority * dt;
    state.roll = Math.max(-1.35, Math.min(1.35, state.roll));
    // Roll banks the turn; rudder adds a little direct yaw.
    state.heading += (-Math.sin(state.roll) * P.turnCoordination * Math.min(1, state.speed / 40) + yawIn * P.yawRate * authority) * dt;
    // Pitch: pull back to climb. Auto-level the roll gently when hands off.
    state.pitch += -pitchIn * P.pitchRate * authority * dt;
    state.pitch = Math.max(-0.55, Math.min(0.55, state.pitch));
    if (Math.abs(rollIn) < 0.05) state.roll *= Math.max(0, 1 - 0.55 * dt);
    if (Math.abs(pitchIn) < 0.05 && !state.onGround) state.pitch *= Math.max(0, 1 - 0.25 * dt);

    // --- Speed --------------------------------------------------------------
    const stallSpeed = P.stallSpeed * (state.flaps ? 0.8 : 1);
    state.stalled = state.speed < stallSpeed && !state.onGround;
    const thrust = state.throttle * P.accel;
    const drag = P.drag * state.speed * state.speed * (state.flaps ? 1.6 : 1)
      + (state.brake && state.onGround ? 22 : 0);
    const gravityAlong = -Math.sin(state.pitch) * 9.8 * 0.9;
    state.speed += (thrust - drag + gravityAlong) * dt;
    state.speed = Math.max(0, Math.min(P.maxSpeed, state.speed));

    // --- Fuel ---------------------------------------------------------------
    const burn = (P.fuelBurnIdle + (P.fuelBurn - P.fuelBurnIdle) * state.throttle) * dt;
    state.fuel = Math.max(0, state.fuel - burn);
    if (state.fuel <= 0) state.throttle = Math.max(0, state.throttle - dt * 0.5);

    // --- Motion -------------------------------------------------------------
    const fwd = forwardVector(state);
    // Stall: the nose drops and lift fades.
    let lift = 1;
    if (state.stalled) {
      state.pitch -= 0.5 * dt;
      lift = 0.45;
    }
    // Climb only while there is lift; sink otherwise.
    const climb = Math.sin(state.pitch) * state.speed * lift;
    const sink = state.stalled ? -6 : (state.speed < stallSpeed * 0.7 ? -2.5 : 0);
    const vs = climb + sink;
    state.verticalSpeed = vs;
    state.position.addScaledVector(fwd, state.speed * dt);
    state.position.y += (vs - Math.sin(state.pitch) * state.speed) * dt; // vs already counted along fwd; add the extra sink
    state.position.addScaledVector(state.wind, dt);

    // --- Ground -------------------------------------------------------------
    const ground = this.terrain.heightAt(state.position.x, state.position.z);
    const gearHeight = 1.6;
    const onStrip = this.onAnyStrip(state.position);
    const groundY = onStrip ? 3.6 + gearHeight : ground + gearHeight;
    if (state.position.y <= groundY) {
      state.position.y = groundY;
      if (!state.onGround) {
        // Touchdown: hard if sinking fast or fast sideways, gentle otherwise.
        const hard = Math.abs(vs) > 7 || state.speed > 78;
        if (onStrip && Math.abs(vs) <= 7 && state.speed < 78 && Math.abs(state.roll) < 0.35) {
          state.landed = true;
        } else if (!onStrip || hard) {
          state.damage += hard ? 55 : 25;
          if (state.damage >= 100) state.crashed = true;
        }
        state.speed *= 0.82;
        state.pitch = 0;
        state.roll *= 0.4;
      }
      state.onGround = true;
      state.verticalSpeed = 0;
      if (state.brake) state.speed = Math.max(0, state.speed - 26 * dt);
    } else {
      state.onGround = false;
      // Airborne again: a fresh touchdown can count as a new landing
      // (the courier run lands on three strips in one sortie).
      if (state.position.y > groundY + 4) state.landed = false;
    }
    // World edge: turn the plane gently back instead of a hard wall.
    const half = CONFIG.world.size / 2 - 60;
    if (Math.abs(state.position.x) > half || Math.abs(state.position.z) > half) {
      state.heading += 0.9 * dt * Math.sign(state.position.x + state.position.z);
    }
    return state;
  }

  onAnyStrip(pos) {
    for (const strip of allStrips()) {
      if (this.onStrip(pos, strip)) return true;
    }
    return false;
  }

  onStrip(pos, strip) {
    const dx = pos.x - strip.x;
    const dz = pos.z - strip.z;
    const along = Math.abs(dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading));
    const across = Math.abs(dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading));
    return along < strip.length / 2 && across < strip.width / 2;
  }
}
