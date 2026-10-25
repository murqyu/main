// ---------- the storm ----------
// [wait seconds, shrink seconds, end radius, damage per second]
const STORM_PHASES = [[80, 45, 280, 1], [45, 40, 170, 1], [35, 35, 105, 2], [30, 30, 62, 5], [25, 25, 34, 8], [20, 22, 15, 10], [15, 25, 0, 12]];
// early phases stretch with the island; the endgame circles stay the same size
function phaseAt(i) { const P = STORM_PHASES[i], sc = WORLD.scale || 1, k = i < 3 ? 0.6 + 0.4 * sc : 1, rs = i < 3 ? sc : i === 3 ? Math.sqrt(sc) : 1; return [Math.round(P[0] * k), Math.round(P[1] * k), P[2] * rs, P[3]]; }
const STORM = { idx: 0, state: 'wait', timer: 0, total: 1, cur: { x: 0, z: 0, r: 720 }, from: { x: 0, z: 0, r: 720 }, to: { x: 0, z: 0, r: 280 }, dmg: 1, tick: 1, warned: false, mesh: null, mat: null };
function makeStormMesh() {
  STORM.mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 }, uFogFar: { value: 700 }, uFogCol: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'uniform float t, uFogFar; uniform vec3 uFogCol; varying vec3 vW; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }',
      'void main(){ float a = vUv.x * 90.0; float y = vW.y * 0.045;',
      ' float v = n(vec2(a + t*0.5, y - t*0.7)) * 0.6 + n(vec2(a*2.3 - t*0.9, y*2.1 - t*1.6)) * 0.4;',
      ' float bands = smoothstep(0.5, 0.92, v);',
      ' vec3 col = mix(vec3(0.16,0.015,0.55), vec3(1.6,0.7,2.2), bands);',
      ' float dist = distance(vW, cameraPosition); float fogk = smoothstep(uFogFar * 0.35, uFogFar * 1.05, dist);',
      ' col = mix(col, uFogCol * 1.2 + vec3(0.06, 0.0, 0.12), fogk);',
      ' float alpha = (0.34 + bands * 0.32) * (1.0 - smoothstep(150.0, 290.0, vW.y)) * (1.0 - fogk * 0.92);',
      ' gl_FragColor = vec4(col, alpha); }',
    ].join('\n'),
  });
  STORM.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 360, 72, 1, true), STORM.mat);
  STORM.mesh.position.y = 110; STORM.mesh.renderOrder = 4; STORM.mesh.frustumCulled = false;
  scene.add(STORM.mesh);
}
function nextCircle(prev, r, first) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU, d = Math.random() * (first ? 110 * WORLD.scale : Math.max(0, prev.r - r));
    const x = (first ? 0 : prev.x) + Math.cos(a) * d, z = (first ? 0 : prev.z) + Math.sin(a) * d;
    if (groundH(x, z) > 1.2 || i === 39) return { x, z, r };
  }
}
function stormInit() {
  const S = STORM;
  S.idx = 0; S.state = 'wait'; S.timer = phaseAt(0)[0]; S.total = S.timer; S.dmg = 1; S.tick = 1; S.warned = false;
  S.cur = { x: 0, z: 0, r: 720 * WORLD.scale }; S.from = { x: 0, z: 0, r: 720 * WORLD.scale };
  S.to = nextCircle(S.cur, phaseAt(0)[2], true);
  S.mat.uniforms.t.value = 0;
}
function updateStorm(dt) {
  const S = STORM;
  S.timer -= dt;
  if (S.state === 'wait') {
    if (!S.warned && S.timer < 10 && GAME.time > 15) { S.warned = true; HUD.banner('Storm closing in 10 seconds', '', 2.2, 'storm'); SFX.alert(); }
    if (S.timer <= 0) {
      const ph = phaseAt(S.idx);
      S.state = 'shrink'; S.timer = ph[1]; S.total = ph[1]; S.from = { x: S.cur.x, z: S.cur.z, r: S.cur.r }; S.dmg = ph[3];
      HUD.banner('The storm is closing in', 'Get inside the white circle', 3, 'storm'); SFX.announce('The storm is closing');
      if (S.idx === 1 || S.idx === 3) setTimeout(() => { if (GAME.state !== 'menu') spawnSupply(); }, 4000);
    }
  } else if (S.state === 'shrink') {
    const t = 1 - Math.max(0, S.timer) / S.total;
    S.cur.x = lerp(S.from.x, S.to.x, t); S.cur.z = lerp(S.from.z, S.to.z, t); S.cur.r = lerp(S.from.r, S.to.r, t);
    if (S.timer <= 0) {
      S.idx++;
      if (S.idx >= STORM_PHASES.length) { S.state = 'done'; S.timer = 0; S.dmg = 14; }
      else { const ph = phaseAt(S.idx); S.state = 'wait'; S.timer = ph[0]; S.total = ph[0]; S.to = nextCircle(S.cur, ph[2]); S.warned = false; HUD.banner('New safe zone marked', 'The storm moves again in ' + ph[0] + ' seconds', 3, 'storm'); }
    }
  }
  S.tick -= dt;
  if (S.tick <= 0) {
    S.tick = 1;
    for (const c of characters) {
      if (!c.alive || c.mode === 'bus') continue;
      if (Math.hypot(c.pos.x - S.cur.x, c.pos.z - S.cur.z) > S.cur.r) applyDamage(c, S.dmg, null, 'storm', false, 'storm');
    }
  }
  S.mesh.scale.set(Math.max(0.5, S.cur.r), 1, Math.max(0.5, S.cur.r));
  S.mesh.position.x = S.cur.x; S.mesh.position.z = S.cur.z;
  S.mat.uniforms.t.value += dt;
  S.mat.uniforms.uFogFar.value = Math.max(220, scene.fog.far); S.mat.uniforms.uFogCol.value.copy(scene.fog.color);
}
function inStorm(p) { return Math.hypot(p.x - STORM.cur.x, p.z - STORM.cur.z) > STORM.cur.r; }
