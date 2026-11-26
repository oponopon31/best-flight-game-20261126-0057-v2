// HUD for AERIS — Ridge Run: a DOM overlay of flight instruments.
// Crisp text and gauges so the screenshots read as a flown aircraft.
export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="hud-top-left" class="hud-panel">
        <div class="hud-row"><span class="hud-label">ALT</span><span id="hud-alt" class="hud-big">0</span><span class="hud-unit">FT</span></div>
        <div class="hud-row"><span class="hud-label">SPD</span><span id="hud-spd" class="hud-big">0</span><span class="hud-unit">KT</span></div>
        <div class="hud-row"><span class="hud-label">HDG</span><span id="hud-hdg" class="hud-big">000</span><span class="hud-unit">°</span></div>
        <div class="hud-row"><span class="hud-label">V/S</span><span id="hud-vs" class="hud-mid">+0</span><span class="hud-unit">FPM</span></div>
      </div>
      <div id="hud-compass" class="hud-panel"><div id="hud-compass-strip"></div><div id="hud-compass-needle">▲</div></div>
      <div id="hud-waypoint" class="hud-panel"><span id="hud-wp-arrow">▲</span><span id="hud-wp-dist">—</span></div>
      <div id="hud-top-right" class="hud-panel">
        <div class="hud-row"><span class="hud-label">THR</span><div class="hud-bar"><div id="hud-thr-fill" class="hud-fill thr"></div></div><span id="hud-thr" class="hud-mid">0%</span></div>
        <div class="hud-row"><span class="hud-label">FUEL</span><div class="hud-bar"><div id="hud-fuel-fill" class="hud-fill fuel"></div></div><span id="hud-fuel" class="hud-mid">100%</span></div>
        <div class="hud-row"><span class="hud-label">DMG</span><div class="hud-bar"><div id="hud-dmg-fill" class="hud-fill dmg"></div></div><span id="hud-dmg" class="hud-mid">0%</span></div>
        <div class="hud-row"><span class="hud-label">WIND</span><span id="hud-wind" class="hud-mid">0 KT</span><span id="hud-wind-arrow" class="hud-mid">→</span></div>
      </div>
      <div id="hud-horizon" class="hud-panel">
        <canvas id="hud-horizon-canvas" width="120" height="120"></canvas>
        <div class="hud-horizon-label">ATTITUDE</div>
      </div>
      <div id="hud-bottom" class="hud-panel">
        <div id="hud-objective">—</div>
        <div id="hud-progress"></div>
        <div id="hud-sub"><span id="hud-timer">4:00</span> &nbsp;·&nbsp; SCORE <span id="hud-score">0</span></div>
      </div>
      <div id="hud-warn"></div>
      <div id="hud-centre"></div>
    `;
    this.el = {};
    for (const id of ['alt', 'spd', 'hdg', 'vs', 'thr', 'fuel', 'dmg', 'timer', 'score', 'objective']) {
      this.el[id] = root.querySelector(`#hud-${id}`);
    }
    this.el.thrFill = root.querySelector('#hud-thr-fill');
    this.el.fuelFill = root.querySelector('#hud-fuel-fill');
    this.el.dmgFill = root.querySelector('#hud-dmg-fill');
    this.el.warn = root.querySelector('#hud-warn');
    this.el.centre = root.querySelector('#hud-centre');
    this.el.strip = root.querySelector('#hud-compass-strip');
    this.el.wpArrow = root.querySelector('#hud-wp-arrow');
    this.el.wpDist = root.querySelector('#hud-wp-dist');
    this.el.waypoint = root.querySelector('#hud-waypoint');
    this.el.wind = root.querySelector('#hud-wind');
    this.el.windArrow = root.querySelector('#hud-wind-arrow');
    this.el.progress = root.querySelector('#hud-progress');
    this.horizonCtx = root.querySelector('#hud-horizon-canvas').getContext('2d');
    this.buildCompassStrip();
  }

  buildCompassStrip() {
    const labels = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    let html = '';
    for (let i = 0; i < 3; i++) {
      for (const l of labels) html += `<span class="hud-compass-tick">${l}</span>`;
    }
    this.el.strip.innerHTML = html;
  }

  update(state, mission) {
    const altFt = Math.max(0, Math.round((state.position.y - 2) * 3.28084));
    const spdKt = Math.round(state.speed * 1.94384);
    let hdg = Math.round((-state.heading * 180) / Math.PI) % 360;
    if (hdg < 0) hdg += 360;
    const vsFpm = Math.round(state.verticalSpeed * 196.85);
    this.el.alt.textContent = altFt.toLocaleString('en-US');
    this.el.spd.textContent = spdKt;
    this.el.hdg.textContent = String(hdg).padStart(3, '0');
    this.el.vs.textContent = (vsFpm >= 0 ? '+' : '') + vsFpm;
    this.el.thr.textContent = `${Math.round(state.throttle * 100)}%`;
    this.el.fuel.textContent = `${Math.round(state.fuel)}%`;
    this.el.dmg.textContent = `${Math.round(state.damage)}%`;
    this.el.thrFill.style.width = `${state.throttle * 100}%`;
    this.el.fuelFill.style.width = `${state.fuel}%`;
    this.el.fuelFill.classList.toggle('low', state.fuel < 25);
    this.el.dmgFill.style.width = `${state.damage}%`;
    const t = Math.max(0, Math.ceil(mission.timeLeft));
    this.el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.el.score.textContent = mission.score.toLocaleString('en-US');
    this.el.objective.textContent = mission.objectiveText();
    // Waypoint arrow: bearing to the next target, relative to the nose,
    // with the straight-line distance. Hidden when there is no target.
    const targetPos = mission.nextTargetPos ? mission.nextTargetPos() : null;
    if (targetPos && mission.status === 'flying') {
      const dx = targetPos.x - state.position.x;
      const dz = targetPos.z - state.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const bearing = Math.atan2(dx, -dz); // same convention as heading
      let rel = bearing - state.heading;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      this.el.waypoint.style.display = '';
      this.el.wpArrow.style.transform = `rotate(${rel * 180 / Math.PI}deg)`;
      this.el.wpDist.textContent = dist >= 1000
        ? `${(dist / 1000).toFixed(1)} KM` : `${Math.round(dist)} M`;
    } else {
      this.el.waypoint.style.display = 'none';
    }
    // Mission progress dots: one per step, done / current / upcoming.
    if (mission.progressDots) {
      const dots = mission.progressDots();
      this.el.progress.innerHTML = dots.map((d) => `<span class="hud-dot ${d}">●</span>`).join('');
    }
    // Wind: speed in knots and the direction it blows toward.
    const windKt = Math.round(Math.hypot(state.wind.x, state.wind.z) * 1.94384);
    this.el.wind.textContent = `${windKt} KT`;
    if (windKt > 0) {
      const windAngle = Math.atan2(state.wind.z, state.wind.x) * 180 / Math.PI;
      this.el.windArrow.style.transform = `rotate(${windAngle}deg)`;
      this.el.windArrow.style.display = '';
    } else {
      this.el.windArrow.style.display = 'none';
    }
    // Compass strip scrolls with heading. The strip holds 3 copies of 12
    // ticks (96 px each); copy 2's N sits at 1200 px, so shifting the strip
    // by -(1200 + offset * 3.2) px centres the current heading.
    const offset = ((hdg + 180) % 360) - 180;
    this.el.strip.style.transform = `translateX(${-1200 - offset * 3.2}px)`;
    // Warnings.
    const warns = [];
    if (state.stalled && !state.onGround) warns.push('STALL');
    if (state.fuel < 25) warns.push('LOW FUEL');
    if (state.damage > 60) warns.push('DAMAGE');
    if (state.fuel <= 0) warns.push('FUEL EMPTY');
    this.el.warn.innerHTML = warns.map((w) => `<span class="hud-warn-item">${w}</span>`).join('');
    this.drawHorizon(state);
  }

  drawHorizon(state) {
    const ctx = this.horizonCtx;
    const W = 120, H = 120, cx = 60, cy = 60, R = 52;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-state.roll);
    const pitchPx = Math.max(-40, Math.min(40, state.pitch * 90));
    ctx.translate(0, pitchPx);
    ctx.fillStyle = '#3f7ec2';
    ctx.fillRect(-70, -70, 140, 70);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-70, 0, 140, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-70, 0); ctx.lineTo(70, 0);
    ctx.stroke();
    ctx.restore();
    // Fixed aircraft symbol + bezel.
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  showCentre(text, sub) {
    this.el.centre.innerHTML = `<div class="hud-centre-title">${text}</div>${sub ? `<div class="hud-centre-sub">${sub}</div>` : ''}`;
  }
  clearCentre() { this.el.centre.innerHTML = ''; }
}
