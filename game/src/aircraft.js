// The aircraft: a bush plane built from Three.js primitives — fuselage,
// wings, tail, spinning propeller, landing gear, navigation lights.
import * as THREE from 'three';

export class Aircraft {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.prop = null;
    this.navLeft = null;
    this.navRight = null;
    this.buildBody();
    this.buildSmoke();
    scene.add(this.group);
  }

  buildBody() {
    const paint = new THREE.MeshStandardMaterial({ color: 0xd8432e, roughness: 0.45, metalness: 0.25 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.5, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.6 });

    // Fuselage: a tapered cylinder along -Z (nose points -Z in local space).
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 12), paint);
    fus.rotation.x = Math.PI / 2;
    fus.castShadow = true;
    this.group.add(fus);
    // Nose cone.
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), cream);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -3.9;
    this.group.add(nose);
    // Canopy.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), glass);
    canopy.scale.set(0.9, 0.75, 1.7);
    canopy.position.set(0, 0.62, -0.4);
    this.group.add(canopy);
    // Main wing.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), cream);
    wing.position.set(0, 0.15, -0.3);
    wing.castShadow = true;
    this.group.add(wing);
    // Wing tips.
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.9), paint);
      tip.position.set(s * 5.55, 0.15, -0.3);
      this.group.add(tip);
    }
    // Tail: horizontal stabiliser + vertical fin.
    const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 1.3), cream);
    stab.position.set(0, 0.25, 3.1);
    this.group.add(stab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.7), paint);
    fin.position.set(0, 0.9, 3.1);
    this.group.add(fin);
    // Propeller: spinner cone, hub + two blades, spins with throttle.
    this.prop = new THREE.Group();
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), cream);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -0.35;
    this.prop.add(spinner);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
    hub.rotation.x = Math.PI / 2;
    this.prop.add(hub);
    for (const a of [0, Math.PI]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.1), dark);
      blade.position.y = Math.cos(a) * 0; // blades span the Y axis
      const holder = new THREE.Group();
      holder.rotation.z = a;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.7, 0.08), dark);
      b.position.y = 0.85;
      holder.add(b);
      const b2 = b.clone();
      b2.position.y = -0.85;
      holder.add(b2);
      this.prop.add(holder);
    }
    this.prop.position.z = -4.75;
    this.group.add(this.prop);
    // Propeller disc: faint translucent circle so the spin reads at speed.
    // Kept visible in cockpit view, where it reads as the spinning prop.
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, side: THREE.DoubleSide }),
    );
    this.disc.position.z = -4.78;
    this.group.add(this.disc);
    // Landing gear: two wheels + struts, tail wheel.
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
      strut.position.set(s * 0.9, -0.85, -1.2);
      strut.rotation.z = s * 0.35;
      this.group.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(s * 1.15, -1.35, -1.2);
      this.group.add(wheel);
    }
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -0.75, 3.2);
    this.group.add(tailWheel);
    // Engine detail: exhaust stacks, cowling vents, wing struts, antenna, pitot.
    for (const s of [-1, 1]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6), dark);
      exhaust.rotation.x = Math.PI / 2 - 0.35;
      exhaust.position.set(s * 0.72, -0.45, -3.4);
      this.group.add(exhaust);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), dark);
      strut.position.set(s * 2.6, -0.85, -0.3);
      strut.rotation.z = s * 0.5;
      this.group.add(strut);
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.4), dark);
      vent.position.set(s * 0.55, 0.86, -2.6);
      this.group.add(vent);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 5.6), cream);
    stripe.position.set(0, 0.82, 0.4);
    this.group.add(stripe);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 5), dark);
    antenna.position.set(0, 1.3, 1.2);
    antenna.rotation.x = 0.25;
    this.group.add(antenna);
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), dark);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(-2.8, 0.05, -1.1);
    this.group.add(pitot);
    // Navigation lights: red left, green right, white tail.
    this.navLeft = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    this.navLeft.position.set(-5.8, 0.15, -0.3);
    this.navRight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x22ff66 }),
    );
    this.navRight.position.set(5.8, 0.15, -0.3);
    const tailLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    tailLight.position.set(0, 0.3, 3.95);
    this.group.add(this.navLeft, this.navRight, tailLight);
  }

  // In cockpit view the camera sits inside the fuselage, so the bodywork
  // and the prop blades are hidden; only the faint prop disc stays ahead,
  // so no blade freezes across the windscreen.
  setCockpitMode(on) {
    for (const child of this.group.children) {
      child.visible = on ? (child === this.disc) : true;
    }
  }

  // Wingtip smoke: a ring buffer of puffs in world space, fed on hard turns.
  // The points are added to the scene (not the plane) so they hang in the
  // air behind the wingtips instead of rotating with the aircraft.
  buildSmoke() {
    this.smokeCount = 140;
    this.smokeLife = new Float32Array(this.smokeCount);
    const positions = new Float32Array(this.smokeCount * 3);
    for (let i = 0; i < this.smokeCount; i++) positions[i * 3 + 1] = -1000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, transparent: true, opacity: 0.4,
      sizeAttenuation: true, depthWrite: false,
    });
    this.smoke = new THREE.Points(geo, mat);
    this.smoke.frustumCulled = false;
    this.smokeCursor = 0;
    this.smokeTimer = 0;
    this.scene.add(this.smoke);
  }

  emitSmoke(worldPos) {
    const i = this.smokeCursor;
    this.smokeCursor = (this.smokeCursor + 1) % this.smokeCount;
    const attr = this.smoke.geometry.attributes.position;
    attr.setXYZ(i, worldPos.x, worldPos.y, worldPos.z);
    attr.needsUpdate = true;
    this.smokeLife[i] = 1;
  }

  // Place the mesh from the flight state; spin the prop with throttle.
  update(state, dt, time) {
    this.group.position.copy(state.position);
    this.group.rotation.set(state.pitch, state.heading, state.roll, 'YXZ');
    const spin = 4 + state.throttle * 46;
    this.prop.rotation.z += spin * dt;
    const blink = Math.sin(time * 6) > 0;
    this.navLeft.material.color.setHex(blink ? 0xff2222 : 0x551111);
    this.navRight.material.color.setHex(blink ? 0x22ff66 : 0x113311);
    // Hard bank at speed trails wingtip smoke from the inside wingtip.
    this.smokeTimer -= dt;
    const hardTurn = Math.abs(state.roll) > 0.55 && state.speed > 45 && !state.onGround;
    if (hardTurn && this.smokeTimer <= 0) {
      this.smokeTimer = 0.03;
      const side = state.roll > 0 ? -1 : 1;
      const tip = new THREE.Vector3(side * 5.6, 0.15, -0.3);
      this.group.localToWorld(tip);
      this.emitSmoke(tip);
    }
    // Fade old puffs out by sinking them below the world.
    const attr = this.smoke.geometry.attributes.position;
    let faded = false;
    for (let i = 0; i < this.smokeCount; i++) {
      if (this.smokeLife[i] > 0) {
        this.smokeLife[i] -= dt * 0.8;
        if (this.smokeLife[i] <= 0) {
          attr.setY(i, -1000);
          faded = true;
        }
      }
    }
    if (faded) attr.needsUpdate = true;
  }
}
