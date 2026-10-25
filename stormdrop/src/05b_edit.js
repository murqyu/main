// ---------- build editing: 3x3 tiles on walls -> doors, windows, arches ----------
const EDIT = { overlay: null, tiles: [], mats: null };
const TILE_N = 3;
function wallBoxes(p, mask) {
  const x0 = p.ix * CELL, z0 = p.iz * CELL, y0 = p.L * LVL, tw = CELL / TILE_N, th = LVL / TILE_N, out = [];
  for (let r = 0; r < TILE_N; r++) {
    let c = 0;
    while (c < TILE_N) {
      if (mask & (1 << (r * TILE_N + c))) { c++; continue; }
      let c1 = c; while (c1 + 1 < TILE_N && !(mask & (1 << (r * TILE_N + c1 + 1)))) c1++;
      const a0 = c * tw, a1 = (c1 + 1) * tw, ya = y0 + r * th, yb = y0 + (r + 1) * th;
      out.push(p.t === 'wx' ? [x0 - 0.15, ya, z0 + a0, x0 + 0.15, yb, z0 + a1] : [x0 + a0, ya, z0 - 0.15, x0 + a1, yb, z0 + 0.15]);
      c = c1 + 1;
    }
  }
  if (p.skirt !== undefined) out.push(p.t === 'wx' ? [x0 - 0.15, p.skirt, z0, x0 + 0.15, y0, z0 + CELL] : [x0, p.skirt, z0 - 0.15, x0 + CELL, y0, z0 + 0.15]);
  return out;
}
// merged geometry for the remaining tiles, UVs taken from wall-space so the texture stays continuous
function wallGeometry(p, boxes, cx, cy, cz) {
  const y0 = p.L * LVL, x0 = p.ix * CELL, z0 = p.iz * CELL;
  let n = 0; const geos = [];
  for (const b of boxes) { const g = new THREE.BoxGeometry(b[3] - b[0], b[4] - b[1], b[5] - b[2]).toNonIndexed(); g.translate((b[0] + b[3]) / 2 - cx, (b[1] + b[4]) / 2 - cy, (b[2] + b[5]) / 2 - cz); geos.push(g); n += g.attributes.position.count; }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of geos) {
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++, o++) {
      const x = gp.getX(i) + cx, y = gp.getY(i) + cy, z = gp.getZ(i) + cz;
      P[o * 3] = gp.getX(i); P[o * 3 + 1] = gp.getY(i); P[o * 3 + 2] = gp.getZ(i);
      N[o * 3] = gn.getX(i); N[o * 3 + 1] = gn.getY(i); N[o * 3 + 2] = gn.getZ(i);
      U[o * 2] = (p.t === 'wx' ? z - z0 : x - x0) / CELL; U[o * 2 + 1] = (y - y0) / LVL;
    }
    g.dispose();
  }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  G.computeBoundingSphere();
  return G;
}
function applyWallEdit(p, mask) {
  if (mask === (1 << TILE_N * TILE_N) - 1) return false;
  p.editMask = mask;
  removeCollider(p.collider); for (const c of p.extraCols || []) removeCollider(c);
  const m = p.mesh;
  if (m.geometry !== GEO_B.wx && m.geometry !== GEO_B.wz) m.geometry.dispose();
  pieceTransform(m, p); m.scale.set(1, 1, 1); m.userData.bs = m.scale.clone();
  const boxes = wallBoxes(p, mask), props = { kind: 'build', piece: p, hp: Infinity };
  if (!mask && p.skirt === undefined) m.geometry = p.t === 'wx' ? GEO_B.wx : GEO_B.wz;
  else m.geometry = wallGeometry(p, boxes, m.position.x, m.position.y, m.position.z);
  const cols = boxes.map((b) => boxCollider(b[0], b[1], b[2], b[3], b[4], b[5], Object.assign({}, props)));
  p.collider = cols[0]; p.extraCols = cols.slice(1);
  return true;
}
function initEditOverlay() {
  EDIT.overlay = new THREE.Group(); EDIT.overlay.visible = false; scene.add(EDIT.overlay);
  const geo = keepGeo(new THREE.PlaneGeometry(1, 1));
  EDIT.mats = { on: new THREE.MeshBasicMaterial({ color: 0x3a9cff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), off: new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), hover: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }) };
  for (const k in EDIT.mats) EDIT.mats[k].userData.keep = true;
  for (let i = 0; i < TILE_N * TILE_N; i++) { const t = new THREE.Mesh(geo, EDIT.mats.on); t.renderOrder = 6; EDIT.overlay.add(t); EDIT.tiles.push(t); }
}
function editTarget(p) {
  camera.getWorldDirection(_tmpV);
  const h = raycastWorld(camera.position.x, camera.position.y, camera.position.z, _tmpV.x, _tmpV.y, _tmpV.z, 10, true);
  if (h.t >= 10 || !h.c || !h.c.piece) return null;
  const pc = h.c.piece;
  if (!pc.alive || (pc.t !== 'wx' && pc.t !== 'wz') || pc.owner !== p || pc.buildT < pc.buildTime) return null;
  return pc;
}
function startEdit(p, pc) {
  if (!EDIT.overlay) initEditOverlay();
  p.editing = { piece: pc, sel: pc.editMask || 0, drag: null, hover: -1 };
  if (p.buildMode) exitBuild(p);
  layoutEditOverlay(p);
  EDIT.overlay.visible = true; SFX.click();
}
function layoutEditOverlay(p) {
  const pc = p.editing.piece, x0 = pc.ix * CELL, z0 = pc.iz * CELL, y0 = pc.L * LVL, tw = CELL / TILE_N, th = LVL / TILE_N;
  const side = pc.t === 'wx' ? Math.sign(camera.position.x - x0) || 1 : Math.sign(camera.position.z - z0) || 1, off = 0.17 * side;
  for (let r = 0; r < TILE_N; r++) for (let c = 0; c < TILE_N; c++) {
    const t = EDIT.tiles[r * TILE_N + c], ya = y0 + (r + 0.5) * th, a = (c + 0.5) * tw;
    t.scale.set(tw * 0.9, th * 0.9, 1);
    if (pc.t === 'wx') { t.position.set(x0 + off, ya, z0 + a); t.rotation.set(0, Math.PI / 2, 0); } else { t.position.set(x0 + a, ya, z0 + off); t.rotation.set(0, 0, 0); }
  }
}
function editHover(pc) {
  camera.getWorldDirection(_tmpV);
  const o = camera.position, x0 = pc.ix * CELL, z0 = pc.iz * CELL, y0 = pc.L * LVL;
  const den = pc.t === 'wx' ? _tmpV.x : _tmpV.z; if (Math.abs(den) < 1e-4) return -1;
  const t = ((pc.t === 'wx' ? x0 : z0) - (pc.t === 'wx' ? o.x : o.z)) / den; if (t < 0 || t > 12) return -1;
  const hy = o.y + _tmpV.y * t, ha = pc.t === 'wx' ? o.z + _tmpV.z * t - z0 : o.x + _tmpV.x * t - x0;
  const c = Math.floor(ha / (CELL / TILE_N)), r = Math.floor((hy - y0) / (LVL / TILE_N));
  return c < 0 || c >= TILE_N || r < 0 || r >= TILE_N ? -1 : r * TILE_N + c;
}
function updateEdit(p, A) {
  const E = p.editing, pc = E.piece;
  if (!pc.alive || p.pos.distanceTo(pc.mesh.position) > 9) { endEdit(p, false); return; }
  E.hover = editHover(pc);
  if (A.aimPressed) { E.sel = 0; SFX.click(); }
  if (A.firePressed && E.hover >= 0) { E.drag = (E.sel >> E.hover) & 1 ? 'restore' : 'remove'; }
  if (A.fire && E.drag && E.hover >= 0) { const b = 1 << E.hover; const ns = E.drag === 'remove' ? E.sel | b : E.sel & ~b; if (ns !== E.sel) { E.sel = ns; SFX.hover(); } }
  if (!A.fire) E.drag = null;
  for (let i = 0; i < EDIT.tiles.length; i++) EDIT.tiles[i].material = i === E.hover ? EDIT.mats.hover : (E.sel >> i) & 1 ? EDIT.mats.off : EDIT.mats.on;
  HUD.prompt(IS_TOUCH ? 'Tap tiles · EDIT to confirm' : 'Click tiles to cut · G to confirm · Right-click to reset', 2);
  if (A.edit) endEdit(p, true);
}
function endEdit(p, apply) {
  const E = p.editing; if (!E) return;
  if (apply && E.sel !== (E.piece.editMask || 0)) { if (applyWallEdit(E.piece, E.sel)) { SFX.build(E.piece.mesh.position, E.piece.mat); if (p.isPlayer) ev('edits'); } }
  p.editing = null; if (EDIT.overlay) EDIT.overlay.visible = false;
}
