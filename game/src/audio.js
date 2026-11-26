// Sound for AERIS — Ridge Run: everything synthesised with WebAudio.
// No audio files. Audio starts on the first user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSrc = null;
    this.windGain = null;
    this.muted = false;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      // Engine hum: two detuned sawtooth oscillators through a low-pass filter.
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 93;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.4;
      this.engineOsc.connect(filter);
      osc2.connect(g2);
      g2.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      osc2.start();
      this.engineOsc2 = osc2;
      // Wind: looped filtered noise.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.windSrc = this.ctx.createBufferSource();
      this.windSrc.buffer = buf;
      this.windSrc.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;
      this.windSrc.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      this.windSrc.start();
    } catch {
      this.ctx = null;
    }
  }

  update(state) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const rpm = 50 + state.throttle * 90 + state.speed * 0.4;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.1);
    const vol = state.onGround && state.speed < 2 ? 0.03 : 0.05 + state.throttle * 0.07;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.15);
    const wind = Math.min(0.16, (state.speed / 95) * 0.16);
    this.windGain.gain.setTargetAtTime(wind, t, 0.2);
  }

  // A short chime when a ring is passed.
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [freq, delay] of [[880, 0], [1318, 0.09]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.22, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.5);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.55);
    }
  }

  // A low thud for touchdown or impact.
  thud(hard) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hard ? 70 : 110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.5 : 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.engineGain) {
      this.engineGain.gain.value = this.muted ? 0 : 0.05;
      this.windGain.gain.value = this.muted ? 0 : 0.02;
    }
    return this.muted;
  }
}
