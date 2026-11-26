// Terrain for AERIS — Ridge Run: seeded heightmap valley, river, lake,
// trees, rocks, clouds, sun and sky. One low-poly style throughout.
import * as THREE from 'three';
import { CONFIG, makeRng } from './config.js';

// Small deterministic value-noise field, seeded so every run builds the same valley.
function makeNoise(seed) {
  const rng = makeRng(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  function smooth(t) { return t * t * (3 - 2 * t); }
  function at(ix, iz) {
    const x = ((ix % size) + size) % size;
    const z = ((iz % size) + size) % size;
    return grid[z * size + x];
  }
  return function noise(x, z) {
    const fx = Math.floor(x), fz = Math.floor(z);
    const tx = smooth(x - fx), tz = smooth(z - fz);
    const a = at(fx, fz), b = at(fx + 1, fz), c = at(fx, fz + 1), d = at(fx + 1, fz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
}

export class Terrain {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.seed = seed;
    this.noise = makeNoise(seed * 7919 + 13);
    this.rng = makeRng(seed * 104729 + 7);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildRiver();
    this.buildSea();
    this.buildTreesAndRocks();
    this.buildClouds();
    this.buildSky();
    this.buildRunways();
    this.buildPeaks();
    this.buildBuildings();
  }

  // Ground height at world (x, z). Ridges rise away from the valley floor.
  heightAt(x, z) {
    const n = this.noise;
    const half = CONFIG.world.size / 2;
    if (Math.abs(x) > half || Math.abs(z) > half) return 0;
    const valley = Math.min(1, Math.abs(x) / CONFIG.world.valleyHalfWidth);
    const ridge = Math.pow(valley, 1.6);
    let h = 0;
    h += n(x * 0.0016 + 7.3, z * 0.0016 + 2.1) * 150 * ridge;
    h += n(x * 0.005 + 1.7, z * 0.005 + 9.4) * 55 * ridge;
    h += n(x * 0.02 + 4.2, z * 0.02 + 6.8) * 9 * ridge;
    // A second, lower ridge line on the east side for the canyon shots.
    const east = Math.max(0, (x - 700) / 900);
    h += east * east * 120 * n(x * 0.002 + 3.1, z * 0.002 + 5.5);
    // The eastern sea: beyond the coast the land sinks to sea level,
    // except for three island bumps that rise out of the water.
    if (x > 1250) {
      const seaT = Math.max(0, Math.min(1, (x - 1250) / 250));
      const blend = seaT * seaT * (3 - 2 * seaT);
      h = h * (1 - blend) + 1.5 * blend;
      for (const isle of CONFIG.world.islands) {
        const dx = x - isle.x;
        const dz = z - isle.z;
        const d2 = (dx * dx + dz * dz) / (230 * 230);
        h += 26 * Math.exp(-d2);
      }
    }
    // Flatten the runway strips so landings are possible.
    h = this.flattenStrip(h, x, z, CONFIG.world.runway);
    h = this.flattenStrip(h, x, z, CONFIG.world.farStrip);
    for (const isle of CONFIG.world.islands) h = this.flattenStrip(h, x, z, isle);
    return h;
  }

  flattenStrip(h, x, z, strip) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    // Rotate into strip space: the strip's long axis runs (sin h, cos h).
    const along = Math.abs(dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading));
    const across = Math.abs(dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading));
    if (along < strip.length / 2 + 60 && across < strip.width / 2 + 60) {
      const edge = Math.max(
        (along - strip.length / 2) / 60,
        (across - strip.width / 2) / 60,
      );
      const t = Math.max(0, Math.min(1, edge));
      const blend = t * t * (3 - 2 * t);
      return h * blend + 2 * (1 - blend);
    }
    return h;
  }

  buildGround() {
    const size = CONFIG.world.size;
    const seg = CONFIG.world.segments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(CONFIG.colours.grass);
    const cRock = new THREE.Color(CONFIG.colours.rock);
    const cSnow = new THREE.Color(CONFIG.colours.snow);
    const cSand = new THREE.Color(0x9a8a5e);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      // Colour by height and slope: grass low, rock steep, snow high.
      const slope = this.noise(x * 0.02 + 4.2, z * 0.02 + 6.8);
      tmp.copy(cGrass);
      if (h > 150) tmp.lerp(cSnow, Math.min(1, (h - 150) / 90));
      else if (h > 70 || slope > 0.72) tmp.lerp(cRock, Math.min(1, (h - 70) / 80 + (slope - 0.72) * 2));
      if (Math.abs(x) < 46 && h < 12) tmp.lerp(cSand, 0.5); // riverbank sand
      if (x > 1180 && h < 8) tmp.lerp(cSand, 0.6); // beach where the valley meets the sea
      const shade = 0.95 + this.noise(x * 0.05, z * 0.05) * 0.09;
      colours[i * 3] = tmp.r * shade;
      colours[i * 3 + 1] = tmp.g * shade;
      colours[i * 3 + 2] = tmp.b * shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.ground = mesh;
    this.group.add(mesh);
  }

  buildRiver() {
    // A winding river down the valley floor into a lake near the south end.
    // Phong water with a specular highlight so the sun glints off it.
    this.waterMat = new THREE.MeshPhongMaterial({
      color: CONFIG.colours.water, transparent: true, opacity: 0.9,
      shininess: 120, specular: 0x99ccff,
    });
    const points = [];
    for (let z = 2000; z >= -1400; z -= 100) {
      const x = Math.sin(z * 0.0016) * 120 + Math.sin(z * 0.004) * 30;
      points.push(new THREE.Vector3(x, 3.2, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 120, 16, 6, false);
    const river = new THREE.Mesh(geo, this.waterMat);
    river.scale.y = 0.18;
    this.group.add(river);

    const lakeGeo = new THREE.CircleGeometry(260, 40);
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, this.waterMat);
    lake.position.set(Math.sin(-1500 * 0.0016) * 120, 3.4, -1500);
    this.group.add(lake);
  }

  buildSea() {
    // The eastern sea: a wide sheet of glinting water past the coast,
    // with the three courier islands rising out of it.
    const seaGeo = new THREE.PlaneGeometry(920, 4200);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMat = new THREE.MeshPhongMaterial({
      color: CONFIG.colours.sea, transparent: true, opacity: 0.94,
      shininess: 160, specular: 0xbfe0ff,
    });
    this.seaMat = seaMat;
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.position.set(1660, 2.2, 0);
    this.group.add(sea);
    // A pale foam ring hugging each island's shore.
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xdff2f5, transparent: true, opacity: 0.55 });
    for (const isle of CONFIG.world.islands) {
      const ringGeo = new THREE.RingGeometry(235, 268, 40);
      ringGeo.rotateX(-Math.PI / 2);
      const foam = new THREE.Mesh(ringGeo, foamMat);
      foam.position.set(isle.x, 2.5, isle.z);
      this.group.add(foam);
    }
  }

  buildTreesAndRocks() {
    const treeGeo = new THREE.ConeGeometry(7, 22, 6);
    const trunkGeo = new THREE.CylinderGeometry(1.4, 2, 8, 5);
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2f, flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f, flatShading: true });
    const rockGeo = new THREE.DodecahedronGeometry(6, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: CONFIG.colours.rock, flatShading: true });
    const rng = this.rng;
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, 420);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 420);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 160);
    const dummy = new THREE.Object3D();
    let ti = 0, ri = 0;
    for (let i = 0; i < 900 && ti < 420; i++) {
      const x = (rng() - 0.5) * 3800;
      const z = (rng() - 0.5) * 3800;
      const h = this.heightAt(x, z);
      if (h < 4 || h > 130) continue;              // trees live on the valley floor and slopes
      if (Math.abs(x) < 60 && h < 12) continue;    // keep the river clear
      const s = 0.7 + rng() * 0.9;
      dummy.position.set(x, h + 12 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      trees.setMatrixAt(ti, dummy.matrix);
      dummy.position.set(x, h + 4 * s, z);
      dummy.updateMatrix();
      trunks.setMatrixAt(ti, dummy.matrix);
      ti++;
    }
    for (let i = 0; i < 500 && ri < 160; i++) {
      const x = (rng() - 0.5) * 3800;
      const z = (rng() - 0.5) * 3800;
      const h = this.heightAt(x, z);
      if (h < 40) continue;
      const s = 0.6 + rng() * 1.6;
      dummy.position.set(x, h + 2 * s, z);
      dummy.scale.set(s, s * 0.7, s);
      dummy.rotation.set(rng(), rng() * 6, rng());
      dummy.updateMatrix();
      rocks.setMatrixAt(ri, dummy.matrix);
      ri++;
    }
    trees.count = ti; trunks.count = ti; rocks.count = ri;
    this.group.add(trees, trunks, rocks);
    // Broadleaf trees: round canopies for variety beside the pines.
    const leafGeo = new THREE.IcosahedronGeometry(8, 0);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x4a7d33, flatShading: true });
    const leafTrunkGeo = new THREE.CylinderGeometry(1.6, 2.4, 10, 5);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 200);
    const leafTrunks = new THREE.InstancedMesh(leafTrunkGeo, trunkMat, 200);
    let li = 0;
    for (let i = 0; i < 600 && li < 200; i++) {
      const x = (rng() - 0.5) * 3400;
      const z = (rng() - 0.5) * 3400;
      const h = this.heightAt(x, z);
      if (h < 4 || h > 90) continue;
      if (Math.abs(x) < 60 && h < 12) continue;
      if (x > 1250) continue; // no trees out at sea
      const s = 0.7 + rng() * 0.8;
      dummy.position.set(x, h + 14 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      leaves.setMatrixAt(li, dummy.matrix);
      dummy.position.set(x, h + 5 * s, z);
      dummy.updateMatrix();
      leafTrunks.setMatrixAt(li, dummy.matrix);
      li++;
    }
    leaves.count = li; leafTrunks.count = li;
    this.group.add(leaves, leafTrunks);
  }

  // Distant snow-capped peaks ringing the horizon, beyond the play area.
  buildPeaks() {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6f6258, flatShading: true });
    const snowMat = new THREE.MeshLambertMaterial({ color: CONFIG.colours.snow, flatShading: true });
    const spots = [
      [-1950, -1850, 620, 520], [1900, -1700, 560, 480], [-1850, 1750, 540, 460],
      [1750, 1900, 500, 430], [0, -2050, 680, 560], [-700, 2050, 480, 400],
      [900, -1950, 520, 440],
    ];
    for (const [x, z, h, r] of spots) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rockMat);
      peak.position.set(x, h / 2 - 10, z);
      this.group.add(peak);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.36, 7), snowMat);
      cap.position.set(x, h - 10 - h * 0.18, z);
      this.group.add(cap);
    }
  }

  // A hangar by the home runway, houses by the far strip, huts on the islands.
  buildBuildings() {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd8cdb8, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x9a4a34, flatShading: true });
    const hangarMat = new THREE.MeshLambertMaterial({ color: 0x7d94a6, flatShading: true });
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x2e3a44, flatShading: true });
    const addHouse = (x, z, w, d, hgt, ry = 0) => {
      const y = this.heightAt(x, z);
      const g = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMat);
      walls.position.y = hgt / 2;
      walls.castShadow = true;
      g.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, hgt * 0.7, 4), roofMat);
      roof.position.y = hgt + hgt * 0.35;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = ry;
      this.group.add(g);
    };
    // Hangar beside the home runway.
    const hy = this.heightAt(72, 960);
    const hangar = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 24), hangarMat);
    hall.position.y = 6.5;
    hall.castShadow = true;
    hangar.add(hall);
    const hangarRoof = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 26), hangarMat);
    hangarRoof.position.y = 14;
    hangar.add(hangarRoof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), doorMat);
    door.position.set(0, 5, -12.1);
    door.rotation.y = Math.PI;
    hangar.add(door);
    hangar.position.set(72, hy, 960);
    this.group.add(hangar);
    // Houses near the far strip.
    addHouse(-215, -1080, 12, 10, 7, 0.4);
    addHouse(-195, -1230, 10, 9, 6, -0.3);
    addHouse(-245, -1180, 11, 9, 6.5, 0.9);
    // Huts on each island, beside the strip.
    for (const isle of CONFIG.world.islands) {
      addHouse(isle.x + 42, isle.z + 34, 9, 8, 5, isle.heading);
      addHouse(isle.x - 48, isle.z - 28, 8, 7, 4.5, isle.heading + 0.7);
    }
  }

  buildClouds() {
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true, opacity: 0.88, flatShading: true,
    });
    this.cloudMat = mat;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.clouds = [];
    const rng = this.rng;
    for (let i = 0; i < 42; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(geo, mat);
        const s = 14 + rng() * 22;
        m.scale.set(s, s * 0.45, s * 0.8);
        m.position.set((rng() - 0.5) * 50, (rng() - 0.5) * 6, (rng() - 0.5) * 30);
        cloud.add(m);
      }
      // A few low clouds drift just above the ridges for depth.
      const low = i < 8;
      cloud.position.set(
        (rng() - 0.5) * 3800,
        low ? 170 + rng() * 60 : 300 + rng() * 140,
        (rng() - 0.5) * 3800,
      );
      cloud.userData.drift = 1.5 + rng() * 2.5;
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildSky() {
    const scene = this.scene;
    scene.background = new THREE.Color(CONFIG.colours.skyBottom);
    scene.fog = new THREE.Fog(CONFIG.colours.fog, 500, 3400);
    const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x4a6b3a, 0.9);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(CONFIG.colours.sun, 1.6);
    sun.position.set(900, 1200, 400);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -500; sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500; sun.shadow.camera.bottom = -500;
    sun.shadow.camera.far = 4000;
    scene.add(sun);
    this.sun = sun;
    // A visible sun disc with a warm glow, so the sky has a light source to look at.
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128; glowCanvas.height = 128;
    const g = glowCanvas.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,244,200,1)');
    grad.addColorStop(0.25, 'rgba(255,226,150,0.9)');
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe9a8, transparent: true, depthWrite: false,
    }));
    this.sunSprite.position.set(2400, 800, -3200);
    this.sunSprite.scale.set(700, 700, 1);
    scene.add(this.sunSprite);
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe9a8, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    this.sunGlow.position.copy(this.sunSprite.position);
    this.sunGlow.scale.set(1800, 1800, 1);
    scene.add(this.sunGlow);
    this.dusk = false;
    // A big gradient sky dome so the horizon reads in every shot.
    const skyGeo = new THREE.SphereGeometry(5200, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(CONFIG.colours.skyTop) },
        bottom: { value: new THREE.Color(CONFIG.colours.skyBottom) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyMat = skyMat;
    scene.add(this.skyDome);
  }

  // Swap the whole lighting mood between day and dusk (the night run).
  setDusk(on) {
    this.dusk = on;
    const C = CONFIG.colours;
    const top = on ? C.duskSkyTop : C.skyTop;
    const bottom = on ? C.duskSkyBottom : C.skyBottom;
    this.skyMat.uniforms.top.value.setHex(top);
    this.skyMat.uniforms.bottom.value.setHex(bottom);
    this.scene.background.setHex(bottom);
    this.scene.fog.color.setHex(on ? C.duskFog : C.fog);
    this.sun.color.setHex(on ? C.duskSun : C.sun);
    this.sun.intensity = on ? 0.7 : 1.6;
    this.sun.position.set(on ? -900 : 900, on ? 320 : 1200, on ? 600 : 400);
    this.hemi.intensity = on ? 0.45 : 0.9;
    this.hemi.color.setHex(on ? 0x8a7ab8 : 0xcfe5ff);
    this.hemi.groundColor.setHex(on ? 0x3a2a28 : 0x4a6b3a);
    this.sunSprite.position.set(on ? -2400 : 2400, on ? 500 : 800, on ? 1600 : -3200);
    this.sunSprite.material.color.setHex(on ? 0xff7a30 : 0xffe9a8);
    this.sunSprite.scale.set(on ? 900 : 700, on ? 900 : 700, 1);
    this.sunGlow.position.copy(this.sunSprite.position);
    this.sunGlow.material.color.setHex(on ? 0xff7a30 : 0xffe9a8);
    this.sunGlow.material.opacity = on ? 0.45 : 0.35;
    this.sunGlow.scale.set(on ? 2200 : 1800, on ? 2200 : 1800, 1);
    this.cloudMat.color.setHex(on ? 0xffc9a8 : 0xffffff);
    if (this.waterMat) this.waterMat.color.setHex(on ? 0x7a4a6a : C.water);
    if (this.seaMat) this.seaMat.color.setHex(on ? 0x5a3a5e : C.sea);
  }

  buildRunways() {
    for (const strip of [CONFIG.world.runway, CONFIG.world.farStrip, ...CONFIG.world.islands]) {
      const geo = new THREE.PlaneGeometry(strip.width, strip.length);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshLambertMaterial({ color: CONFIG.colours.runway });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(strip.x, 3.6, strip.z);
      mesh.rotation.y = strip.heading;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      // Centre line dashes.
      const dashGeo = new THREE.PlaneGeometry(2, 14);
      dashGeo.rotateX(-Math.PI / 2);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
      const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 10);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 10; i++) {
        const along = -strip.length / 2 + 30 + i * (strip.length - 60) / 9;
        dummy.position.set(
          strip.x + Math.sin(strip.heading) * along,
          3.8,
          strip.z + Math.cos(strip.heading) * along,
        );
        dummy.rotation.y = strip.heading;
        dummy.updateMatrix();
        dashes.setMatrixAt(i, dummy.matrix);
      }
      this.group.add(dashes);
      this.buildStripLights(strip);
    }
    this.buildApproachLights(CONFIG.world.runway);
  }

  // Edge lights, threshold bar and PAPI-style glidepath lights for one strip.
  buildStripLights(strip) {
    const isHome = strip === CONFIG.world.runway;
    const edgeColour = isHome ? 0x9fd8ff : 0xffe08a;
    const edgeGeo = new THREE.SphereGeometry(0.7, 8, 6);
    const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColour });
    const count = Math.floor(strip.length / 30) + 1;
    const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, count * 2);
    const dummy = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < count; i++) {
      const along = -strip.length / 2 + i * 30;
      for (const side of [-1, 1]) {
        const across = side * (strip.width / 2 + 2);
        dummy.position.set(
          strip.x + Math.sin(strip.heading) * along + Math.cos(strip.heading) * across,
          4.4,
          strip.z + Math.cos(strip.heading) * along - Math.sin(strip.heading) * across,
        );
        dummy.updateMatrix();
        edges.setMatrixAt(k++, dummy.matrix);
      }
    }
    edges.count = k;
    this.group.add(edges);
    // Threshold bar: green lights across the approach end of the strip.
    const thrGeo = new THREE.BoxGeometry(2.2, 0.8, 2.2);
    const thrMat = new THREE.MeshBasicMaterial({ color: 0x2aff66 });
    const thr = new THREE.InstancedMesh(thrGeo, thrMat, 5);
    for (let i = 0; i < 5; i++) {
      const across = -strip.width / 2 + 4 + i * (strip.width - 8) / 4;
      const along = strip.length / 2 - 2;
      dummy.position.set(
        strip.x + Math.sin(strip.heading) * along + Math.cos(strip.heading) * across,
        4.2,
        strip.z + Math.cos(strip.heading) * along - Math.sin(strip.heading) * across,
      );
      dummy.updateMatrix();
      thr.setMatrixAt(i, dummy.matrix);
    }
    this.group.add(thr);
    if (!isHome) return;
    // PAPI-style lights beside the home threshold: two red, two white.
    const papiGeo = new THREE.BoxGeometry(2.4, 1.6, 1.2);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(papiGeo, i < 2 ? redMat : whiteMat);
      const along = strip.length / 2 - 55;
      const across = strip.width / 2 + 8 + i * 4;
      m.position.set(
        strip.x + Math.sin(strip.heading) * along + Math.cos(strip.heading) * across,
        4.6,
        strip.z + Math.cos(strip.heading) * along - Math.sin(strip.heading) * across,
      );
      m.rotation.y = strip.heading;
      this.group.add(m);
    }
  }

  // Approach light bars marching out from the home threshold, pulsing gently.
  buildApproachLights(strip) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 });
    this.approachMat = mat;
    const barGeo = new THREE.BoxGeometry(2.4, 0.9, 2.4);
    const bars = new THREE.InstancedMesh(barGeo, mat, 11);
    const dummy = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < 5; i++) {
      const along = strip.length / 2 + 30 + i * 42;
      const spread = i === 0 ? [-12, -6, 0, 6, 12] : [0];
      for (const across of spread) {
        dummy.position.set(
          strip.x + Math.sin(strip.heading) * along + Math.cos(strip.heading) * across,
          4.2,
          strip.z + Math.cos(strip.heading) * along - Math.sin(strip.heading) * across,
        );
        dummy.updateMatrix();
        bars.setMatrixAt(k++, dummy.matrix);
      }
    }
    bars.count = k;
    this.group.add(bars);
  }

  update(dt) {
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 2100) c.position.x = -2100;
    }
    if (this.skyDome) this.skyDome.position.set(0, 0, 0);
    // The approach lights breathe so the runway draws the eye at dusk.
    if (this.approachMat) {
      this.approachMat.opacity = 0.75 + 0.25 * Math.sin(performance.now() / 350);
    }
  }
}
