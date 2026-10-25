// ---------- biomes (snow + desert), extra POIs, ziplines, snowfall ----------
const _bio = { snow: 0, desert: 0 };
function biomeAt(x, z, h) {
  const B = WORLD.biome; if (!B) { _bio.snow = 0; _bio.desert = 0; return _bio; }
  const n = WORLD.perlin ? WORLD.perlin(x * 0.006 + 31, z * 0.006 - 17) * 0.16 : 0;
  const ps = (x * B.sx + z * B.sz) / WORLD.islandR + n, pd = (x * B.dx + z * B.dz) / WORLD.islandR - n;
  _bio.snow = smoothstep(0.28, 0.5, ps);
  _bio.desert = smoothstep(0.3, 0.52, pd);
  if (h !== undefined && h > 17) _bio.snow = Math.max(_bio.snow, smoothstep(17, 24, h));   // snow caps on every peak
  return _bio;
}
function setupBiomes(rng) {
  const a = rng() * TAU, b = a + Math.PI + (rng() - 0.5) * 1.1;
  WORLD.biome = { sx: Math.cos(a), sz: Math.sin(a), dx: Math.cos(b), dz: Math.sin(b), snowA: a, desertA: b };
}
// a spot deep inside a biome, away from other POIs
function biomeSpot(rng, raw, which, r) {
  const B = WORLD.biome, ang = which === 'snow' ? B.snowA : B.desertA;
  for (let t = 0; t < 400; t++) {
    const a = ang + (rng() - 0.5) * 1.3, d = (150 + rng() * 140) * WORLD.scale, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = raw(x, z); if (h < 2 || h > 14) continue;
    const bw = biomeAt(x, z); if ((which === 'snow' ? bw.snow : bw.desert) < 0.75) continue;
    let ok = true; for (const p of WORLD.pois) if (Math.hypot(p.x - x, p.z - z) < p.r + r + 45) { ok = false; break; }
    if (ok) for (const M of WORLD.mountains) if (Math.hypot(M.x - x, M.z - z) < M.r * 0.8 + r) { ok = false; break; }
    if (ok) return { x, z, h };
  }
  return null;
}
function pickBiomePOIs(rng, raw) {
  const put = (type, name, spot, r) => { if (spot) WORLD.pois.push({ type, name, x: spot.x, z: spot.z, r, sea: 0, h: Math.max(2.4, spot.h) }); };
  put('lodge', 'Frostpeak Lodge', biomeSpot(rng, raw, 'snow', 42), 42);
  put('outpost', 'Dustwater', biomeSpot(rng, raw, 'desert', 42), 42);
}
// ---------- POI builders ----------
function genLodge(p) {
  makeBuilding(p.x, p.z, 4, 3, 2, 'lodge', ri(0, 3), 0x7a4a2c);
  let made = 0;
  for (let i = 0; i < 40 && made < 4; i++) { const a = rand() * TAU, d = rr(18, p.r - 6), cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d; if (makeBuilding(cx, cz, 2, 2, rand() < 0.5 ? 2 : 1, 'lodge', doorToward(cx, cz, p.x, p.z), pick([0x6d4c33, 0x8a5a3a, 0x5a3c26]))) made++; }
  for (let i = 0; i < 5; i++) propBox(p.x + rr(-0.8, 0.8) * p.r, p.z + rr(-0.8, 0.8) * p.r, 1.4, 1.2, 1.4, woodMat(0xe8e2d0), 'wood', 90);
  WORLD.lodge = p;
}
function genOutpost(p) {
  let made = 0;
  for (let i = 0; i < 50 && made < 6; i++) {
    const a = rand() * TAU, d = rr(10, p.r - 6), cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
    if (makeBuilding(cx, cz, ri(2, 3), 2, rand() < 0.4 ? 2 : 1, 'saloon', doorToward(cx, cz, p.x, p.z), pick([0xc89a62, 0xb5824e, 0xd8b483, 0xa86f4f]))) made++;
  }
  // water tower on stilts with a chest on top
  const x = p.x + rr(-6, 6), z = p.z + rr(-6, 6), y = groundH(x, z);
  if (!overlapsFootprint(x - 2.5, z - 2.5, x + 2.5, z + 2.5, 1)) {
    addFootprint(x - 2.5, z - 2.5, x + 2.5, z + 2.5, true);
    for (const [sx, sz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) addBlock(x + sx - 0.2, y - 0.3, z + sz - 0.2, x + sx + 0.2, y + 9, z + sz + 0.2, woodMat(0x8a6040), { hp: 200, maxHp: 200, harvest: 'wood', kind: 'static' });
    addBlock(x - 2.4, y + 9, z - 2.4, x + 2.4, y + 9.4, z + 2.4, woodMat(0x9a7050), { hp: 250, maxHp: 250, harvest: 'wood', kind: 'static' });
    addBlock(x - 2, y + 9.4, z - 2, x + 2, y + 13, z + 2, woodMat(0xb08050), { hp: 300, maxHp: 300, harvest: 'wood', kind: 'static' });
    addStaticRamp(x + 2.4, z - 1, x + 7.4, z + 1, y, y + 9.4, 2, woodMat(0x8a6040), 'wood', 150);
    WORLD.lootSpots.push({ kind: 'chest', x, y: y + 13, z, rot: 0 });
  }
  for (let i = 0; i < 6; i++) propBox(p.x + rr(-0.85, 0.85) * p.r, p.z + rr(-0.85, 0.85) * p.r, 1.3, 1.1, 1.3, woodMat(0xc8a070), 'wood', 80);
}
function genFactory(p) {
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rand(), d = rr(12, 20); makeBuilding(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, ri(3, 4), 3, 1, 'warehouse', ri(0, 3), pick([0x8a949e, 0x6f8fa8, 0xa86f4f, 0x7a8a5a])); }
  // smokestacks
  for (let k = 0; k < 2; k++) {
    const x = p.x + rr(-10, 10), z = p.z + rr(-10, 10), y = groundH(x, z);
    if (overlapsFootprint(x - 2, z - 2, x + 2, z + 2, 1)) continue;
    addFootprint(x - 2, z - 2, x + 2, z + 2, true);
    let top = y - 0.3;
    for (let s = 0; s < 6; s++) { const w = 1.8 - s * 0.1; addBlock(x - w, top, z - w, x + w, top + 4, z + w, brickMat(s % 2 ? 0xa04a3a : 0xb85a48), { hp: 600, maxHp: 600, harvest: 'stone', kind: 'static' }); top += 4; }
    WORLD.smoke = WORLD.smoke || []; WORLD.smoke.push({ x, y: top + 0.5, z });
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * TAU, d = rr(6, p.r - 4), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, rotX = rand() < 0.5, w = rotX ? 6.2 : 2.6, dd = rotX ? 2.6 : 6.2;
    if (overlapsFootprint(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, 1.5)) continue;
    addFootprint(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, true);
    const y = groundH(x, z); let top = y - 0.2;
    for (let k = 0; k < ri(1, 2); k++) { addBlock(x - w / 2, top, z - dd / 2, x + w / 2, top + 2.7, z + dd / 2, metalMat(pick([0xc0392b, 0x2e86c1, 0xd68910, 0x239b56])), { hp: 500, maxHp: 500, harvest: 'metal', kind: 'static' }); top += 2.7; }
    if (rand() < 0.4) WORLD.lootSpots.push({ kind: rand() < 0.5 ? 'chest' : 'floor', x, y: top, z, rot: 0 });
  }
}
function genLighthouse(p) {
  const b = makeBuilding(p.x, p.z, 2, 2, 5, 'tower', ri(0, 3), 0xf2f2ee);
  if (!b) return;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  // red bands + glowing lantern room with a sweeping beam
  beginAsm();
  for (let f = 1; f < 5; f += 2) addVisual(boxGeo(b.x1 - b.x0 + 0.08, 1.2, b.z1 - b.z0 + 0.08), lam(0xd8342b), cx, b.base + f * 4 + 2, cz);
  addVisual(boxGeo(4, 2.6, 4), lam(0xfff4c8, { emissive: 0xffd27a, emissiveIntensity: 1.6 }), cx, b.top + 1.5, cz);
  addVisual(boxGeo(5, 0.5, 5), lam(0x2b2b2b), cx, b.top + 3, cz);
  endAsm();
  const beam = new THREE.Mesh(keepGeo(new THREE.ConeGeometry(3.2, 46, 16, 1, true).translate(0, -23, 0).rotateZ(Math.PI / 2)), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(cx, b.top + 1.6, cz); worldGroup.add(beam);
  WORLD.beam = beam;
  for (let i = 0; i < 3; i++) carAt(p.x + rr(-0.7, 0.7) * p.r, p.z + rr(-0.7, 0.7) * p.r);
}
// the vault: a fortified bunker with a boss, guards and a mythic weapon
function genVault(p) {
  const b = makeBuilding(p.x, p.z, 3, 3, 1, 'bunker', ri(0, 3), 0x8d9096);
  if (!b) return;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  beginAsm();
  for (let i = 0; i < 6; i++) addVisual(boxGeo(1, 0.6, 0.3), lam(i % 2 ? 0xffd23f : 0x222222), b.x0 + 1 + i * 2.2, b.base + 4.2, b.z0 - 0.2);
  addVisual(boxGeo(3, 3, 0.4), metalMat(0x6a7480), cx, b.top + 0.4, cz);
  endAsm();
  for (const [sx, sz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) addBlock(sx - 0.8, b.top - 0.2, sz - 0.8, sx + 0.8, b.top + 1.8, sz + 0.8, concreteMat(0x70747a), { hp: 500, maxHp: 500, harvest: 'stone', kind: 'static' });
  WORLD.lootSpots.push({ kind: 'chest', x: cx, y: b.base, z: cz, rot: 0, vault: true });
  WORLD.vault = { x: cx, y: b.base, z: cz, b };
}
const POI_GEN_EXTRA = { lodge: genLodge, outpost: genOutpost, factory: genFactory, lighthouse: genLighthouse, vault: genVault };

// ---------- ziplines ----------
const ZIPS = [];
function addZipline(ax, ay, az, bx, by, bz) {
  const a = new V3(ax, ay, az), b = new V3(bx, by, bz), len = a.distanceTo(b);
  if (len < 20) return;
  const pole = (p) => { addBlock(p.x - 0.25, groundH(p.x, p.z) - 0.4, p.z - 0.25, p.x + 0.25, p.y + 0.6, p.z + 0.25, metalMat(0xffc62e), { hp: Infinity, kind: 'static' }); };
  beginAsm(); pole(a); pole(b); endAsm();
  // cable as a sagging polyline
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new V3().lerpVectors(a, b, t).add(new V3(0, -Math.sin(Math.PI * t) * len * 0.035, 0))); }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x222222 })); worldGroup.add(line);
  ZIPS.push({ a, b, len });
}
function genZiplines() {
  ZIPS.length = 0;
  for (const M of WORLD.mountains) {
    const top = { x: M.x, z: M.z, y: groundH(M.x, M.z) + 4 };
    let best = null, bd = 1e9;
    for (const p of WORLD.pois) { const d = Math.hypot(p.x - M.x, p.z - M.z); if (d < bd && d > M.r * 0.6) { bd = d; best = p; } }
    if (!best || bd > 260) continue;
    const dx = (best.x - M.x) / bd, dz = (best.z - M.z) / bd;
    const ex = best.x - dx * (best.r + 6), ez = best.z - dz * (best.r + 6);
    if (groundH(ex, ez) < 1) continue;
    addZipline(top.x + dx * 3, top.y, top.z + dz * 3, ex, groundH(ex, ez) + 4.5, ez);
  }
}
function nearestZip(c, maxD) {
  let best = null, bd = maxD;
  for (const z of ZIPS) for (const end of [0, 1]) {
    const e = end ? z.b : z.a, d = Math.hypot(e.x - c.pos.x, e.z - c.pos.z);
    if (d < bd && Math.abs(e.y - 3.6 - c.pos.y) < 3) { bd = d; best = { zip: z, end }; }
  }
  return best;
}
function startZip(c, zz) {
  c.zip = { z: zz.zip, t: zz.end ? 1 : 0, dir: zz.end ? -1 : 1, v: 4 };
  c.mode = 'ground'; c.vel.set(0, 0, 0); c.sliding = false; setCrouch(c, false);
  if (c.isPlayer) SFX.click();
}
function updateZip(c, dt, jump) {
  const Z = c.zip, z = Z.z;
  const down = (z.b.y - z.a.y) * Z.dir < 0;
  Z.v = Math.min(down ? 22 : 13, Z.v + dt * (down ? 9 : 6));
  Z.t += Z.dir * Z.v * dt / z.len;
  const t = clamp(Z.t, 0, 1), sag = Math.sin(Math.PI * t) * z.len * 0.035;
  c.pos.set(lerp(z.a.x, z.b.x, t), lerp(z.a.y, z.b.y, t) - sag - 2.35, lerp(z.a.z, z.b.z, t));
  const dx = (z.b.x - z.a.x) * Z.dir, dz = (z.b.z - z.a.z) * Z.dir;
  c.modelYaw = Math.atan2(-dx, -dz);
  if (Math.random() < dt * 25) FX.emitA(c.pos.x, c.pos.y + 2.35, c.pos.z, mr(-1, 1), mr(-1, 0.5), mr(-1, 1), 0.2, 0.12, 0.02, 1, 0.8, 0.4, 1, -9, 0);
  if (jump || Z.t <= 0 || Z.t >= 1) {
    const L = Math.hypot(dx, dz) || 1;
    c.vel.set(dx / L * Z.v * 0.7, jump ? 7 : 2, dz / L * Z.v * 0.7);
    c.zip = null; c.grounded = false;
  }
}
// ---------- snowfall around the camera in the snow biome ----------
const SNOWFALL = (() => {
  let pts = null, pos = null, N = 900; const R = 26, H = 18;
  function init() {
    const g = new THREE.BufferGeometry(); pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = mr(-R, R); pos[i * 3 + 1] = mr(0, H); pos[i * 3 + 2] = mr(-R, R); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0, depthWrite: false, fog: true });
    m.userData.keep = true;
    pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  }
  let amt = 0;
  function update(dt, cx, cy, cz) {
    if (!pts) return;
    const b = biomeAt(cx, cz, groundH(cx, cz));
    amt += ((GAME.state === 'menu' ? 0 : b.snow) - amt) * Math.min(1, dt * 1.5);
    pts.material.opacity = amt * 0.9; pts.visible = amt > 0.02;
    if (!pts.visible) return;
    pts.position.set(cx, cy - H * 0.5, cz);
    const t = UTIME.value;
    for (let i = 0; i < N; i++) {
      let y = pos[i * 3 + 1] - dt * (1.2 + (i % 7) * 0.12);
      if (y < 0) { y += H; pos[i * 3] = mr(-R, R); pos[i * 3 + 2] = mr(-R, R); }
      pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.4;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }
  return { init, update };
})();
function updateWorldFx(dt) {
  if (WORLD.beam) { WORLD.beam.rotation.y += dt * 0.6; WORLD.beam.material.opacity = ENVSTATE.tod === 'dusk' ? 0.24 : ENVSTATE.weather === 'rain' ? 0.14 : 0.05; }
  if (WORLD.smoke && camera) for (const s of WORLD.smoke) if (Math.random() < dt * 5 && camera.position.distanceToSquared(_tmpV.set(s.x, s.y, s.z)) < 250000) FX.emitN(s.x + mr(-0.5, 0.5), s.y, s.z + mr(-0.5, 0.5), mr(0.5, 1.5), mr(1.5, 2.5), mr(-0.3, 0.3), 6, 1.5, 7, 0.55, 0.55, 0.57, 0.5, 0.1, 0.2);
}
const _tmpCol = new THREE.Color();
