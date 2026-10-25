// ---------- gadgets: grenades, pop-up forts, launch pads, campfires, foraged food ----------
const GADGETS = { nades: [], pads: [], fires: [], forage: [] };
let forageMesh = { apple: null, shroom: null };
function resetGadgets() {
  for (const n of GADGETS.nades) worldGroup.remove(n.mesh);
  for (const p of GADGETS.pads) { worldGroup.remove(p.mesh); if (p.col) removeCollider(p.col); }
  for (const f of GADGETS.fires) worldGroup.remove(f.mesh);
  GADGETS.nades.length = 0; GADGETS.pads.length = 0; GADGETS.fires.length = 0; GADGETS.forage.length = 0;
  forageMesh = { apple: null, shroom: null };
}
function useGadget(c, it, origin, dir) {
  const def = CONSUMABLES[it.id];
  if (def.placeable && !placeGadget(c, it.id)) { if (c.isPlayer) HUD.banner('No room to place that here', '', 1.1); return false; }
  if (def.throwable) throwGadget(c, it.id, origin, dir);
  c.throwT = 0.45;
  it.count--;
  if (it.count <= 0) { const k = c.inv.indexOf(it); if (k >= 0) c.inv[k] = null; c.slot = -1; afterPickup(c); }
  updateHeld(c);
  return true;
}
function throwGadget(c, id, origin, dir) {
  const mesh = consModel(id); mesh.scale.setScalar(id === 'portafort' ? 1.6 : 1.3); worldGroup.add(mesh);
  const p = new V3(origin.x + dir.x * 0.7, origin.y + dir.y * 0.7 - 0.15, origin.z + dir.z * 0.7);
  const sp = id === 'grenade' ? 21 : 17;
  const v = new V3(dir.x * sp + c.vel.x * 0.5, dir.y * sp + 4.5, dir.z * sp + c.vel.z * 0.5);
  GADGETS.nades.push({ id, owner: c, mesh, p, v, fuse: id === 'grenade' ? 2.3 : 9, spin: new V3(mr(-9, 9), mr(-9, 9), mr(-9, 9)), bounces: 0, rest: false });
  if (c.isPlayer) SFX.click();
}
const _gd = new V3();
function updateNades(dt) {
  for (let i = GADGETS.nades.length - 1; i >= 0; i--) {
    const n = GADGETS.nades[i];
    n.fuse -= dt;
    if (!n.rest) {
      n.v.y -= GRAV * dt;
      const len = n.v.length() * dt;
      if (len > 1e-4) {
        _gd.copy(n.v).normalize();
        const h = raycastWorld(n.p.x, n.p.y, n.p.z, _gd.x, _gd.y, _gd.z, len + 0.12, false);
        if (h.t < len + 0.12) {
          let nx = h.nx, ny = h.ny, nz = h.nz;
          if (h.terrain) { nx = groundH(n.p.x - 0.5, n.p.z) - groundH(n.p.x + 0.5, n.p.z); ny = 1; nz = groundH(n.p.x, n.p.z - 0.5) - groundH(n.p.x, n.p.z + 0.5); const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; }
          n.p.addScaledVector(_gd, Math.max(0, h.t - 0.1));
          if (n.id === 'portafort' && ny > 0.6) { buildFort(n); worldGroup.remove(n.mesh); GADGETS.nades.splice(i, 1); continue; }
          const vn = n.v.x * nx + n.v.y * ny + n.v.z * nz;
          n.v.x -= 1.55 * vn * nx; n.v.y -= 1.55 * vn * ny; n.v.z -= 1.55 * vn * nz;
          n.v.multiplyScalar(0.55); n.spin.multiplyScalar(0.6); n.bounces++;
          if (n.v.length() < 1.2 && ny > 0.6) { n.rest = true; n.v.set(0, 0, 0); }
          else if (camera.position.distanceToSquared(n.p) < 900) SFX.impact(n.p, 'metal');
        } else n.p.addScaledVector(_gd, len);
      }
      n.mesh.rotation.x += n.spin.x * dt; n.mesh.rotation.y += n.spin.y * dt; n.mesh.rotation.z += n.spin.z * dt;
    }
    n.mesh.position.copy(n.p);
    if (n.id === 'grenade' && Math.random() < dt * 20) FX.emitA(n.p.x, n.p.y + 0.1, n.p.z, 0, 0.6, 0, 0.25, 0.14, 0.03, 1, 0.3, 0.2, 1, 0, 0);
    if (n.fuse <= 0) {
      worldGroup.remove(n.mesh); GADGETS.nades.splice(i, 1);
      if (n.id === 'grenade') explode(n.p.x, n.p.y + 0.2, n.p.z, { radius: 5.5, dmg: 85, bd: 260, owner: n.owner, name: 'Grenade' });
      else if (n.id === 'portafort') buildFort(n);
    }
  }
}
// pop-up fort: three storeys of metal walls around the landing cell, a roof, and a lift for whoever is inside
function buildFort(n) {
  const ix = Math.floor(n.p.x / CELL), iz = Math.floor(n.p.z / CELL);
  const g = surfaceBelow(n.p.x, n.p.y + 0.5, n.p.z), L0 = Math.max(0, Math.round(g / LVL));
  const made = [];
  const put = (s) => { if (canPlace(s)) { const pc = placePiece(s, 'metal', n.owner); pc.buildT = pc.buildTime * 0.85; made.push(pc); } };
  for (let L = L0; L < L0 + 3; L++) { put({ t: 'wx', ix, iz, L }); put({ t: 'wx', ix: ix + 1, iz, L }); put({ t: 'wz', ix, iz, L }); put({ t: 'wz', ix, iz: iz + 1, L }); }
  put({ t: 'f', ix, iz, L: L0 + 3 });
  const top = (L0 + 3) * LVL;
  for (const c of characters) {
    if (!c.alive || c.mode !== 'ground') continue;
    if (c.pos.x > ix * CELL && c.pos.x < ix * CELL + CELL && c.pos.z > iz * CELL && c.pos.z < iz * CELL + CELL && c.pos.y < top - 1) {
      c.mantle = { t: 0, dur: 0.9, fx: c.pos.x, fy: c.pos.y, fz: c.pos.z, tx: c.pos.x, ty: top, tz: c.pos.z }; c.vel.set(0, 0, 0);
    }
  }
  FX.burst(n.p.x, n.p.y + 1, n.p.z, 30, 0x9fd8ff, 6, 0.6, 0.3, true, -6);
  SFX.build(n.p, 'metal');
}
function placeGadget(c, id) {
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  const x = c.pos.x + fx * 2.6, z = c.pos.z + fz * 2.6, y = surfaceBelow(x, c.pos.y + 1.2, z);
  if (Math.abs(y - c.pos.y) > 1.6) return false;
  queryBox(x - 0.9, z - 0.9, x + 0.9, z + 0.9, _gq2);
  for (const k of _gq2) if (k.shape === 'box' && k.maxY > y + 0.4 && k.minY < y + 1.8 && x + 0.9 > k.minX && x - 0.9 < k.maxX && z + 0.9 > k.minZ && z - 0.9 < k.maxZ) return false;
  if (id === 'launchpad') {
    const m = new THREE.Group();
    const base = new THREE.Mesh(boxGeo(2.2, 0.22, 2.2), lam(0x2f86e8, { roughness: 0.4 })); base.position.y = 0.11; m.add(base);
    const ring = new THREE.Mesh(boxGeo(1.6, 0.06, 1.6), lam(0xffd23f, { emissive: 0xffb000, emissiveIntensity: 0.9 })); ring.position.y = 0.25; m.add(ring);
    for (let k = 0; k < 2; k++) { const ar = new THREE.Mesh(keepGeo(new THREE.ConeGeometry(0.35, 0.5, 4)), lam(0xffffff, { emissive: 0x88ccff, emissiveIntensity: 0.8 })); ar.position.set(0, 0.5 + k * 0.45, 0); m.add(ar); }
    m.position.set(x, y, z); m.traverse((o) => { if (o.isMesh) o.castShadow = true; }); worldGroup.add(m);
    const pad = { x, y, z, mesh: m, t: 0, cd: 0 };
    pad.col = boxCollider(x - 1.1, y - 0.2, z - 1.1, x + 1.1, y + 0.22, z + 1.1, { kind: 'gadget', hp: 120, maxHp: 120, harvest: 'metal', gadget: pad });
    GADGETS.pads.push(pad);
  } else {
    const m = consModel('campfire'); m.scale.setScalar(2.4); m.position.set(x, y, z); worldGroup.add(m);
    GADGETS.fires.push({ x, y, z, mesh: m, life: 25, owner: c });
  }
  SFX.build({ x, y, z }, 'wood');
  return true;
}
const _gq2 = [];
function updatePads(dt) {
  for (let i = GADGETS.pads.length - 1; i >= 0; i--) {
    const P = GADGETS.pads[i];
    if (!P.col.alive) { worldGroup.remove(P.mesh); GADGETS.pads.splice(i, 1); continue; }
    P.t += dt; P.mesh.children[2].position.y = 0.5 + Math.sin(P.t * 4) * 0.08; P.mesh.children[3].position.y = 0.95 + Math.sin(P.t * 4 + 1) * 0.08;
    for (const c of characters) {
      if (!c.alive || c.mode !== 'ground' || c.mantle) continue;
      if (Math.abs(c.pos.x - P.x) < 1.15 && Math.abs(c.pos.z - P.z) < 1.15 && c.pos.y - P.y < 0.7 && c.pos.y - P.y > -0.4) {
        c.mode = 'sky'; c.grounded = false; c.vel.y = 46; c.vel.x *= 0.6; c.vel.z *= 0.6; c.sliding = false; setCrouch(c, false); c.launched = true;
        FX.burst(P.x, P.y + 0.6, P.z, 26, 0xffd23f, 6, 0.5, 0.3, true, -4);
        SFX.jump(); if (c.isPlayer) { HUD.banner('Launched!', IS_TOUCH ? 'Tap JUMP to open the glider' : 'Space opens the glider', 1.6); CAM.shake = Math.min(1, CAM.shake + 0.3); }
      }
    }
  }
}
function updateFires(dt) {
  for (let i = GADGETS.fires.length - 1; i >= 0; i--) {
    const F = GADGETS.fires[i]; F.life -= dt;
    if (F.life <= 0) { worldGroup.remove(F.mesh); GADGETS.fires.splice(i, 1); FX.burst(F.x, F.y + 0.4, F.z, 10, 0x777777, 2, 1, 0.5, false, 1); continue; }
    if (camera.position.distanceToSquared(F.mesh.position) < 3600 && Math.random() < dt * 30) FX.emitA(F.x + mr(-0.3, 0.3), F.y + 0.3, F.z + mr(-0.3, 0.3), mr(-0.2, 0.2), mr(1.2, 2.4), mr(-0.2, 0.2), mr(0.4, 0.8), 0.45, 0.05, 1, 0.55, 0.15, 1, 0.5, 0.5);
    if (Math.random() < dt * 4) FX.emitN(F.x, F.y + 0.8, F.z, mr(-0.2, 0.2), mr(0.6, 1.2), mr(-0.2, 0.2), 2.4, 0.4, 1.8, 0.5, 0.5, 0.52, 0.35, 0.2, 0.3);
    for (const c of characters) {
      if (!c.alive || c.hp >= 100) continue;
      const dx = c.pos.x - F.x, dz = c.pos.z - F.z;
      if (dx * dx + dz * dz < 20 && Math.abs(c.pos.y - F.y) < 2.5) { c.hp = Math.min(100, c.hp + dt * 2.5); if (c.isPlayer && Math.random() < dt * 4) FX.emitA(c.pos.x + mr(-0.4, 0.4), c.pos.y + mr(0.3, 1.6), c.pos.z + mr(-0.4, 0.4), 0, 1, 0, 0.6, 0.18, 0.04, 0.45, 1, 0.5, 0.9, 0, 0.5); }
    }
  }
}
// apples under leafy trees, mushrooms along the shore
function spawnForage() {
  const apples = [], shrooms = [];
  for (const t of WORLD.trees) {
    if (t.s && t.kind !== 'pine' && t.kind !== 'cactus' && Math.random() < 0.18) { const a = Math.random() * TAU, r = mr(1.2, 2.2); apples.push({ type: 'apple', x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r }); }
  }
  for (let i = 0; i < 500 && shrooms.length < 60; i++) {
    const a = Math.random() * TAU, d = mr(150, 460), x = Math.cos(a) * d, z = Math.sin(a) * d, h = groundH(x, z);
    if (h > 1.7 && h < 2.6 && !overlapsFootprint(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0)) for (let k = 0; k < 3; k++) shrooms.push({ type: 'shroom', x: x + mr(-1.2, 1.2), z: z + mr(-1.2, 1.2) });
  }
  const mk = (list, geo, mat, sy) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.castShadow = false; im.frustumCulled = false;
    list.forEach((f, i) => { f.y = groundH(f.x, f.z); f.mesh = im; f.idx = i; f.alive = true; _m4.compose(_p4.set(f.x, f.y + sy, f.z), _q4.setFromAxisAngle(UP, Math.random() * TAU), _s4.set(1, 1, 1)); im.setMatrixAt(i, _m4); GADGETS.forage.push(f); });
    im.instanceMatrix.needsUpdate = true; worldGroup.add(im); return im;
  };
  const shroomGeo = keepGeo(new THREE.SphereGeometry(0.22, 8, 5, 0, TAU, 0, Math.PI / 2));
  forageMesh.apple = mk(apples, keepGeo(new THREE.SphereGeometry(0.17, 8, 6)), lam(0xd8342b, { roughness: 0.4 }), 0.16);
  forageMesh.shroom = mk(shrooms, shroomGeo, lam(0x5ab4ff, { emissive: 0x1a5f99, emissiveIntensity: 0.6, roughness: 0.5 }), 0.12);
}
function nearestForage(c, maxD) {
  let best = null, bd = maxD * maxD;
  for (const f of GADGETS.forage) { if (!f.alive) continue; const d = (f.x - c.pos.x) ** 2 + (f.z - c.pos.z) ** 2; if (d < bd && Math.abs(f.y - c.pos.y) < 2) { bd = d; best = f; } }
  return best;
}
function eatForage(c, f) {
  f.alive = false; _m4.makeScale(0, 0, 0); f.mesh.setMatrixAt(f.idx, _m4); f.mesh.instanceMatrix.needsUpdate = true;
  if (f.type === 'apple') c.hp = Math.min(100, c.hp + 5); else c.shield = Math.min(100, c.shield + 5);
  if (c.isPlayer) { SFX.pickup(1); FX.burst(f.x, f.y + 0.3, f.z, 8, f.type === 'apple' ? 0x6fe06a : 0x5ab4ff, 2, 0.5, 0.2, true, 0); }
}
function updateGadgets(dt) { updateNades(dt); updatePads(dt); updateFires(dt); }
