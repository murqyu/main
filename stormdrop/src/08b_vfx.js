// ---------- VFX 2.0: muzzle flashes + dynamic lights, casings, decals, explosions, build holograms, ambient puffs ----------
const VFX = (() => {
  const tmpC = new THREE.Color(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new V3(), _s = new V3(), _n = new V3(), _Z = new V3(0, 0, 1), _e = new THREE.Euler();
  function canvasT(size, draw) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(cv); t.userData = { keep: true }; return t;
  }
  // ---- textures ----
  let flashTex, holeTex, scorchTex, ringTex;
  function makeTextures() {
    flashTex = canvasT(128, (g, s) => {
      g.translate(s / 2, s / 2);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, s / 2); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,240,200,0.9)'); rg.addColorStop(0.45, 'rgba(255,170,60,0.35)'); rg.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, s / 2, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { g.rotate(TAU / 7 + Math.random() * 0.3); const L = s * (0.32 + Math.random() * 0.18); const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, 'rgba(255,250,220,0.95)'); lg.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(0, -s * 0.03); g.lineTo(L, 0); g.lineTo(0, s * 0.03); g.fill(); }
    });
    holeTex = canvasT(64, (g, s) => {
      const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rg.addColorStop(0, 'rgba(10,8,6,1)'); rg.addColorStop(0.22, 'rgba(20,16,12,0.95)'); rg.addColorStop(0.32, 'rgba(60,50,40,0.6)'); rg.addColorStop(0.7, 'rgba(40,34,28,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(15,12,10,0.55)'; g.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, l = s * (0.22 + Math.random() * 0.2); g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); g.stroke(); }
    });
    scorchTex = canvasT(128, (g, s) => {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * TAU, d = Math.random() * s * 0.25, r = s * (0.12 + Math.random() * 0.22);
        const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
        const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(8,6,5,0.28)'); rg.addColorStop(1, 'rgba(8,6,5,0)');
        g.fillStyle = rg; g.fillRect(0, 0, s, s);
      }
    });
    ringTex = canvasT(128, (g, s) => {
      const rg = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
      rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.75, 'rgba(255,230,190,0.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, s, s);
    });
  }
  // ---- muzzle flash sprites + pooled point lights ----
  const flashes = [], lights = [];
  function initFlashes() {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.SpriteMaterial({ map: flashTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      m.userData.keep = true;
      const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 4; scene.add(s);
      flashes.push({ s, life: 0, ml: 0.05, size: 1 });
    }
  }
  function setLights(n) {
    while (lights.length > n) { const L = lights.pop(); scene.remove(L.l); }
    while (lights.length < n) { const l = new THREE.PointLight(0xffb060, 0, 12, 2); scene.add(l); lights.push({ l, life: 0, ml: 1, peak: 0 }); }
  }
  function flashLight(x, y, z, hex, peak, life, dist) {
    if (!lights.length) return;
    _p.set(x, y, z);
    // reuse the dimmest light, but never steal a bigger one for a smaller flash
    let best = null, bv = Infinity;
    for (const L of lights) { const v = L.life > 0 ? L.peak * (L.life / L.ml) : -1; if (v < bv) { bv = v; best = L; } }
    if (bv > peak) return;
    best.l.position.copy(_p); best.l.color.set(hex); best.l.distance = dist || 12; best.peak = peak; best.life = best.ml = life; best.l.intensity = peak;
  }
  function muzzle(c, x, y, z, big) {
    const cp = camera.position, d2 = (x - cp.x) ** 2 + (z - cp.z) ** 2;
    if (d2 > 160 * 160) return;
    const f = flashes.find((q) => q.life <= 0) || flashes[0];
    f.life = f.ml = big ? 0.065 : 0.045; f.size = (big ? 0.85 : 0.5) * mr(0.85, 1.15);
    f.s.position.set(x, y, z); f.s.material.rotation = Math.random() * TAU; f.s.material.color.setRGB(4.2, 3, 1.7); f.s.visible = true;
    f.s.scale.setScalar(f.size);
    if (d2 < 45 * 45) flashLight(x, y, z, 0xffa648, big ? 3 : 1.8, 0.06, big ? 12 : 9);
  }
  // ---- casings ----
  const CAS = 90; let casM; const cas = [];
  function initCasings() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.32 }); mat.userData.keep = true;
    casM = new THREE.InstancedMesh(keepGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.075, 6).rotateX(Math.PI / 2)), mat, CAS);
    casM.frustumCulled = false; casM.castShadow = false;
    for (let i = 0; i < CAS; i++) { _m.makeScale(0, 0, 0); casM.setMatrixAt(i, _m); casM.setColorAt(i, tmpC.set(0xd4a640)); cas.push({ life: 0, p: new V3(), v: new V3(), r: new V3(), rv: new V3(), floor: 0, s: 1, rest: false }); }
    scene.add(casM);
  }
  let casNext = 0;
  function casing(c, shell) {
    if (!c.rig || !c.rig.root.visible) return;
    const cp = camera.position; if ((c.pos.x - cp.x) ** 2 + (c.pos.z - cp.z) ** 2 > 28 * 28) return;
    const R = c.rig; if (!R.gunModel) return;
    R.gunModel.localToWorld(_p.set(0.06, 0.04, 0.02));
    const yaw = c.modelYaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const k = casNext; casNext = (casNext + 1) % CAS; const q = cas[k];
    q.life = 3.5; q.rest = false; q.p.copy(_p); q.v.set(rx * mr(1.8, 3) + c.vel.x * 0.8, mr(2, 3.4), rz * mr(1.8, 3) + c.vel.z * 0.8);
    q.r.set(Math.random() * 6, Math.random() * 6, 0); q.rv.set(mr(-20, 20), mr(-20, 20), 0); q.s = shell ? 1.7 : 1;
    q.floor = surfaceBelow(_p.x, _p.y, _p.z);
    casM.setColorAt(k, tmpC.set(shell ? 0xc8322a : 0xd4a640).convertSRGBToLinear()); casM.instanceColor.needsUpdate = true;
  }
  function updateCasings(dt) {
    let dirty = false;
    for (let i = 0; i < CAS; i++) {
      const q = cas[i]; if (q.life <= 0) continue;
      q.life -= dt; dirty = true;
      if (!q.rest) {
        q.v.y -= GRAV * dt; q.p.addScaledVector(q.v, dt); q.r.addScaledVector(q.rv, dt);
        if (q.p.y < q.floor + 0.02) {
          q.p.y = q.floor + 0.02;
          if (Math.abs(q.v.y) > 1.2) { q.v.y *= -0.35; q.v.x *= 0.55; q.v.z *= 0.55; q.rv.multiplyScalar(0.6); if (Math.random() < 0.5) SFX.tink && SFX.tink(q.p); }
          else { q.rest = true; q.r.x = Math.PI / 2 * Math.round(q.r.x / (Math.PI / 2)); }
        }
      }
      const sc = q.life <= 0 ? 0 : q.s * Math.min(1, q.life * 2);
      _e.set(q.r.x, q.r.y, 0); _q.setFromEuler(_e); _m.compose(q.p, _q, _s.set(sc, sc, sc)); casM.setMatrixAt(i, _m);
    }
    if (dirty) casM.instanceMatrix.needsUpdate = true;
  }
  // ---- decals: bullet holes + scorch marks on any surface ----
  function decalSet(tex, max, opacity) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity, color: 0xffffff });
    mat.userData.keep = true;
    const m = new THREE.InstancedMesh(keepGeo(new THREE.PlaneGeometry(1, 1)), mat, max); m.frustumCulled = false; m.renderOrder = 1;
    const list = [];
    for (let i = 0; i < max; i++) { _m.makeScale(0, 0, 0); m.setMatrixAt(i, _m); list.push({ life: 0, size: 0, col: null, p: new V3(), q: new THREE.Quaternion() }); }
    scene.add(m);
    return { m, list, next: 0, max };
  }
  let holes, scorch;
  function addDecal(D, x, y, z, nx, ny, nz, size, life, col) {
    const k = D.next; D.next = (D.next + 1) % D.max; const d = D.list[k];
    _n.set(nx, ny, nz).normalize();
    d.p.set(x + _n.x * 0.012, y + _n.y * 0.012, z + _n.z * 0.012); d.q.setFromUnitVectors(_Z, _n);
    _q.setFromAxisAngle(_Z, Math.random() * TAU); d.q.multiply(_q);
    d.size = size; d.life = life; d.col = col || null;
    _m.compose(d.p, d.q, _s.set(size, size, size)); D.m.setMatrixAt(k, _m); D.m.instanceMatrix.needsUpdate = true;
  }
  function updateDecals(D, dt) {
    let dirty = false;
    for (let i = 0; i < D.max; i++) {
      const d = D.list[i]; if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life < 1.2 || (d.col && d.col.alive === false)) {
        if (d.col && d.col.alive === false) d.life = 0;
        const sc = d.life > 0 ? d.size * (d.life / 1.2) : 0;
        _m.compose(d.p, d.q, _s.set(sc, sc, sc)); D.m.setMatrixAt(i, _m); dirty = true;
      }
    }
    if (dirty) D.m.instanceMatrix.needsUpdate = true;
  }
  function terrainNormal(x, z, out) { const e = 0.5; return out.set(groundH(x - e, z) - groundH(x + e, z), 2 * e, groundH(x, z - e) - groundH(x, z + e)).normalize(); }
  function bulletHole(h, x, y, z) {
    if (!holes) return;
    const cp = camera.position; if ((x - cp.x) ** 2 + (z - cp.z) ** 2 > 70 * 70) return;
    if (h.terrain) { terrainNormal(x, z, _n); addDecal(holes, x, y, z, _n.x, _n.y, _n.z, mr(0.16, 0.22), 14, null); }
    else if (h.col) addDecal(holes, x, y, z, h.nx, h.ny, h.nz, mr(0.12, 0.17), 14, h.col);
  }
  // ---- explosions: noisy fireball, shock ring, smoke column, sparks, light, scorch ----
  const FB_VS = `uniform float uT; varying float vHeat; varying vec3 vN;
    float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
    void main(){ vec3 p = position; float n = n3(p * 2.6 + uT * 3.0) * 0.6 + n3(p * 5.3 - uT * 4.0) * 0.4;
      vHeat = n; vN = normalize(normalMatrix * normal); p += normal * (n - 0.45) * 0.55;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const FB_FS = `uniform float uT, uA; varying float vHeat; varying vec3 vN;
    void main(){ float rim = pow(1.0 - abs(vN.z), 1.5); float heat = clamp(vHeat * 1.3 - uT * 1.25 + (1.0 - rim) * 0.35, 0.0, 1.0);
      vec3 smoke = vec3(0.07, 0.06, 0.05), fire = vec3(2.2, 0.62, 0.1), core = vec3(4.2, 2.1, 0.55);
      vec3 c = mix(smoke, fire, smoothstep(0.15, 0.55, heat)); c = mix(c, core, smoothstep(0.62, 0.95, heat));
      gl_FragColor = vec4(c, uA * (0.55 + 0.45 * smoothstep(0.0, 0.4, heat))); }`;
  const fbs = [], rings = [];
  function initExplosions() {
    const geo = keepGeo(new THREE.IcosahedronGeometry(1, 3));
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 1 } }, vertexShader: FB_VS, fragmentShader: FB_FS, transparent: true, depthWrite: false });
      mat.userData.keep = true;
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 3; scene.add(m);
      fbs.push({ m, t: 0, life: 0, R: 1 });
      const rm = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.6, 1.1, 0.75), side: THREE.DoubleSide });
      rm.userData.keep = true;
      const r = new THREE.Mesh(keepGeo(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), rm); r.visible = false; r.renderOrder = 3; scene.add(r);
      rings.push({ m: r, t: 0, life: 0, R: 1 });
    }
  }
  function explosion(x, y, z, R) {
    const f = fbs.find((q) => q.life <= 0) || fbs[0];
    f.t = 0; f.life = 0.8; f.R = R * 0.45; f.m.position.set(x, y, z); f.m.visible = true; f.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    const r = rings.find((q) => q.life <= 0) || rings[0];
    const gy = surfaceBelow(x, y + 0.5, z);
    r.t = 0; r.life = 0.45; r.R = R * 1.6; r.m.position.set(x, Math.max(gy + 0.08, y - 1.5), z); r.m.visible = true;
    const P = Q().particles;
    for (let i = 0; i < 30 * P; i++) { const a = Math.random() * TAU, sp = mr(0.5, 2.6); FX.emitN(x + mr(-0.8, 0.8), y + mr(-0.3, 0.8), z + mr(-0.8, 0.8), Math.cos(a) * sp, mr(0.8, 2.8), Math.sin(a) * sp, mr(2.2, 3.6), mr(1.2, 2), mr(4, 6.5), 0.36, 0.34, 0.32, 0.62, 0.35, 0.9); }
    for (let i = 0; i < 46 * P; i++) { const th = Math.random() * TAU, ph = Math.acos(mr(-0.3, 1)), sp = mr(7, 17); FX.emitA(x, y, z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, mr(0.4, 0.9), 0.22, 0.05, 1, 0.62, 0.25, 1, -14, 0.8); }
    flashLight(x, y + 0.6, z, 0xff7a2a, 5, 0.4, 26);
    FX.debris({ x, y, z }, 0x4a3e34, 8);
    if (scorch && y - gy < 2.5) { terrainNormal(x, z, _n); addDecal(scorch, x, gy, z, _n.x, _n.y, _n.z, R * 1.5, 30, null); }
    POST.U.flash.value = Math.min(1, POST.U.flash.value + 0.15 * Math.max(0, 1 - camera.position.distanceTo(_p.set(x, y, z)) / 40));
  }
  function updateExplosions(dt) {
    for (const f of fbs) {
      if (f.life <= 0) continue;
      f.t += dt; const k = f.t / f.life;
      if (k >= 1) { f.life = 0; f.m.visible = false; continue; }
      const grow = 1 - Math.pow(1 - Math.min(1, k * 2.4), 3);
      f.m.scale.setScalar(f.R * (0.35 + grow * 0.85 + k * 0.25)); f.m.position.y += dt * 1.6;
      f.m.material.uniforms.uT.value = k; f.m.material.uniforms.uA.value = 1 - smooth01(clamp((k - 0.55) / 0.45, 0, 1));
    }
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { r.life = 0; r.m.visible = false; continue; }
      r.m.scale.setScalar(r.R * (0.2 + (1 - (1 - k) * (1 - k)) * 0.8)); r.m.material.opacity = 1 - k;
    }
  }
  function smooth01(t) { return t * t * (3 - 2 * t); }
  // ---- builds: hologram fill while constructing ----
  function holoMaterial(mat) {
    const U = { uFill: { value: -1e4 }, uHolo: { value: new THREE.Color(0.25, 0.75, 2.2) }, uPop: { value: 0 } };
    const m = MAT.build[mat].clone();
    m.transparent = true; m.userData.keep = false; m.userData.U = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHw; uniform float uFill, uPop; uniform vec3 uHolo;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          vec3 gp = abs(fract(vHw * 1.25) - 0.5); float grid = smoothstep(0.44, 0.5, max(max(gp.x, gp.y), gp.z) * 1.0);
          float above = step(uFill, vHw.y), edge = smoothstep(0.25, 0.0, abs(vHw.y - uFill));
          vec3 holo = uHolo * (0.35 + grid * 1.6);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, holo, above) + uHolo * edge * 1.6 + uPop * vec3(1.5, 1.8, 2.4);
          gl_FragColor.a = mix(1.0, 0.32 + grid * 0.5, above);`);
    };
    m.customProgramCacheKey = () => 'holo';
    return m;
  }
  // ---- ambient puffs: sprint dust, slide spray, landing rings, water splashes, healing ----
  const stepT = new WeakMap();
  function dustAt(x, y, z, n, sp, size, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = sp * mr(0.4, 1); FX.emitN(x + mr(-0.15, 0.15), y + 0.05, z + mr(-0.15, 0.15), Math.cos(a) * s, mr(0.2, 0.9), Math.sin(a) * s, mr(0.5, 0.9), size * 0.5, size * 1.6, col[0], col[1], col[2], 0.5, 0.2, 2.5); }
  }
  const DUST = [0.72, 0.64, 0.52], WATERC = [0.85, 0.93, 1];
  function landDust(c, strength) {
    const water = c.pos.y < 0.12;
    const n = Math.round(8 + strength * 14);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, s = mr(2.2, 4) * (0.6 + strength); FX.emitN(c.pos.x + Math.cos(a) * 0.3, c.pos.y + 0.08, c.pos.z + Math.sin(a) * 0.3, Math.cos(a) * s, mr(0.3, 1) + (water ? 2.5 : 0), Math.sin(a) * s, mr(0.5, 0.8), 0.45, 1.5, ...(water ? WATERC : DUST), 0.55, water ? -9 : 0.3, 3); }
  }
  function ambient(dt) {
    const cp = camera.position;
    for (const c of characters) {
      if (!c.alive || c.mode !== 'ground' || !c.rig.root.visible) continue;
      const dx = c.pos.x - cp.x, dz = c.pos.z - cp.z; if (dx * dx + dz * dz > 45 * 45) continue;
      const sp = Math.hypot(c.vel.x, c.vel.z), water = c.pos.y < 0.12;
      let t = (stepT.get(c) || 0) - dt;
      if (c.sliding && c.grounded) {
        if (t <= 0) { t = 0.03; FX.emitN(c.pos.x + mr(-0.2, 0.2), c.pos.y + 0.1, c.pos.z + mr(-0.2, 0.2), -c.vel.x * 0.15 + mr(-0.8, 0.8), mr(0.5, 1.5) + (water ? 2 : 0), -c.vel.z * 0.15 + mr(-0.8, 0.8), mr(0.4, 0.7), 0.4, 1.3, ...(water ? WATERC : DUST), 0.5, water ? -8 : 0.5, 2); }
      } else if (c.grounded && sp > (water ? 2 : 7.3)) {
        if (t <= 0) { t = water ? 0.12 : 0.27; if (water) { for (let i = 0; i < 5; i++) FX.emitN(c.pos.x + mr(-0.3, 0.3), c.pos.y + 0.05, c.pos.z + mr(-0.3, 0.3), mr(-1, 1), mr(2, 3.5), mr(-1, 1), mr(0.4, 0.7), 0.18, 0.4, ...WATERC, 0.8, -9, 0.5); } else dustAt(c.pos.x, c.pos.y, c.pos.z, 2, 0.6, 0.45, DUST); }
      }
      if (c.using && Math.random() < dt * 22) {
        const def = CONSUMABLES[c.using.id], a = Math.random() * TAU, r = mr(0.35, 0.6);
        const col = def && def.heal ? [0.45, 1, 0.5] : [0.4, 0.8, 1];
        FX.emitA(c.pos.x + Math.cos(a) * r, c.pos.y + mr(0.2, 1.6), c.pos.z + Math.sin(a) * r, 0, mr(0.8, 1.6), 0, mr(0.5, 0.9), 0.2, 0.04, col[0], col[1], col[2], 0.9, 0, 0.5);
      }
      stepT.set(c, t);
    }
  }
  function shieldBreak(c) {
    for (let i = 0; i < 36; i++) { const th = Math.random() * TAU, ph = Math.acos(mr(-1, 1)), sp = mr(3, 7); FX.emitA(c.pos.x, c.pos.y + 1.1, c.pos.z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, mr(0.3, 0.6), 0.25, 0.04, 0.45, 0.8, 1, 1, -6, 1.5); }
    flashLight(c.pos.x, c.pos.y + 1.2, c.pos.z, 0x5ab4ff, 4, 0.25, 9);
  }
  function chestOpen(p) { flashLight(p.x, p.y + 1, p.z, 0xffcf5a, 6, 0.6, 12); for (let i = 0; i < 20; i++) FX.emitA(p.x + mr(-0.5, 0.5), p.y + mr(0.4, 1), p.z + mr(-0.5, 0.5), mr(-0.3, 0.3), mr(1.5, 3.5), mr(-0.3, 0.3), mr(0.8, 1.6), 0.18, 0.04, 1, 0.85, 0.4, 1, 0, 0.8); }
  function smokeTrail(ax, ay, az, bx, by, bz) {
    const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.min(40, Math.floor(L / 1.6));
    for (let i = 1; i < n; i++) { const k = i / n; FX.emitN(lerp(ax, bx, k), lerp(ay, by, k), lerp(az, bz, k), mr(-0.1, 0.1), mr(0.05, 0.25), mr(-0.1, 0.1), mr(1.2, 1.8), 0.12, 0.55, 0.92, 0.92, 0.95, 0.35, 0, 0.4); }
  }
  function pieceSpark(b) {
    for (let i = 0; i < 12; i++) FX.emitA(mr(b[0], b[3]), mr(b[1], b[4]), mr(b[2], b[5]), 0, mr(0.3, 1), 0, mr(0.3, 0.6), 0.22, 0.05, 0.35, 0.75, 1, 1, 0, 0);
  }
  function pieceBreak(pos, hex) {
    tmpC.set(hex);
    for (let i = 0; i < 14; i++) FX.emitN(pos.x + mr(-1.6, 1.6), pos.y + mr(-1.2, 1.2), pos.z + mr(-1.6, 1.6), mr(-1, 1), mr(0, 1.2), mr(-1, 1), mr(0.8, 1.4), mr(0.8, 1.2), mr(2, 3.2), tmpC.r * 0.9 + 0.08, tmpC.g * 0.9 + 0.08, tmpC.b * 0.9 + 0.08, 0.45, 0.2, 1.5);
  }
  return {
    init() {
      makeTextures(); initFlashes(); initCasings(); initExplosions();
      holes = decalSet(holeTex, 240, 0.9); scorch = decalSet(scorchTex, 24, 1);
      setLights(Q().lights);
    },
    setLights, muzzle, casing, bulletHole, explosion, holoMaterial, landDust, shieldBreak, chestOpen, smokeTrail, pieceSpark, pieceBreak, flashLight,
    clear() {
      for (const D of [holes, scorch]) for (let i = 0; i < D.max; i++) { D.list[i].life = 0; _m.makeScale(0, 0, 0); D.m.setMatrixAt(i, _m); }
      holes.m.instanceMatrix.needsUpdate = true; scorch.m.instanceMatrix.needsUpdate = true;
      for (const q of cas) q.life = 0;
      for (const f of fbs) { f.life = 0; f.m.visible = false; } for (const r of rings) { r.life = 0; r.m.visible = false; }
    },
    update(dt) {
      for (const f of flashes) { if (f.life <= 0) continue; f.life -= dt; if (f.life <= 0) f.s.visible = false; else f.s.scale.setScalar(f.size * (0.6 + 0.4 * f.life / f.ml)); }
      for (const L of lights) { if (L.life <= 0) { L.l.intensity = 0; continue; } L.life -= dt; const k = Math.max(0, L.life / L.ml); L.l.intensity = L.peak * k * k; }
      updateCasings(dt); updateDecals(holes, dt); updateDecals(scorch, dt); updateExplosions(dt); ambient(dt);
    },
  };
})();
