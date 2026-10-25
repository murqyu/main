// ---------- synthesized sound (WebAudio, no files) ----------
const SFX = (() => {
  let ctx = null, out = null, master = null, noise = null;
  const loops = {};
  let vol = SETTINGS.vol;
  const L = { x: 0, y: 0, z: 0, yaw: 0 };
  function init() {
    try {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.25;
      comp.connect(master); out = comp;
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      loops.storm = noiseLoop(240, 'lowpass', 0.8);
      loops.wind = noiseLoop(850, 'bandpass', 0.45);
      loops.hum = humLoop();
    } catch (e) { ctx = null; }
  }
  function noiseLoop(freq, type, q) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(out); s.start();
    return { g, f };
  }
  function humLoop() {
    const g = ctx.createGain(); g.gain.value = 0;
    const trem = ctx.createGain(); trem.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
    const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    for (const fr of [587.3, 739.99, 880, 1174.7]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const og = ctx.createGain(); og.gain.value = 0.07; o.connect(og); og.connect(trem); o.start();
    }
    trem.connect(g); g.connect(out);
    return { g };
  }
  function loop(name, v) { if (!ctx || !loops[name]) return; loops[name].g.gain.setTargetAtTime(v, ctx.currentTime, 0.12); }
  function setListener(x, y, z, yaw) { L.x = x; L.y = y; L.z = z; L.yaw = yaw; }
  function bus(pos, base) {
    if (!ctx || ctx.state !== 'running') return null;
    let v = base, pan = 0;
    if (pos) {
      const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 330) return null;
      v = base / (1 + d / 13);
      if (d > 0.5) { const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw); pan = clamp((dx * rx + dz * rz) / d, -1, 1) * 0.75; }
    }
    if (v < 0.012) return null;
    const g = ctx.createGain(); g.gain.value = v;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); }
    else g.connect(out);
    return g;
  }
  function nz(t, dur, freq, q, type, peak, dest, att = 0.002) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + att + dur + 0.05);
  }
  function tn(t, dur, f0, f1, type, peak, dest, att = 0.003) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + att + dur + 0.05);
  }
  const api = {
    init, loop, setListener,
    setVolume(v) { vol = v; if (master) master.gain.value = v; },
    shot(kind, pos) {
      const d = bus(pos, kind === 'sniper' || kind === 'shotgun' ? 1.0 : 0.8); if (!d) return; const t = ctx.currentTime;
      if (kind === 'ar') { nz(t, 0.14, 1700, 0.9, 'bandpass', 0.9, d); nz(t, 0.22, 520, 0.7, 'lowpass', 0.5, d); tn(t, 0.08, 160, 55, 'sine', 0.8, d); }
      else if (kind === 'smg') { nz(t, 0.08, 2600, 1, 'bandpass', 0.7, d); tn(t, 0.05, 200, 80, 'sine', 0.5, d); }
      else if (kind === 'shotgun') { nz(t, 0.4, 800, 0.6, 'lowpass', 1.3, d); nz(t, 0.06, 3000, 0.8, 'bandpass', 0.6, d); tn(t, 0.2, 110, 38, 'sine', 1.1, d); }
      else if (kind === 'pistol') { nz(t, 0.1, 2300, 1.1, 'bandpass', 0.75, d); tn(t, 0.06, 240, 90, 'sine', 0.5, d); }
      else if (kind === 'sniper') { nz(t, 0.7, 1100, 0.5, 'lowpass', 1.3, d); nz(t, 0.04, 5200, 1, 'highpass', 0.7, d); tn(t, 0.3, 120, 32, 'sine', 1.1, d); }
      else if (kind === 'rocket') { nz(t, 0.8, 500, 0.6, 'lowpass', 0.9, d, 0.02); tn(t, 0.5, 80, 220, 'sawtooth', 0.12, d); }
    },
    pickaxe(pos, crit) { const d = bus(pos, 0.7); if (!d) return; const t = ctx.currentTime; nz(t, 0.12, crit ? 2600 : 1200, 2, 'bandpass', 0.9, d); tn(t, 0.08, crit ? 900 : 300, crit ? 600 : 120, 'triangle', 0.5, d); },
    build(pos) { const d = bus(pos, 0.6); if (!d) return; const t = ctx.currentTime; nz(t, 0.07, 900, 2, 'bandpass', 0.9, d); nz(t + 0.06, 0.08, 650, 2, 'bandpass', 0.7, d); tn(t, 0.06, 180, 90, 'square', 0.12, d); },
    hit(head, shield) { const d = bus(null, 0.45); if (!d) return; const t = ctx.currentTime; tn(t, 0.05, head ? 2500 : 1750, head ? 2100 : 1500, 'sine', 0.6, d); if (shield) tn(t, 0.07, 3300, 2600, 'triangle', 0.2, d); },
    hurt() { const d = bus(null, 0.5); if (!d) return; const t = ctx.currentTime; nz(t, 0.12, 500, 1, 'lowpass', 0.8, d); tn(t, 0.12, 220, 120, 'sawtooth', 0.12, d); },
    shieldBreak() { const d = bus(null, 0.6); if (!d) return; const t = ctx.currentTime; for (let i = 0; i < 5; i++) tn(t + i * 0.03, 0.15, 2400 - i * 300, 1200 - i * 100, 'triangle', 0.22, d); nz(t, 0.25, 4000, 0.8, 'highpass', 0.4, d); },
    elim() { const d = bus(null, 0.6); if (!d) return; const t = ctx.currentTime; tn(t, 0.12, 880, 880, 'square', 0.15, d); tn(t + 0.1, 0.25, 1320, 1320, 'square', 0.15, d); tn(t + 0.1, 0.3, 660, 660, 'triangle', 0.3, d); },
    chestOpen(pos) { const d = bus(pos, 0.8); if (!d) return; const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => tn(t + i * 0.06, 0.3, f, f, 'triangle', 0.32, d)); nz(t, 0.3, 6000, 0.7, 'highpass', 0.22, d); },
    pickup() { const d = bus(null, 0.45); if (!d) return; const t = ctx.currentTime; tn(t, 0.06, 660, 990, 'sine', 0.4, d); },
    reload() { const d = bus(null, 0.4); if (!d) return; const t = ctx.currentTime; nz(t, 0.04, 3000, 3, 'bandpass', 0.8, d); nz(t + 0.22, 0.05, 2000, 3, 'bandpass', 0.8, d); },
    explode(pos) { const d = bus(pos, 1.5); if (!d) return; const t = ctx.currentTime; nz(t, 1.3, 300, 0.5, 'lowpass', 1.6, d, 0.005); nz(t, 0.4, 1200, 0.6, 'bandpass', 0.7, d); tn(t, 0.6, 90, 30, 'sine', 1.3, d); },
    land(pos) { const d = bus(pos, 0.5); if (!d) return; const t = ctx.currentTime; nz(t, 0.12, 300, 1, 'lowpass', 0.8, d); },
    deploy() { const d = bus(null, 0.5); if (!d) return; const t = ctx.currentTime; nz(t, 0.5, 1200, 0.4, 'bandpass', 0.6, d, 0.05); },
    click() { const d = bus(null, 0.35); if (!d) return; const t = ctx.currentTime; tn(t, 0.04, 1200, 900, 'square', 0.1, d); },
    heal() { const d = bus(null, 0.4); if (!d) return; const t = ctx.currentTime; tn(t, 0.25, 523, 784, 'sine', 0.3, d); tn(t + 0.12, 0.3, 659, 988, 'sine', 0.25, d); },
    victory() { const d = bus(null, 0.7); if (!d) return; const t = ctx.currentTime; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { tn(t + i * 0.12, 0.35, f, f, 'square', 0.1, d); tn(t + i * 0.12, 0.4, f / 2, f / 2, 'triangle', 0.2, d); }); },
    alert() { const d = bus(null, 0.5); if (!d) return; const t = ctx.currentTime; tn(t, 0.15, 600, 600, 'square', 0.1, d); tn(t + 0.18, 0.15, 600, 600, 'square', 0.1, d); },
    impact(pos, kind) { const d = bus(pos, 0.3); if (!d) return; const t = ctx.currentTime; nz(t, 0.05, kind === 'metal' ? 4000 : kind === 'stone' ? 2500 : 1400, 2, 'bandpass', 0.5, d); },
    step(pos) { const d = bus(pos, 0.22); if (!d) return; const t = ctx.currentTime; nz(t, 0.05, 420 + Math.random() * 200, 1.2, 'lowpass', 0.8, d); },
    dry() { const d = bus(null, 0.3); if (!d) return; const t = ctx.currentTime; tn(t, 0.03, 1800, 1600, 'square', 0.1, d); },
  };
  return api;
})();
