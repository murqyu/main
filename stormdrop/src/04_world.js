// ---------- world: collision grid, raycasts, terrain, map generation ----------
const CELL = 5, LVL = 4, STEP = 0.6, GRAV = 24;
const WORLD = { half: 500, seg: 200, step: 5, N: 201, heights: null, pois: [], footprints: [], mapRects: [], lootSpots: [], trees: [], statics: [], mapCanvas: null, islandR: 360, mountains: [], sunDir: null };
let scene, camera, renderer, sun, hemi, worldGroup = null, skyMesh, waterMesh, cloudGroup;
const colliders = new Set();
const GRID = { cs: 8, min: -520, n: 130, cells: null };
let qstamp = 1, rstamp = 1;
const VEG = {};

function gridInit() {
  GRID.cells = new Array(GRID.n * GRID.n);
  for (let i = 0; i < GRID.cells.length; i++) GRID.cells[i] = [];
  colliders.clear();
}
function gi(v) { return clamp(Math.floor((v - GRID.min) / GRID.cs), 0, GRID.n - 1); }
function addCollider(c) {
  c.alive = true; c._q = 0; c._r = 0;
  const x0 = gi(c.minX), x1 = gi(c.maxX), z0 = gi(c.minZ), z1 = gi(c.maxZ);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) GRID.cells[z * GRID.n + x].push(c);
  colliders.add(c);
  return c;
}
function removeCollider(c) {
  if (!c.alive) return;
  c.alive = false;
  const x0 = gi(c.minX), x1 = gi(c.maxX), z0 = gi(c.minZ), z1 = gi(c.maxZ);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const cell = GRID.cells[z * GRID.n + x]; const k = cell.indexOf(c);
    if (k >= 0) { cell[k] = cell[cell.length - 1]; cell.pop(); }
  }
  colliders.delete(c);
}
function queryBox(minX, minZ, maxX, maxZ, out) {
  out.length = 0; const q = ++qstamp;
  const x0 = gi(minX), x1 = gi(maxX), z0 = gi(minZ), z1 = gi(maxZ);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const cell = GRID.cells[z * GRID.n + x];
    for (let i = 0; i < cell.length; i++) {
      const c = cell[i]; if (c._q === q) continue; c._q = q;
      if (c.maxX >= minX && c.minX <= maxX && c.maxZ >= minZ && c.minZ <= maxZ) out.push(c);
    }
  }
  return out;
}
function boxCollider(minX, minY, minZ, maxX, maxY, maxZ, props) {
  const c = { shape: 'box', minX, minY, minZ, maxX, maxY, maxZ, hp: Infinity, maxHp: Infinity, harvest: null, kind: 'static', mesh: null };
  Object.assign(c, props);
  return addCollider(c);
}
function setupRampPlane(c) {
  const w = (c.dir === 0 || c.dir === 2) ? (c.maxX - c.minX) : (c.maxZ - c.minZ);
  const k = (c.y1 - c.y0) / w; c.Bx = 0; c.Bz = 0;
  if (c.dir === 0) { c.Bx = k; c.A = c.y0 - k * c.minX; }
  else if (c.dir === 2) { c.Bx = -k; c.A = c.y0 + k * c.maxX; }
  else if (c.dir === 1) { c.Bz = k; c.A = c.y0 - k * c.minZ; }
  else { c.Bz = -k; c.A = c.y0 + k * c.maxZ; }
}
function rampCollider(minX, minZ, maxX, maxZ, y0, y1, dir, props) {
  const c = { shape: 'ramp', minX, minZ, maxX, maxZ, minY: y0 - 0.35, maxY: y1, y0, y1, dir, hp: Infinity, maxHp: Infinity, harvest: null, kind: 'static', mesh: null };
  setupRampPlane(c); Object.assign(c, props);
  return addCollider(c);
}
function rampH(c, x, z) { return clamp(c.A + c.Bx * x + c.Bz * z, c.y0, c.y1); }
function coneH(c, x, z) {
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, hw = (c.maxX - c.minX) / 2;
  const m = Math.max(Math.abs(x - cx), Math.abs(z - cz)) / hw;
  return c.y0 + (c.y1 - c.y0) * (1 - clamp(m, 0, 1));
}
function surfH(c, x, z) { return c.shape === 'box' ? c.maxY : c.shape === 'ramp' ? rampH(c, x, z) : coneH(c, x, z); }

// ---------- terrain height ----------
function groundH(x, z) {
  const fx = (x + WORLD.half) / WORLD.step, fz = (z + WORLD.half) / WORLD.step;
  if (fx < 0 || fz < 0 || fx >= WORLD.seg || fz >= WORLD.seg) return -8;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, N = WORLD.N, H = WORLD.heights;
  const h00 = H[iz * N + ix], h10 = H[iz * N + ix + 1], h01 = H[(iz + 1) * N + ix], h11 = H[(iz + 1) * N + ix + 1];
  if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
  return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}
const walkH = (x, z) => Math.max(groundH(x, z), -1.0);   // shallow water floor
const _qs = [];
function surfaceBelow(x, y, z) {
  let best = walkH(x, z);
  queryBox(x - 0.05, z - 0.05, x + 0.05, z + 0.05, _qs);
  for (const c of _qs) {
    if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
    const h = surfH(c, x, z);
    if (h <= y + 0.35 && h > best) best = h;
  }
  return best;
}

// ---------- raycasts ----------
const _rb = { nx: 0, ny: 0, nz: 0, tmax: 0 };
function rayBox(ox, oy, oz, dx, dy, dz, c, maxT, skipInside) {
  let tmin = -Infinity, tmax = Infinity, ax = -1, sg = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < c.minX || ox > c.maxX) return -1; }
  else { const inv = 1 / dx; let t1 = (c.minX - ox) * inv, t2 = (c.maxX - ox) * inv, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; ax = 0; sg = s; } if (t2 < tmax) tmax = t2; }
  if (Math.abs(dy) < 1e-9) { if (oy < c.minY || oy > c.maxY) return -1; }
  else { const inv = 1 / dy; let t1 = (c.minY - oy) * inv, t2 = (c.maxY - oy) * inv, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; ax = 1; sg = s; } if (t2 < tmax) tmax = t2; }
  if (Math.abs(dz) < 1e-9) { if (oz < c.minZ || oz > c.maxZ) return -1; }
  else { const inv = 1 / dz; let t1 = (c.minZ - oz) * inv, t2 = (c.maxZ - oz) * inv, s = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; } if (t1 > tmin) { tmin = t1; ax = 2; sg = s; } if (t2 < tmax) tmax = t2; }
  if (tmax < tmin || tmax < 0) return -1;
  _rb.tmax = tmax;
  if (tmin < 0) { if (skipInside) return -1; _rb.nx = -dx; _rb.ny = -dy; _rb.nz = -dz; return 0; }
  if (tmin > maxT) return -1;
  _rb.nx = ax === 0 ? sg : 0; _rb.ny = ax === 1 ? sg : 0; _rb.nz = ax === 2 ? sg : 0;
  return tmin;
}
function rayRamp(ox, oy, oz, dx, dy, dz, c, maxT) {
  const den = dy - c.Bx * dx - c.Bz * dz; if (Math.abs(den) < 1e-9) return -1;
  const t = (c.A + c.Bx * ox + c.Bz * oz - oy) / den; if (t < 0 || t > maxT) return -1;
  const x = ox + dx * t, z = oz + dz * t;
  if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) return -1;
  let nx = -c.Bx, ny = 1, nz = -c.Bz; const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
  if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz; }
  _rb.nx = nx; _rb.ny = ny; _rb.nz = nz; return t;
}
const _coneBox = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
function rayCone(ox, oy, oz, dx, dy, dz, c, maxT) {
  _coneBox.minX = c.minX; _coneBox.maxX = c.maxX; _coneBox.minZ = c.minZ; _coneBox.maxZ = c.maxZ; _coneBox.minY = c.y0; _coneBox.maxY = c.y1;
  let t0 = rayBox(ox, oy, oz, dx, dy, dz, _coneBox, maxT, false); if (t0 < 0) return -1;
  const t1 = Math.min(maxT, _rb.tmax);
  const below = (t) => (oy + dy * t) <= coneH(c, ox + dx * t, oz + dz * t);
  if (below(t0)) { _rb.nx = 0; _rb.ny = 1; _rb.nz = 0; return t0; }
  let prev = t0;
  for (let i = 1; i <= 10; i++) {
    const t = t0 + (t1 - t0) * i / 10;
    if (below(t)) { let lo = prev, hi = t; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (below(m)) hi = m; else lo = m; } _rb.nx = 0; _rb.ny = 1; _rb.nz = 0; return hi; }
    prev = t;
  }
  return -1;
}
function rayTerrain(ox, oy, oz, dx, dy, dz, maxT) {
  if (oy > 58 && dy >= 0) return -1;
  let prevT = 0;
  if (oy - groundH(ox, oz) < 0) return 0;
  let t = 0;
  while (t < maxT) {
    t = Math.min(maxT, t + 1.2 + t * 0.012);
    const y = oy + dy * t;
    if (y > 60 && dy >= 0) return -1;
    if (y - groundH(ox + dx * t, oz + dz * t) < 0) {
      let a = prevT, b = t;
      for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if ((oy + dy * m) - groundH(ox + dx * m, oz + dz * m) < 0) b = m; else a = m; }
      return b;
    }
    prevT = t;
  }
  return -1;
}
const RH = { t: 0, c: null, nx: 0, ny: 0, nz: 0, terrain: false };
function raycastWorld(ox, oy, oz, dx, dy, dz, maxT, skipInside, ignoreC) {
  RH.c = null; RH.terrain = false;
  let best = maxT, bnx = 0, bny = 0, bnz = 0;
  const rs = ++rstamp, cs = GRID.cs, n = GRID.n;
  const fx = (ox - GRID.min) / cs, fz = (oz - GRID.min) / cs;
  let ix = Math.floor(fx), iz = Math.floor(fz);
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const adx = Math.abs(dx), adz = Math.abs(dz);
  const tdx = adx > 1e-9 ? cs / adx : Infinity, tdz = adz > 1e-9 ? cs / adz : Infinity;
  let tmx = adx > 1e-9 ? ((dx > 0 ? (ix + 1 - fx) : (fx - ix)) * cs) / adx : Infinity;
  let tmz = adz > 1e-9 ? ((dz > 0 ? (iz + 1 - fz) : (fz - iz)) * cs) / adz : Infinity;
  let tEnter = 0, guard = 0;
  while (tEnter <= best && guard++ < 420) {
    if (ix >= 0 && iz >= 0 && ix < n && iz < n) {
      const cell = GRID.cells[iz * n + ix];
      for (let i = 0; i < cell.length; i++) {
        const c = cell[i]; if (c._r === rs) continue; c._r = rs;
        if (c === ignoreC) continue;
        let t;
        if (c.shape === 'box') t = rayBox(ox, oy, oz, dx, dy, dz, c, best, skipInside);
        else if (c.shape === 'ramp') t = rayRamp(ox, oy, oz, dx, dy, dz, c, best);
        else t = rayCone(ox, oy, oz, dx, dy, dz, c, best);
        if (t >= 0 && t < best) { best = t; RH.c = c; bnx = _rb.nx; bny = _rb.ny; bnz = _rb.nz; }
      }
    } else if ((ix < 0 && sx < 0) || (ix >= n && sx > 0) || (iz < 0 && sz < 0) || (iz >= n && sz > 0)) break;
    if (tmx < tmz) { tEnter = tmx; tmx += tdx; ix += sx; } else { tEnter = tmz; tmz += tdz; iz += sz; }
  }
  const tt = rayTerrain(ox, oy, oz, dx, dy, dz, best);
  if (tt >= 0 && tt < best) { best = tt; RH.c = null; RH.terrain = true; bnx = 0; bny = 1; bnz = 0; }
  RH.t = best; RH.nx = bnx; RH.ny = bny; RH.nz = bnz;
  return RH;
}

// ---------- terrain generation ----------
const POI_NAMES = { city: ['Neon Heights'], town: ['Maple Row', 'Cedar Court', 'Brookside'], farm: ['Haystack Farm'], docks: ['Port Brine'], quarry: ['Gravel Pit'], cabins: ['Pine Hollow'], lighthouse: ['Gull Point'], vault: ['The Vault'], factory: ['Ironworks'] };
function genTerrain(seed) {
  const rng = mulberry32(seed * 7 + 3);
  const P = makePerlin(rng), P2 = makePerlin(rng);
  WORLD.perlin = P;
  WORLD.mountains = [];
  for (let i = 0; i < 3; i++) { const a = rng() * TAU, d = 110 + rng() * 160; if (WORLD.mountains.some((M) => Math.hypot(M.x - Math.cos(a) * d, M.z - Math.sin(a) * d) < 150)) { i--; continue; } WORLD.mountains.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 64 + rng() * 34, h: 22 + rng() * 14 }); }
  setupBiomes(rng);
  const raw = (x, z) => {
    const d = Math.sqrt(x * x + z * z), ang = Math.atan2(z, x);
    const coast = WORLD.islandR + P(Math.cos(ang) * 1.3 + 7.1, Math.sin(ang) * 1.3 + 3.3) * 95 + P(x * 0.012 + 40, z * 0.012) * 26;
    const m = smoothstep(0, 60, coast - d);
    let h = 3.4 + fbm(P2, x * 0.0055, z * 0.0055, 4) * 11;
    for (const M of WORLD.mountains) { const md = Math.hypot(x - M.x, z - M.z); if (md < M.r) { const t = 1 - md / M.r; h += M.h * t * t * (3 - 2 * t) * (0.8 + 0.25 * P(x * 0.03, z * 0.03)); } }
    h = Math.max(h, 1.6);
    return lerp(-7, h, m);
  };
  WORLD.raw = raw;
  WORLD.pois = [];
  pickPOIs(rng, raw);
  const N = WORLD.N, H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = finalH(-WORLD.half + i * WORLD.step, -WORLD.half + j * WORLD.step);
  WORLD.heights = H;
}
function finalH(x, z) {
  let h = WORLD.raw(x, z);
  for (const p of WORLD.pois) { const d = Math.hypot(x - p.x, z - p.z); const w = 1 - smoothstep(p.r, p.r + 28, d); if (w > 0) h = lerp(h, p.h, w); }
  return h;
}
function pickPOIs(rng, raw) {
  pickBiomePOIs(rng, raw);
  const types = ['city', 'docks', 'lighthouse', 'vault', 'factory', 'town', 'farm', 'quarry', 'town', 'cabins', 'town'];
  const used = {};
  for (const type of types) {
    const r = type === 'city' ? 56 : type === 'docks' ? 38 : type === 'lighthouse' ? 26 : type === 'vault' ? 30 : type === 'factory' ? 46 : 44;
    const coastal = type === 'docks' || type === 'lighthouse';
    for (let tries = 0; tries < 500; tries++) {
      let x, z, sea = 0;
      if (coastal) {
        sea = rng() * TAU; let d = 470;
        for (; d > 100; d -= 4) if (raw(Math.cos(sea) * d, Math.sin(sea) * d) > 1.8) break;
        d -= 20; x = Math.cos(sea) * d; z = Math.sin(sea) * d;
      } else { const a = rng() * TAU, d = Math.sqrt(rng()) * 290; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      const h = raw(x, z);
      if (h < 1.9 || h > 13) continue;
      const bw = biomeAt(x, z); if ((type === 'farm' || type === 'town') && (bw.desert > 0.4 || bw.snow > 0.5)) continue;
      let ok = true;
      for (const p of WORLD.pois) if (Math.hypot(p.x - x, p.z - z) < p.r + r + 50) { ok = false; break; }
      if (ok) for (const M of WORLD.mountains) if (Math.hypot(M.x - x, M.z - z) < M.r * 0.75 + r) { ok = false; break; }
      if (!ok) continue;
      let mn = 99, mx = -99;
      for (let k = 0; k < 8; k++) { const a2 = k / 8 * TAU; const hh = raw(x + Math.cos(a2) * r * 0.85, z + Math.sin(a2) * r * 0.85); mn = Math.min(mn, hh); mx = Math.max(mx, hh); }
      if (!coastal && mn < 1.4) continue;
      const names = POI_NAMES[type]; const idx = used[type] || 0; used[type] = idx + 1;
      WORLD.pois.push({ type, name: names[idx % names.length], x, z, r, sea, h: coastal ? 2.4 : Math.max(2.4, (h * 2 + mn + mx) / 4) });
      break;
    }
  }
}
const _tc = [0, 0, 0], _ts = [1, 0, 0, 0];
function terrainColor(x, z, h, ny) {
  const P = WORLD.perlin;
  const n = P(x * 0.018, z * 0.018) * 0.5 + 0.5, n2 = P(x * 0.06 + 11, z * 0.06 - 4) * 0.5 + 0.5;
  let r, g, b, sg = 1, sdirt = 0, ssand = 0, srock = 0;
  if (h < 0.4) { r = 0.80; g = 0.72; b = 0.50; sg = 0; ssand = 1; }
  else if (h < 2.1) { const t = smoothstep(1.5, 2.1, h); r = lerp(0.9, 0.46, t); g = lerp(0.8, 0.76, t); b = lerp(0.55, 0.30, t); sg = t; ssand = 1 - t; }
  else {
    r = lerp(0.46, 0.32, n); g = lerp(0.79, 0.63, n); b = lerp(0.30, 0.21, n);
    const dry = smoothstep(0.62, 0.84, n2) * 0.7; r = lerp(r, 0.72, dry); g = lerp(g, 0.75, dry); b = lerp(b, 0.34, dry);
    sdirt = dry * 0.6; sg = 1 - sdirt;
  }
  const bio = biomeAt(x, z, h);
  if (bio.desert > 0 && h >= 0.4) {
    const dune = P(x * 0.03 + 5, z * 0.012) * 0.5 + 0.5, k = bio.desert;
    r = lerp(r, lerp(0.88, 0.8, dune), k); g = lerp(g, lerp(0.72, 0.6, dune), k); b = lerp(b, lerp(0.5, 0.4, dune), k);
    ssand = lerp(ssand, 1, k); sg *= 1 - k; sdirt *= 1 - k;
  }
  if (bio.snow > 0 && h >= 0.4) {
    const k = bio.snow, sp = n2 * 0.04;
    r = lerp(r, 0.9 + sp, k); g = lerp(g, 0.93 + sp, k); b = lerp(b, 0.98, k);
    ssand = lerp(ssand, 0.8, k); sg *= 1 - k; sdirt *= 1 - k;
  }
  const rock = smoothstep(0.86, 0.72, ny);
  if (rock > 0) { r = lerp(r, 0.57, rock); g = lerp(g, 0.57, rock); b = lerp(b, 0.56, rock); sg *= 1 - rock; sdirt *= 1 - rock; ssand *= 1 - rock; srock = rock; }
  for (const p of WORLD.pois) {
    if (p.type === 'lighthouse') continue;
    const d = Math.hypot(x - p.x, z - p.z); const w = 1 - smoothstep(p.r - 6, p.r + 4, d); if (w <= 0) continue;
    let pr, pg, pb, pgr = 0, pd = 1;
    if (p.type === 'city') {
      pr = 0.40; pg = 0.41; pb = 0.44;
      const lx = (((x - p.x) % 24) + 24) % 24, lz = (((z - p.z) % 24) + 24) % 24;
      if (lx < 3 || lz < 3) { pr = 0.30; pg = 0.31; pb = 0.34; }
    } else if (p.type === 'farm') { const row = Math.sin((x - p.x) * 0.9) > 0; pr = row ? 0.56 : 0.48; pg = row ? 0.43 : 0.68; pb = row ? 0.27 : 0.25; pgr = row ? 0 : 1; pd = row ? 1 : 0; }
    else if (p.type === 'docks') { pr = 0.62; pg = 0.63; pb = 0.64; }
    else if (p.type === 'quarry') { pr = 0.68; pg = 0.62; pb = 0.53; }
    else if (p.type === 'town') { pr = lerp(0.52, 0.42, n); pg = lerp(0.74, 0.63, n); pb = 0.33; pgr = 1; pd = 0; }
    else if (p.type === 'lodge') { pr = 0.9; pg = 0.92; pb = 0.96; pgr = 0; pd = 0.3; }
    else if (p.type === 'outpost') { pr = 0.82; pg = 0.66; pb = 0.45; pgr = 0; pd = 1; }
    else if (p.type === 'factory' || p.type === 'vault') { pr = 0.46; pg = 0.46; pb = 0.47; pgr = 0; pd = 1; }
    else { pr = 0.40; pg = 0.58; pb = 0.27; pgr = 1; pd = 0; }
    r = lerp(r, pr, w); g = lerp(g, pg, w); b = lerp(b, pb, w);
    sg = lerp(sg, pgr, w); sdirt = lerp(sdirt, pd, w); ssand *= 1 - w; srock *= 1 - w * 0.8;
  }
  _tc[0] = r * 1.02; _tc[1] = g * 1.02; _tc[2] = b * 1.02;
  _ts[0] = sg; _ts[1] = sdirt; _ts[2] = ssand; _ts[3] = srock;
  return _tc;
}
function buildTerrainMesh() {
  const N = WORLD.N, S = WORLD.step, half = WORLD.half, H = WORLD.heights;
  const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), col = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    pos[k * 3] = -half + i * S; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = -half + j * S;
    uv[k * 2] = i / (N - 1); uv[k * 2 + 1] = 1 - j / (N - 1);
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal.array, spl = new Float32Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const c = terrainColor(pos[k * 3], pos[k * 3 + 2], pos[k * 3 + 1], nrm[k * 3 + 1]);
    col[k * 3] = Math.pow(c[0], 2.2); col[k * 3 + 1] = Math.pow(c[1], 2.2); col[k * 3 + 2] = Math.pow(c[2], 2.2);
    spl[k * 4] = _ts[0]; spl[k * 4 + 1] = _ts[1]; spl[k * 4 + 2] = _ts[2]; spl[k * 4 + 3] = _ts[3];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  WORLD.tintArr = col; WORLD.splatArr = spl;
  if (!WORLD.terrainMat) { WORLD.terrainMat = makeTerrainMaterial(); WORLD.terrainMat.userData.keep = true; }
  const mesh = new THREE.Mesh(geo, WORLD.terrainMat);
  mesh.receiveShadow = true;
  worldGroup.add(mesh);
}

// ---------- sky, water, clouds (built once) ----------
function makeEnvironment() {
  WORLD.sunDir = new V3(0.45, 0.8, 0.3).normalize();
  makeSkyAndEnv(); makeWater(); RAIN.init(); SNOWFALL.init();
  cloudGroup = new THREE.Group();
  const cg = new THREE.IcosahedronGeometry(1, 1), cm = ENVSTATE.cloudMat;
  for (let i = 0; i < 26; i++) {
    const cl = new THREE.Group(); const n = 4 + (Math.random() * 4 | 0);
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(cg, cm); const s = 8 + Math.random() * 13; m.scale.set(s * 1.4, s * 0.65, s); m.position.set((k - n / 2) * 12 + Math.random() * 6, Math.random() * 5, Math.random() * 14 - 7); cl.add(m); }
    cl.position.set(Math.random() * 1400 - 700, 150 + Math.random() * 90, Math.random() * 1400 - 700);
    cl.userData.v = 1.5 + Math.random() * 2.5; cloudGroup.add(cl);
  }
  scene.add(cloudGroup);
  VEG.trunk = keepGeo(new THREE.CylinderGeometry(0.22, 0.34, 1, 6).translate(0, 0.5, 0));
  VEG.cone = keepGeo(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0));
  VEG.blob = keepGeo(new THREE.IcosahedronGeometry(1, 0));
  VEG.rock = keepGeo(new THREE.DodecahedronGeometry(1, 0));
  VEG.bush = keepGeo(new THREE.IcosahedronGeometry(1, 0));
  // cactus: trunk + two arms merged into one geometry
  const parts = [];
  const cyl = (r, h, x, y, z, rz) => { const g = new THREE.CylinderGeometry(r, r * 1.05, h, 7).toNonIndexed(); g.rotateZ(rz || 0); g.translate(x, y, z); parts.push(g); };
  cyl(0.32, 3.2, 0, 1.6, 0); cyl(0.2, 0.9, 0.5, 1.3, 0, Math.PI / 2); cyl(0.2, 1.1, 0.85, 1.85, 0); cyl(0.18, 0.7, -0.42, 1.9, 0, Math.PI / 2); cyl(0.18, 0.8, -0.7, 2.25, 0);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  VEG.cactus = new THREE.BufferGeometry(); VEG.cactus.setAttribute('position', new THREE.BufferAttribute(P, 3)); VEG.cactus.setAttribute('normal', new THREE.BufferAttribute(N, 3)); keepGeo(VEG.cactus);
  MAT.cactus = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }), 0.03, 3); MAT.cactus.userData.keep = true;
}

// ---------- structures ----------
const HOUSE_COLORS = [0xf2e6c9, 0xcfe3f0, 0xf3d1c7, 0xd8ecd0, 0xf7ecb5, 0xe0d7f2, 0xffffff];
const STYLE = {
  house: { fh: 4, win: 0.4, hp: 170, harvest: 'wood', roof: 'gable' },
  tower: { fh: 4, win: 0.55, hp: 260, harvest: 'stone', roof: 'flat' },
  barn: { fh: 4.5, win: 0.12, hp: 170, harvest: 'wood', roof: 'gable' },
  warehouse: { fh: 6, win: 0, hp: 380, harvest: 'metal', roof: 'flat' },
  shack: { fh: 4, win: 0.35, hp: 150, harvest: 'wood', roof: 'gable' },
  store: { fh: 4.5, win: 0.5, hp: 240, harvest: 'stone', roof: 'flat' },
  lodge: { fh: 4.2, win: 0.45, hp: 200, harvest: 'wood', roof: 'gable', roofHex: 0xeef3f8, wall: (h) => woodMat(h) },
  saloon: { fh: 4.4, win: 0.4, hp: 180, harvest: 'wood', roof: 'flat', wall: (h) => woodMat(h) },
  bunker: { fh: 5, win: 0, hp: 900, harvest: 'stone', roof: 'flat', wall: (h) => concreteMat(h) },
};
function overlapsFootprint(x0, z0, x1, z1, pad) { for (const f of WORLD.footprints) if (x0 - pad < f[2] && x1 + pad > f[0] && z0 - pad < f[3] && z1 + pad > f[1]) return true; return false; }
function addFootprint(x0, z0, x1, z1, map) { WORLD.footprints.push([x0, z0, x1, z1]); if (map) WORLD.mapRects.push([x0, z0, x1, z1]); }
function addMesh(m) { m.castShadow = true; m.receiveShadow = true; worldGroup.add(m); WORLD.statics.push(m); return m; }
// Static props are merged into one mesh per material per "assembly" (a building, a POI's props, a car).
const ASM = [];
function beginAsm() { ASM.push({ parts: new Map() }); }
function endAsm() { const a = ASM.pop(); for (const mat of a.parts.keys()) rebuildAsm(a, mat); return a; }
function curAsm() { return ASM.length ? ASM[ASM.length - 1] : null; }
const _am = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _ae = new THREE.Euler(), _one = new V3(1, 1, 1);
// Adds a visual piece: into the open assembly when there is one, otherwise as its own mesh.
function addVisual(geo, mat, px, py, pz, rx, ry, rz) {
  const a = curAsm();
  if (!a) { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx || 0, ry || 0, rz || 0); addMesh(m); return { mesh: m }; }
  _ae.set(rx || 0, ry || 0, rz || 0); _aq.setFromEuler(_ae);
  const part = { geo, m4: new THREE.Matrix4().compose(new V3(px, py, pz), _aq.clone(), _one), alive: true };
  let g = a.parts.get(mat); if (!g) { g = { list: [], mesh: null }; a.parts.set(mat, g); }
  g.list.push(part);
  return { asm: a, part, partMat: mat };
}
const _nm3 = new THREE.Matrix3(), _av = new V3();
function rebuildAsm(a, mat) {
  const g = a.parts.get(mat); if (!g) return;
  if (g.mesh) { worldGroup.remove(g.mesh); g.mesh.geometry.dispose(); const k = WORLD.statics.indexOf(g.mesh); if (k >= 0) WORLD.statics.splice(k, 1); g.mesh = null; }
  let nv = 0, ni = 0;
  for (const p of g.list) if (p.alive) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  if (!nv) return;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65000 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of g.list) {
    if (!p.alive) continue;
    const G = p.geo, P = G.attributes.position, N = G.attributes.normal, U = G.attributes.uv;
    _nm3.getNormalMatrix(p.m4);
    for (let i = 0; i < P.count; i++) {
      _av.fromBufferAttribute(P, i).applyMatrix4(p.m4); pos[(vo + i) * 3] = _av.x; pos[(vo + i) * 3 + 1] = _av.y; pos[(vo + i) * 3 + 2] = _av.z;
      _av.fromBufferAttribute(N, i).applyMatrix3(_nm3).normalize(); nrm[(vo + i) * 3] = _av.x; nrm[(vo + i) * 3 + 1] = _av.y; nrm[(vo + i) * 3 + 2] = _av.z;
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
    }
    if (G.index) for (let i = 0; i < G.index.count; i++) idx[io++] = G.index.getX(i) + vo;
    else for (let i = 0; i < P.count; i++) idx[io++] = vo + i;
    vo += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.userData.cx = geo.boundingSphere.center.x; m.userData.cz = geo.boundingSphere.center.z;
  addMesh(m); g.mesh = m;
}
function killAsm(a) { for (const [mat, g] of a.parts) { for (const p of g.list) p.alive = false; rebuildAsm(a, mat); } }
function addBlock(x0, y0, z0, x1, y1, z1, mat, props) {
  const v = addVisual(boxGeo(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return boxCollider(x0, y0, z0, x1, y1, z1, Object.assign(v, props));
}
function addStaticRamp(x0, z0, x1, z1, y0, y1, dir, mat, harvest, hp) {
  const c = rampCollider(x0, z0, x1, z1, y0, y1, dir, { hp: hp || 250, maxHp: hp || 250, harvest, kind: 'static' });
  const alongX = dir === 0 || dir === 2;
  const run = alongX ? x1 - x0 : z1 - z0, rise = y1 - y0, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  const v = addVisual(alongX ? boxGeo(len, 0.25, z1 - z0) : boxGeo(x1 - x0, 0.25, len), mat, (x0 + x1) / 2, (y0 + y1) / 2 - 0.125 / Math.cos(ang), (z0 + z1) / 2,
    alongX ? 0 : (dir === 1 ? -ang : ang), 0, alongX ? (dir === 0 ? ang : -ang) : 0);
  Object.assign(c, v);
  return c;
}
function gable(at, a0, a1, top, rh, atX, hex) {
  const g = new THREE.BufferGeometry(), am = (a0 + a1) / 2;
  const v = atX ? [at, top, a0, at, top, a1, at, top + rh, am] : [a0, top, at, a1, top, at, am, top + rh, at];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  g.computeVertexNormals();
  addVisual(g, lam(hex, { map: TEX.siding, side: THREE.DoubleSide }), 0, 0, 0);
}
function makeGableRoof(x0, z0, x1, z1, top, roofHex, wallHex, pitch) {
  const W = x1 - x0, D = z1 - z0, ov = 0.6, alongX = W >= D;
  const rh = ((alongX ? D : W) / 2) * pitch;
  const rm = roofMat(roofHex);
  if (alongX) {
    const zm = (z0 + z1) / 2;
    addStaticRamp(x0 - ov, z0 - ov, x1 + ov, zm, top - ov * pitch, top + rh, 1, rm, 'wood');
    addStaticRamp(x0 - ov, zm, x1 + ov, z1 + ov, top - ov * pitch, top + rh, 3, rm, 'wood');
    gable(x0, z0, z1, top, rh, true, wallHex); gable(x1, z0, z1, top, rh, true, wallHex);
  } else {
    const xm = (x0 + x1) / 2;
    addStaticRamp(x0 - ov, z0 - ov, xm, z1 + ov, top - ov * pitch, top + rh, 0, rm, 'wood');
    addStaticRamp(xm, z0 - ov, x1 + ov, z1 + ov, top - ov * pitch, top + rh, 2, rm, 'wood');
    gable(z0, x0, x1, top, rh, false, wallHex); gable(z1, x0, x1, top, rh, false, wallHex);
  }
  addBlock(x0 + 0.3, top - 0.3, z0 + 0.3, x1 - 0.3, top, z1 - 0.3, concreteMat(0xcfc8bb), { hp: 300, maxHp: 300, harvest: 'wood', kind: 'static' });
}
function interiorSpot(x0, z0, wc, dc) {
  const rows = dc > 1 ? dc - 1 : 1;
  const ci = ri(0, wc - 1), cj = ri(0, rows - 1);
  return [x0 + ci * CELL + CELL / 2 + rr(-1, 1), z0 + cj * CELL + CELL / 2 + rr(-1, 1), ri(0, 3) * Math.PI / 2];
}
function makeBuilding(cx, cz, wc, dc, floors, style, door, colorHex) {
  const S = STYLE[style];
  const W = wc * CELL, D = dc * CELL;
  const x0 = Math.round((cx - W / 2) / CELL) * CELL, z0 = Math.round((cz - D / 2) / CELL) * CELL, x1 = x0 + W, z1 = z0 + D;
  if (overlapsFootprint(x0, z0, x1, z1, 3)) return null;
  let gmin = 99, gmax = -99;
  for (const [sx, sz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) { const h = groundH(sx, sz); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); }
  if (gmin < 0.8 || gmax - gmin > 3.5) return null;
  if (floors > 1 && wc < 2) floors = 1;
  addFootprint(x0, z0, x1, z1, true);
  beginAsm();
  const base = gmax + 0.25, FH = S.fh;
  const wallMat = S.wall ? S.wall(colorHex) : style === 'tower' ? (rand() < 0.5 ? concreteMat(colorHex) : brickMat(colorHex)) : style === 'warehouse' ? metalMat(colorHex) : style === 'store' ? concreteMat(colorHex) : sidingMat(colorHex);
  addBlock(x0 - 0.3, gmin - 2.5, z0 - 0.3, x1 + 0.3, base, z1 + 0.3, concreteMat(0xb9b4aa), { kind: 'static' });
  const t = 0.3;
  const sideBox = (s, a, b, ya, yb, hpMul) => {
    const hp = S.hp * (hpMul || 1);
    const pr = { hp, maxHp: hp, harvest: S.harvest, kind: 'static' };
    if (s === 0) return addBlock(a, ya, z0, b, yb, z0 + t, wallMat, pr);
    if (s === 2) return addBlock(a, ya, z1 - t, b, yb, z1, wallMat, pr);
    if (s === 3) return addBlock(x0, ya, a, x0 + t, yb, b, wallMat, pr);
    return addBlock(x1 - t, ya, a, x1, yb, b, wallMat, pr);
  };
  for (let f = 0; f < floors; f++) {
    const y = base + f * FH;
    for (let s = 0; s < 4; s++) {
      const a0 = (s === 0 || s === 2) ? x0 : z0, cnt = (s === 0 || s === 2) ? wc : dc;
      for (let p = 0; p < cnt; p++) {
        const a = a0 + p * CELL, b = a + CELL;
        if (f === 0 && s === door && p === Math.floor(cnt / 2)) {
          const dw = style === 'warehouse' ? 3.6 : style === 'barn' ? 3.2 : 2.2, dh = style === 'warehouse' ? 4.4 : 2.9, m = (a + b) / 2;
          sideBox(s, a, m - dw / 2, y, y + FH); sideBox(s, m + dw / 2, b, y, y + FH); sideBox(s, m - dw / 2, m + dw / 2, y + dh, y + FH, 0.6);
        } else if (rand() < S.win) {
          sideBox(s, a, b, y, y + 1.1, 0.7); sideBox(s, a, b, y + 2.7, y + FH, 0.6);
        } else sideBox(s, a, b, y, y + FH);
      }
    }
    if (f > 0) {
      const holeLeft = f % 2 === 1, y2 = base + f * FH, slabMat = concreteMat(0xcfc8bb);
      const pr = () => ({ hp: 300, maxHp: 300, harvest: S.harvest, kind: 'static' });
      if (dc > 1) addBlock(x0 + t, y2 - 0.3, z0 + t, x1 - t, y2, z1 - CELL, slabMat, pr());
      if (holeLeft) addBlock(x0 + CELL, y2 - 0.3, z1 - CELL, x1 - t, y2, z1 - t, slabMat, pr());
      else addBlock(x0 + t, y2 - 0.3, z1 - CELL, x1 - CELL, y2, z1 - t, slabMat, pr());
      const hx0 = holeLeft ? x0 + t : x1 - CELL, hx1 = holeLeft ? x0 + CELL : x1 - t;
      addStaticRamp(hx0, z1 - CELL + 0.5, hx1, z1 - t, y2 - FH, y2, holeLeft ? 0 : 2, woodMat(0xffffff), S.harvest);
    }
  }
  const top = base + floors * FH;
  if (S.roof === 'flat') {
    addBlock(x0 - 0.2, top - 0.3, z0 - 0.2, x1 + 0.2, top + 0.2, z1 + 0.2, concreteMat(style === 'warehouse' ? 0x8d949c : 0xa9a49a), { hp: 400, maxHp: 400, harvest: S.harvest, kind: 'static' });
    if (style === 'tower') for (const r of [[x0, z0, x1, z0 + 0.3], [x0, z1 - 0.3, x1, z1], [x0, z0, x0 + 0.3, z1], [x1 - 0.3, z0, x1, z1]]) addBlock(r[0], top + 0.2, r[1], r[2], top + 1.1, r[3], wallMat, { hp: 150, maxHp: 150, harvest: 'stone', kind: 'static' });
  } else makeGableRoof(x0, z0, x1, z1, top, S.roofHex || (style === 'barn' ? 0x6e2a22 : null) || pick([0x8c3b2e, 0x3b5a8c, 0x4a6b3a, 0x5a4a6a, 0x7a5a2a]), colorHex, style === 'barn' ? 0.8 : 0.6);
  for (let f = 0; f < floors; f++) {
    const y = base + f * FH;
    if (rand() < (style === 'tower' ? 0.5 : 0.62)) { const s = interiorSpot(x0, z0, wc, dc); WORLD.lootSpots.push({ kind: 'chest', x: s[0], y, z: s[1], rot: s[2] }); }
    const nf = (rand() < 0.75 ? 1 : 0) + (wc * dc > 6 ? 1 : 0);
    for (let k = 0; k < nf; k++) { const s = interiorSpot(x0, z0, wc, dc); WORLD.lootSpots.push({ kind: 'floor', x: s[0], y, z: s[1] }); }
  }
  if (style === 'tower' && rand() < 0.5) WORLD.lootSpots.push({ kind: 'chest', x: (x0 + x1) / 2, y: top + 0.2, z: (z0 + z1) / 2, rot: 0 });
  endAsm();
  return { x0, z0, x1, z1, base, top };
}
function propBox(x, z, w, h, d, mat, harvest, hp, kind) {
  const y = groundH(x, z);
  if (overlapsFootprint(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.6)) return null;
  addFootprint(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  return addBlock(x - w / 2, y - 0.3, z - d / 2, x + w / 2, y + h, z + d / 2, mat, { hp, maxHp: hp, harvest, kind: kind || 'static' });
}
function carAt(x, z) {
  const rotX = rand() < 0.5, w = rotX ? 4.2 : 2.0, d = rotX ? 2.0 : 4.2;
  if (overlapsFootprint(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 1)) return;
  const y = groundH(x, z); if (y < 1) return;
  addFootprint(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  const col = pick([0xd8433a, 0x3a7bd8, 0xf2c230, 0xeeeeee, 0x2f9e5e, 0x333a44, 0xe07a2e]);
  const ry = rotX ? Math.PI / 2 : 0, cr = Math.cos(ry), sr = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * cr + lz * sr, y + ly, z - lx * sr + lz * cr];
  beginAsm();
  addVisual(boxGeo(2, 0.9, 4.2), lam(col), ...P(0, 0.75, 0), 0, ry, 0);
  addVisual(boxGeo(1.8, 0.75, 2.2), lam(0x9fc6e6), ...P(0, 1.55, -0.2), 0, ry, 0);
  addVisual(boxGeo(1.84, 0.12, 2.0), lam(col), ...P(0, 1.95, -0.2), 0, ry, 0);
  for (const [wx, wz] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) addVisual(boxGeo(0.3, 0.7, 0.7), lam(0x1d1f24), ...P(wx, 0.35, wz), 0, ry, 0);
  const a = endAsm();
  boxCollider(x - w / 2, y - 0.2, z - d / 2, x + w / 2, y + 2, z + d / 2, { asm: a, asmAll: true, hp: 300, maxHp: 300, harvest: 'metal', kind: 'static' });
}
function gasStation(x, z) {
  const b = makeBuilding(x, z, 2, 2, 1, 'store', 0, 0xe8e2d6); if (!b) return;
  const cx = (b.x0 + b.x1) / 2, cz = b.z0 - 7, y = groundH(cx, cz);
  if (overlapsFootprint(cx - 6, cz - 4, cx + 6, cz + 4, 0)) return;
  addFootprint(cx - 6, cz - 4, cx + 6, cz + 4, true);
  for (const [px, pz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) addBlock(cx + px - 0.25, y - 0.3, cz + pz - 0.25, cx + px + 0.25, y + 4.6, cz + pz + 0.25, metalMat(0xd8dde2), { hp: 300, maxHp: 300, harvest: 'metal', kind: 'static' });
  addBlock(cx - 6, y + 4.6, cz - 4, cx + 6, y + 5.1, cz + 4, lam(0xe0423a), { hp: 400, maxHp: 400, harvest: 'metal', kind: 'static' });
  for (const px of [-2, 2]) addBlock(cx + px - 0.4, y - 0.2, cz - 0.3, cx + px + 0.4, y + 1.6, cz + 0.3, lam(0xd8433a), { hp: 150, maxHp: 150, harvest: 'metal', kind: 'static' });
  WORLD.lootSpots.push({ kind: 'floor', x: cx, y, z: cz + 1.5 });
}
function genCity(p) {
  let made = 0;
  for (let i = 0; i < 30 && made < 6; i++) {
    const a = rand() * TAU, d = rr(0, p.r - 14);
    if (makeBuilding(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 3, 3, ri(3, 5), 'tower', ri(0, 3), pick([0xd9d4c7, 0xc9d3dc, 0xe0c9b8, 0xb9c4b0, 0xcfc2dd, 0xe8d8b0]))) made++;
  }
  for (let i = 0; i < 7; i++) carAt(p.x + rr(-0.85, 0.85) * p.r, p.z + rr(-0.85, 0.85) * p.r);
  for (let i = 0; i < 6; i++) propBox(p.x + rr(-0.8, 0.8) * p.r, p.z + rr(-0.8, 0.8) * p.r, 1.3, 1.3, 1.3, woodMat(0xffffff), 'wood', 90);
}
function doorToward(cx, cz, px, pz) { const dx = px - cx, dz = pz - cz; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0); }
function genTown(p) {
  let made = 0; const n = ri(5, 7);
  if (rand() < 0.6) gasStation(p.x + rr(-8, 8), p.z + rr(-8, 8));
  for (let i = 0; i < 50 && made < n; i++) {
    const a = rand() * TAU, d = rr(10, p.r - 6);
    const cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
    if (makeBuilding(cx, cz, ri(2, 3), ri(2, 3), rand() < 0.55 ? 2 : 1, 'house', doorToward(cx, cz, p.x, p.z), pick(HOUSE_COLORS))) made++;
  }
  for (let i = 0; i < 4; i++) carAt(p.x + rr(-0.7, 0.7) * p.r, p.z + rr(-0.7, 0.7) * p.r);
  for (let i = 0; i < 4; i++) propBox(p.x + rr(-0.8, 0.8) * p.r, p.z + rr(-0.8, 0.8) * p.r, 1.3, 1.3, 1.3, woodMat(0xffffff), 'wood', 90);
}
function genFarm(p) {
  makeBuilding(p.x, p.z, 3, 4, 2, 'barn', ri(0, 3), 0xb8392b);
  for (let i = 0; i < 12; i++) { const a = rand() * TAU, d = rr(18, p.r - 4); if (makeBuilding(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 2, 2, 2, 'house', ri(0, 3), pick(HOUSE_COLORS))) break; }
  for (let i = 0; i < 14; i++) { const a = rand() * TAU, d = rr(8, p.r); propBox(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 1.6, 1.4, 2.2, lam(0xe2c25a), 'wood', 70); }
  for (let i = 0; i < 6; i++) WORLD.lootSpots.push({ kind: 'floor', x: p.x + rr(-p.r, p.r) * 0.7, y: null, z: p.z + rr(-p.r, p.r) * 0.7 });
}
function genDocks(p) {
  const sx = Math.cos(p.sea), sz = Math.sin(p.sea);
  for (let i = 0; i < 2; i++) { const off = (i === 0 ? -1 : 1) * 14; makeBuilding(p.x - sz * off - sx * 8, p.z + sx * off - sz * 8, 4, 3, 1, 'warehouse', ri(0, 3), pick([0x6f8fa8, 0xa86f4f, 0x7a8a5a])); }
  const colors = [0xc0392b, 0x2e86c1, 0xd68910, 0x239b56, 0x7d3c98];
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU, d = rr(6, p.r - 4), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const rotX = rand() < 0.5, w = rotX ? 6.2 : 2.6, dd = rotX ? 2.6 : 6.2;
    if (overlapsFootprint(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, 1.5)) continue;
    addFootprint(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, true);
    const y = groundH(x, z); let top = y - 0.2; const stack = ri(1, 3);
    for (let k = 0; k < stack; k++) { addBlock(x - w / 2, top, z - dd / 2, x + w / 2, top + 2.7, z + dd / 2, metalMat(pick(colors)), { hp: 500, maxHp: 500, harvest: 'metal', kind: 'static' }); top += 2.7; }
    if (rand() < 0.45) WORLD.lootSpots.push({ kind: rand() < 0.5 ? 'chest' : 'floor', x, y: top, z, rot: 0 });
  }
  // pier out over the water
  let px = p.x + sx * (p.r - 6), pz = p.z + sz * (p.r - 6);
  for (let i = 0; i < 9; i++) {
    px += sx * 4.5; pz += sz * 4.5;
    if (groundH(px, pz) > 2.2) continue;
    addBlock(px - 2.5, 1.9, pz - 2.5, px + 2.5, 2.3, pz + 2.5, woodMat(0xd0b090), { hp: 200, maxHp: 200, harvest: 'wood', kind: 'static' });
    addVisual(boxGeo(0.4, 6, 0.4), lam(0x5a3c22), px, -1, pz);
    if (i === 8) WORLD.lootSpots.push({ kind: 'chest', x: px, y: 2.3, z: pz, rot: p.sea });
  }
}
function genQuarry(p) {
  for (let i = 0; i < 10; i++) { const a = rand() * TAU, d = rr(10, p.r - 6); makeBuilding(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 2, 2, 1, 'shack', ri(0, 3), 0x9a7b5a); }
  for (let i = 0; i < 10; i++) { const a = rand() * TAU, d = rr(5, p.r); propBox(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, rr(2, 3.5), rr(1.5, 3), rr(2, 3.5), concreteMat(0xbdb6aa), 'stone', 280); }
  for (let i = 0; i < 5; i++) WORLD.lootSpots.push({ kind: 'floor', x: p.x + rr(-p.r, p.r) * 0.7, y: null, z: p.z + rr(-p.r, p.r) * 0.7 });
}
function genCabins(p) {
  let made = 0;
  for (let i = 0; i < 30 && made < 5; i++) {
    const a = rand() * TAU, d = rr(6, p.r - 4), cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
    if (makeBuilding(cx, cz, 2, ri(1, 2), rand() < 0.4 ? 2 : 1, 'shack', doorToward(cx, cz, p.x, p.z), pick([0x8a5a3a, 0x6d4c33, 0xa06b45]))) made++;
  }
}
function nearPOI(x, z, pad, except) { for (const p of WORLD.pois) if (p.type !== except && Math.hypot(x - p.x, z - p.z) < p.r + pad) return true; return false; }
function genStructures() {
  for (const p of WORLD.pois) {
    beginAsm();
    if (p.type === 'city') genCity(p); else if (p.type === 'town') genTown(p); else if (p.type === 'farm') genFarm(p);
    else if (p.type === 'docks') genDocks(p); else if (p.type === 'quarry') genQuarry(p); else if (POI_GEN_EXTRA[p.type]) POI_GEN_EXTRA[p.type](p); else genCabins(p);
    endAsm();
  }
  let made = 0;
  for (let i = 0; i < 300 && made < 12; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 330, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (groundH(x, z) < 2.5 || nearPOI(x, z, 30)) continue;
    if (makeBuilding(x, z, ri(2, 3), 2, rand() < 0.5 ? 2 : 1, rand() < 0.7 ? 'house' : 'shack', ri(0, 3), pick(HOUSE_COLORS))) made++;
  }
  for (const s of WORLD.lootSpots) if (s.y === null) s.y = groundH(s.x, s.z);
  genZiplines();
}

// ---------- vegetation (instanced) ----------
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new V3(), _p4 = new V3(), _c4 = new THREE.Color();
function addPart(obj, mesh, idx, pos, quat, scale, color) {
  _m4.compose(pos, quat, scale); mesh.setMatrixAt(idx, _m4);
  if (color) mesh.setColorAt(idx, color);
  obj.parts.push({ mesh, idx, pos: pos.clone(), quat: quat.clone(), scale: scale.clone() });
}
function finishInst(mesh, shadow) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.frustumCulled = false; worldGroup.add(mesh);
}
function genVegetation() {
  const P = WORLD.perlin; const pines = [], rounds = [], rocks = [], bushes = [], cacti = [];
  for (let i = 0; i < 3200 && pines.length + rounds.length < 540; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 420, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = groundH(x, z); if (h < 2.3) continue;
    if (P(x * 0.008 + 50, z * 0.008) < -0.05 && rand() > 0.12) continue;
    if (nearPOI(x, z, 2, 'cabins')) continue;
    if (overlapsFootprint(x - 1, z - 1, x + 1, z + 1, 1.5)) continue;
    if (Math.abs(groundH(x + 1.5, z) - groundH(x - 1.5, z)) > 2.2) continue;
    const bw = biomeAt(x, z, h);
    if (bw.desert > 0.5) { if (rand() < 0.45) cacti.push({ x, z, y: h, s: rr(0.8, 1.5) }); continue; }
    (bw.snow > 0.5 || rand() < 0.6 ? pines : rounds).push({ x, z, y: h, s: rr(0.8, 1.45), snow: bw.snow });
  }
  const nT = pines.length + rounds.length;
  const trunks = new THREE.InstancedMesh(VEG.trunk, MAT.trunk, Math.max(1, nT));
  const pineM = new THREE.InstancedMesh(VEG.cone, MAT.leaf, Math.max(1, pines.length * 2));
  const roundM = new THREE.InstancedMesh(VEG.blob, MAT.leaf, Math.max(1, rounds.length));
  let ti = 0, pi = 0, oi = 0;
  const mkTree = (t, height) => {
    const tree = t.tree;
    tree.collider = boxCollider(t.x - 0.45, t.y - 0.5, t.z - 0.45, t.x + 0.45, t.y + height, t.z + 0.45, { kind: 'tree', harvest: 'wood', hp: 110 + 70 * t.s, maxHp: 110 + 70 * t.s, tree });
    WORLD.trees.push(tree);
  };
  for (const t of pines) {
    const th = 2.2 * t.s; t.tree = { kind: 'pine', x: t.x, y: t.y, z: t.z, s: t.s, parts: [], shakeT: 0, alive: true };
    _q4.setFromAxisAngle(UP, rand() * TAU);
    addPart(t.tree, trunks, ti++, _p4.set(t.x, t.y - 0.3, t.z), _q4, _s4.set(t.s, th + 0.3, t.s), null);
    _c4.setHSL(0.31 + rr(-0.03, 0.03), rr(0.42, 0.58), rr(0.25, 0.33));
    if (t.snow > 0.3) _c4.lerp(_tmpCol.setRGB(0.86, 0.92, 0.96), Math.min(0.75, t.snow * 0.8));
    _c4.convertSRGBToLinear();
    addPart(t.tree, pineM, pi++, _p4.set(t.x, t.y + th * 0.7, t.z), _q4, _s4.set(2.4 * t.s, 4.2 * t.s, 2.4 * t.s), _c4);
    addPart(t.tree, pineM, pi++, _p4.set(t.x, t.y + th * 0.7 + 2.5 * t.s, t.z), _q4, _s4.set(1.7 * t.s, 3.3 * t.s, 1.7 * t.s), _c4);
    mkTree(t, th + 5.6 * t.s);
  }
  for (const t of rounds) {
    const th = 2.6 * t.s; t.tree = { kind: 'round', x: t.x, y: t.y, z: t.z, s: t.s, parts: [], shakeT: 0, alive: true };
    _q4.setFromAxisAngle(UP, rand() * TAU);
    addPart(t.tree, trunks, ti++, _p4.set(t.x, t.y - 0.3, t.z), _q4, _s4.set(t.s, th + 0.3, t.s), null);
    _c4.setHSL(0.26 + rr(-0.04, 0.05), rr(0.45, 0.6), rr(0.3, 0.4)).convertSRGBToLinear();
    addPart(t.tree, roundM, oi++, _p4.set(t.x, t.y + th + 1.3 * t.s, t.z), _q4, _s4.set(2.6 * t.s, 2.3 * t.s, 2.6 * t.s), _c4);
    mkTree(t, th + 3.4 * t.s);
  }
  finishInst(trunks, true); finishInst(pineM, true); finishInst(roundM, true);
  // desert cacti
  if (cacti.length) {
    const cm = new THREE.InstancedMesh(VEG.cactus, MAT.cactus, cacti.length);
    cacti.forEach((t, i) => {
      t.tree = { kind: 'cactus', x: t.x, y: t.y, z: t.z, s: t.s, parts: [], shakeT: 0, alive: true };
      _q4.setFromAxisAngle(UP, rand() * TAU); _c4.setHSL(0.3 + rr(-0.03, 0.03), rr(0.35, 0.5), rr(0.28, 0.36)).convertSRGBToLinear();
      addPart(t.tree, cm, i, _p4.set(t.x, t.y - 0.2, t.z), _q4, _s4.set(t.s, t.s, t.s), _c4);
      t.tree.collider = boxCollider(t.x - 0.4 * t.s, t.y - 0.4, t.z - 0.4 * t.s, t.x + 0.4 * t.s, t.y + 3.4 * t.s, t.z + 0.4 * t.s, { kind: 'tree', harvest: 'wood', hp: 80, maxHp: 80, tree: t.tree });
      WORLD.trees.push(t.tree);
    });
    finishInst(cm, true);
  }

  for (let i = 0; i < 2400 && rocks.length < 190; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 420, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = groundH(x, z); if (h < 1.2) continue;
    let quarry = false; for (const p of WORLD.pois) if (p.type === 'quarry' && Math.hypot(x - p.x, z - p.z) < p.r + 10) quarry = true;
    if (!quarry && (nearPOI(x, z, 2) || rand() < 0.4)) continue;
    const bw = biomeAt(x, z, h), mesa = bw.desert > 0.6 && rand() < 0.22;
    const s = mesa ? rr(4, 7) : quarry ? rr(1.8, 4.2) : rr(0.7, 2.0);
    if (overlapsFootprint(x - s, z - s, x + s, z + s, 1)) continue;
    addFootprint(x - s * 0.8, z - s * 0.8, x + s * 0.8, z + s * 0.8);
    rocks.push({ x, z, y: h, s, sy: mesa ? s * rr(1.6, 2.4) : s * rr(0.55, 0.95), desert: bw.desert, snow: bw.snow });
  }
  const rockM = new THREE.InstancedMesh(VEG.rock, MAT.rock, Math.max(1, rocks.length));
  rocks.forEach((r, i) => {
    const obj = { parts: [], alive: true, shakeT: 0 };
    _q4.setFromEuler(new THREE.Euler(rr(-0.4, 0.4), rand() * TAU, rr(-0.4, 0.4)));
    const g = rr(0.5, 0.66); _c4.setRGB(g, g * rr(0.97, 1.02), g * rr(0.98, 1.06));
    if (r.desert > 0.4) _c4.setRGB(rr(0.72, 0.82), rr(0.42, 0.5), rr(0.3, 0.36)); else if (r.snow > 0.5) _c4.lerp(_tmpCol.setRGB(0.85, 0.88, 0.92), 0.5);
    _c4.convertSRGBToLinear();
    addPart(obj, rockM, i, _p4.set(r.x, r.y + r.sy * 0.3, r.z), _q4, _s4.set(r.s * rr(0.95, 1.3), r.sy, r.s * rr(0.95, 1.3)), _c4);
    boxCollider(r.x - r.s * 0.8, r.y - 0.5, r.z - r.s * 0.8, r.x + r.s * 0.8, r.y + r.sy * 1.15, r.z + r.s * 0.8, { kind: 'rock', harvest: 'stone', hp: 100 + r.s * 90, maxHp: 100 + r.s * 90, tree: obj });
  });
  finishInst(rockM, true);

  for (let i = 0; i < 1500 && bushes.length < 240; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 410, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = groundH(x, z); if (h < 2 || overlapsFootprint(x - 1, z - 1, x + 1, z + 1, 0.5)) continue;
    const bw = biomeAt(x, z, h); bushes.push({ x, z, y: h, s: rr(0.6, 1.3), desert: bw.desert, snow: bw.snow });
  }
  const bushM = new THREE.InstancedMesh(VEG.bush, MAT.bush, Math.max(1, bushes.length));
  bushes.forEach((b, i) => {
    _q4.setFromAxisAngle(UP, rand() * TAU); _c4.setHSL(0.28 + rr(-0.04, 0.04), 0.5, rr(0.28, 0.36));
    if (b.desert > 0.5) _c4.setHSL(0.09, 0.35, rr(0.32, 0.42)); else if (b.snow > 0.5) _c4.setRGB(0.88, 0.92, 0.96);
    _c4.convertSRGBToLinear();
    _m4.compose(_p4.set(b.x, b.y + b.s * 0.4, b.z), _q4, _s4.set(b.s * 1.3, b.s, b.s * 1.3)); bushM.setMatrixAt(i, _m4); bushM.setColorAt(i, _c4);
  });
  finishInst(bushM, false);
}
const _zero = new V3(0, 0, 0);
function hideInstParts(obj) { for (const p of obj.parts) { _m4.compose(p.pos, p.quat, _zero); p.mesh.setMatrixAt(p.idx, _m4); p.mesh.instanceMatrix.needsUpdate = true; } }
const SHAKING = new Set();
function updateShaking(dt) {
  for (const o of SHAKING) {
    o.shakeT -= dt;
    const k = Math.max(0, o.shakeT) / 0.35, wob = Math.sin(o.shakeT * 55) * 0.18 * k;
    for (let i = 0; i < o.parts.length; i++) {
      const p = o.parts[i];
      _p4.copy(p.pos); if (i > 0 || o.parts.length === 1) { _p4.x += wob; _p4.z += wob * 0.6; }
      _m4.compose(_p4, p.quat, p.scale); p.mesh.setMatrixAt(p.idx, _m4); p.mesh.instanceMatrix.needsUpdate = true;
    }
    if (o.shakeT <= 0) SHAKING.delete(o);
  }
}

// ---------- minimap image ----------
function buildMapCanvas() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = (px + 0.5) / S * 1000 - 500, z = (py + 0.5) / S * 1000 - 500, h = groundH(x, z);
    let r, gg, b;
    if (h < 0) { const t = clamp(-h / 7, 0, 1); r = lerp(80, 24, t); gg = lerp(178, 96, t); b = lerp(220, 166, t); }
    else {
      const col = terrainColor(x, z, h, 1); const shade = clamp(1 - (groundH(x - 2.5, z - 2.5) - h) * 0.12, 0.72, 1.25);
      r = col[0] * 215 * shade; gg = col[1] * 215 * shade; b = col[2] * 215 * shade;
    }
    const k = (py * S + px) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(246,240,228,.95)'; g.strokeStyle = 'rgba(50,40,30,.55)'; g.lineWidth = 1;
  for (const f of WORLD.mapRects) { const x0 = (f[0] + 500) / 1000 * S, y0 = (f[1] + 500) / 1000 * S, w = (f[2] - f[0]) / 1000 * S, h = (f[3] - f[1]) / 1000 * S; g.fillRect(x0, y0, w, h); g.strokeRect(x0 + 0.5, y0 + 0.5, w, h); }
  WORLD.mapCanvas = c;
}

// ---------- lifecycle ----------
function disposeWorld() {
  if (!worldGroup) return;
  worldGroup.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (!m.userData.keep) m.dispose(); }
  });
  scene.remove(worldGroup); worldGroup = null;
}
function newWorld(seed) {
  disposeWorld();
  rand = mulberry32(seed);
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  gridInit(); resetBuild(); resetItems(); resetGadgets(); VEHICLES.length = 0; SHAKING.clear(); ASM.length = 0;
  WORLD.footprints = []; WORLD.mapRects = []; WORLD.lootSpots = []; WORLD.trees = []; WORLD.statics = []; WORLD.smoke = []; WORLD.beam = null; WORLD.vault = null; WORLD.lodge = null;
  WORLD.seed = seed | 0;
  genTerrain(seed);
  buildTerrainMesh();
  buildWaterHeightTexture();
  genStructures();
  genVegetation();
  spawnLoot();
  spawnForage();
  buildMapCanvas();
  buildBlockedGrid();
  rand = Math.random;
  initGrass();
}
// 2-unit bitmap of building and prop footprints so grass never grows through floors
function buildBlockedGrid() {
  const S = 2, n = Math.ceil(WORLD.half * 2 / S), b = new Uint8Array(n * n);
  for (const f of WORLD.footprints) {
    const x0 = Math.max(0, Math.floor((f[0] + WORLD.half) / S)), x1 = Math.min(n - 1, Math.floor((f[2] + WORLD.half) / S));
    const z0 = Math.max(0, Math.floor((f[1] + WORLD.half) / S)), z1 = Math.min(n - 1, Math.floor((f[3] + WORLD.half) / S));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) b[z * n + x] = 1;
  }
  WORLD.blocked = b; WORLD.blockN = n;
}
function terrainSampleIndex(x, z) {
  const N = WORLD.N, i = clamp(Math.round((x + WORLD.half) / WORLD.step), 0, N - 1), j = clamp(Math.round((z + WORLD.half) / WORLD.step), 0, N - 1);
  return j * N + i;
}
function grassWeight(x, z) {
  if (WORLD.blocked) { const n = WORLD.blockN, bx = Math.floor((x + WORLD.half) / 2), bz = Math.floor((z + WORLD.half) / 2); if (bx >= 0 && bz >= 0 && bx < n && bz < n && WORLD.blocked[bz * n + bx]) return 0; }
  const k = terrainSampleIndex(x, z), s = WORLD.splatArr;
  if (WORLD.heights[k] < 1.7) return 0;
  return s[k * 4] / Math.max(0.001, s[k * 4] + s[k * 4 + 1] + s[k * 4 + 2] + s[k * 4 + 3]);
}
const _tt = [0, 0, 0];
function terrainTint(x, z) { const k = terrainSampleIndex(x, z), c = WORLD.tintArr; _tt[0] = c[k * 3] * 1.45; _tt[1] = c[k * 3 + 1] * 1.5; _tt[2] = c[k * 3 + 2] * 1.4; return _tt; }
let _cullT = 0;
function updateStaticCulling(dt, cx, cz) {
  _cullT -= dt; if (_cullT > 0) return; _cullT = 0.3;
  const R2 = 430 * 430;
  for (const m of WORLD.statics) { const dx = (m.userData.cx !== undefined ? m.userData.cx : m.position.x) - cx, dz = (m.userData.cz !== undefined ? m.userData.cz : m.position.z) - cz; m.visible = dx * dx + dz * dz < R2; }
}
