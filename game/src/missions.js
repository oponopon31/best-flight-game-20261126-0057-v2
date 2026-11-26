// Missions for AERIS — Ridge Run: ring courses, checkpoints, the
// far-strip landing, the island courier run and the dusk run.
// Rings are glowing torus meshes in the world.
import * as THREE from 'three';
import { CONFIG, MISSION_DEFS, stripById, onStripAt } from './config.js';

export class Missions {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain || null;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.def = MISSION_DEFS[0];
    this.targets = [];   // { mesh, glow, beam, pos, passed, stripId? }
    this.nextIndex = 0;
    this.score = 0;
    this.timeLeft = 0;
    this.status = 'ready'; // ready | flying | done | failed
    this.message = '';
    this.ringRadius = 16;
    this.awaitingLanding = false; // courier: ring passed, land on the island strip
    this.prevLanded = false;      // courier: touchdown edge detection
  }

  start(defId) {
    this.def = MISSION_DEFS.find((d) => d.id === defId) || MISSION_DEFS[0];
    this.clearTargets();
    this.score = 0;
    this.nextIndex = 0;
    this.timeLeft = this.def.timeLimit;
    this.status = 'flying';
    this.message = this.def.name;
    this.awaitingLanding = false;
    this.prevLanded = false;
    if (this.terrain) this.terrain.setDusk(!!this.def.dusk);
    this.buildCourse();
  }

  buildCourse() {
    const rngPts = [];
    if (this.def.goal === 'courier') {
      // One approach ring above each island strip; land on the strip after it.
      for (const isle of CONFIG.world.islands) {
        rngPts.push({ pos: new THREE.Vector3(isle.x, 70, isle.z), stripId: isle.id });
      }
    } else if (this.def.goal === 'rings') {
      // Eight rings threading the valley from the home runway to the lake.
      const zs = [560, 260, -40, -330, -600, -850, -1080, -1330];
      const xs = [60, -90, 110, -60, 90, -110, 40, -30];
      const ys = [55, 80, 60, 110, 70, 120, 85, 95];
      for (let i = 0; i < 8; i++) {
        rngPts.push({ pos: new THREE.Vector3(xs[i], ys[i], zs[i]) });
      }
    } else {
      // Delivery: four checkpoints, then the far strip itself.
      const pts = [
        new THREE.Vector3(120, 70, 480),
        new THREE.Vector3(-140, 110, 40),
        new THREE.Vector3(90, 80, -480),
        new THREE.Vector3(-60, 60, -900),
      ];
      for (const p of pts) rngPts.push({ pos: p });
    }
    for (const p of rngPts) this.addRing(p.pos, p.stripId);
    this.updateRingColours();
  }

  addRing(pos, stripId) {
    const geo = new THREE.TorusGeometry(this.ringRadius, 1.6, 10, 40);
    const mat = new THREE.MeshBasicMaterial({ color: CONFIG.colours.ring, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    // Rings face along the valley (toward +Z, the direction of travel from the runway).
    mesh.rotation.y = 0;
    this.group.add(mesh);
    // A soft glow disc behind the ring so it reads from far away.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(this.ringRadius * 0.92, 32),
      new THREE.MeshBasicMaterial({ color: CONFIG.colours.ring, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    glow.position.copy(pos);
    this.group.add(glow);
    // A tall light beam over the ring so the next target is unmistakable.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 160, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: CONFIG.colours.ringNext, transparent: true, opacity: 0.10,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(pos.x, pos.y + 80, pos.z);
    beam.visible = false;
    this.group.add(beam);
    this.targets.push({ mesh, glow, beam, pos, passed: false, stripId: stripId || null });
  }

  clearTargets() {
    for (const t of this.targets) {
      this.group.remove(t.mesh, t.glow, t.beam);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    this.targets = [];
  }

  updateRingColours() {
    this.targets.forEach((t, i) => {
      const col = t.passed ? 0x2f7a4a : (i === this.nextIndex ? CONFIG.colours.ringNext : CONFIG.colours.ring);
      t.mesh.material.color.setHex(col);
      t.glow.material.color.setHex(col);
      t.beam.material.color.setHex(col);
      t.beam.visible = !t.passed && i === this.nextIndex && this.status === 'flying';
    });
  }

  // Called every frame while flying. Returns 'ring' | 'landed' | 'timeout' | null.
  update(state, dt) {
    if (this.status !== 'flying') return null;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.status = 'failed';
      this.message = 'TIME UP';
      return 'timeout';
    }
    // Wind gusts in the storm mission.
    if (this.def.gust > 0) {
      const t = state.time;
      const gust = Math.sin(t * 0.7) * this.def.gust + Math.sin(t * 1.9) * this.def.gust * 0.5;
      state.wind.set(gust, 0, Math.cos(t * 0.5) * this.def.gust * 0.6);
    } else {
      state.wind.set(0, 0, 0);
    }
    // The next ring pulses so it is unmistakable at a glance.
    const next = this.targets[this.nextIndex];
    if (next && !this.awaitingLanding) {
      const p = 0.5 + 0.5 * Math.sin(state.time * 4);
      next.mesh.scale.setScalar(1 + p * 0.05);
      next.mesh.material.opacity = 0.8 + p * 0.2;
      next.glow.material.opacity = 0.06 + p * 0.08;
    }
    // Courier: a touchdown on the expected island strip, after its ring.
    if (this.def.goal === 'courier' && this.awaitingLanding) {
      if (state.landed && !this.prevLanded) {
        const strip = this.stripUnder(state.position);
        const target = this.targets[this.nextIndex];
        if (strip && target && strip.id === target.stripId) {
          const last = this.nextIndex >= this.targets.length - 1;
          this.score += 1500 + Math.max(0, Math.round(this.timeLeft)) * 2;
          this.awaitingLanding = false;
          if (last) {
            this.status = 'done';
            this.message = 'COURIER COMPLETE';
            this.score += 3000 + Math.round(this.timeLeft) * 10;
            this.updateRingColours();
            this.prevLanded = state.landed;
            return 'landed';
          }
          this.nextIndex++;
          this.message = 'CARGO LOADED — NEXT ISLAND';
          this.updateRingColours();
          this.prevLanded = state.landed;
          return 'landed';
        }
      }
      this.prevLanded = state.landed;
      return null;
    }
    this.prevLanded = state.landed;
    // Ring / checkpoint pass check.
    const target = this.targets[this.nextIndex];
    if (target && !target.passed) {
      const d = state.position.distanceTo(target.pos);
      if (d < this.ringRadius) {
        target.passed = true;
        this.score += 1000 + Math.max(0, Math.round(this.timeLeft)) * 2;
        if (this.def.goal === 'courier') {
          // Ring passed: now land on the island strip below it.
          const strip = stripById(target.stripId);
          this.awaitingLanding = true;
          this.message = this.nextIndex >= this.targets.length - 1
            ? `LAND ON ${strip.name} — DELIVER THE CARGO`
            : `LAND ON ${strip.name} — PICK UP CARGO`;
          this.updateRingColours();
          return 'ring';
        }
        this.nextIndex++;
        this.updateRingColours();
        if (this.def.goal === 'rings' && this.nextIndex >= this.targets.length) {
          this.status = 'done';
          this.message = 'COURSE COMPLETE';
          this.score += 2000 + Math.round(this.timeLeft) * 10;
          return 'ring';
        }
        if (this.def.goal === 'delivery' && this.nextIndex >= this.targets.length) {
          this.message = 'ALL CHECKPOINTS — LAND ON THE FAR STRIP';
        }
        return 'ring';
      }
    }
    // Delivery mission ends with a landing on the far strip.
    if (this.def.goal === 'delivery' && this.nextIndex >= this.targets.length && state.landed) {
      this.status = 'done';
      this.message = 'DELIVERY COMPLETE';
      this.score += 3000 + Math.round(this.timeLeft) * 10;
      return 'landed';
    }
    // Ring missions also end early if the plane lands safely back home.
    if (this.def.goal === 'rings' && state.landed && this.nextIndex > 0) {
      this.status = 'done';
      this.message = 'LANDED — SORTIE OVER';
      return 'landed';
    }
    return null;
  }

  nextTarget() {
    return this.targets[this.nextIndex] || null;
  }

  // Which strip, if any, the plane is sitting on right now.
  stripUnder(position) {
    for (const strip of [CONFIG.world.runway, CONFIG.world.farStrip, ...CONFIG.world.islands]) {
      if (onStripAt(position.x, position.z, strip)) return strip;
    }
    return null;
  }

  // World position the waypoint arrow should point at: the next ring,
  // the island strip to land on, or the far strip for the delivery finish.
  nextTargetPos() {
    if (this.status !== 'flying') return null;
    if (this.def.goal === 'courier') {
      const target = this.targets[this.nextIndex];
      if (!target) return null;
      if (this.awaitingLanding) {
        const strip = stripById(target.stripId);
        return new THREE.Vector3(strip.x, 8, strip.z);
      }
      return target.pos;
    }
    if (this.def.goal === 'delivery' && this.nextIndex >= this.targets.length) {
      const f = CONFIG.world.farStrip;
      return new THREE.Vector3(f.x, 8, f.z);
    }
    const target = this.targets[this.nextIndex];
    return target ? target.pos : null;
  }

  // One dot per mission step for the HUD: done | current | todo.
  progressDots() {
    if (this.def.goal === 'courier') {
      return this.targets.map((t, i) => {
        if (i < this.nextIndex) return 'done';
        if (i === this.nextIndex) return t.passed ? 'landing' : 'current';
        return 'todo';
      });
    }
    const steps = this.targets.length + (this.def.goal === 'delivery' ? 1 : 0);
    const dots = [];
    for (let i = 0; i < steps; i++) {
      if (i < this.nextIndex) dots.push('done');
      else if (i === this.nextIndex) dots.push('current');
      else dots.push('todo');
    }
    return dots;
  }

  objectiveText() {
    if (this.status !== 'flying') return this.message;
    if (this.def.goal === 'courier') {
      const target = this.targets[this.nextIndex];
      if (!target) return this.message;
      const strip = stripById(target.stripId);
      if (this.awaitingLanding) return `LAND ON ${strip.name} — ${this.nextIndex >= this.targets.length - 1 ? 'DELIVER THE CARGO' : 'PICK UP CARGO'}`;
      return `ISLAND ${this.nextIndex + 1} / ${this.targets.length} — ring over ${strip.name}`;
    }
    const target = this.nextTarget();
    if (this.def.goal === 'rings') {
      return `RING ${this.nextIndex + 1} / ${this.targets.length} — fly through the green ring`;
    }
    if (this.nextIndex < this.targets.length) {
      return `CHECKPOINT ${this.nextIndex + 1} / ${this.targets.length} — fly through the green ring`;
    }
    return 'LAND ON THE FAR STRIP — gentle touchdown, wings level';
  }
}
