// ---------- characters: rigs, animation, movement, inventory ----------
const OUTFITS = [
  { name: 'Ranger', skin: 0xf0c8a0, shirt: 0x2f6fd6, pants: 0x2a2f45, hair: 0x3b2416, acc: 0xffc62e },
  { name: 'Ember', skin: 0xd9a07a, shirt: 0xe0482f, pants: 0x3a2a22, hair: 0x141414, acc: 0x2b2b2b },
  { name: 'Mint', skin: 0xf3d2b5, shirt: 0x3fcf9a, pants: 0x1f3b3a, hair: 0xe8c25a, acc: 0xffffff },
  { name: 'Nightshade', skin: 0x8d5a3b, shirt: 0x6c3fd1, pants: 0x1b1630, hair: 0x0e0e0e, acc: 0x41b8ff },
  { name: 'Sunny', skin: 0xffd9b8, shirt: 0xffb02e, pants: 0x5a3e9a, hair: 0xb0442c, acc: 0x2fd06f },
  { name: 'Glacier', skin: 0xe8c4a8, shirt: 0xe9f2ff, pants: 0x3a5f8f, hair: 0xdddddd, acc: 0x3aa0ff },
  { name: 'Moss', skin: 0xc68f62, shirt: 0x5b7f2a, pants: 0x4a3b26, hair: 0x2a1a0e, acc: 0xd6b25a },
  { name: 'Cherry', skin: 0xf6cfb0, shirt: 0xff5d8f, pants: 0x2b2d42, hair: 0x2b1b17, acc: 0xffffff },
];
function randomOutfit() {
  const o = Object.assign({}, OUTFITS[Math.floor(Math.random() * OUTFITS.length)]);
  const c = new THREE.Color(o.shirt); const hsl = {}; c.getHSL(hsl); c.setHSL((hsl.h + mr(-0.08, 0.08) + 1) % 1, hsl.s, clamp(hsl.l + mr(-0.08, 0.08), 0.15, 0.85)); o.shirt = c.getHex();
  return o;
}
function buildRig(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips);
  const M = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(boxGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const skin = lam(o.skin), shirt = lam(o.shirt), pants = lam(o.pants), hair = lam(o.hair), acc = lam(o.acc), dark = lam(0x1d2026);
  M(0.56, 0.62, 0.32, shirt, 0, 0.33, 0, hips);
  M(0.58, 0.1, 0.34, dark, 0, 0.04, 0, hips);
  M(0.4, 0.42, 0.18, acc, 0, 0.36, 0.24, hips);
  const head = new THREE.Group(); head.position.y = 0.66; hips.add(head);
  M(0.4, 0.4, 0.4, skin, 0, 0.21, 0, head);
  M(0.44, 0.14, 0.44, hair, 0, 0.44, 0.01, head);
  M(0.44, 0.24, 0.1, hair, 0, 0.3, 0.19, head);
  M(0.07, 0.07, 0.02, dark, -0.09, 0.24, -0.205, head); M(0.07, 0.07, 0.02, dark, 0.09, 0.24, -0.205, head);
  const limb = (x, y, w, h, mat, handMat) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); hips.add(pv); M(w, h, w, mat, 0, -h / 2, 0, pv); if (handMat) M(w * 0.9, w * 0.9, w * 0.9, handMat, 0, -h - w * 0.35, 0, pv); return pv; };
  const armL = limb(-0.37, 0.58, 0.16, 0.5, shirt, skin), armR = limb(0.37, 0.58, 0.16, 0.5, shirt, skin);
  const legL = limb(-0.14, 0.02, 0.22, 0.86, pants, null), legR = limb(0.14, 0.02, 0.22, 0.86, pants, null);
  M(0.24, 0.12, 0.32, dark, 0, -0.86, -0.04, legL); M(0.24, 0.12, 0.32, dark, 0, -0.86, -0.04, legR);
  const gun = new THREE.Group(); gun.position.set(0, -0.62, -0.06); gun.rotation.x = -Math.PI / 2; armR.add(gun);
  const glider = new THREE.Group(); glider.position.y = 2.7; glider.visible = false; root.add(glider);
  const gm = lam(o.acc === 0xffffff ? 0xff5d8f : o.acc), gm2 = lam(o.shirt);
  const w1 = new THREE.Mesh(boxGeo(2.1, 0.06, 1.1), gm); w1.position.x = -0.95; w1.rotation.z = 0.22; glider.add(w1);
  const w2 = new THREE.Mesh(boxGeo(2.1, 0.06, 1.1), gm2); w2.position.x = 0.95; w2.rotation.z = -0.22; glider.add(w2);
  const bar = new THREE.Mesh(boxGeo(0.06, 1.1, 0.06), dark); bar.position.y = -0.55; glider.add(bar);
  return { root, body, hips, head, armL, armR, legL, legR, gun, glider, heldKey: '' };
}
function makeCharacter(isPlayer, name, outfit) {
  const c = {
    isPlayer, name, outfit, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, modelYaw: 0,
    hp: 100, shield: 0, alive: true, grounded: false, groundC: null, mode: 'bus',
    inv: [null, null, null, null, null], slot: -1, ammo: { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 },
    mats: { wood: 0, stone: 0, metal: 0 }, buildMat: 'wood', buildMode: null, buildRot: 0, buildCD: 0, lastPiece: 'wall',
    kills: 0, damageDealt: 0, fireCD: 0, reloadT: 0, reloadTotal: 0, using: null, useT: 0, useTotal: 0,
    swingT: 0, bloom: 0, radius: 0.42, height: 2.0, aiming: false, lastAttacker: null, lastHurt: -99,
    deathT: 0, blocked: false, blockC: null, animPhase: 0, autoReload: 0, landedAt: 0,
  };
  c.rig = buildRig(outfit); c.rig.root.visible = false;
  worldGroup.add(c.rig.root);
  return c;
}
function curItem(c) { return c.slot >= 0 ? c.inv[c.slot] : null; }
function curWeapon(c) { const it = curItem(c); return it && it.kind === 'weapon' ? it : null; }
function updateHeld(c) {
  const R = c.rig, it = curItem(c);
  const key = c.buildMode ? 'build' : it ? (it.kind + ':' + (it.id) + ':' + (it.rarity || 0)) : 'pick';
  if (R.heldKey === key) return;
  R.heldKey = key;
  while (R.gun.children.length) R.gun.remove(R.gun.children[0]);
  if (c.buildMode) return;
  if (!it) {
    const pg = new THREE.Group();
    const h = new THREE.Mesh(boxGeo(0.05, 0.05, 0.9), lam(0x6b4a2a)); h.position.z = -0.25; pg.add(h);
    const hd = new THREE.Mesh(boxGeo(0.06, 0.5, 0.1), lam(c.outfit.acc === 0x2b2b2b ? 0xffc62e : c.outfit.acc)); hd.position.set(0, 0.12, -0.68); pg.add(hd);
    R.gun.add(pg);
  } else if (it.kind === 'weapon') R.gun.add(gunModel(it.id, it.rarity));
  else { const m = consModel(it.id); m.position.z = -0.1; R.gun.add(m); }
}
const _kTmp = { x: 0 };
function animateRig(c, dt) {
  const R = c.rig;
  if (!R.root.visible) return;
  R.root.position.copy(c.pos);
  R.root.rotation.y += angleDiff(R.root.rotation.y, c.modelYaw) * Math.min(1, dt * 16);
  const k = Math.min(1, dt * 14);
  let bx = 0, aLx = 0, aLz = 0, aRx = 0, aRz = 0, lLx = 0, lRx = 0, lLz = 0, lRz = 0, hx = 0;
  R.glider.visible = c.mode === 'glide';
  if (c.dance) {
    const t = GAME.time * 6.5;
    aLz = -(2.3 + Math.sin(t) * 0.55); aRz = 2.3 + Math.sin(t + Math.PI) * 0.55; aLx = 0.3; aRx = 0.3;
    lLx = Math.max(0, Math.sin(t)) * 0.6; lRx = Math.max(0, -Math.sin(t)) * 0.6; hx = Math.sin(t * 0.5) * 0.25;
    R.body.position.y = Math.abs(Math.sin(t)) * 0.28;
  } else if (c.mode === 'sky') { bx = -1.25; aLz = -1.25; aRz = 1.25; lLz = -0.28; lRz = 0.28; lLx = 0.15; lRx = 0.15; hx = 0.9; }
  else if (c.mode === 'glide') { bx = -0.12; aLz = -2.75; aRz = 2.75; lLx = 0.25; lRx = 0.1; }
  else {
    const sp = Math.hypot(c.vel.x, c.vel.z);
    c.animPhase += dt * sp * 1.55;
    const sw = Math.sin(c.animPhase) * Math.min(1, sp / 6) * 0.85;
    lLx = sw; lRx = -sw;
    if (!c.grounded) { lLx = 0.55; lRx = -0.25; }
    const it = curItem(c);
    if (c.swingT > 0) { const t = 1 - Math.min(1, c.swingT / 0.5); aRx = t < 0.35 ? lerp(1.4, 2.9, t / 0.35) : lerp(2.9, 0.4, (t - 0.35) / 0.65); aLx = -sw * 0.5; }
    else if (c.buildMode) { aRx = 1.0; aLx = 0.9; aLz = 0.2; aRz = -0.2; }
    else if (c.using) { aRx = 1.3; aLx = 1.3; aLz = 0.45; aRz = -0.45; }
    else if (it && it.kind === 'weapon') { const p = c.pitch; aRx = 1.5 + p; aLx = 1.45 + p; aLz = 0.5; aRz = 0.05; hx = -p * 0.5; }
    else { aRx = 0.5 - sw * 0.3; aLx = -sw * 0.8; }
    if (c.reloadT > 0) { aLx -= 0.5; aLz += 0.3; }
  }
  R.body.rotation.x += (bx - R.body.rotation.x) * k;
  R.head.rotation.x += (hx - R.head.rotation.x) * k;
  R.armL.rotation.x += (aLx - R.armL.rotation.x) * k; R.armL.rotation.z += (aLz - R.armL.rotation.z) * k;
  R.armR.rotation.x += (aRx - R.armR.rotation.x) * k * (c.swingT > 0 ? 2 : 1); R.armR.rotation.z += (aRz - R.armR.rotation.z) * k;
  R.legL.rotation.x += (lLx - R.legL.rotation.x) * k; R.legR.rotation.x += (lRx - R.legR.rotation.x) * k;
  R.legL.rotation.z += (lLz - R.legL.rotation.z) * k; R.legR.rotation.z += (lRz - R.legR.rotation.z) * k;
  if (c.dance) { /* body bounce set above */ } else if (c.mode === 'sky') R.body.position.y = 1.0; else R.body.position.y += (0 - R.body.position.y) * k;
}

// ---------- movement ----------
const _cq = [];
function pushOut(c, near) {
  const r = c.radius, feet = c.pos.y, head = feet + c.height;
  for (const k of near) {
    if (k.shape !== 'box') continue;
    if (k.maxY <= feet + STEP || k.minY >= head) continue;
    const cx = clamp(c.pos.x, k.minX, k.maxX), cz = clamp(c.pos.z, k.minZ, k.maxZ);
    const dx = c.pos.x - cx, dz = c.pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      c.pos.x += nx * (r - d); c.pos.z += nz * (r - d);
      const vn = c.vel.x * nx + c.vel.z * nz; if (vn < 0) { c.vel.x -= vn * nx; c.vel.z -= vn * nz; }
    } else {
      const l = c.pos.x - k.minX, rt = k.maxX - c.pos.x, b = c.pos.z - k.minZ, t = k.maxZ - c.pos.z, m = Math.min(l, rt, b, t);
      if (m === l) c.pos.x = k.minX - r; else if (m === rt) c.pos.x = k.maxX + r; else if (m === b) c.pos.z = k.minZ - r; else c.pos.z = k.maxZ + r;
    }
    c.blocked = true; c.blockC = k;
  }
}
function vertical(c, near) {
  const r = c.radius * 0.75, x = c.pos.x, z = c.pos.z, feet = c.pos.y;
  let sup = walkH(x, z), sc = null;
  for (const k of near) {
    if (k.shape === 'box') {
      if (x + r < k.minX || x - r > k.maxX || z + r < k.minZ || z - r > k.maxZ) continue;
      if (k.maxY <= feet + STEP && k.maxY > sup) { sup = k.maxY; sc = k; }
    } else {
      if (x < k.minX || x > k.maxX || z < k.minZ || z > k.maxZ) continue;
      const h = k.shape === 'ramp' ? rampH(k, x, z) : coneH(k, x, z);
      if (h <= feet + STEP && h > sup) { sup = h; sc = k; }
    }
  }
  if (c.vel.y <= 0) {
    const snap = (c.grounded && c.mode === 'ground') ? 0.55 : 0;
    if (feet <= sup + snap) { if (!c.grounded) landed(c); c.pos.y = sup; c.vel.y = 0; c.grounded = true; c.groundC = sc; }
    else { c.grounded = false; c.groundC = null; }
  } else {
    c.grounded = false; c.groundC = null;
    const head = feet + c.height;
    for (const k of near) {
      if (k.shape !== 'box') continue;
      if (x + r < k.minX || x - r > k.maxX || z + r < k.minZ || z - r > k.maxZ) continue;
      if (k.minY < head && k.minY > feet + 0.6) { c.pos.y = k.minY - c.height; c.vel.y = 0; }
    }
  }
}
function charPhysics(c, dt) {
  if (c.mode === 'ground') c.vel.y = Math.max(c.vel.y - GRAV * dt, -60);
  const maxV = Math.max(Math.abs(c.vel.x), Math.abs(c.vel.z), Math.abs(c.vel.y));
  const steps = Math.min(10, Math.max(1, Math.ceil(maxV * dt / 0.3)));
  const sdt = dt / steps;
  c.blocked = false; c.blockC = null;
  for (let s = 0; s < steps; s++) {
    const px = c.pos.x, pz = c.pos.z;
    c.pos.x += c.vel.x * sdt; c.pos.z += c.vel.z * sdt;
    if (c.mode === 'ground' && groundH(c.pos.x, c.pos.z) < -2.5 && groundH(px, pz) >= -2.5) { c.pos.x = px; c.pos.z = pz; c.vel.x = 0; c.vel.z = 0; c.blocked = true; }
    const lim = 485;
    if (c.pos.x > lim) c.pos.x = lim; if (c.pos.x < -lim) c.pos.x = -lim; if (c.pos.z > lim) c.pos.z = lim; if (c.pos.z < -lim) c.pos.z = -lim;
    const r = c.radius + 0.6;
    queryBox(c.pos.x - r, c.pos.z - r, c.pos.x + r, c.pos.z + r, _cq);
    pushOut(c, _cq);
    c.pos.y += c.vel.y * sdt;
    vertical(c, _cq);
  }
}
function landed(c) {
  const vy = c.vel.y;
  if (c.mode === 'sky' || c.mode === 'glide') {
    c.mode = 'ground'; c.rig.glider.visible = false; c.landedAt = GAME.time;
    if (c.isPlayer) { SFX.land(c.pos); SFX.loop('wind', 0); }
    return;
  }
  if (vy < -19.5) {
    const dmg = Math.round((-vy - 19.5) * 6);
    if (dmg > 0) applyDamage(c, dmg, null, 'fall', false, 'fall');
  }
  if (c.isPlayer && vy < -8) SFX.land(c.pos);
}
function skyPhysics(c, dt, mx, my, deploy) {
  const above = c.pos.y - surfaceBelow(c.pos.x, c.pos.y, c.pos.z);
  if (c.mode === 'sky' && (above < 46 || (deploy && above < 150))) { c.mode = 'glide'; if (c.isPlayer) SFX.deploy(); }
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
  const wx = fx * my + rx * mx, wz = fz * my + rz * mx;
  let hs, vy;
  if (c.mode === 'sky') { const dive = clamp(-c.pitch / 1.1, 0, 1) * (my > 0 ? 1 : 0.6); hs = lerp(19, 12, dive); vy = -lerp(28, 52, dive); }
  else { hs = my > 0 ? 17 : 11; vy = my > 0 ? -8.5 : -6.5; }
  const k = 1 - Math.exp(-2.6 * dt);
  c.vel.x += (wx * hs - c.vel.x) * k; c.vel.z += (wz * hs - c.vel.z) * k; c.vel.y += (vy - c.vel.y) * (1 - Math.exp(-3 * dt));
  charPhysics(c, dt);
  c.modelYaw = c.yaw;
}

// ---------- inventory + actions shared by player and bots ----------
function selectSlot(c, i) {
  if (c.slot === i && !c.buildMode) return;
  c.slot = i; c.buildMode = null; c.using = null; c.reloadT = 0; c.fireCD = Math.max(c.fireCD, 0.2); c.autoReload = 0;
  updateHeld(c);
}
function freeSlot(c) { for (let i = 0; i < 5; i++) if (!c.inv[i]) return i; return -1; }
function giveItem(c, it) {
  if (it.kind === 'ammo') { c.ammo[it.ammo] = Math.min(999, (c.ammo[it.ammo] || 0) + it.count); return true; }
  if (it.kind === 'mats') { c.mats[it.mat] = Math.min(999, c.mats[it.mat] + it.count); return true; }
  if (it.kind === 'consumable') {
    const def = CONSUMABLES[it.id];
    for (let i = 0; i < 5 && it.count > 0; i++) { const s = c.inv[i]; if (s && s.kind === 'consumable' && s.id === it.id && s.count < def.stack) { const n = Math.min(def.stack - s.count, it.count); s.count += n; it.count -= n; } }
    if (it.count <= 0) return true;
    const f = freeSlot(c); if (f >= 0) { c.inv[f] = { kind: 'consumable', id: it.id, count: it.count }; it.count = 0; return true; }
    return false;
  }
  const f = freeSlot(c);
  if (f >= 0) { c.inv[f] = { kind: 'weapon', id: it.id, rarity: it.rarity, mag: it.mag }; return true; }
  return false;
}
function invToItem(s) { return s.kind === 'weapon' ? { kind: 'weapon', id: s.id, rarity: s.rarity, mag: s.mag } : { kind: 'consumable', id: s.id, count: s.count }; }
function pickupItem(c, it) {
  if (!it.alive) return false;
  if (giveItem(c, it)) { removeItem(it); if (c.isPlayer) { SFX.pickup(); afterPickup(c); } return true; }
  if (it.kind === 'consumable' || it.kind === 'weapon') {
    let s = c.slot;
    if (!c.isPlayer || s < 0) s = worstSlot(c);
    if (s < 0) return false;
    const old = c.inv[s];
    c.inv[s] = null; giveItem(c, it); removeItem(it);
    if (old) dropItem(invToItem(old), c.pos.x, c.pos.y + 0.6, c.pos.z, -Math.sin(c.yaw) * 2, 3.5, -Math.cos(c.yaw) * 2);
    if (c.isPlayer) { SFX.pickup(); afterPickup(c); }
    return true;
  }
  return false;
}
function afterPickup(c) { if (c.slot === -1 && !c.buildMode) { const k = c.inv.findIndex((s) => s && s.kind === 'weapon'); if (k >= 0) selectSlot(c, k); } updateHeld(c); }
function weaponScore(id, r) { const base = { ar: 50, smg: 40, shotgun: 48, pistol: 22, sniper: 44, rocket: 46 }[id]; return base + r * 8; }
function worstSlot(c) {
  let best = -1, bs = Infinity;
  for (let i = 0; i < 5; i++) { const s = c.inv[i]; if (!s) return i; const sc = s.kind === 'weapon' ? weaponScore(s.id, s.rarity) : 30; if (sc < bs) { bs = sc; best = i; } }
  return best;
}
function startReload(c) {
  const w = curWeapon(c); if (!w || c.reloadT > 0) return false;
  const def = WEAPONS[w.id]; if (w.mag >= def.mag) return false;
  if (c.isPlayer && c.ammo[def.ammo] <= 0) return false;
  c.reloadTotal = def.reloadPer || def.reload[w.rarity]; c.reloadT = c.reloadTotal; c.using = null;
  if (c.isPlayer) SFX.reload();
  return true;
}
function finishReload(c) {
  const w = curWeapon(c); if (!w) return;
  const def = WEAPONS[w.id];
  const reserve = c.isPlayer ? c.ammo[def.ammo] : 999;
  if (def.reloadPer) {
    if (reserve > 0) { w.mag++; if (c.isPlayer) c.ammo[def.ammo]--; }
    if (w.mag < def.mag && (c.isPlayer ? c.ammo[def.ammo] > 0 : true)) { c.reloadT = def.reloadPer; c.reloadTotal = def.reloadPer; }
  } else {
    const n = Math.min(def.mag - w.mag, reserve); w.mag += n; if (c.isPlayer) c.ammo[def.ammo] -= n;
  }
}
function consumableUseful(c, def) {
  if (def.heal) return c.hp < def.cap;
  return c.shield < def.cap;
}
function startUse(c) {
  const it = curItem(c); if (!it || it.kind !== 'consumable' || c.using) return false;
  const def = CONSUMABLES[it.id];
  if (!consumableUseful(c, def)) { if (c.isPlayer) HUD.banner(def.heal ? 'Health is full' : 'Shields are full', '', 1.2); return false; }
  c.using = it; c.useT = 0; c.useTotal = def.time;
  return true;
}
function finishUse(c) {
  const it = c.using; c.using = null;
  if (!it || it.count <= 0) return;
  const def = CONSUMABLES[it.id];
  if (def.heal) c.hp = Math.min(def.cap, Math.max(c.hp, Math.min(100, c.hp + def.heal)));
  if (def.shield) c.shield = Math.min(def.cap, Math.max(c.shield, Math.min(100, c.shield + def.shield)));
  it.count--;
  if (it.count <= 0) { const k = c.inv.indexOf(it); if (k >= 0) c.inv[k] = null; if (c.slot === k) { c.slot = -1; updateHeld(c); } }
  if (c.isPlayer) SFX.heal();
}
function tickTimers(c, dt) {
  if (c.fireCD > 0) c.fireCD -= dt;
  if (c.swingT > 0) c.swingT -= dt;
  c.bloom = Math.max(0, c.bloom - dt * 0.12);
  if (c.reloadT > 0) { c.reloadT -= dt; if (c.reloadT <= 0) { c.reloadT = 0; finishReload(c); } }
  if (c.autoReload > 0) { c.autoReload -= dt; if (c.autoReload <= 0) startReload(c); }
  if (c.using) { c.useT += dt; if (c.useT >= c.useTotal) finishUse(c); }
}
function eyeOf(c, out) { return out.set(c.pos.x, c.pos.y + 1.6, c.pos.z); }
function muzzleOf(c, out) {
  const fx = -Math.sin(c.yaw) * Math.cos(c.pitch), fy = Math.sin(c.pitch), fz = -Math.cos(c.yaw) * Math.cos(c.pitch);
  return out.set(c.pos.x + fx * 0.9 + Math.cos(c.yaw) * 0.32, c.pos.y + 1.45 + fy * 0.9, c.pos.z + fz * 0.9 - Math.sin(c.yaw) * 0.32);
}
