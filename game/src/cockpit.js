// Cockpit for AERIS — Ridge Run: a 3D instrument panel with lit gauges
// (airspeed, altimeter, attitude, compass) that rides with the camera, so
// the cockpit view shows real flown instruments, not a flat overlay.
// Gauge faces are small canvases drawn fresh as the plane flies.
import * as THREE from 'three';

const GAUGE_SIZE = 128;

function makeGaugeCanvas() {
  const c = document.createElement('canvas');
  c.width = GAUGE_SIZE;
  c.height = GAUGE_SIZE;
  return c;
}

// Dark lit gauge face: glowing rim, tick marks, a needle and a label.
function drawDial(ctx, label, value, max, unit) {
  const W = GAUGE_SIZE, cx = W / 2, cy = W / 2, R = 58;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#0a141f';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#37e08a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,240,255,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const r1 = R - 6, r2 = R - (i % 5 === 0 ? 16 : 11);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  const frac = Math.max(0, Math.min(1, value / max));
  const na = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * (R - 18), cy + Math.sin(na) * (R - 18));
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfe6f5';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 30);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(value)}`, cx, cy + 48);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#8fc7ec';
  ctx.fillText(unit, cx, cy - 26);
}

// Artificial horizon ball with a fixed aircraft symbol.
function drawAttitude(ctx, pitch, roll) {
  const W = GAUGE_SIZE, cx = W / 2, cy = W / 2, R = 58;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pitchPx = Math.max(-40, Math.min(40, pitch * 90));
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-70, -70, 140, 70);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-70, 0, 140, 70);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 9, cy);
  ctx.moveTo(cx + 9, cy); ctx.lineTo(cx + 24, cy);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  ctx.strokeStyle = '#37e08a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#cfe6f5';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', cx, cy + 48);
}

// Heading tape: the cardinal points scroll past a fixed centre needle.
function drawCompass(ctx, headingDeg) {
  const W = GAUGE_SIZE, cx = W / 2, cy = W / 2, R = 58;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#0a141f';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#37e08a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, Math.PI * 2); ctx.stroke();
  const labels = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  ctx.fillStyle = '#cfe6f5';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 12; i++) {
    const deg = i * 30;
    let rel = ((deg - headingDeg + 540) % 360) - 180; // -180..180 from centre
    if (Math.abs(rel) > 45) continue;
    const x = cx + (rel / 45) * 44;
    const alpha = 1 - Math.abs(rel) / 60;
    ctx.globalAlpha = Math.max(0.3, alpha);
    ctx.fillText(labels[i], x, cy + 4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(cx, cy - R + 8);
  ctx.lineTo(cx - 6, cy - R + 20);
  ctx.lineTo(cx + 6, cy - R + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0'), cx, cy + 40);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#8fc7ec';
  ctx.fillText('HDG', cx, cy - 26);
}

export class Cockpit {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.frame = 0;
    this.buildPanel();
    this.group.visible = false;
    camera.add(this.group);
  }

  buildPanel() {
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.7, metalness: 0.3 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.1), panelMat);
    panel.position.set(0, -0.75, -2.2);
    this.group.add(panel);
    // Glareshield lip above the panel.
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.12, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x12181f, roughness: 0.9 }),
    );
    shield.position.set(0, -0.42, -2.1);
    shield.rotation.x = -0.35;
    this.group.add(shield);
    // A centre control stick below the panel.
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6 }),
    );
    stick.position.set(0, -1.12, -2.0);
    stick.rotation.x = 0.3;
    this.group.add(stick);

    this.gauges = [];
    const defs = [
      { kind: 'dial', label: 'AIRSPEED', max: 200, unit: 'KT', x: -0.68 },
      { kind: 'attitude', x: -0.23 },
      { kind: 'dial', label: 'ALT', max: 10000, unit: 'FT', x: 0.23 },
      { kind: 'compass', x: 0.68 },
    ];
    for (const def of defs) {
      const canvas = makeGaugeCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36, 0.36),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      face.position.set(def.x, -0.75, -2.14);
      this.group.add(face);
      this.gauges.push({ ...def, canvas, ctx: canvas.getContext('2d'), tex });
    }
    // Small amber glow strip under the panel so the gauges read as lit.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.5 }),
    );
    glow.position.set(0, -1.08, -2.14);
    this.group.add(glow);
  }

  setVisible(v) {
    this.group.visible = v;
  }

  update(state) {
    if (!this.group.visible) return;
    // Redraw the dials every third frame: plenty smooth, a third of the cost.
    this.frame++;
    if (this.frame % 3 !== 0) return;
    const altFt = Math.max(0, (state.position.y - 2) * 3.28084);
    const spdKt = state.speed * 1.94384;
    let hdg = Math.round((-state.heading * 180) / Math.PI) % 360;
    if (hdg < 0) hdg += 360;
    for (const g of this.gauges) {
      if (g.kind === 'dial' && g.label === 'AIRSPEED') drawDial(g.ctx, g.label, spdKt, g.max, g.unit);
      else if (g.kind === 'dial') drawDial(g.ctx, g.label, altFt, g.max, g.unit);
      else if (g.kind === 'attitude') drawAttitude(g.ctx, state.pitch, state.roll);
      else if (g.kind === 'compass') drawCompass(g.ctx, hdg);
      g.tex.needsUpdate = true;
    }
  }
}
