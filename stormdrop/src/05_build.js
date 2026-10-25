// ---------- building: walls, floors, ramps, cones on a 5-unit grid ----------
const BMAT = { wood: { hp: 150, time: 1.0, name: 'Wood' }, stone: { hp: 300, time: 1.8, name: 'Stone' }, metal: { hp: 500, time: 2.6, name: 'Metal' } };
const MAT_ORDER = ['wood', 'stone', 'metal'];
const PIECES = new Map(), EDGES = new Map();
let constructing = [], collapsing = [], popping = [];
const GEO_B = {};
const RAMP_ANG = Math.atan2(LVL, CELL);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
let ghostMesh = null;

function initBuildGeo() {
  GEO_B.wx = keepGeo(new THREE.BoxGeometry(0.3, LVL, CELL));
  GEO_B.wz = keepGeo(new THREE.BoxGeometry(CELL, LVL, 0.3));
  GEO_B.f = keepGeo(new THREE.BoxGeometry(CELL, 0.3, CELL));
  const RL = Math.hypot(CELL, LVL);
  GEO_B.rx = keepGeo(new THREE.BoxGeometry(RL, 0.3, CELL));
  GEO_B.rz = keepGeo(new THREE.BoxGeometry(CELL, 0.3, RL));
  GEO_B.c = keepGeo(new THREE.ConeGeometry(CELL / Math.SQRT2, LVL / 2, 4, 1));
  GEO_B.c.rotateY(Math.PI / 4);
  ghostMesh = new THREE.Mesh(GEO_B.wx, MAT.ghost); ghostMesh.visible = false; ghostMesh.renderOrder = 5;
  scene.add(ghostMesh);
}
function resetBuild() {
  PIECES.clear(); EDGES.clear(); constructing = []; collapsing = []; popping = [];
  if (ghostMesh) ghostMesh.visible = false;
}
function keyOf(s) { return s.t + ':' + s.ix + ':' + s.iz + ':' + s.L; }
function ek(a, b, c, d, e, f) {
  if (a < d || (a === d && (b < e || (b === e && c < f)))) return a + ',' + b + ',' + c + '|' + d + ',' + e + ',' + f;
  return d + ',' + e + ',' + f + '|' + a + ',' + b + ',' + c;
}
function pieceEdges(s) {
  const { t, ix, iz, L, d } = s, E = [];
  if (t === 'wx') E.push(ek(ix, L, iz, ix, L, iz + 1), ek(ix, L + 1, iz, ix, L + 1, iz + 1), ek(ix, L, iz, ix, L + 1, iz), ek(ix, L, iz + 1, ix, L + 1, iz + 1));
  else if (t === 'wz') E.push(ek(ix, L, iz, ix + 1, L, iz), ek(ix, L + 1, iz, ix + 1, L + 1, iz), ek(ix, L, iz, ix, L + 1, iz), ek(ix + 1, L, iz, ix + 1, L + 1, iz));
  else if (t === 'f' || t === 'c') E.push(ek(ix, L, iz, ix + 1, L, iz), ek(ix, L, iz + 1, ix + 1, L, iz + 1), ek(ix, L, iz, ix, L, iz + 1), ek(ix + 1, L, iz, ix + 1, L, iz + 1));
  else if (t === 'r') {
    if (d === 0) E.push(ek(ix, L, iz, ix, L, iz + 1), ek(ix + 1, L + 1, iz, ix + 1, L + 1, iz + 1), 's' + ek(ix, L, iz, ix + 1, L + 1, iz), 's' + ek(ix, L, iz + 1, ix + 1, L + 1, iz + 1));
    else if (d === 2) E.push(ek(ix + 1, L, iz, ix + 1, L, iz + 1), ek(ix, L + 1, iz, ix, L + 1, iz + 1), 's' + ek(ix + 1, L, iz, ix, L + 1, iz), 's' + ek(ix + 1, L, iz + 1, ix, L + 1, iz + 1));
    else if (d === 1) E.push(ek(ix, L, iz, ix + 1, L, iz), ek(ix, L + 1, iz + 1, ix + 1, L + 1, iz + 1), 's' + ek(ix, L, iz, ix, L + 1, iz + 1), 's' + ek(ix + 1, L, iz, ix + 1, L + 1, iz + 1));
    else E.push(ek(ix, L, iz + 1, ix + 1, L, iz + 1), ek(ix, L + 1, iz, ix + 1, L + 1, iz), 's' + ek(ix, L, iz + 1, ix, L + 1, iz), 's' + ek(ix + 1, L, iz + 1, ix + 1, L + 1, iz));
    if (d === 0 || d === 2) E.push(ek(ix, L, iz, ix + 1, L, iz), ek(ix, L, iz + 1, ix + 1, L, iz + 1));
    else E.push(ek(ix, L, iz, ix, L, iz + 1), ek(ix + 1, L, iz, ix + 1, L, iz + 1));
  }
  return E;
}
function pieceBounds(s) {
  const x0 = s.ix * CELL, z0 = s.iz * CELL, y0 = s.L * LVL;
  switch (s.t) {
    case 'wx': return [x0 - 0.15, y0, z0, x0 + 0.15, y0 + LVL, z0 + CELL];
    case 'wz': return [x0, y0, z0 - 0.15, x0 + CELL, y0 + LVL, z0 + 0.15];
    case 'f': return [x0, y0 - 0.3, z0, x0 + CELL, y0, z0 + CELL];
    case 'r': return [x0, y0, z0, x0 + CELL, y0 + LVL, z0 + CELL];
    default: return [x0, y0, z0, x0 + CELL, y0 + LVL / 2, z0 + CELL];
  }
}
const _gq = [];
function terrainRange(b) {
  let gmax = -Infinity, gmin = Infinity;
  const pts = [[b[0] + 0.2, b[2] + 0.2], [b[3] - 0.2, b[2] + 0.2], [b[0] + 0.2, b[5] - 0.2], [b[3] - 0.2, b[5] - 0.2], [(b[0] + b[3]) / 2, (b[2] + b[5]) / 2]];
  for (const p of pts) { const h = groundH(p[0], p[1]); gmax = Math.max(gmax, h); gmin = Math.min(gmin, h); }
  return [gmin, gmax];
}
function computeGrounded(b, t) {
  const [, gmax] = terrainRange(b);
  const wall = t === 'wx' || t === 'wz';
  if (b[1] <= gmax + (wall ? LVL - 0.4 : 1.2)) return true;
  queryBox(b[0] - 0.2, b[2] - 0.2, b[3] + 0.2, b[5] + 0.2, _gq);
  for (const c of _gq) if (c.kind === 'static' && c.shape === 'box' && c.maxY >= b[1] - 0.4 && c.minY <= b[4] + 0.2) return true;
  return false;
}
function yawDir(yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 2;
  return fz > 0 ? 1 : 3;
}
// Where a piece would go for a character looking along yaw/pitch.
function buildTarget(type, c, yaw, pitch, rot) {
  const p = c.pos, ix = Math.floor(p.x / CELL), iz = Math.floor(p.z / CELL);
  const d = yawDir(yaw), dx = DIRS[d][0], dz = DIRS[d][1];
  const gc = c.groundC, onRamp = gc && gc.piece && gc.piece.t === 'r' ? gc.piece : null;
  let L = Math.floor((p.y + 0.6) / LVL);
  if (onRamp) L = p.y > onRamp.L * LVL + LVL * 0.5 ? onRamp.L + 1 : onRamp.L;
  if (type === 'wall') {
    let Lw = Math.floor((p.y + 1.5) / LVL);
    if (pitch > 0.8) Lw += 1;
    if (d === 0) return { t: 'wx', ix: ix + 1, iz, L: Lw };
    if (d === 2) return { t: 'wx', ix, iz, L: Lw };
    if (d === 1) return { t: 'wz', ix, iz: iz + 1, L: Lw };
    return { t: 'wz', ix, iz, L: Lw };
  }
  const lookDown = pitch < -0.85;
  if (type === 'floor' || type === 'cone') {
    const t = type === 'floor' ? 'f' : 'c';
    if (pitch > 0.55) return { t, ix, iz, L: L + 1 };
    return lookDown ? { t, ix, iz, L } : { t, ix: ix + dx, iz: iz + dz, L };
  }
  // ramp
  let Lr = Math.floor((p.y + 0.6) / LVL);
  if (onRamp) Lr = (!lookDown && onRamp.d === d) ? onRamp.L + 1 : onRamp.L;
  const rd = (d + (rot || 0)) % 4;
  return lookDown ? { t: 'r', ix, iz, L: Lr, d: rd } : { t: 'r', ix: ix + dx, iz: iz + dz, L: Lr, d: rd };
}
function canPlace(s) {
  if (!s || s.L < -2 || s.L > 55) return false;
  if (PIECES.has(keyOf(s))) return false;
  if (Math.abs(s.ix * CELL) > 480 || Math.abs(s.iz * CELL) > 480) return false;
  if (computeGrounded(pieceBounds(s), s.t)) return true;
  for (const e of pieceEdges(s)) { const set = EDGES.get(e); if (set && set.size) return true; }
  return false;
}
function pieceTransform(mesh, s) {
  const x0 = s.ix * CELL, z0 = s.iz * CELL, y0 = s.L * LVL;
  mesh.rotation.set(0, 0, 0);
  if (s.t === 'wx') { mesh.geometry = GEO_B.wx; mesh.position.set(x0, y0 + LVL / 2, z0 + CELL / 2); }
  else if (s.t === 'wz') { mesh.geometry = GEO_B.wz; mesh.position.set(x0 + CELL / 2, y0 + LVL / 2, z0); }
  else if (s.t === 'f') { mesh.geometry = GEO_B.f; mesh.position.set(x0 + CELL / 2, y0 - 0.15, z0 + CELL / 2); }
  else if (s.t === 'c') { mesh.geometry = GEO_B.c; mesh.position.set(x0 + CELL / 2, y0 + LVL / 4, z0 + CELL / 2); }
  else {
    if (s.d === 0 || s.d === 2) { mesh.geometry = GEO_B.rx; mesh.rotation.z = s.d === 0 ? RAMP_ANG : -RAMP_ANG; }
    else { mesh.geometry = GEO_B.rz; mesh.rotation.x = s.d === 1 ? -RAMP_ANG : RAMP_ANG; }
    mesh.position.set(x0 + CELL / 2, y0 + LVL / 2 - 0.15 / Math.cos(RAMP_ANG), z0 + CELL / 2);
  }
}
function placePiece(s, mat, owner) {
  const key = keyOf(s), b = pieceBounds(s), M = BMAT[mat];
  const piece = { t: s.t, ix: s.ix, iz: s.iz, L: s.L, d: s.d, key, mat, maxHp: M.hp, hp: M.hp * 0.1, buildT: 0, buildTime: M.time, owner, alive: true };
  piece.grounded = computeGrounded(b, s.t);
  let col;
  const props = { kind: 'build', piece, hp: Infinity };
  if (s.t === 'r') col = rampCollider(b[0], b[2], b[3], b[5], b[1], b[4], s.d, props);
  else if (s.t === 'c') col = addCollider(Object.assign({ shape: 'cone', minX: b[0], minY: b[1], minZ: b[2], maxX: b[3], maxY: b[4], maxZ: b[5], y0: b[1], y1: b[4] }, props));
  else col = boxCollider(b[0], b[1], b[2], b[3], b[4], b[5], props);
  piece.collider = col;
  const m = new THREE.Mesh(GEO_B.f, VFX.holoMaterial(mat));
  piece.b = b;
  pieceTransform(m, s);
  if (s.t === 'wx' || s.t === 'wz') {
    // on uneven ground a wall reaches down to the terrain so there is no gap under it
    const gmin = terrainRange(b)[0];
    if (gmin < b[1] - 0.05 && gmin > b[1] - LVL) {
      const bottom = gmin - 0.3; col.minY = bottom;
      m.scale.y = (b[4] - bottom) / LVL; m.position.y = (b[4] + bottom) / 2;
    }
  }
  m.castShadow = true; m.receiveShadow = true;
  worldGroup.add(m); piece.mesh = m; m.userData.bs = m.scale.clone();
  if (camera.position.distanceToSquared(m.position) < 3600) VFX.pieceSpark(b);
  piece.edges = pieceEdges(s);
  for (const e of piece.edges) { let set = EDGES.get(e); if (!set) { set = new Set(); EDGES.set(e, set); } set.add(piece); }
  PIECES.set(key, piece); constructing.push(piece);
  SFX.build(m.position);
  return piece;
}
function tryBuild(c, s) {
  if (!s) return null;
  let mat = c.buildMat || 'wood';
  if (c.mats[mat] < 10) mat = MAT_ORDER.find((k) => c.mats[k] >= 10);
  if (!mat || !canPlace(s)) return null;
  c.mats[mat] -= 10;
  return placePiece(s, mat, c);
}
function damagePiece(p, amt) {
  if (!p.alive) return;
  p.hp -= amt;
  if (p.mesh.material !== MAT.build[p.mat]) { const U = p.mesh.material.userData.U; if (U) U.uPop.value = 0.5; }
  else { p.flashT = 0.08; }
  if (p.hp <= 0) destroyPiece(p, true);
}
function destroyPiece(p, check) {
  if (!p.alive) return;
  p.alive = false;
  removeCollider(p.collider);
  worldGroup.remove(p.mesh);
  if (p.mesh.material !== MAT.build[p.mat]) p.mesh.material.dispose();
  const bc = p.mat === 'wood' ? 0xb07a43 : p.mat === 'stone' ? 0x8a8e94 : 0x9fb0bf;
  FX.debris(p.mesh.position, bc, 14);
  if (camera.position.distanceToSquared(p.mesh.position) < 8100) VFX.pieceBreak(p.mesh.position, bc);
  for (const e of p.edges) { const set = EDGES.get(e); if (set) { set.delete(p); if (!set.size) EDGES.delete(e); } }
  PIECES.delete(p.key);
  if (check) collapseCheck(p);
}
function neighborsOf(p, out) {
  out.clear();
  for (const e of p.edges) { const set = EDGES.get(e); if (set) for (const q of set) if (q !== p && q.alive) out.add(q); }
  return out;
}
const _nb = new Set();
function collapseCheck(p) {
  const done = new Set();
  for (const e of p.edges) {
    const set = EDGES.get(e); if (!set) continue;
    for (const start of set) {
      if (done.has(start) || !start.alive) continue;
      const seen = new Set([start]), stack = [start]; let grounded = false;
      while (stack.length) {
        const x = stack.pop();
        if (x.grounded) { grounded = true; break; }
        if (seen.size > 700) { grounded = true; break; }
        for (const y of [...neighborsOf(x, _nb)]) if (!seen.has(y)) { seen.add(y); stack.push(y); }
      }
      for (const v of seen) done.add(v);
      if (!grounded) for (const v of seen) { if (!v.collapseT) { v.collapseT = mr(0.05, 0.45); collapsing.push(v); } }
    }
  }
}
function updateBuild(dt) {
  for (let i = constructing.length - 1; i >= 0; i--) {
    const p = constructing[i];
    if (!p.alive) { constructing.splice(i, 1); continue; }
    p.buildT += dt;
    const k = Math.min(1, p.buildT / p.buildTime);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.9 * dt / p.buildTime);
    const U = p.mesh.material.userData.U;
    if (U) { U.uFill.value = lerp(p.b[1] - 0.05, p.b[4] + 0.05, k); U.uPop.value = Math.max(0, U.uPop.value - dt * 5); }
    if (k >= 1) { p.mesh.material.dispose(); p.mesh.material = MAT.build[p.mat]; constructing.splice(i, 1); p.popT = 0.22; popping.push(p); }
  }
  for (let i = popping.length - 1; i >= 0; i--) {
    const p = popping[i]; p.popT -= dt;
    const bs = p.mesh.userData.bs, k = Math.max(0, p.popT / 0.22), s = 1 + Math.sin(k * Math.PI) * 0.035;
    p.mesh.scale.set(bs.x * s, bs.y * s, bs.z * s);
    if (p.popT <= 0 || !p.alive) { p.mesh.scale.copy(bs); popping.splice(i, 1); }
  }
  for (let i = collapsing.length - 1; i >= 0; i--) {
    const p = collapsing[i];
    if (!p.alive) { collapsing.splice(i, 1); continue; }
    p.collapseT -= dt;
    p.mesh.position.y -= dt * 3;
    if (p.collapseT <= 0) { collapsing.splice(i, 1); destroyPiece(p, false); }
  }
}
function showGhost(s, ok) {
  if (!s) { ghostMesh.visible = false; return; }
  pieceTransform(ghostMesh, s);
  ghostMesh.material = ok ? MAT.ghost : MAT.ghostBad;
  ghostMesh.visible = true;
}
