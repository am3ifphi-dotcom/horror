// WebAudio のみで生成する効果音・BGM
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  droneNodes: AudioNode[] = [];
  droneGain: GainNode | null = null;
  timer: number | null = null;
  step = 0;
  corruption = 0;

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 8;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.master);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, detune = 0, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // かわいいBGM（corruption が上がるほど遅く・短調に・音程が狂う）
  private melody = [0, 4, 7, 12, 7, 4, 7, 4, 5, 9, 12, 9, 7, 4, 2, -1, 0, 4, 7, 12, 14, 12, 9, 7, 5, 4, 2, 4, 0, -5, 0, null];
  private bass = [-12, -12, -5, -5, -7, -7, -5, -5];

  startMusic() {
    if (!this.ctx) return;
    this.stopMusic();
    const tick = () => {
      const c = this.corruption;
      const n = this.melody[this.step % this.melody.length];
      const base = 523.25 * Math.pow(2, -c * 0.9 / 12); // だんだんピッチが下がる
      if (n !== null && !(c >= 2 && Math.random() < 0.15 * c)) {
        let semi = n;
        const pc = ((semi % 12) + 12) % 12;
        if (c >= 2 && (pc === 4 || pc === 9)) semi -= 1; // 短調化
        const det = (Math.random() - 0.5) * c * 40;
        this.tone(base * Math.pow(2, semi / 12), 0.22 + c * 0.1, c >= 2 ? "triangle" : "square", 0.5, this.musicGain, det);
      }
      if (this.step % 4 === 0) {
        const b = this.bass[(this.step / 4) % this.bass.length];
        this.tone(base * Math.pow(2, b / 12) / 2, 0.4, "triangle", 0.6, this.musicGain, c * 12);
      }
      this.step++;
      const interval = 170 * (1 + c * 0.45) + (c >= 2 ? Math.random() * 60 * c : 0);
      this.timer = window.setTimeout(tick, interval);
    };
    tick();
  }

  stopMusic() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  blip(pitch = 1) {
    if (!this.ctx) return;
    const f = 880 * pitch * Math.pow(2, -this.corruption * 2 / 12);
    this.tone(f, 0.08, "square", 0.15, this.master);
    this.tone(f * 1.5, 0.1, "square", 0.1, this.master, 0, 0.06);
  }

  tick() {
    if (!this.ctx) return;
    this.tone(1200 * Math.pow(2, -this.corruption * 3 / 12), 0.03, "square", 0.05, this.master);
  }

  sparkle() {
    if (!this.ctx) return;
    [0, 4, 7, 12].forEach((s, i) => this.tone(1046 * Math.pow(2, s / 12), 0.15, "sine", 0.15, this.master, 0, i * 0.06));
  }

  // 低い持続音
  startDrone(level = 0.25) {
    if (!this.ctx) return;
    this.stopDrone();
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + 4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    lp.connect(g).connect(this.master);
    const freqs = [43.65, 46.25, 87.3];
    const nodes: AudioNode[] = [];
    freqs.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.1 + Math.random() * 0.2;
      lg.gain.value = 3;
      lfo.connect(lg).connect(o.frequency);
      o.connect(lp);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    });
    this.droneNodes = nodes;
    this.droneGain = g;
  }

  stopDrone() {
    this.droneNodes.forEach((n) => {
      try { (n as OscillatorNode).stop(); } catch { /* noop */ }
    });
    this.droneNodes = [];
  }

  heartbeat() {
    if (!this.ctx) return;
    this.tone(55, 0.18, "sine", 0.9, this.master);
    this.tone(50, 0.2, "sine", 0.7, this.master, 0, 0.22);
  }

  // ささやき風ノイズ
  whisper(dur = 1.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 900));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() < 0.5 ? -0.9 : 0.9;
    src.connect(bp).connect(g).connect(pan).connect(this.master);
    src.start();
  }

  glitch() {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) this.tone(100 + Math.random() * 2000, 0.04, "square", 0.2, this.master, 0, i * 0.03);
  }

  // ジャンプスケア
  scream() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.linearRampToValueAtTime(0.9, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    ws.curve = curve;
    ws.connect(g).connect(this.master);
    // ノイズ
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(3500, t + 0.4);
    bp.frequency.exponentialRampToValueAtTime(1200, t + dur);
    ns.connect(bp).connect(ws);
    ns.start(t);
    // 不協和な叫び
    [620, 655, 931, 1244, 311].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(f, t + dur);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 18 + Math.random() * 12;
      lg.gain.value = f * 0.08;
      lfo.connect(lg).connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = 0.25;
      o.connect(og).connect(ws);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur);
      lfo.stop(t + dur);
    });
  }

  silenceAll() {
    this.stopMusic();
    this.stopDrone();
  }
}

export const audio = new AudioEngine();
