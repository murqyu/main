// ---------- rendering: color, quality presets, HDR post, sky, time of day, water, terrain, grass, weather ----------
const LIN = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const QUALITY = {
  low:    { dprCap: 1,    minScale: 0.6, shadows: 0,    bloom: false, msaa: 0, fxaa: false, grass: 0,     grassR: 0,  cloudOct: 3, decals: 60,  particles: 0.6 , lights: 0 },
  medium: { dprCap: 1.25, minScale: 0.7, shadows: 1024, bloom: true,  msaa: 0, fxaa: true,  grass: 7000,  grassR: 44, cloudOct: 4, decals: 120, particles: 1 , lights: 1 },
  high:   { dprCap: 1.5,  minScale: 0.75, shadows: 2048, bloom: true, msaa: 4, fxaa: false, grass: 15000, grassR: 62, cloudOct: 5, decals: 200, particles: 1 , lights: 2 },
  ultra:  { dprCap: 2,    minScale: 0.8, shadows: 4096, bloom: true,  msaa: 4, fxaa: false, grass: 26000, grassR: 84, cloudOct: 5, decals: 300, particles: 1.3 , lights: 3 },
};
function Q() { return QUALITY[SETTINGS.quality] || QUALITY.high; }
const UTIME = { value: 0 };           // shared time uniform for every animated shader
const UWIND = { value: 1 };
const UPLAYER = { value: new V3(0, -999, 0) };
const UWET = { value: 0 };

// ---------- post-processing ----------
const POST = (() => {
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FS_BRIGHT = `uniform sampler2D tDiffuse; uniform float threshold, knee; varying vec2 vUv;
    void main(){ vec3 c = min(texture2D(tDiffuse, vUv).rgb, vec3(40.0)); float l = max(c.r, max(c.g, c.b));
      float s = clamp(l - threshold + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-4);
      float k = max(s, l - threshold) / max(l, 1e-4); gl_FragColor = vec4(c * k, 1.0); }`;
  const FS_DOWN = `uniform sampler2D tDiffuse; uniform vec2 hp; varying vec2 vUv;
    void main(){ vec3 s = texture2D(tDiffuse, vUv).rgb * 4.0;
      s += texture2D(tDiffuse, vUv - hp).rgb + texture2D(tDiffuse, vUv + hp).rgb + texture2D(tDiffuse, vUv + vec2(hp.x, -hp.y)).rgb + texture2D(tDiffuse, vUv - vec2(hp.x, -hp.y)).rgb;
      gl_FragColor = vec4(s / 8.0, 1.0); }`;
  const FS_UP = `uniform sampler2D tDiffuse; uniform vec2 hp; uniform float amt; varying vec2 vUv;
    void main(){ vec3 s = texture2D(tDiffuse, vUv + vec2(-hp.x * 2.0, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(hp.x * 2.0, 0.0)).rgb
      + texture2D(tDiffuse, vUv + vec2(0.0, hp.y * 2.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, -hp.y * 2.0)).rgb
      + (texture2D(tDiffuse, vUv + vec2(-hp.x, hp.y)).rgb + texture2D(tDiffuse, vUv + vec2(hp.x, hp.y)).rgb
      + texture2D(tDiffuse, vUv + vec2(hp.x, -hp.y)).rgb + texture2D(tDiffuse, vUv + vec2(-hp.x, -hp.y)).rgb) * 2.0;
      gl_FragColor = vec4(s / 12.0 * amt, 1.0); }`;
  const FS_COMP = `uniform sampler2D tScene, tBloom; uniform float bloomStrength, exposure, saturation, contrast, vignette, grain, time, ca, hurt, lowhp, storm, speed, flash;
    uniform vec3 lift, gammaV, gain, stormTint; uniform vec2 res; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 dc = uv - 0.5;
      vec3 col;
      float cab = ca + hurt * 0.006;
      if (cab > 0.0001) { col = vec3(texture2D(tScene, uv + dc * cab).r, texture2D(tScene, uv).g, texture2D(tScene, uv - dc * cab).b); }
      else col = texture2D(tScene, uv).rgb;
      if (speed > 0.01) { vec3 acc = col; for (int i = 1; i < 7; i++) { acc += texture2D(tScene, uv - dc * float(i) * 0.012 * speed).rgb; } col = acc / 7.0; }
      col += texture2D(tBloom, uv).rgb * bloomStrength;
      col *= exposure * (1.0 + flash);
      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, stormTint * L * 1.6 + col * 0.25, storm);
      col = aces(col);
      col = pow(col, vec3(1.0 / 2.2));
      col = gain * (col + lift * (1.0 - col));
      col = pow(max(col, vec3(0.0)), 1.0 / gammaV);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, saturation * (1.0 - lowhp * 0.55));
      col = (col - 0.5) * contrast + 0.5;
      float r = length(dc * vec2(res.x / res.y, 1.0));
      col *= 1.0 - smoothstep(0.45, 1.05, r) * vignette;
      float pulse = 0.5 + 0.5 * sin(time * 6.0);
      col = mix(col, vec3(0.55, 0.0, 0.03), smoothstep(0.35, 1.0, r) * (hurt * 0.55 + lowhp * (0.25 + 0.2 * pulse)));
      col += (hash(uv * res + fract(time) * 100.0) - 0.5) * grain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;
  const FS_FXAA = `uniform sampler2D tDiffuse; uniform vec2 resolution; varying vec2 vUv;
    void main(){ vec2 inv = 1.0 / resolution;
      vec3 nw = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * inv).rgb, ne = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * inv).rgb;
      vec3 sw = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * inv).rgb, se = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * inv).rgb, m = texture2D(tDiffuse, vUv).rgb;
      vec3 lu = vec3(0.299, 0.587, 0.114);
      float lnw = dot(nw, lu), lne = dot(ne, lu), lsw = dot(sw, lu), lse = dot(se, lu), lm = dot(m, lu);
      float lmin = min(lm, min(min(lnw, lne), min(lsw, lse))), lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
      vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), (lnw + lsw) - (lne + lse));
      float red = max((lnw + lne + lsw + lse) * 0.03125, 1.0 / 128.0);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * inv;
      vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lb = dot(b, lu);
      gl_FragColor = vec4((lb < lmin || lb > lmax) ? a : b, 1.0); }`;
  let rtScene = null, rtLDR = null, mips = [], W = 2, H = 2, hdrType = THREE.UnsignedByteType, dynScale = 1;
  const scn = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(g); quad.frustumCulled = false; scn.add(quad);
  const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); black.needsUpdate = true;
  const brightM = mk(FS_BRIGHT, { tDiffuse: { value: null }, threshold: { value: 1.7 }, knee: { value: 0.9 } });
  const downM = mk(FS_DOWN, { tDiffuse: { value: null }, hp: { value: new THREE.Vector2() } });
  const upM = mk(FS_UP, { tDiffuse: { value: null }, hp: { value: new THREE.Vector2() }, amt: { value: 1 } }); upM.blending = THREE.AdditiveBlending;
  const U = {
    tScene: { value: null }, tBloom: { value: black }, bloomStrength: { value: 0.6 }, exposure: { value: 1 }, saturation: { value: 1.06 }, contrast: { value: 1.04 },
    vignette: { value: 0.35 }, grain: { value: 0.025 }, time: { value: 0 }, ca: { value: 0 }, hurt: { value: 0 }, lowhp: { value: 0 }, storm: { value: 0 }, speed: { value: 0 }, flash: { value: 0 },
    lift: { value: new V3(0, 0, 0) }, gammaV: { value: new V3(1, 1, 1) }, gain: { value: new V3(1, 1, 1) }, stormTint: { value: new V3(0.55, 0.25, 0.95) }, res: { value: new THREE.Vector2(1, 1) },
  };
  const compM = mk(FS_COMP, U);
  const fxaaM = mk(FS_FXAA, { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2() } });
  function pass(m, target) { quad.material = m; renderer.setRenderTarget(target); renderer.render(scn, cam); }
  function init() {
    const gl2 = renderer.capabilities.isWebGL2;
    if (gl2 && (renderer.extensions.get('EXT_color_buffer_float') || renderer.extensions.get('EXT_color_buffer_half_float'))) hdrType = THREE.HalfFloatType;
    else if (!gl2 && renderer.extensions.get('OES_texture_half_float') && renderer.extensions.get('EXT_color_buffer_half_float')) hdrType = THREE.HalfFloatType;
  }
  const rt = (w, h, type) => new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: type || hdrType, depthBuffer: false, stencilBuffer: false });
  function resize() {
    const q = Q(), dpr = Math.min(window.devicePixelRatio || 1, q.dprCap) * dynScale;
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
    const v = renderer.getDrawingBufferSize(new THREE.Vector2()); W = Math.max(2, v.x); H = Math.max(2, v.y);
    if (rtScene) rtScene.dispose(); if (rtLDR) rtLDR.dispose(); for (const m of mips) m.dispose(); mips = [];
    if (q.msaa && renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
      rtScene = new THREE.WebGLMultisampleRenderTarget(W, H, { format: THREE.RGBAFormat, type: hdrType, depthBuffer: true, stencilBuffer: true });
      rtScene.samples = q.msaa;
    } else rtScene = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: hdrType, depthBuffer: true, stencilBuffer: true });
    if (q.fxaa) rtLDR = rt(W, H, THREE.UnsignedByteType); else rtLDR = null;
    if (q.bloom) { let w = W >> 1, h = H >> 1; for (let i = 0; i < 6 && w > 4 && h > 4; i++) { mips.push(rt(w, h)); w >>= 1; h >>= 1; } }
    U.res.value.set(W, H); fxaaM.uniforms.resolution.value.set(W, H);
  }
  function render() {
    const q = Q();
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    U.tScene.value = rtScene.texture; U.time.value = UTIME.value;
    if (q.bloom && mips.length) {
      brightM.uniforms.tDiffuse.value = rtScene.texture; pass(brightM, mips[0]);
      for (let i = 1; i < mips.length; i++) { downM.uniforms.tDiffuse.value = mips[i - 1].texture; downM.uniforms.hp.value.set(0.5 / mips[i - 1].width, 0.5 / mips[i - 1].height); pass(downM, mips[i]); }
      renderer.autoClear = false;
      for (let i = mips.length - 1; i > 0; i--) { upM.uniforms.tDiffuse.value = mips[i].texture; upM.uniforms.hp.value.set(0.5 / mips[i].width, 0.5 / mips[i].height); pass(upM, mips[i - 1]); }
      renderer.autoClear = true;
      U.tBloom.value = mips[0].texture;
    } else U.tBloom.value = black;
    if (rtLDR) { pass(compM, rtLDR); fxaaM.uniforms.tDiffuse.value = rtLDR.texture; pass(fxaaM, null); }
    else pass(compM, null);
  }
  return { init, resize, render, U, brightM, get W() { return W; }, get H() { return H; }, get dynScale() { return dynScale; }, set dynScale(v) { dynScale = v; } };
})();

// dynamic resolution keeps the frame rate up on weaker GPUs
const DYNRES = { acc: 0, n: 0, t: 0, cool: 0 };
function updateDynRes(frameMs) {
  if (!SETTINGS.autoRes) { if (POST.dynScale !== 1) { POST.dynScale = 1; POST.resize(); } return; }
  DYNRES.acc += frameMs; DYNRES.n++; DYNRES.t += frameMs / 1000; DYNRES.cool -= frameMs / 1000;
  if (DYNRES.t < 1.2) return;
  const avg = DYNRES.acc / DYNRES.n; DYNRES.acc = 0; DYNRES.n = 0; DYNRES.t = 0;
  if (DYNRES.cool > 0) return;
  let s = POST.dynScale;
  if (avg > 19.5) s = Math.max(Q().minScale, s - 0.1);
  else if (avg < 14 && s < 1) s = Math.min(1, s + 0.05);
  if (Math.abs(s - POST.dynScale) > 0.001) { POST.dynScale = s; POST.resize(); FX.setScale(pointScale()); DYNRES.cool = 2.5; }
}

// ---------- sky ----------
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
const SKY_FS = `uniform vec3 uZenith, uHorizon, uGround, uSunColor, uSunDir, uCloudCol; uniform float uTime, uCloud, uStars, uStorm, uSunSize, uSunGlow, uDisc;
  varying vec3 vDir;
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < CLOUD_OCT; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir); float h = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
    col = mix(col, uGround, smoothstep(0.02, -0.2, h));
    float sd = max(dot(d, uSunDir), 0.0);
    float above = 1.0 - smoothstep(0.0, -0.08, h);
    col += uSunColor * (pow(sd, 5.0) * 0.18 + pow(sd, 48.0) * 0.5) * uSunGlow * above;
    col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.55, sd) * 22.0 * above * uDisc;
    #ifdef CLOUDS
    if (h > 0.0) {
      vec2 cp = d.xz / (h + 0.18) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
      float n = fbm(vec3(cp, uTime * 0.012));
      float c = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n) * smoothstep(0.0, 0.18, h);
      vec3 cc = uCloudCol * (0.75 + 0.35 * n) + uSunColor * pow(sd, 3.0) * 0.5;
      col = mix(col, cc, c * 0.9);
    }
    if (uStars > 0.0 && h > 0.0) { vec3 sp = floor(d * 380.0); float s = step(0.9975, h3(sp)) * uStars * smoothstep(0.02, 0.35, h); col += vec3(s * 3.0); }
    #endif
    col = mix(col, vec3(0.16, 0.05, 0.26) + vec3(0.12, 0.04, 0.2) * clamp(h, 0.0, 1.0), uStorm);
    gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
  }`;
function makeSkyMaterial(clouds) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
    defines: Object.assign({ CLOUD_OCT: Q().cloudOct }, clouds ? { CLOUDS: 1 } : {}),
    uniforms: { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uSunColor: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() },
      uSunDir: { value: new V3(0, 1, 0) }, uTime: UTIME, uCloud: { value: 0.4 }, uStars: { value: 0 }, uStorm: { value: 0 }, uSunSize: { value: 0.0009 }, uSunGlow: { value: 1 }, uDisc: { value: clouds ? 1 : 0 } },
  });
}

// ---------- time of day + weather ----------
const TOD = {
  morning: { name: 'Morning', elev: 17, az: 115, sun: 0xffe0bd, sunI: 2.0, zenith: 0x3f7fd0, horizon: 0xd4e4f0, ground: 0x7a8288, cloud: 0xfff4ea, fog: 0xc9dbe8, fogNear: 110, fogFar: 640, hemiSky: 0xc0d8ff, hemiGround: 0x6e6a52, hemiI: 0.06, env: 0.55, exposure: 0.92, bloom: 0.5, sat: 1.06, contrast: 1.04, lift: [0.0, 0.004, 0.012], gain: [1.0, 0.99, 0.98], stars: 0, glow: 1 },
  noon: { name: 'Midday', elev: 58, az: 150, sun: 0xfff7ea, sunI: 2.25, zenith: 0x2668d6, horizon: 0xaed3f6, ground: 0x7d8a7a, cloud: 0xffffff, fog: 0xbcd8f2, fogNear: 140, fogFar: 700, hemiSky: 0xd0e4ff, hemiGround: 0x6f7552, hemiI: 0.05, env: 0.5, exposure: 0.86, bloom: 0.42, sat: 1.08, contrast: 1.05, lift: [0, 0, 0], gain: [1, 1, 1], stars: 0, glow: 0.7 },
  golden: { name: 'Golden hour', elev: 9, az: 245, sun: 0xffa356, sunI: 2.5, zenith: 0x3757a5, horizon: 0xffb77c, ground: 0x6b4c3c, cloud: 0xffc9a0, fog: 0xf0b98f, fogNear: 100, fogFar: 600, hemiSky: 0xffc9a8, hemiGround: 0x5a4a3a, hemiI: 0.06, env: 0.6, exposure: 0.95, bloom: 0.75, sat: 1.16, contrast: 1.07, lift: [0.015, 0.005, 0.0], gain: [1.04, 0.99, 0.92], stars: 0, glow: 1.6 },
  dusk: { name: 'Dusk', elev: 4, az: 282, sun: 0xff7a40, sunI: 1.3, zenith: 0x16214f, horizon: 0xd8775a, ground: 0x2c2638, cloud: 0x8a6878, fog: 0x5e5068, fogNear: 80, fogFar: 520, hemiSky: 0x8e8cd8, hemiGround: 0x3a3448, hemiI: 0.12, env: 0.85, exposure: 1.15, bloom: 0.95, sat: 1.12, contrast: 1.06, lift: [0.01, 0.0, 0.03], gain: [1.0, 0.95, 1.05], stars: 0.7, glow: 1.8 },
};
const WEATHER = { clear: { name: 'Clear', cloud: 0.32, sunMul: 1, fogMul: 1, wet: 0, rain: 0, wind: 0.8 }, cloudy: { name: 'Overcast', cloud: 0.72, sunMul: 0.55, fogMul: 0.82, wet: 0, rain: 0, wind: 1.3 }, rain: { name: 'Rain', cloud: 0.95, sunMul: 0.32, fogMul: 0.6, wet: 1, rain: 1, wind: 1.9 } };
const ENVSTATE = { tod: 'noon', weather: 'clear', fogCol: new THREE.Color(), fogNear: 140, fogFar: 700, envRT: null, sky: null, envScene: null, pmrem: null, rain: 0 };
function pickTimeOfDay() {
  const t = SETTINGS.tod && SETTINGS.tod !== 'random' ? SETTINGS.tod : weighted([['morning', 25], ['noon', 30], ['golden', 30], ['dusk', 15]]);
  const w = SETTINGS.weather && SETTINGS.weather !== 'random' ? SETTINGS.weather : weighted([['clear', 62], ['cloudy', 22], ['rain', 16]]);
  return [t, w];
}
function applyEnvironment(todKey, weatherKey) {
  const T = TOD[todKey] || TOD.noon, Wt = WEATHER[weatherKey] || WEATHER.clear;
  ENVSTATE.tod = todKey; ENVSTATE.weather = weatherKey;
  const el = T.elev * Math.PI / 180, az = T.az * Math.PI / 180;
  const sd = new V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
  WORLD.sunDir = sd;
  const mute = (hex, k) => { const c = LIN(hex); const g = (c.r + c.g + c.b) / 3; return c.lerp(new THREE.Color(g, g, g), k); };
  const cloudK = Wt.cloud > 0.6 ? (Wt.cloud - 0.6) * 1.6 : 0;
  for (const m of [ENVSTATE.sky.material, ENVSTATE.envSky.material]) {
    const u = m.uniforms;
    u.uZenith.value.copy(mute(T.zenith, cloudK * 0.8)).multiplyScalar(1 - cloudK * 0.25);
    u.uHorizon.value.copy(mute(T.horizon, cloudK * 0.7));
    u.uGround.value.copy(LIN(T.ground));
    u.uSunColor.value.copy(LIN(T.sun)).multiplyScalar(Wt.sunMul);
    u.uCloudCol.value.copy(LIN(T.cloud)).multiplyScalar(1 - cloudK * 0.35);
    u.uSunDir.value.copy(sd); u.uCloud.value = Wt.cloud; u.uStars.value = Wt.cloud > 0.6 ? 0 : T.stars; u.uSunGlow.value = T.glow * Wt.sunMul;
    u.uDisc.value = m === ENVSTATE.sky.material ? clamp(1.5 - Wt.cloud * 1.6, 0, 1) : 0;
  }
  sun.color.copy(LIN(T.sun)); sun.intensity = T.sunI * Wt.sunMul;
  hemi.color.copy(LIN(T.hemiSky)); hemi.groundColor.copy(LIN(T.hemiGround)); hemi.intensity = T.hemiI * (1 + (1 - Wt.sunMul) * 0.6);
  ENVSTATE.fogCol.copy(mute(T.fog, cloudK * 0.6));
  ENVSTATE.fogNear = T.fogNear * Wt.fogMul; ENVSTATE.fogFar = T.fogFar * Wt.fogMul;
  scene.fog.color.copy(ENVSTATE.fogCol); scene.fog.near = ENVSTATE.fogNear; scene.fog.far = ENVSTATE.fogFar;
  const U = POST.U;
  U.exposure.value = T.exposure * (1 + (1 - Wt.sunMul) * 0.25); U.bloomStrength.value = T.bloom; U.saturation.value = T.sat * (1 - cloudK * 0.12); U.contrast.value = T.contrast;
  U.lift.value.set(...T.lift); U.gain.value.set(...T.gain);
  UWET.value = Wt.wet; UWIND.value = Wt.wind; ENVSTATE.rain = Wt.rain;
  if (cloudGroup) for (const cl of cloudGroup.children) cl.children.forEach((m) => { m.material = ENVSTATE.cloudMat; });
  if (ENVSTATE.cloudMat) { ENVSTATE.cloudMat.color.copy(LIN(T.cloud)).multiplyScalar(0.85 - cloudK * 0.3); ENVSTATE.cloudMat.emissive.copy(LIN(T.horizon)).multiplyScalar(0.25); }
  if (WATER.mat) { const u = WATER.mat.uniforms; u.uSkyH.value.copy(ENVSTATE.sky.material.uniforms.uHorizon.value); u.uSkyZ.value.copy(ENVSTATE.sky.material.uniforms.uZenith.value); u.uSunDir.value.copy(sd); u.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity * 0.5); u.uFogColor.value.copy(ENVSTATE.fogCol); u.uFogNear.value = ENVSTATE.fogNear; u.uFogFar.value = ENVSTATE.fogFar; }
  // image based lighting from this sky
  if (!ENVSTATE.pmrem) ENVSTATE.pmrem = new THREE.PMREMGenerator(renderer);
  if (ENVSTATE.envRT) ENVSTATE.envRT.dispose();
  ENVSTATE.envRT = ENVSTATE.pmrem.fromScene(ENVSTATE.envScene, 0.02, 0.1, 100);
  scene.environment = ENVSTATE.envRT.texture;
  ENVSTATE.envIntensity = T.env;
  setEnvIntensity(T.env);
  RAIN.setActive(Wt.rain > 0);
}

// ---------- water ----------
const WATER = { mat: null, mesh: null, heightTex: null };
const WATER_VS = `uniform float uTime; varying vec3 vW;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
    w.y += sin(w.x * 0.05 + uTime * 0.9) * 0.16 + sin(w.z * 0.07 - uTime * 1.1) * 0.12 + sin((w.x + w.z) * 0.13 + uTime * 1.7) * 0.05;
    vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `uniform vec3 uDeep, uShallow, uSkyH, uSkyZ, uSunDir, uSunColor, uFogColor; uniform float uFogNear, uFogFar, uTime, uWet; uniform sampler2D uHeight; uniform vec4 uRect;
  varying vec3 vW;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float wav(vec2 p){ return n2(p * 0.35 + vec2(uTime * 0.25, uTime * 0.11)) * 0.6 + n2(p * 0.9 - vec2(uTime * 0.4, -uTime * 0.27)) * 0.3 + n2(p * 2.3 + vec2(uTime * 0.9, uTime * 0.6)) * 0.1 + uWet * n2(p * 6.0 + uTime * 4.0) * 0.12; }
  void main(){
    vec2 p = vW.xz; float e = 0.35;
    float c0 = wav(p), cx = wav(p + vec2(e, 0.0)), cz = wav(p + vec2(0.0, e));
    vec3 n = normalize(vec3((c0 - cx) * 1.6, e, (c0 - cz) * 1.6));
    vec3 v = normalize(cameraPosition - vW);
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uSkyH, uSkyZ, pow(clamp(r.y, 0.0, 1.0), 0.5));
    vec2 huv = (vW.xz - uRect.xy) / uRect.z;
    float th = texture2D(uHeight, huv).r * 8.0 - 4.0;
    float depth = max(0.0, vW.y - th);
    vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 4.5, depth));
    vec3 col = mix(water, sky, fres * 0.85);
    float sr = max(dot(r, uSunDir), 0.0);
    col += uSunColor * (pow(sr, 600.0) * 30.0 + pow(sr, 60.0) * 0.5) * (1.0 - uWet * 0.9);
    float band = 1.0 - smoothstep(0.0, 1.1, depth);
    float wv = sin(depth * 6.0 - uTime * 2.1 + n2(p * 0.25) * 5.0) * 0.5 + 0.5;
    float foam = band * (0.45 + 0.55 * wv) * smoothstep(0.3, 0.7, n2(p * 0.9 + vec2(uTime * 0.3, 0.0)) + band * 0.35);
    col = mix(col, vec3(0.95), clamp(foam, 0.0, 0.85));
    float alpha = clamp(mix(0.55, 0.96, smoothstep(0.0, 3.0, depth)) + foam, 0.0, 1.0);
    float fd = length(vW - cameraPosition);
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
    gl_FragColor = vec4(col, alpha);
  }`;
function makeWater() {
  WATER.mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: true, fog: false,
    uniforms: { uTime: UTIME, uWet: UWET, uDeep: { value: LIN(0x0b3f72) }, uShallow: { value: LIN(0x2fb6c8) }, uSkyH: { value: new THREE.Color() }, uSkyZ: { value: new THREE.Color() }, uSunDir: { value: new V3() }, uSunColor: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 600 }, uHeight: { value: null }, uRect: { value: new THREE.Vector4(-500, -500, 1000, 0) } },
  });
  const geo = new THREE.PlaneGeometry(3000, 3000, 300, 300); geo.rotateX(-Math.PI / 2);
  WATER.mesh = new THREE.Mesh(geo, WATER.mat); WATER.mesh.frustumCulled = false; WATER.mesh.renderOrder = 1;
  scene.add(WATER.mesh);
}
function buildWaterHeightTexture() {
  const N = WORLD.N, H = WORLD.heights, data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const v = clamp((H[i] + 4) / 8, 0, 1) * 255; data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  if (WATER.heightTex) WATER.heightTex.dispose();
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.flipY = false;
  WATER.heightTex = t; WATER.mat.uniforms.uHeight.value = t;
  const S = (N - 1) * WORLD.step; WATER.mat.uniforms.uRect.value.set(-WORLD.half, -WORLD.half, S, 0);
}
function updateWater(cx, cz) { if (WATER.mesh) WATER.mesh.position.set(Math.round(cx / 8) * 8, 0, Math.round(cz / 8) * 8); }

// ---------- terrain material (blend of detail textures by splat weights) ----------
function makeTerrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGrassD: { value: TEX.dGrass }, tDirtD: { value: TEX.dDirt }, tSandD: { value: TEX.dSand }, tRockD: { value: TEX.dRock }, tNoise: { value: TEX.noise }, uTime: UTIME, uWet: UWET });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWp; varying vec3 vWn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vWp = (modelMatrix * vec4(position, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tGrassD, tDirtD, tSandD, tRockD, tNoise; uniform float uTime, uWet; varying vec4 vSplat; varying vec3 vWp; varying vec3 vWn;')
      .replace('#include <map_fragment>', `
        vec4 sw = vSplat / max(0.001, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
        vec2 ua = vWp.xz * 0.23;
        float mac = texture2D(tNoise, vWp.xz * 0.0045).r;
        float gD = texture2D(tGrassD, ua).r * mix(0.86, 1.12, texture2D(tNoise, vWp.xz * 0.05).g);
        float dD = texture2D(tDirtD, ua * 0.8).r;
        float sD = texture2D(tSandD, ua * 0.6).r;
        vec3 bw = abs(normalize(vWn)); bw = pow(bw, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        float rD = texture2D(tRockD, vWp.zy * 0.16).r * bw.x + texture2D(tRockD, vWp.xz * 0.16).r * bw.y + texture2D(tRockD, vWp.xy * 0.16).r * bw.z;
        float detail = gD * sw.x + dD * sw.y + sD * sw.z + rD * sw.w;
        diffuseColor.rgb *= detail * 1.25 * (0.88 + mac * 0.24);
        if (vWp.y < 0.2) { vec2 cp = vWp.xz * 0.5; float c = sin(cp.x * 3.1 + uTime * 1.3 + sin(cp.y * 2.3 + uTime)) * sin(cp.y * 2.7 - uTime * 1.1 + sin(cp.x * 1.9)); diffuseColor.rgb += vec3(0.08, 0.14, 0.16) * smoothstep(0.55, 1.0, c) * smoothstep(0.2, -1.0, vWp.y); diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.2, -2.5, vWp.y)); }
        diffuseColor.rgb *= 1.0 - uWet * 0.18;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
        { vec4 sw2 = vSplat / max(0.001, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
          float wetSand = 1.0 - smoothstep(0.4, 1.7, vWp.y);
          roughnessFactor = max(0.4, dot(sw2, vec4(0.95, 0.9, mix(0.85, 0.42, wetSand), 0.72)) * (1.0 - uWet * 0.4)); }`);
  };
  return m;
}

// ---------- wind for instanced foliage ----------
function addWind(mat, strength, heightRef) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uTime = UTIME; sh.uniforms.uWind = UWIND;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
        vec3 ip = vec3(0.0);
        #endif
        float hk = clamp(position.y / ${heightRef.toFixed(2)}, 0.0, 1.5);
        float sw = sin(uTime * 1.3 + ip.x * 0.11 + ip.z * 0.07) * 0.6 + sin(uTime * 2.7 + ip.x * 0.31) * 0.25;
        transformed.x += sw * hk * hk * ${strength.toFixed(3)} * uWind;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.13) * hk * hk * ${(strength * 0.6).toFixed(3)} * uWind;`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength + heightRef;
  return mat;
}

// ---------- grass ----------
const GRASS = { mesh: null, chunk: 8, per: 0, slots: [], map: new Map(), cx: 1e9, cz: 1e9, mat: null, uRadius: { value: 60 } };
function makeGrassGeometry() {
  const pos = [], col = [], idx = [];
  const blades = 9, segs = 2;
  for (let b = 0; b < blades; b++) {
    const a = Math.random() * TAU, r = Math.random() * 0.55, bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const h = 0.4 + Math.random() * 0.5, w = 0.07 + Math.random() * 0.05, rot = Math.random() * TAU, lean = (Math.random() - 0.5) * 0.4;
    const cr = Math.cos(rot), sr = Math.sin(rot), base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - t * 0.9), y = h * t, off = lean * t * t;
      for (const side of [-1, 1]) {
        const lx = side * ww, lz = off;
        pos.push(bx + lx * cr - lz * sr, y, bz + lx * sr + lz * cr);
        const k = 0.5 + 0.6 * t; col.push(k, k, k);
      }
    }
    for (let s = 0; s < segs; s++) { const i = base + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2, i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);   // flat-lit upward normals look softer
  return g;
}
function makeGrassMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: UTIME, uWind: UWIND, uPlayer: UPLAYER, uRadius: GRASS.uRadius });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind, uRadius; uniform vec3 uPlayer;')
      .replace('#include <project_vertex>', `
        vec4 lp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        lp = instanceMatrix * lp;
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
        vec3 ip = vec3(0.0);
        #endif
        vec4 wp = modelMatrix * lp;
        float hgt = max(0.0, wp.y - ip.y);
        float sway = sin(uTime * 1.9 + wp.x * 0.23 + wp.z * 0.19) * 0.55 + sin(uTime * 3.7 + wp.x * 0.61 - wp.z * 0.3) * 0.2;
        wp.x += sway * hgt * hgt * 0.5 * uWind; wp.z += sway * hgt * hgt * 0.3 * uWind;
        vec2 dp = wp.xz - uPlayer.xz; float dd = length(dp);
        float push = (1.0 - smoothstep(0.2, 1.4, dd)) * hgt * step(abs(wp.y - uPlayer.y), 2.0);
        wp.xz += dp / max(dd, 0.001) * push * 0.75; wp.y -= push * 0.35;
        float cd = length((viewMatrix * vec4(ip, 1.0)).xyz);
        float fade = 1.0 - smoothstep(uRadius * 0.72, uRadius, cd);
        wp.y = ip.y + (wp.y - ip.y) * fade;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'grass';
  return m;
}
function initGrass() {
  if (GRASS.mesh) { scene.remove(GRASS.mesh); GRASS.mesh = null; }
  GRASS.map.clear(); GRASS.cx = GRASS.cz = 1e9;
  const q = Q(); if (!q.grass) return;
  const R = q.grassR, C = GRASS.chunk, side = Math.ceil(R / C) * 2 + 1;
  let nChunks = 0; for (let i = 0; i < side; i++) for (let j = 0; j < side; j++) { const dx = (i - (side - 1) / 2) * C, dz = (j - (side - 1) / 2) * C; if (dx * dx + dz * dz <= (R + C) * (R + C)) nChunks++; }
  GRASS.per = Math.max(4, Math.floor(q.grass / nChunks));
  if (!GRASS.geo) GRASS.geo = keepGeo(makeGrassGeometry());
  if (!GRASS.mat) { GRASS.mat = makeGrassMaterial(); GRASS.mat.userData.keep = true; }
  const mesh = new THREE.InstancedMesh(GRASS.geo, GRASS.mat, nChunks * GRASS.per);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, zero);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  GRASS.slots = []; for (let s = 0; s < nChunks; s++) GRASS.slots.push({ key: null, base: s * GRASS.per });
  GRASS.mesh = mesh; GRASS.R = R; scene.add(mesh);
  GRASS.uRadius.value = R;
}
const _grM = new THREE.Matrix4(), _grQ = new THREE.Quaternion(), _grP = new V3(), _grS = new V3(), _grC = new THREE.Color();
function fillGrassChunk(slot, ci, cj) {
  const C = GRASS.chunk, rng = mulberry32((ci * 73856093) ^ (cj * 19349663) ^ WORLD.seed);
  const mesh = GRASS.mesh;
  for (let k = 0; k < GRASS.per; k++) {
    const x = (ci + rng()) * C, z = (cj + rng()) * C;
    const wgt = grassWeight(x, z);
    if (wgt < 0.45 + rng() * 0.3) { _grM.makeScale(0, 0, 0); mesh.setMatrixAt(slot.base + k, _grM); continue; }
    const h = groundH(x, z);
    const s = (0.65 + rng() * 0.75) * (0.6 + wgt * 0.5);
    _grQ.setFromAxisAngle(UP, rng() * TAU);
    _grM.compose(_grP.set(x, h - 0.05, z), _grQ, _grS.set(s, s * (0.8 + rng() * 0.5), s));
    mesh.setMatrixAt(slot.base + k, _grM);
    const tc = terrainTint(x, z); _grC.setRGB(tc[0] * (0.85 + rng() * 0.3), tc[1] * (0.9 + rng() * 0.25), tc[2] * (0.85 + rng() * 0.3));
    mesh.setColorAt(slot.base + k, _grC);
  }
}
function updateGrass(cx, cz) {
  if (!GRASS.mesh) return;
  const C = GRASS.chunk, pci = Math.floor(cx / C), pcj = Math.floor(cz / C);
  if (pci === GRASS.cx && pcj === GRASS.cz) return;
  GRASS.cx = pci; GRASS.cz = pcj;
  const R = GRASS.R, rc = Math.ceil(R / C), want = new Set();
  for (let i = -rc; i <= rc; i++) for (let j = -rc; j <= rc; j++) { if ((i * i + j * j) * C * C <= (R + C) * (R + C)) want.add((pci + i) + ',' + (pcj + j)); }
  const free = [];
  for (const s of GRASS.slots) { if (s.key && !want.has(s.key)) { GRASS.map.delete(s.key); s.key = null; } if (!s.key) free.push(s); }
  let dirty = false;
  for (const key of want) {
    if (GRASS.map.has(key)) continue;
    const s = free.pop(); if (!s) break;
    const [ci, cj] = key.split(',').map(Number);
    s.key = key; GRASS.map.set(key, s); fillGrassChunk(s, ci, cj); dirty = true;
  }
  if (dirty) { GRASS.mesh.instanceMatrix.needsUpdate = true; if (GRASS.mesh.instanceColor) GRASS.mesh.instanceColor.needsUpdate = true; }
}

// ---------- rain ----------
const RAIN = (() => {
  let mesh = null, active = false, pos = null, vel = null;
  const N = 2600, BOX = 34;
  function init() {
    const g = new THREE.BufferGeometry(); pos = new Float32Array(N * 6); vel = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = mr(-BOX, BOX), y = mr(0, 40), z = mr(-BOX, BOX); vel[i] = mr(26, 34); pos.set([x, y, z, x, y + 0.9, z], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.35, depthWrite: false }));
    mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  }
  return {
    init,
    setActive(on) { active = on; if (mesh) mesh.visible = on; },
    get active() { return active; },
    update(dt, cx, cy, cz) {
      if (!active || !mesh) return;
      const wx = UWIND.value * 2.5;
      for (let i = 0; i < N; i++) {
        let x = pos[i * 6], y = pos[i * 6 + 1], z = pos[i * 6 + 2];
        y -= vel[i] * dt; x += wx * dt;
        if (y < cy - 6 || x - cx > BOX || x - cx < -BOX || z - cz > BOX || z - cz < -BOX) { x = cx + mr(-BOX, BOX); z = cz + mr(-BOX, BOX); y = cy + mr(12, 40); }
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x - wx * 0.03; pos[i * 6 + 4] = y + 0.9; pos[i * 6 + 5] = z;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
    },
  };
})();

// ---------- environment setup (called once) ----------
function makeSkyAndEnv() {
  ENVSTATE.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), makeSkyMaterial(true));
  ENVSTATE.sky.frustumCulled = false; ENVSTATE.sky.renderOrder = -10; scene.add(ENVSTATE.sky);
  ENVSTATE.envScene = new THREE.Scene();
  ENVSTATE.envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), makeSkyMaterial(false));
  ENVSTATE.envScene.add(ENVSTATE.envSky);
  ENVSTATE.cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334455, roughness: 1, flatShading: true });
  ENVSTATE.cloudMat.userData.keep = true;
}

// every standard material shares the time-of-day ambient strength
function setEnvIntensity(v) {
  ENV_INTENSITY = v;
  for (const m of _matCache.values()) if (m.isMeshStandardMaterial) m.envMapIntensity = v;
  if (scene) scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.isMeshStandardMaterial) m.envMapIntensity = v * (m.userData.envMul || 1); });
  for (const m of Object.values(MAT.build || {})) m.envMapIntensity = v;
}
