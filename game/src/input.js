// Keyboard + mouse input for AERIS — Ridge Run.
// Holds the live control state; main.js reads it every frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseDX = 0;   // accumulated drag deltas, consumed per frame
    this.mouseDY = 0;
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.pressed = new Set(); // keys pressed since last consume (edge triggers)
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX / window.innerWidth;
      this.mouseY = e.clientY / window.innerHeight;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.mouseDown) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
      this.mouseX = e.clientX / window.innerWidth;
      this.mouseY = e.clientY / window.innerHeight;
    });
    // Touch: drag steers, second finger is throttle.
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.mouseDX += (t.clientX / window.innerWidth - this.mouseX) * 600;
      this.mouseX = t.clientX / window.innerWidth;
      this.mouseY = t.clientY / window.innerHeight;
    }, { passive: false });
  }

  down(code) { return this.keys.has(code); }

  // True once for a key pressed since the last frame; consumed by the caller.
  wasPressed(code) { return this.pressed.has(code); }
  clearPressed() { this.pressed.clear(); }

  // -1..1 axes from keys + mouse drag.
  pitchAxis() {
    let v = 0;
    if (this.down('ArrowUp')) v -= 1;
    if (this.down('ArrowDown')) v += 1;
    v += this.mouseDY * 0.004;
    return Math.max(-1, Math.min(1, v));
  }
  rollAxis() {
    let v = 0;
    if (this.down('ArrowLeft') || this.down('KeyA')) v -= 1;
    if (this.down('ArrowRight') || this.down('KeyD')) v += 1;
    v += this.mouseDX * 0.004;
    return Math.max(-1, Math.min(1, v));
  }
  yawAxis() {
    let v = 0;
    if (this.down('KeyQ')) v -= 1;
    if (this.down('KeyE')) v += 1;
    return v;
  }
  throttleAxis() {
    let v = 0;
    if (this.down('ShiftLeft') || this.down('ShiftRight')) v += 1;
    if (this.down('ControlLeft') || this.down('ControlRight') || this.down('KeyS')) v -= 1;
    if (this.down('KeyW')) v += 1;
    return v;
  }
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }
}
