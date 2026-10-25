// ---------- audio engine: HRTF 3D, generated reverb, occlusion, layered synthesis, ambience, adaptive music, announcer ----------
const SFX = (() => {
  let ctx = null, master = null, limiter = null, sfxBus = null, ambBus = null, musBus = null, uiBus = null, rev = null, revIn = null, noise = null, brown = null, pink = null;
  const loops = {};
  let vol = SETTINGS.vol, musVol = SETTINGS.music === undefined ? 0.55 : SETTINGS.music;
  const L = { x: 0, y: 0, z: 0, yaw: 0, indoor: 0, indoorT: 0 };
  let voices = 0;
  const MAXV = 64;
  const now = () => ctx.currentTime;
  const running = () => ctx && ctx.state === 'running';

  function makeNoise(kind) {
    const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return b;
  }
  // stereo impulse response: a few early reflections plus a decorrelated exponential tail
  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.015 ? t / 0.015 : 1); }
      for (let k = 0; k < 6; k++) { const at = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.06)); if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.06); }
    }
    return b;
  }
  function init() {
    try {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14; limiter.knee.value = 10; limiter.ratio.value = 8; limiter.attack.value = 0.002; limiter.release.value = 0.2;
      limiter.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(limiter);
      ambBus = ctx.createGain(); ambBus.gain.value = 0.8; ambBus.connect(limiter);
      uiBus = ctx.createGain(); uiBus.gain.value = 0.9; uiBus.connect(limiter);
      musBus = ctx.createGain(); musBus.gain.value = musVol * 0.6; musBus.connect(limiter);
      rev = ctx.createConvolver(); rev.buffer = makeIR(2.4, 3.2);
      revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(rev);
      const revOut = ctx.createGain(); revOut.gain.value = 0.42; rev.connect(revOut); revOut.connect(limiter);
      noise = makeNoise('white'); brown = makeNoise('brown'); pink = makeNoise('pink');
      loops.wind = noiseLoop(pink, 900, 'bandpass', 0.5, ambBus);
      loops.storm = noiseLoop(brown, 260, 'lowpass', 0.7, ambBus);
      loops.rain = noiseLoop(noise, 2600, 'bandpass', 0.35, ambBus);
      loops.windBed = noiseLoop(pink, 420, 'bandpass', 0.7, ambBus);
      loops.waves = noiseLoop(brown, 520, 'lowpass', 0.6, ambBus);
      loops.slide = noiseLoop(noise, 1300, 'bandpass', 0.9, sfxBus);
      loops.glide = noiseLoop(pink, 1700, 'bandpass', 1.4, sfxBus);
      loops.bus = busLoop();
      loops.hum = humLoop();
      loops.crickets = cricketLoop();
      MUSIC.init();
    } catch (e) { ctx = null; }
  }
  function noiseLoop(buf, freq, type, q, dest) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(dest); s.start(0, Math.random() * 2);
    return { g, f };
  }
  function humLoop() {
    const g = ctx.createGain(); g.gain.value = 0;
    const trem = ctx.createGain(); trem.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
    const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    for (const fr of [587.3, 739.99, 880, 1174.7]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; const og = ctx.createGain(); og.gain.value = 0.07; o.connect(og); og.connect(trem); o.start(); }
    trem.connect(g); g.connect(sfxBus);
    return { g };
  }
  function busLoop() {
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    for (const [fr, ty, a] of [[52, 'sawtooth', 0.22], [52.6, 'sawtooth', 0.18], [104, 'square', 0.05]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = fr; const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(f); o.start(); }
    const s = ctx.createBufferSource(); s.buffer = brown; s.loop = true; const ng = ctx.createGain(); ng.gain.value = 0.6; s.connect(ng); ng.connect(f); s.start();
    f.connect(g); g.connect(sfxBus);
    return { g, f };
  }
  function cricketLoop() {
    const g = ctx.createGain(); g.gain.value = 0;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4300;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28;
    const lfo2 = ctx.createOscillator(); lfo2.type = 'square'; lfo2.frequency.value = 0.9;
    const l1 = ctx.createGain(); l1.gain.value = 0.5; const l2 = ctx.createGain(); l2.gain.value = 0.5;
    lfo.connect(l1); l1.connect(am.gain); lfo2.connect(l2); l2.connect(am.gain);
    o.connect(am); am.connect(g); g.connect(ambBus); o.start(); lfo.start(); lfo2.start();
    return { g };
  }
  function loop(name, v, freq) {
    if (!ctx || !loops[name]) return;
    loops[name].g.gain.setTargetAtTime(v, now(), 0.15);
    if (freq && loops[name].f) loops[name].f.frequency.setTargetAtTime(freq, now(), 0.2);
  }
  // listener follows the camera; also probes whether we are under a roof for reverb and ambience
  const _lf = { x: 0, y: 0, z: -1 };
  function setListener(cam) {
    if (!cam) return;
    const e = cam.matrixWorld.elements;
    L.x = cam.position.x; L.y = cam.position.y; L.z = cam.position.z;
    _lf.x = -e[8]; _lf.y = -e[9]; _lf.z = -e[10]; L.yaw = Math.atan2(-_lf.x, -_lf.z);
    if (!ctx) return;
    const l = ctx.listener, t = now();
    if (l.positionX) {
      l.positionX.setValueAtTime(L.x, t); l.positionY.setValueAtTime(L.y, t); l.positionZ.setValueAtTime(L.z, t);
      l.forwardX.setValueAtTime(_lf.x, t); l.forwardY.setValueAtTime(_lf.y, t); l.forwardZ.setValueAtTime(_lf.z, t);
      l.upX.setValueAtTime(e[4], t); l.upY.setValueAtTime(e[5], t); l.upZ.setValueAtTime(e[6], t);
    } else if (l.setPosition) { l.setPosition(L.x, L.y, L.z); l.setOrientation(_lf.x, _lf.y, _lf.z, e[4], e[5], e[6]); }
    L.indoorT -= 1;
    if (L.indoorT <= 0 && typeof raycastWorld === 'function' && GRID && GRID.cells) {
      L.indoorT = 10;
      const h = raycastWorld(L.x, L.y + 0.5, L.z, 0, 1, 0, 14, true);
      L.indoor += ((h.t < 14 && h.c ? 1 : 0) - L.indoor) * 0.5;
    }
  }
  // one sound's output chain: gain -> air absorption / occlusion lowpass -> HRTF panner -> bus, plus a reverb send
  function voice(pos, base, opt) {
    if (!running()) return null;
    opt = opt || {};
    let d = 0;
    if (pos) {
      const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z;
      d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > (opt.range || 340)) return null;
      if (voices >= MAXV && d > 25) return null;
      if (base / (1 + d / (opt.ref || 6)) < 0.006) return null;
    } else if (voices >= MAXV + 16) return null;
    const g = ctx.createGain(); g.gain.value = base;
    const bus = opt.bus || (pos ? sfxBus : uiBus);
    let tail = g;
    if (pos) {
      let cut = clamp(24000 / (1 + d / 30), 600, 20000), occl = false;
      if (d > 3 && opt.occlude !== false && typeof raycastWorld === 'function') {
        const h = raycastWorld(L.x, L.y, L.z, (pos.x - L.x) / d, (pos.y - L.y) / d, (pos.z - L.z) / d, d - 0.8, true);
        if (h.t < d - 1 && (h.c || h.terrain)) { occl = true; cut = Math.min(cut, h.terrain ? 650 : 1200); g.gain.value = base * 0.55; }
      }
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
      const pn = ctx.createPanner();
      pn.panningModel = d < 70 ? 'HRTF' : 'equalpower'; pn.distanceModel = 'inverse'; pn.refDistance = opt.ref || 6; pn.rolloffFactor = opt.roll || 1.15; pn.maxDistance = 10000;
      if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
      g.connect(lp); lp.connect(pn); pn.connect(bus);
      const send = ctx.createGain(); send.gain.value = Math.min(0.9, (opt.wet || 0.14) + d / 420 + L.indoor * 0.3 + (occl ? 0.15 : 0));
      lp.connect(send); send.connect(revIn);
      tail = lp;
    } else {
      g.connect(bus);
      if (opt.wet) { const send = ctx.createGain(); send.gain.value = opt.wet + L.indoor * 0.2; g.connect(send); send.connect(revIn); }
    }
    voices++; setTimeout(() => { voices--; }, (opt.dur || 1.2) * 1000 + 200);
    g._d = d;
    return g;
  }
  // primitives: filtered noise burst (optionally swept) and enveloped tone (optionally swept)
  function nz(t, dur, freq, q, type, peak, dest, att, f1, buf) {
    att = att || 0.002;
    const s = ctx.createBufferSource(); s.buffer = buf || noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + att + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 2); s.stop(t + att + dur + 0.05);
  }
  function tn(t, dur, f0, f1, type, peak, dest, att) {
    att = att || 0.003;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + att + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + att + dur + 0.05);
  }
  const delayFor = (d) => d > 40 ? Math.min(1.2, d / 343) : 0;   // sound travels: far blasts arrive late

  // ---------- weapons ----------
  const GUN = {
    ar:      { g: 0.85, crack: 4200, body: [2200, 600], bodyD: 0.12, thump: [150, 46], thumpG: 0.9, ring: 3100, tail: 0.7, tailG: 0.22 },
    smg:     { g: 0.7,  crack: 5200, body: [3000, 900], bodyD: 0.07, thump: [190, 70], thumpG: 0.55, ring: 3800, tail: 0.45, tailG: 0.15 },
    pistol:  { g: 0.72, crack: 4800, body: [2600, 800], bodyD: 0.09, thump: [230, 80], thumpG: 0.55, ring: 2900, tail: 0.5, tailG: 0.16 },
    shotgun: { g: 1.0,  crack: 3000, body: [1400, 220], bodyD: 0.34, thump: [120, 36], thumpG: 1.2, ring: 0, tail: 1.1, tailG: 0.35 },
    hand:    { g: 0.95, crack: 5000, body: [2000, 400], bodyD: 0.18, thump: [140, 40], thumpG: 1.0, ring: 2600, tail: 1.0, tailG: 0.3 },
    sniper:  { g: 1.05, crack: 6000, body: [1800, 260], bodyD: 0.3, thump: [110, 30], thumpG: 1.2, ring: 2400, tail: 1.8, tailG: 0.42 },
  };
  function shot(kind, pos, mine) {
    if (kind === 'rocket') return rocketLaunch(pos);
    const G = GUN[kind] || GUN.ar;
    const d = voice(pos, G.g * (mine ? 1.1 : 1), { ref: 9, range: 460, dur: G.tail + 0.4, wet: 0.12 }); if (!d) return;
    const dist = d._d, t = now() + (kind === 'sniper' || kind === 'shotgun' ? delayFor(dist) : 0) + Math.random() * 0.004;
    nz(t, 0.014, G.crack, 0.7, 'highpass', 0.9, d);
    nz(t, G.bodyD, G.body[0], 0.8, 'lowpass', 0.85, d, 0.002, G.body[1]);
    tn(t, G.bodyD * 0.8 + 0.04, G.thump[0], G.thump[1], 'sine', G.thumpG, d);
    if (G.ring) tn(t, 0.22, G.ring, G.ring * 0.97, 'triangle', 0.035, d);
    nz(t + 0.02, G.tail, 700, 0.4, 'lowpass', G.tailG * (0.6 + Math.min(1, dist / 80)), d, 0.03, 180, brown);
    if (kind === 'shotgun' && mine) { nz(t + 0.42, 0.05, 1500, 3, 'bandpass', 0.5, d); nz(t + 0.56, 0.06, 1100, 3, 'bandpass', 0.6, d); }
    if (kind === 'sniper' && mine) { nz(t + 0.6, 0.05, 2400, 4, 'bandpass', 0.4, d); nz(t + 0.78, 0.06, 1700, 4, 'bandpass', 0.45, d); }
    if (dist < 30) MUSIC.duck(0.85);
  }
  function rocketLaunch(pos) {
    const d = voice(pos, 0.95, { ref: 9, range: 400, dur: 1.2 }); if (!d) return; const t = now();
    tn(t, 0.25, 90, 40, 'sine', 1.0, d); nz(t, 0.9, 900, 0.6, 'bandpass', 0.8, d, 0.02, 2600); nz(t, 0.2, 3000, 0.8, 'highpass', 0.4, d);
  }
  function whiz(pos, crack) {
    const d = voice(pos, crack ? 0.7 : 0.5, { ref: 2, dur: 0.4, occlude: false }); if (!d) return; const t = now();
    nz(t, 0.14, 3800, 4, 'bandpass', 0.8, d, 0.01, 900);
    if (crack) nz(t, 0.012, 6000, 0.7, 'highpass', 0.9, d);
  }
  function impact(pos, kind) {
    const d = voice(pos, 0.32, { ref: 3, dur: 0.3, range: 90 }); if (!d) return; const t = now();
    if (kind === 'metal') { tn(t, 0.18, 2600 + Math.random() * 900, 2200, 'triangle', 0.35, d); nz(t, 0.03, 5000, 1, 'highpass', 0.5, d); }
    else if (kind === 'stone') { nz(t, 0.05, 2500, 1.5, 'bandpass', 0.6, d); nz(t + 0.01, 0.09, 900, 0.8, 'lowpass', 0.25, d); }
    else if (kind === 'wood') { nz(t, 0.05, 1200, 2, 'bandpass', 0.6, d); tn(t, 0.05, 340, 180, 'sine', 0.3, d); }
    else nz(t, 0.07, 700, 0.9, 'lowpass', 0.6, d);
  }
  function explode(pos) {
    const d = voice(pos, 1.7, { ref: 14, range: 700, dur: 2.6, wet: 0.25 }); if (!d) return;
    const t = now() + delayFor(d._d);
    nz(t, 0.02, 3500, 0.6, 'highpass', 1.0, d);
    tn(t, 1.1, 72, 24, 'sine', 1.5, d, 0.004);
    nz(t, 1.6, 1100, 0.5, 'lowpass', 1.5, d, 0.004, 120, brown);
    nz(t, 0.45, 1600, 0.6, 'bandpass', 0.6, d);
    for (let i = 0; i < 8; i++) nz(t + 0.25 + Math.random() * 0.9, 0.04, 1500 + Math.random() * 2500, 2, 'bandpass', 0.18, d);
    MUSIC.duck(0.35);
  }
  // ---------- footsteps by surface ----------
  function step(pos, surf, loud) {
    const d = voice(pos, 0.26 * (loud || 1), { ref: 3, range: 60, dur: 0.4, wet: 0.08 }); if (!d) return; const t = now(), r = Math.random();
    switch (surf) {
      case 'wood': tn(t, 0.07, 150 + r * 30, 80, 'sine', 0.7, d); nz(t, 0.05, 700 + r * 200, 2.5, 'bandpass', 0.5, d); break;
      case 'stone': nz(t, 0.035, 2600 + r * 800, 1.2, 'highpass', 0.45, d); tn(t, 0.04, 260, 140, 'sine', 0.35, d); break;
      case 'metal': tn(t, 0.16, 620 + r * 120, 560, 'triangle', 0.22, d); tn(t, 0.1, 1310 + r * 200, 1200, 'triangle', 0.1, d); nz(t, 0.03, 3000, 1, 'highpass', 0.3, d); break;
      case 'water': nz(t, 0.16, 1100 + r * 400, 0.7, 'bandpass', 0.7, d, 0.01); tn(t + 0.03, 0.06, 500 + r * 300, 1300, 'sine', 0.12, d); break;
      case 'sand': nz(t, 0.11, 1600 + r * 500, 0.5, 'bandpass', 0.45, d, 0.01); break;
      case 'snow': nz(t, 0.13, 2200 + r * 600, 0.6, 'bandpass', 0.5, d, 0.015, 900); nz(t + 0.02, 0.08, 500, 0.8, 'lowpass', 0.4, d); break;
      case 'grass': nz(t, 0.07, 900 + r * 300, 0.8, 'lowpass', 0.6, d); nz(t + 0.01, 0.06, 2800 + r * 900, 0.9, 'bandpass', 0.22, d); break;
      default: nz(t, 0.07, 520 + r * 200, 1.0, 'lowpass', 0.75, d); nz(t, 0.025, 2200, 1.5, 'bandpass', 0.18, d);
    }
  }
  // ---------- ambience: birds by day, crickets at dusk, shore waves, wind, thunder ----------
  const AMB = { birdT: 2, thunderT: 20, waveT: 0, shore: 0, shoreT: 0, wind: 0 };
  function bird() {
    const a = Math.random() * TAU, r = 18 + Math.random() * 40;
    const d = voice({ x: L.x + Math.cos(a) * r, y: L.y + 6 + Math.random() * 10, z: L.z + Math.sin(a) * r }, 0.16, { ref: 10, bus: ambBus, dur: 1.4, wet: 0.2 }); if (!d) return;
    const t = now(), sp = Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1800;
    if (sp === 0) for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) tn(t + i * 0.11, 0.06, base, base * 1.35, 'sine', 0.5, d);
    else if (sp === 1) { tn(t, 0.18, base * 1.2, base * 0.75, 'sine', 0.5, d); tn(t + 0.22, 0.12, base, base * 1.25, 'sine', 0.4, d); }
    else if (sp === 2) for (let i = 0; i < 6; i++) tn(t + i * 0.05, 0.035, base + (i % 2) * 600, base + (i % 2) * 600, 'sine', 0.35, d);
    else { tn(t, 0.3, base * 0.6, base * 0.62, 'sine', 0.35, d, 0.05); tn(t + 0.35, 0.4, base * 0.5, base * 0.48, 'sine', 0.3, d, 0.05); }
  }
  function thunder() {
    const d = voice(null, 0.9, { bus: ambBus, dur: 4, wet: 0.5 }); if (!d) return; const t = now() + Math.random() * 0.6;
    nz(t, 0.08, 2500, 0.6, 'highpass', 0.4, d); nz(t, 3.5, 380, 0.6, 'lowpass', 1.1, d, 0.08, 60, brown); tn(t, 2.5, 55, 28, 'sine', 0.6, d, 0.2);
    if (typeof POST !== 'undefined') setTimeout(() => { POST.U.flash.value = Math.min(1, POST.U.flash.value + 0.35); }, 0);
  }
  function ambience(dt, env) {
    if (!running()) return;
    const out = 1 - L.indoor * 0.75;
    AMB.shoreT -= dt;
    if (AMB.shoreT <= 0 && typeof groundH === 'function') {
      AMB.shoreT = 0.6; let wet = 0;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; if (groundH(L.x + Math.cos(a) * 45, L.z + Math.sin(a) * 45) < -0.5) wet++; }
      AMB.shore = wet / 12;
    }
    // waves swell with a slow irregular rhythm
    AMB.waveT -= dt;
    if (AMB.waveT <= 0) {
      AMB.waveT = 5 + Math.random() * 4; const t = now(), g = loops.waves.g.gain, v = (0.05 + AMB.shore * 0.45) * out * (env.menu ? 0.6 : 1);
      g.cancelScheduledValues(t); g.setTargetAtTime(v, t, 1.4); g.setTargetAtTime(v * 0.25, t + 2.8, 1.6);
    }
    const alt = clamp((L.y - 30) / 120, 0, 1);
    loop('windBed', (0.05 + alt * 0.12 + (env.rain ? 0.06 : 0)) * out, 380 + alt * 500);
    loop('rain', env.rain ? 0.2 * (1 - L.indoor * 0.5) : 0);
    loop('crickets', env.dusk && !env.rain ? 0.018 * out : 0);
    if (env.day && !env.rain && !env.storm && L.y < 80) { AMB.birdT -= dt; if (AMB.birdT <= 0) { AMB.birdT = 0.8 + Math.random() * 3.2; if (Math.random() < out) bird(); } }
    if (env.rain) { AMB.thunderT -= dt; if (AMB.thunderT <= 0) { AMB.thunderT = 14 + Math.random() * 30; thunder(); } }
  }
  // ---------- adaptive music: menu, drop, explore, fight, endgame, stingers ----------
  const MUSIC = (() => {
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    // progressions as root midi notes + chord quality (0 minor, 1 major)
    const SONGS = {
      menu: { bpm: 92, prog: [[57, 0], [53, 1], [48, 1], [55, 1]] },
      bus: { bpm: 100, prog: [[50, 0], [50, 0], [46, 1], [48, 1]] },
      match: { bpm: 108, prog: [[50, 0], [46, 1], [53, 1], [48, 1]] },
      end: { bpm: 118, prog: [[52, 0], [48, 1], [55, 1], [50, 1]] },
    };
    let state = 'off', song = null, step = 0, nextT = 0, timer = null, inten = 0, targetInten = 0, duckV = 1;
    let padF = null, arpDelay = null, layer = {};
    function init() {
      padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 900; padF.Q.value = 0.8;
      for (const k of ['pad', 'bass', 'arp', 'drums', 'lead']) { layer[k] = ctx.createGain(); layer[k].gain.value = 0; }
      layer.pad.connect(padF); padF.connect(musBus);
      arpDelay = ctx.createDelay(1); arpDelay.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
      layer.arp.connect(musBus); layer.arp.connect(arpDelay); arpDelay.connect(dl); dl.connect(fb); fb.connect(arpDelay); dl.connect(musBus);
      for (const k of ['bass', 'drums', 'lead']) layer[k].connect(musBus);
      const ms = ctx.createGain(); ms.gain.value = 0.25; layer.pad.connect(ms); ms.connect(revIn);
    }
    function mix() {
      const t = now(), I = inten, set = (k, v) => layer[k].gain.setTargetAtTime(v * duckV, t, 0.6);
      if (state === 'off') { for (const k in layer) set(k, 0); return; }
      if (state === 'menu') { set('pad', 0.5); set('arp', 0.32); set('bass', 0.25); set('drums', 0.18); set('lead', 0); }
      else if (state === 'bus') { set('pad', 0.5); set('arp', 0.2); set('bass', 0.3); set('drums', 0.22); set('lead', 0); }
      else { set('pad', 0.42 - I * 0.1); set('arp', 0.12 + I * 0.15); set('bass', 0.08 + I * 0.4); set('drums', I * 0.5); set('lead', state === 'end' ? 0.12 + I * 0.12 : 0); }
      padF.frequency.setTargetAtTime(700 + I * 1800 + (state === 'menu' ? 600 : 0), t, 0.8);
    }
    function chordNotes(root, q) { return [root, root + (q ? 4 : 3), root + 7, root + 12]; }
    function playStep(s, t) {
      const spb = 60 / song.bpm, s16 = spb / 4, bar = Math.floor(s / 16) % song.prog.length, i = s % 16;
      const [root, q] = song.prog[bar], ch = chordNotes(root, q);
      if (i === 0) for (const n of ch.slice(0, 3)) pad(t, N(n + 12), spb * 4);
      // bass: root on 1, fifth on the and of 2, octave pushes when intense
      if (i === 0 || i === 6 || i === 8 || (inten > 0.5 && (i === 11 || i === 14))) bass(t, N(i === 6 ? root + 7 - 12 : i === 14 ? root : root - 12), s16 * (i === 0 ? 5 : 2));
      // arp
      if (state === 'menu' ? i % 2 === 0 : (inten > 0.4 ? true : i % 4 === 0)) { const k = [0, 2, 1, 3, 2, 1, 3, 2][(i / 2 | 0) % 8]; arp(t, N(ch[k] + 24), s16 * 1.6); }
      // drums
      if (i % 4 === 0) kick(t, i === 0 ? 1 : 0.8);
      if (i === 4 || i === 12) snare(t);
      if (i % 2 === 0 || inten > 0.7) hat(t, i % 4 === 2 ? 0.7 : 0.35);
      if (state === 'end' && (i === 0 || i === 3 || i === 6 || i === 10)) lead(t, N(ch[[3, 2, 1, 2][(i / 3 | 0) % 4]] + 24), s16 * 2);
    }
    function env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05); }
    function pad(t, f, dur) {
      const g = ctx.createGain(); env(g, t, 0.5, 0.06, dur + 0.6, 0.9); g.connect(layer.pad);
      for (const det of [-7, 0, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 0.8); }
    }
    function bass(t, f, dur) {
      const g = ctx.createGain(); env(g, t, 0.01, 0.35, dur, 0.08); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400 + inten * 500; g.connect(lp); lp.connect(layer.bass);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.1);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f / 2; const g2 = ctx.createGain(); g2.gain.value = 0.6; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dur + 0.1);
    }
    function arp(t, f, dur) { const g = ctx.createGain(); env(g, t, 0.004, 0.09, dur, dur * 0.7); g.connect(layer.arp); const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.1); }
    function lead(t, f, dur) { const g = ctx.createGain(); env(g, t, 0.01, 0.07, dur, dur * 0.5); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; g.connect(lp); lp.connect(layer.lead); const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.1); }
    function kick(t, v) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); g.connect(layer.drums); const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); o.start(t); o.stop(t + 0.35); }
    function snare(t) { nz(t, 0.16, 1900, 0.7, 'bandpass', 0.45, layer.drums); tn(t, 0.07, 200, 160, 'triangle', 0.3, layer.drums); }
    function hat(t, v) { nz(t, 0.035, 8000, 0.7, 'highpass', 0.18 * v, layer.drums); }
    function tick() {
      if (!song || !running()) return;
      inten += (targetInten - inten) * 0.04; duckV += (1 - duckV) * 0.03;
      while (nextT < now() + 0.15) { playStep(step, nextT); nextT += 60 / song.bpm / 4; step++; }
      mix();
    }
    function setState(s) {
      if (!ctx || s === state) return;
      state = s;
      const key = s === 'end' ? 'end' : s === 'combat' ? 'match' : s;
      if (SONGS[key] && song !== SONGS[key]) { song = SONGS[key]; step = 0; nextT = now() + 0.1; }
      if (s === 'off') song = null;
      if (!timer) timer = setInterval(tick, 40);
      mix();
    }
    function stinger(kind) {
      if (!ctx) return; const t = now() + 0.05, d = musBus;
      const notes = kind === 'victory' ? [60, 64, 67, 72, 76, 79, 84] : kind === 'defeat' ? [57, 53, 50, 45] : [62, 69, 74];
      notes.forEach((n, i) => { tn(t + i * (kind === 'defeat' ? 0.28 : 0.11), kind === 'defeat' ? 1.2 : 0.5, N(n), N(n), 'triangle', 0.22, d); tn(t + i * 0.11, 0.6, N(n) / 2, N(n) / 2, 'sawtooth', 0.04, d); });
      if (kind === 'victory') { for (let i = 0; i < 4; i++) kick(t + 0.77 + i * 0.25, 1); }
    }
    return { init, setState, stinger, setIntensity(v) { targetInten = clamp(v, 0, 1); }, duck(v) { duckV = Math.min(duckV, v); }, get state() { return state; } };
  })();
  // ---------- announcer (browser speech) ----------
  let lastSay = 0, voicePick = null;
  function announce(text, force) {
    if (!SETTINGS.announcer || !('speechSynthesis' in window)) return;
    const t = performance.now(); if (!force && t - lastSay < 2500) return; lastSay = t;
    try {
      const S = window.speechSynthesis;
      if (!voicePick) { const vs = S.getVoices() || []; voicePick = vs.find((v) => /en-GB/i.test(v.lang) && /male|daniel|george|arthur/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null; }
      if (force) S.cancel();
      const u = new SpeechSynthesisUtterance(text); if (voicePick) u.voice = voicePick; u.rate = 1.04; u.pitch = 0.85; u.volume = Math.min(1, vol * 1.1);
      S.speak(u);
    } catch (e) { /* speech unavailable */ }
  }
  const api = {
    init, loop, setListener, voice, MUSIC, announce, ambience, whiz, step,
    setVolume(v) { vol = v; if (master) master.gain.value = v; },
    setMusic(v) { musVol = v; if (musBus) musBus.gain.value = v * 0.6; },
    get ready() { return running(); },
    shot, impact, explode,
    pickaxe(pos, crit, kind) {
      const d = voice(pos, 0.75, { ref: 4, dur: 0.5 }); if (!d) return; const t = now();
      if (kind === 'metal') { tn(t, 0.3, 1900, 1700, 'triangle', 0.35, d); tn(t, 0.2, 2900, 2800, 'triangle', 0.15, d); nz(t, 0.05, 4000, 1, 'highpass', 0.5, d); }
      else if (kind === 'stone') { nz(t, 0.06, 2800, 1.5, 'bandpass', 0.8, d); tn(t, 0.06, 500, 260, 'sine', 0.4, d); }
      else { tn(t, 0.08, 260, 120, 'sine', 0.8, d); nz(t, 0.09, 1100, 2, 'bandpass', 0.7, d); nz(t + 0.015, 0.05, 3000, 1, 'highpass', 0.25, d); }
      if (crit) { tn(t + 0.02, 0.35, 2093, 2093, 'sine', 0.35, d); tn(t + 0.02, 0.3, 3136, 3136, 'sine', 0.18, d); }
    },
    build(pos, mat) {
      const d = voice(pos, 0.55, { ref: 5, dur: 0.5 }); if (!d) return; const t = now();
      if (mat === 'metal') { tn(t, 0.25, 420, 400, 'triangle', 0.3, d); nz(t, 0.06, 2600, 2, 'bandpass', 0.5, d); }
      else if (mat === 'stone') { nz(t, 0.1, 700, 1.2, 'lowpass', 0.9, d); tn(t, 0.08, 120, 60, 'sine', 0.6, d); }
      else { nz(t, 0.07, 900, 2, 'bandpass', 0.9, d); nz(t + 0.05, 0.08, 650, 2, 'bandpass', 0.6, d); tn(t, 0.07, 170, 80, 'sine', 0.5, d); }
      tn(t, 0.09, 1400, 2100, 'sine', 0.06, d);
    },
    buildBreak(pos, mat) { const d = voice(pos, 0.8, { ref: 6, dur: 1 }); if (!d) return; const t = now(); nz(t, 0.5, mat === 'metal' ? 2200 : 900, 0.8, 'lowpass', 0.9, d, 0.005, 200); for (let i = 0; i < 5; i++) nz(t + Math.random() * 0.4, 0.05, 800 + Math.random() * 2000, 2, 'bandpass', 0.3, d); if (mat === 'metal') tn(t, 0.6, 700, 520, 'triangle', 0.2, d); },
    hit(head, shield) {
      const d = voice(null, 0.5, {}); if (!d) return; const t = now();
      if (head) { tn(t, 0.16, 2637, 2637, 'sine', 0.55, d); tn(t, 0.12, 3951, 3951, 'sine', 0.22, d); tn(t, 0.05, 1318, 1318, 'triangle', 0.25, d); }
      else { tn(t, 0.05, 1700, 1450, 'sine', 0.55, d); nz(t, 0.02, 3000, 1, 'bandpass', 0.3, d); }
      if (shield) { tn(t, 0.08, 3300, 2500, 'triangle', 0.18, d); nz(t, 0.05, 6500, 1, 'highpass', 0.2, d); }
    },
    hurt() { const d = voice(null, 0.55, {}); if (!d) return; const t = now(); nz(t, 0.14, 600, 0.8, 'lowpass', 0.9, d); tn(t, 0.1, 110, 60, 'sine', 0.6, d); },
    shieldBreak() { const d = voice(null, 0.6, { wet: 0.2 }); if (!d) return; const t = now(); for (let i = 0; i < 6; i++) tn(t + i * 0.025, 0.2, 2600 - i * 280, 1300 - i * 90, 'triangle', 0.2, d); nz(t, 0.35, 5000, 0.8, 'highpass', 0.45, d, 0.002, 2000); },
    elim() { const d = voice(null, 0.7, { wet: 0.25 }); if (!d) return; const t = now(); tn(t, 0.35, 120, 38, 'sine', 0.9, d); [880, 1320, 1760].forEach((f) => tn(t + 0.02, 0.28, f, f, 'square', 0.06, d)); tn(t + 0.12, 0.4, 2637, 2637, 'sine', 0.2, d); nz(t, 0.4, 2000, 0.6, 'bandpass', 0.25, d, 0.05, 6000); },
    chestOpen(pos) { const d = voice(pos, 0.8, { ref: 4, dur: 1, wet: 0.25 }); if (!d) return; const t = now(); [784, 988, 1175, 1568, 1976].forEach((f, i) => tn(t + i * 0.05, 0.35, f, f, 'triangle', 0.28, d)); nz(t, 0.4, 6000, 0.7, 'highpass', 0.25, d, 0.02); tn(t, 0.08, 200, 90, 'sine', 0.5, d); },
    pickup(rar) { const d = voice(null, 0.42, {}); if (!d) return; const t = now(), b = 620 * Math.pow(1.122, rar || 0); tn(t, 0.06, b, b * 1.5, 'sine', 0.42, d); tn(t + 0.05, 0.08, b * 1.5, b * 1.5, 'triangle', 0.15, d); },
    reload(kind, T) {
      const d = voice(null, 0.42, {}); if (!d) return; const t = now(); T = T || 1.5;
      nz(t + 0.05, 0.04, 2800, 3, 'bandpass', 0.7, d);
      nz(t + T * 0.55, 0.05, 1900, 3, 'bandpass', 0.8, d); tn(t + T * 0.55, 0.04, 380, 200, 'sine', 0.25, d);
      nz(t + T * 0.85, 0.04, 3200, 4, 'bandpass', 0.7, d); nz(t + T * 0.85 + 0.07, 0.05, 2200, 4, 'bandpass', 0.6, d);
    },
    useStart(id) {
      const d = voice(null, 0.35, {}); if (!d) return; const t = now();
      if (id === 'shieldS' || id === 'shieldL') { for (let i = 0; i < 6; i++) tn(t + 0.3 + i * 0.16, 0.08, 300 + Math.random() * 200, 700, 'sine', 0.3, d); nz(t, 0.1, 3000, 2, 'bandpass', 0.4, d); }
      else { for (let i = 0; i < 4; i++) nz(t + i * 0.25, 0.16, 2400, 0.7, 'bandpass', 0.35, d, 0.04, 900); }
    },
    heal(shield) { const d = voice(null, 0.45, { wet: 0.3 }); if (!d) return; const t = now(); const b = shield ? 659 : 523; tn(t, 0.3, b, b * 1.5, 'sine', 0.3, d); tn(t + 0.12, 0.35, b * 1.25, b * 1.875, 'sine', 0.25, d); tn(t + 0.24, 0.45, b * 2, b * 2, 'triangle', 0.12, d); },
    explodeAt: explode,
    land(pos, surf) { const d = voice(pos, 0.55, { ref: 4, dur: 0.4 }); if (!d) return; const t = now(); nz(t, 0.14, surf === 'water' ? 1200 : 320, 0.9, 'lowpass', 0.9, d); tn(t, 0.1, 90, 45, 'sine', 0.6, d); },
    deploy() { const d = voice(null, 0.5, {}); if (!d) return; const t = now(); nz(t, 0.45, 600, 0.5, 'bandpass', 0.7, d, 0.04, 2400); nz(t + 0.1, 0.1, 1800, 2, 'bandpass', 0.3, d); },
    jump() { const d = voice(null, 0.45, { wet: 0.2 }); if (!d) return; const t = now(); nz(t, 0.7, 400, 0.6, 'bandpass', 0.6, d, 0.05, 2500); },
    slide(pos) { const d = voice(pos, 0.35, { ref: 4 }); if (!d) return; const t = now(); nz(t, 0.25, 1600, 0.8, 'bandpass', 0.6, d, 0.01, 700); },
    mantle(pos) { const d = voice(pos, 0.35, { ref: 4 }); if (!d) return; const t = now(); nz(t, 0.12, 1800, 1, 'bandpass', 0.5, d, 0.02, 900); tn(t + 0.12, 0.05, 200, 120, 'sine', 0.35, d); },
    tink(pos) { const d = voice(pos, 0.12, { ref: 2, range: 25, dur: 0.2, occlude: false }); if (!d) return; const t = now(); tn(t, 0.05, 4200 + Math.random() * 1500, 4000, 'triangle', 0.4, d); },
    click() { const d = voice(null, 0.3, {}); if (!d) return; const t = now(); tn(t, 0.035, 1250, 950, 'square', 0.09, d); },
    hover() { const d = voice(null, 0.15, {}); if (!d) return; const t = now(); tn(t, 0.03, 2200, 2400, 'sine', 0.1, d); },
    victory() { MUSIC.setState('off'); MUSIC.stinger('victory'); },
    defeat() { MUSIC.setState('off'); MUSIC.stinger('defeat'); },
    alert() { const d = voice(null, 0.55, { wet: 0.3 }); if (!d) return; const t = now(); tn(t, 0.7, 110, 110, 'sawtooth', 0.12, d, 0.05); tn(t, 0.7, 165, 165, 'sawtooth', 0.08, d, 0.05); tn(t + 0.75, 0.7, 98, 98, 'sawtooth', 0.12, d, 0.05); },
    dry() { const d = voice(null, 0.3, {}); if (!d) return; const t = now(); tn(t, 0.03, 1800, 1600, 'square', 0.1, d); },
    engine(v, f) {
      if (!running()) return;
      if (!loops.engine) {
        const g = ctx.createGain(); g.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 40; const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 20; const g2 = ctx.createGain(); g2.gain.value = 0.4;
        o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(); o2.start();
        loops.engine = { g, o, o2, lp };
      }
      const E = loops.engine, t = now();
      E.g.gain.setTargetAtTime(v, t, 0.08); E.o.frequency.setTargetAtTime(Math.max(20, f), t, 0.06); E.o2.frequency.setTargetAtTime(Math.max(10, f / 2), t, 0.06); E.lp.frequency.setTargetAtTime(400 + f * 9, t, 0.1);
    },
    heartbeat() { const d = voice(null, 0.5, {}); if (!d) return; const t = now(); tn(t, 0.1, 70, 45, 'sine', 0.9, d); tn(t + 0.22, 0.12, 62, 40, 'sine', 0.7, d); },
  };
  return api;
})();
