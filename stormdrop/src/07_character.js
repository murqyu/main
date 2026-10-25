// ---------- characters: rigs, animation, movement, inventory ----------
// curated named outfits (the player's picks); bots get procedurally generated ones
const OUTFITS = [
  { name: 'Ranger', skin: 0xf0c8a0, top: 'jacket', c1: 0x2f6fd6, c2: 0xffc62e, pattern: 'none', legs: 0x2a2f45, hair: 'crop', hairC: 0x3b2416, head: 'none', back: 'backpack', backC: 0xffc62e, glider: 'wing', gliderC1: 0xffc62e, gliderC2: 0x2f6fd6, pick: 'axe', pickC: 0xffc62e, shoes: 0x1d2026, eyes: 'normal', trail: 0x41b8ff },
  { name: 'Ember', skin: 0xd9a07a, top: 'hoodie', c1: 0xe0482f, c2: 0x2b2b2b, pattern: 'band', legs: 0x3a2a22, hair: 'spiky', hairC: 0x141414, head: 'none', back: 'jetpack', backC: 0x2b2b2b, glider: 'wing', gliderC1: 0xff8a3d, gliderC2: 0xe0482f, pick: 'sickle', pickC: 0xff8a3d, shoes: 0xe0482f, eyes: 'focused', trail: 0xff8a3d },
  { name: 'Mint', skin: 0xf3d2b5, top: 'tee', c1: 0x3fcf9a, c2: 0xffffff, pattern: 'stripe', legs: 0x1f3b3a, hair: 'bun', hairC: 0xe8c25a, head: 'none', back: 'backpack', backC: 0xffffff, glider: 'umbrella', gliderC1: 0x3fcf9a, gliderC2: 0xffffff, pick: 'pick', pickC: 0x3fcf9a, shoes: 0xffffff, eyes: 'happy', trail: 0x2fd06f },
  { name: 'Nightshade', skin: 0x8d5a3b, top: 'armor', c1: 0x6c3fd1, c2: 0x41b8ff, pattern: 'none', legs: 0x1b1630, hair: 'mohawk', hairC: 0x41b8ff, head: 'none', back: 'wings', backC: 0x41b8ff, glider: 'kite', gliderC1: 0x6c3fd1, gliderC2: 0x41b8ff, pick: 'crowbar', pickC: 0x41b8ff, shoes: 0x1d2026, eyes: 'shades', trail: 0xb45cff },
  { name: 'Sunny', skin: 0xffd9b8, top: 'tank', c1: 0xffb02e, c2: 0x2fd06f, pattern: 'none', legs: 0x5a3e9a, shorts: true, hair: 'curly', hairC: 0xb0442c, head: 'headphones', headC: 0x2fd06f, back: 'none', glider: 'para', gliderC1: 0xffb02e, gliderC2: 0x2fd06f, pick: 'hammer', pickC: 0x2fd06f, shoes: 0xffb02e, eyes: 'happy', trail: 0xffd23f },
  { name: 'Glacier', skin: 0xe8c4a8, top: 'jacket', c1: 0xe9f2ff, c2: 0x3aa0ff, pattern: 'split', legs: 0x3a5f8f, hair: 'long', hairC: 0xdddddd, head: 'beanie', headC: 0x3aa0ff, back: 'shield', backC: 0x3aa0ff, glider: 'wing', gliderC1: 0xe9f2ff, gliderC2: 0x3aa0ff, pick: 'pick', pickC: 0x9fd8ff, shoes: 0xffffff, eyes: 'normal', gloves: 0x3aa0ff, trail: 0xffffff },
  { name: 'Moss', skin: 0xc68f62, top: 'hoodie', c1: 0x5b7f2a, c2: 0xd6b25a, pattern: 'none', legs: 0x4a3b26, hair: 'swoop', hairC: 0x2a1a0e, head: 'cap', headC: 0xd6b25a, back: 'quiver', backC: 0x8a5a3a, glider: 'kite', gliderC1: 0x5b7f2a, gliderC2: 0xd6b25a, pick: 'axe', pickC: 0xd6b25a, shoes: 0x8a5a3a, eyes: 'focused', trail: 0x2fd06f },
  { name: 'Cherry', skin: 0xf6cfb0, top: 'tee', c1: 0xff5d8f, c2: 0xffffff, pattern: 'band', legs: 0x2b2d42, hair: 'long', hairC: 0x2b1b17, head: 'bandana', headC: 0xffffff, back: 'cape', backC: 0xff5d8f, glider: 'umbrella', gliderC1: 0xff5d8f, gliderC2: 0xffffff, pick: 'sickle', pickC: 0xff5d8f, shoes: 0xff5d8f, eyes: 'happy', trail: 0xff5d8f },
  { name: 'Vanguard', skin: 0xa86c45, top: 'armor', c1: 0x34495e, c2: 0xe0482f, pattern: 'none', legs: 0x262626, hair: 'crop', hairC: 0x141414, head: 'helmet', headC: 0x34495e, back: 'jetpack', backC: 0x6b6b6b, glider: 'wing', gliderC1: 0xe0482f, gliderC2: 0x34495e, pick: 'hammer', pickC: 0xe0482f, shoes: 0x1d2026, eyes: 'focused', gloves: 0x1d2026, trail: 0xe0482f },
  { name: 'Aurora', skin: 0xeac2a0, top: 'jacket', c1: 0x8e44ad, c2: 0x2fd06f, pattern: 'stripe', legs: 0x1b1630, hair: 'spiky', hairC: 0xff5d8f, head: 'none', back: 'cape', backC: 0x2fd06f, glider: 'para', gliderC1: 0x8e44ad, gliderC2: 0x2fd06f, pick: 'crowbar', pickC: 0x2fd06f, shoes: 0x8e44ad, eyes: 'shades', trail: 0xb45cff },
];
function randomOutfit() { return genOutfit(); }
function makeCharacter(isPlayer, name, outfit) {
  const c = {
    isPlayer, name, outfit, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, modelYaw: 0,
    hp: 100, shield: 0, alive: true, grounded: false, groundC: null, mode: 'bus',
    inv: [null, null, null, null, null], slot: -1, ammo: { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 },
    mats: { wood: 0, stone: 0, metal: 0 }, buildMat: 'wood', buildMode: null, buildRot: 0, buildCD: 0, lastPiece: 'wall',
    kills: 0, damageDealt: 0, fireCD: 0, reloadT: 0, reloadTotal: 0, using: null, useT: 0, useTotal: 0,
    swingT: 0, bloom: 0, radius: 0.42, height: 2.0, aiming: false, lastAttacker: null, lastHurt: -99,
    deathT: 0, blocked: false, blockC: null, animPhase: 0, autoReload: 0, landedAt: 0,
    anim: { phase: 0, recoil: 0, land: 0, turn: 0 }, emote: null, emoteStart: 0, crouch: false, sliding: false, knocked: false, throwT: 0, eyeH: 1.6, mantle: null, slideT: 0,
  };
  if (!CHAR_MAT) initCharMaterials();
  c.rig = buildRig(outfit); c.rig.root.visible = false;
  worldGroup.add(c.rig.root);
  return c;
}
function curItem(c) { return c.slot >= 0 ? c.inv[c.slot] : null; }
function curWeapon(c) { const it = curItem(c); return it && it.kind === 'weapon' ? it : null; }
function playEmote(c, id) { c.emote = id; c.emoteStart = GAME.time; c.buildMode = null; updateHeld(c); }
function stopEmote(c) { if (c.emote) { c.emote = null; updateHeld(c); } }

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
    const lim = WORLD.half - 15;
    if (c.pos.x > lim) c.pos.x = lim; if (c.pos.x < -lim) c.pos.x = -lim; if (c.pos.z > lim) c.pos.z = lim; if (c.pos.z < -lim) c.pos.z = -lim;
    const r = c.radius + 0.6;
    queryBox(c.pos.x - r, c.pos.z - r, c.pos.x + r, c.pos.z + r, _cq);
    pushOut(c, _cq);
    c.pos.y += c.vel.y * sdt;
    vertical(c, _cq);
  }
}
// ---------- crouch, slide, mantle ----------
const STAND_H = 2.0, CROUCH_H = 1.32;
function headroom(c, h) {
  const r = c.radius * 0.9;
  queryBox(c.pos.x - r, c.pos.z - r, c.pos.x + r, c.pos.z + r, _cq);
  for (const k of _cq) {
    if (k.shape !== 'box' || c.pos.x + r < k.minX || c.pos.x - r > k.maxX || c.pos.z + r < k.minZ || c.pos.z - r > k.maxZ) continue;
    if (k.minY > c.pos.y + 0.4 && k.minY < c.pos.y + h) return false;
  }
  return true;
}
function setCrouch(c, on) {
  if (!on && (c.crouch || c.sliding) && !headroom(c, STAND_H)) return false;
  c.crouch = on; if (!on) c.sliding = false;
  c.height = on || c.sliding ? CROUCH_H : STAND_H;
  return true;
}
function startSlide(c) {
  const sp = Math.hypot(c.vel.x, c.vel.z); if (sp < 0.1) return;
  const boost = Math.max(sp, 11.5) / sp;
  c.vel.x *= boost; c.vel.z *= boost;
  c.sliding = true; c.crouch = false; c.height = CROUCH_H; c.slideT = 0;
  if (c.isPlayer) SFX.slide && SFX.slide(c.pos);
}
// slope-aware slide: downhill keeps you going, uphill and friction bleed speed; steering is limited
function slidePhysics(c, dt, wx, wz, wantCrouch) {
  let sp = Math.hypot(c.vel.x, c.vel.z);
  if (sp < 0.01) sp = 0.01;
  let dx = c.vel.x / sp, dz = c.vel.z / sp;
  const y0 = c.pos.y + 0.6, a = surfaceBelow(c.pos.x + dx * 0.6, y0, c.pos.z + dz * 0.6), b = surfaceBelow(c.pos.x - dx * 0.6, y0, c.pos.z - dz * 0.6);
  const slope = clamp((a - b) / 1.2, -1, 1);
  c.slideT += dt;
  sp += (-slope * 15 - (c.grounded ? 3.4 : 0.6)) * dt;
  sp = Math.min(sp, 17);
  if (wx * wx + wz * wz > 0.01) {
    const want = Math.atan2(wx, wz), cur = Math.atan2(dx, dz), d = angleDiff(cur, want);
    const turn = clamp(d, -dt * 1.6, dt * 1.6), nc = cur + turn; dx = Math.sin(nc); dz = Math.cos(nc);
  }
  c.vel.x = dx * Math.max(0, sp); c.vel.z = dz * Math.max(0, sp);
  if (sp < 4.4 || (c.blocked && sp < 7)) { c.sliding = false; if (!setCrouch(c, !!wantCrouch)) setCrouch(c, true); }
}
// climb a ledge up to ~2 m when running or jumping into it
function tryMantle(c) {
  if (c.mantle || c.mode !== 'ground') return false;
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  const px = c.pos.x + fx * 0.8, pz = c.pos.z + fz * 0.8;
  const top = surfaceBelow(px, c.pos.y + 2.2, pz), dh = top - c.pos.y;
  if (dh < 0.75 || dh > 2.25) return false;
  let h = raycastWorld(px, top + 0.06, pz, 0, 1, 0, 1.95, false);
  if (h.t < 1.9 && h.c) return false;
  h = raycastWorld(c.pos.x, c.pos.y + 1.7, c.pos.z, fx, 0, fz, 0.9, false);
  if (h.t < 0.85 && (h.terrain || (h.c && h.c.maxY > top + 0.3))) return false;
  c.mantle = { t: 0, dur: 0.22 + dh * 0.1, fx: c.pos.x, fy: c.pos.y, fz: c.pos.z, tx: px, ty: top, tz: pz };
  c.vel.set(0, 0, 0); c.sliding = false; setCrouch(c, false);
  if (c.isPlayer) { SFX.mantle && SFX.mantle(c.pos); }
  return true;
}
function updateMantle(c, dt) {
  const M = c.mantle; M.t += dt;
  const k = Math.min(1, M.t / M.dur), up = Math.min(1, k / 0.6), fw = k < 0.45 ? 0 : (k - 0.45) / 0.55;
  const e = 1 - (1 - up) * (1 - up);
  c.pos.set(lerp(M.fx, M.tx, fw * fw * (3 - 2 * fw)), lerp(M.fy, M.ty + 0.05, e), lerp(M.fz, M.tz, fw * fw * (3 - 2 * fw)));
  if (k >= 1) { c.mantle = null; c.pos.y = M.ty; c.grounded = true; c.vel.set(-Math.sin(c.yaw) * 3, 0, -Math.cos(c.yaw) * 3); if (c.anim) c.anim.land = 0.35; }
}
function landed(c) {
  const vy = c.vel.y;
  if (c.mode === 'sky' || c.mode === 'glide') {
    c.mode = 'ground'; c.rig.glider.visible = false; c.landedAt = GAME.time;
    if (c.isPlayer) { SFX.land(c.pos); SFX.loop('wind', 0); }
    if (c.rig.root.visible) VFX.landDust(c, 0.6);
    return;
  }
  if (vy < -19.5) {
    const dmg = Math.round((-vy - 19.5) * 6);
    if (dmg > 0) applyDamage(c, dmg, null, 'fall', false, 'fall');
  }
  if (c.isPlayer && vy < -8) SFX.land(c.pos, surfaceOf(c));
  if (c.anim && vy < -6) c.anim.land = clamp((-vy - 4) / 16, 0.15, 1);
  if (vy < -9 && c.rig.root.visible && camera.position.distanceToSquared(c.pos) < 2500) VFX.landDust(c, clamp((-vy - 9) / 14, 0, 1));
  if (c.isPlayer && vy < -12) CAM.shake = Math.min(1, CAM.shake + clamp((-vy - 12) / 20, 0, 0.5));
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
  if (giveItem(c, it)) { removeItem(it); if (c.isPlayer) { SFX.pickup(it.rarity || 0); afterPickup(c); } return true; }
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
function weaponScore(id, r) { return (WEAPONS[id].score || 40) + r * 8; }
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
  if (c.isPlayer) SFX.reload(w.id, c.reloadTotal);
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
  if (def.throwable || def.placeable) return true;
  if (def.regen) return c.hp < 100 || c.shield < 100;
  if (def.heal) return c.hp < def.cap;
  return c.shield < def.cap;
}
function startUse(c) {
  const it = curItem(c); if (!it || it.kind !== 'consumable' || c.using) return false;
  const def = CONSUMABLES[it.id];
  if (def.throwable || def.placeable) return false;
  if (!consumableUseful(c, def)) { if (c.isPlayer) HUD.banner(def.heal ? 'Health is full' : 'Shields are full', '', 1.2); return false; }
  c.using = it; c.useT = 0; c.useTotal = def.time;
  if (c.isPlayer) SFX.useStart(it.id);
  return true;
}
function finishUse(c) {
  const it = c.using; c.using = null;
  if (!it || it.count <= 0) return;
  const def = CONSUMABLES[it.id];
  if (def.heal) c.hp = Math.min(def.cap, Math.max(c.hp, Math.min(100, c.hp + def.heal)));
  if (def.shield) c.shield = Math.min(def.cap, Math.max(c.shield, Math.min(100, c.shield + def.shield)));
  if (def.regen) c.regen = (c.regen || 0) + def.regen;
  it.count--;
  if (it.count <= 0) { const k = c.inv.indexOf(it); if (k >= 0) c.inv[k] = null; if (c.slot === k) { c.slot = -1; updateHeld(c); } }
  if (c.isPlayer) SFX.heal(!!def.shield);
}
function tickTimers(c, dt) {
  if (c.regen > 0) { const k = Math.min(c.regen, dt * 5); c.regen -= k; if (c.hp < 100) c.hp = Math.min(100, c.hp + k); else c.shield = Math.min(100, c.shield + k); }
  if (c.burstQ > 0) c.burstT -= dt;
  if (c.spinning) c.spin = Math.min(1, (c.spin || 0) + dt / 0.65); else c.spin = Math.max(0, (c.spin || 0) - dt * 1.4);
  c.spinning = false;
  if (c.throwT > 0) c.throwT -= dt;
  if (c.fireCD > 0) c.fireCD -= dt;
  if (c.swingT > 0) c.swingT -= dt;
  c.bloom = Math.max(0, c.bloom - dt * 0.12);
  if (c.reloadT > 0) { c.reloadT -= dt; if (c.reloadT <= 0) { c.reloadT = 0; finishReload(c); } }
  if (c.autoReload > 0) { c.autoReload -= dt; if (c.autoReload <= 0) startReload(c); }
  if (c.using) { c.useT += dt; if (c.useT >= c.useTotal) finishUse(c); }
}
function eyeOf(c, out) { return out.set(c.pos.x, c.pos.y + (c.eyeH || 1.6), c.pos.z); }
function surfaceOf(c) {
  if (c.pos.y < 0.12) return 'water';
  if (c.groundC) { const k = colMatKind(c.groundC); return k === 'dirt' ? 'stone' : k; }
  const bw = biomeAt(c.pos.x, c.pos.z, c.pos.y); if (bw.snow > 0.5) return 'snow'; if (bw.desert > 0.5) return 'sand';
  if (grassWeight(c.pos.x, c.pos.z) > 0.45) return 'grass';
  return c.pos.y < 1.8 ? 'sand' : 'dirt';
}
function footstep(c, sp) {
  if (camera.position.distanceToSquared(c.pos) > 2025) return;
  _tmpV.set(c.pos.x, c.pos.y + 0.1, c.pos.z);
  SFX.step(_tmpV, surfaceOf(c), c.crouch ? 0.35 : sp > 7.5 ? 1.25 : 0.85);
}
function stepNoise(c, sp) {
  if (!c.crouch) makeNoise(c.pos.x, c.pos.y, c.pos.z, sp > 7.5 ? 16 : 9, c);
}
function tickEye(c, dt) { c.eyeH += (c.height * 0.8 - c.eyeH) * Math.min(1, dt * 14); }
function muzzleOf(c, out) {
  const R = c.rig;
  if (R && R.muzzle && R.root.visible && R.muzzle.parent) { R.muzzle.getWorldPosition(out); return out; }
  const fx = -Math.sin(c.yaw) * Math.cos(c.pitch), fy = Math.sin(c.pitch), fz = -Math.cos(c.yaw) * Math.cos(c.pitch);
  return out.set(c.pos.x + fx * 0.9 + Math.cos(c.yaw) * 0.32, c.pos.y + 1.45 + fy * 0.9, c.pos.z + fz * 0.9 - Math.sin(c.yaw) * 0.32);
}
