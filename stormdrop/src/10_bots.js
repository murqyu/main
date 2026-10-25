// ---------- bots 2.0: personalities, sight + hearing, A* movement, cover, build fights, grenades, gadgets, AI LOD ----------
const DIFF = {
  casual: { aim: 1.6, react: 1.5, build: 0.45, dmg: 0.55 },
  normal: { aim: 1.0, react: 1.0, build: 1.0, dmg: 0.8 },
  sweaty: { aim: 0.62, react: 0.6, build: 1.7, dmg: 1.0 },
};
const NAME_A = ['Pixel', 'Turbo', 'Sneaky', 'Salty', 'Cosmic', 'Glitch', 'Tilted', 'Captain', 'Lucky', 'Silent', 'Hyper', 'Mega', 'Frosty', 'Shadow', 'Rapid', 'Lil', 'Big', 'Crispy', 'Wobbly', 'Spicy', 'Zesty', 'Rogue', 'Neon', 'Atomic', 'Fuzzy', 'Quiet', 'Sir', 'Doctor', 'Baron', 'Grumpy'];
const NAME_B = ['Panda', 'Taco', 'Builder', 'Sniper', 'Ninja', 'Llama', 'Potato', 'Wizard', 'Goose', 'Falcon', 'Badger', 'Nugget', 'Cactus', 'Raptor', 'Pickle', 'Yeti', 'Ghost', 'Waffle', 'Viper', 'Moose', 'Otter', 'Dingo', 'Comet', 'Gecko', 'Muffin', 'Walrus'];
const usedNames = new Set();
function botName() {
  for (let i = 0; i < 100; i++) {
    const a = NAME_A[Math.floor(Math.random() * NAME_A.length)], b = NAME_B[Math.floor(Math.random() * NAME_B.length)], s = Math.random();
    const n = s < 0.35 ? a + b + Math.floor(Math.random() * 99 + 1) : s < 0.6 ? a + '_' + b : s < 0.8 ? 'x' + a + b + 'x' : b + a + Math.floor(Math.random() * 900 + 100);
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  return 'Bot' + Math.floor(Math.random() * 9999);
}
// how a bot likes to play: where it lands, how far it fights from, how much it builds, how it reacts to noise
const PERSONAS = {
  rusher:  { w: 3, drop: 'hot',  range: 1.0, pref: 0.75, build: 1.25, aggro: 0.9, camp: 0,   cover: 0.4 },
  builder: { w: 2, drop: 'mid',  range: 1.0, pref: 0.9,  build: 1.9,  aggro: 0.6, camp: 0.1, cover: 0.5 },
  sniper:  { w: 2, drop: 'edge', range: 1.6, pref: 1.6,  build: 0.8,  aggro: 0.25, camp: 0.6, cover: 0.8 },
  camper:  { w: 2, drop: 'edge', range: 1.1, pref: 1.1,  build: 1.0,  aggro: 0.15, camp: 0.9, cover: 0.9 },
  looter:  { w: 3, drop: 'mid',  range: 1.0, pref: 1.0,  build: 1.0,  aggro: 0.4, camp: 0.25, cover: 0.6 },
};
const PERSONA_W = Object.keys(PERSONAS).map((k) => [k, PERSONAS[k].w]);
const bots = [];
function makeBot() {
  const b = makeCharacter(false, botName(), randomOutfit());
  const persona = weighted(PERSONA_W);
  Object.assign(b, {
    persona, P: PERSONAS[persona], team: 0,
    skill: mr(0.25, 1), state: 'bus', think: Math.random() * 0.3, target: null, lastSeen: -99, lastSeenPos: new V3(), visible: false,
    moveTarget: new V3(), hasMove: false, moveKind: '', strafe: 1, strafeT: 0, reactT: 0, burst: 0, burstLen: 6,
    stuckT: 0, stuckCount: 0, lastPos: new V3(), harvestC: null, lootTarget: null, buildCD: 0, jumpAt: mr(0.05, 0.9),
    dropTarget: new V3(), aimSettle: 1, wantJump: false, healCD: 0, lootBan: new Set(), lootSince: 0,
    alert: null, path: null, pathI: 0, pathT: -99, pathTo: null, pathQueued: false, cover: null, coverT: 0, rush: 0, rushT: 0, nadeCD: 0, gadgetCD: 0, killEmoteT: 0, emoteEnd: 0, lodAcc: 0, campSpot: null, wantSprint: false,
  });
  return b;
}
// each POI only takes so many landers; the rest spread out over the island
const DROPS = new Map();
function chooseDrop(b) {
  let x, z;
  const cap = (p) => Math.max(3, Math.round(p.r / 6));
  const open = (p) => (DROPS.get(p) || 0) < cap(p);
  const pois = WORLD.pois.filter((p) => p.type !== 'vault' && open(p));
  const hot = pois.filter((p) => p.type === 'city' || p.type === 'factory' || p.type === 'lodge' || p.type === 'docks');
  const mode = b.P.drop, r = Math.random();
  if (mode === 'hot' && hot.length && r < 0.55) { const p = pick(hot); DROPS.set(p, (DROPS.get(p) || 0) + 1); const a = Math.random() * TAU, d = Math.random() * p.r * 0.8; x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d; }
  else if (mode !== 'edge' && pois.length && r < 0.6) { const p = pick(pois); DROPS.set(p, (DROPS.get(p) || 0) + 1); const a = Math.random() * TAU, d = Math.random() * p.r * 0.8; x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d; }
  else { for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * WORLD.islandR * 0.92; x = Math.cos(a) * d; z = Math.sin(a) * d; if (groundH(x, z) > 2) break; } }
  b.dropTarget.set(x, 0, z);
}
// ---------- perception ----------
const NOISE = [];
function makeNoise(x, y, z, r, src) { NOISE.push({ x, y, z, r, src, t: GAME.time }); if (NOISE.length > 96) NOISE.shift(); }
function sameTeam(a, b) { return !!(a && b && a.team && a.team === b.team); }
const _e1 = new V3(), _e2 = new V3(), _e3 = new V3();
function hasLOS(a, b) {
  eyeOf(a, _e1);
  let dx = b.pos.x - _e1.x, dy = b.pos.y + (b.height || 2) * 0.6 - _e1.y, dz = b.pos.z - _e1.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 0.5) return true;
  dx /= d; dy /= d; dz /= d;
  return raycastWorld(_e1.x, _e1.y, _e1.z, dx, dy, dz, d, true).t >= d - 0.4;
}
function hasWeapon(c) { for (const s of c.inv) if (s && s.kind === 'weapon') return true; return false; }
function findTarget(b) {
  const longGun = b.inv.some((s) => s && (s.id === 'sniper' || s.id === 'heavy'));
  const range = (longGun ? 160 : 95) * b.P.range;
  let best = null, bd = range * range;
  for (const c of characters) {
    if (c === b || !c.alive || c.mode === 'bus' || sameTeam(b, c)) continue;
    if (b.npc && c.npc) continue;
    const dx = c.pos.x - b.pos.x, dy = c.pos.y - b.pos.y, dz = c.pos.z - b.pos.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= bd) continue;
    if (c.mode !== 'ground' && d2 > 900) continue;
    // field of view, unless they shot us or we heard them
    const heard = b.alert && b.alert.src === c && GAME.time - b.alert.t < 3;
    if (c !== b.lastAttacker && !heard && d2 > 64 && Math.abs(angleDiff(b.yaw, Math.atan2(-dx, -dz))) > 1.9) continue;
    if (c.crouch && d2 > 900 && Math.random() < 0.5) continue;
    if (!hasLOS(b, c)) continue;
    best = c; bd = d2;
  }
  return best;
}
function hear(b) {
  for (let i = NOISE.length - 1; i >= 0; i--) {
    const n = NOISE[i]; if (GAME.time - n.t > 1.5) break;
    if (n.src === b || sameTeam(n.src, b) || (b.npc && n.src && n.src.npc)) continue;
    const dx = n.x - b.pos.x, dz = n.z - b.pos.z;
    if (dx * dx + dz * dz < n.r * n.r) { b.alert = { x: n.x, z: n.z, t: GAME.time, src: n.src }; return true; }
  }
  return false;
}
// ---------- weapons + loot ----------
function weaponFit(id, d) { const f = WEAPONS[id].fit; if (!f) return 0; return d >= f[0] && d <= f[1] ? f[2] : f[3]; }
function chooseWeapon(b, d) {
  let best = -1, bs = -999, cur = -999;
  for (let i = 0; i < 5; i++) {
    const s = b.inv[i]; if (!s || s.kind !== 'weapon') continue;
    const sc = weaponFit(s.id, d) + s.rarity * 4 - (s.mag <= 0 ? 15 : 0) + (b.persona === 'sniper' && (s.id === 'sniper' || s.id === 'heavy') ? 15 : 0);
    if (i === b.slot) cur = sc;
    if (sc > bs) { bs = sc; best = i; }
  }
  if (best >= 0 && best !== b.slot && bs > cur + 10) { selectSlot(b, best); b.fireCD = Math.max(b.fireCD, 0.35); }
  if (best < 0 && b.slot !== -1) selectSlot(b, -1);
}
function prefDist(b) { const w = curWeapon(b); if (!w) return 2; return (WEAPONS[w.id].pref || 20) * b.P.pref; }
function countCons(b) { let n = 0; for (const s of b.inv) if (s && s.kind === 'consumable') n += s.count; return n; }
function invCount(b, id) { let n = 0; for (const s of b.inv) if (s && s.kind === 'consumable' && s.id === id) n += s.count; return n; }
function botWants(b, it) {
  if (it.kind === 'mats') return true;
  if (it.kind === 'ammo') return false;
  if (it.kind === 'consumable') {
    if (b.inv.some((s) => s && s.kind === 'consumable' && s.id === it.id && s.count < CONSUMABLES[it.id].stack)) return true;
    return countCons(b) < 5 && freeSlot(b) >= 0;
  }
  if (b.inv.some((s) => s && s.kind === 'weapon' && s.id === it.id && s.rarity >= it.rarity)) return false;
  let nW = 0, worst = Infinity;
  for (const s of b.inv) if (s && s.kind === 'weapon') { nW++; worst = Math.min(worst, weaponScore(s.id, s.rarity)); }
  if (nW < 3 && freeSlot(b) >= 0) return true;
  return weaponScore(it.id, it.rarity) > worst + 6;
}
function botPickupNearby(b) {
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const it = ITEMS[i]; if (!it || !it.alive || it.age < 0.4) continue;
    const dx = it.pos.x - b.pos.x, dz = it.pos.z - b.pos.z;
    if (dx * dx + dz * dz > 5 || Math.abs(it.pos.y - b.pos.y) > 2) continue;
    if (!botWants(b, it)) continue;
    if (it.kind === 'weapon') {
      let nW = 0; for (const s of b.inv) if (s && s.kind === 'weapon') nW++;
      if (nW >= 3 || freeSlot(b) < 0) {
        let wi = -1, ws = Infinity;
        for (let k = 0; k < 5; k++) { const s = b.inv[k]; if (s && s.kind === 'weapon') { const sc = weaponScore(s.id, s.rarity); if (sc < ws) { ws = sc; wi = k; } } }
        if (wi >= 0) { const old = b.inv[wi]; b.inv[wi] = null; if (b.slot === wi) { b.slot = -1; updateHeld(b); } dropItem(invToItem(old), b.pos.x, b.pos.y + 0.5, b.pos.z, mr(-1, 1), 3, mr(-1, 1)); }
      }
    }
    pickupItem(b, it);
    if (b.slot === -1 && hasWeapon(b)) selectSlot(b, b.inv.findIndex((s) => s && s.kind === 'weapon'));
    else updateHeld(b);
    return;
  }
}
function needsLoot(b) {
  let nW = 0; for (const s of b.inv) if (s && s.kind === 'weapon') nW++;
  return nW < 2 || countCons(b) < 1 + (b.persona === 'looter' ? 2 : 0);
}
function lootValid(t) { return t.opened === undefined ? t.alive : !t.opened; }
function findLoot(b) {
  let best = null, bd = 75 * 75;
  for (const ch of CHESTS) {
    if (ch.opened || b.lootBan.has(ch)) continue;
    const dy = ch.pos.y - b.pos.y; if (dy > 2.5 || dy < -6) continue;
    const dx = ch.pos.x - b.pos.x, dz = ch.pos.z - b.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = ch; }
  }
  for (const it of ITEMS) {
    if (!it.alive || b.lootBan.has(it)) continue;
    const dy = it.pos.y - b.pos.y; if (dy > 2.5 || dy < -6 || !botWants(b, it)) continue;
    const dx = it.pos.x - b.pos.x, dz = it.pos.z - b.pos.z, d2 = (dx * dx + dz * dz) * 1.3;
    if (d2 < bd) { bd = d2; best = it; }
  }
  return best;
}
const _hq = [];
function destructible(col) { return col && col.alive && (col.piece || col.hp !== Infinity); }
function findHarvest(b, r) {
  queryBox(b.pos.x - r, b.pos.z - r, b.pos.x + r, b.pos.z + r, _hq);
  let best = null, bd = r * r;
  for (const c of _hq) {
    if (c.kind !== 'tree' && c.kind !== 'rock') continue;
    const dx = (c.minX + c.maxX) / 2 - b.pos.x, dz = (c.minZ + c.maxZ) / 2 - b.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
function pickHeal(b) {
  let best = -1, bs = 0;
  for (let i = 0; i < 5; i++) {
    const s = b.inv[i]; if (!s || s.kind !== 'consumable') continue;
    const def = CONSUMABLES[s.id]; if (def.throwable || def.placeable || !consumableUseful(b, def)) continue;
    const sc = def.regen ? (200 - b.hp - b.shield) * 0.6 : def.heal ? (100 - b.hp) : (100 - b.shield) * 0.8 + 5;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
function pickRoam(b, circ) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * circ.r * 0.75;
    const x = circ.x + Math.cos(a) * r, z = circ.z + Math.sin(a) * r;
    if (groundH(x, z) > 1 && !NAV.blocked(x, z)) { setMove(b, x, z, 'roam'); return; }
  }
  setMove(b, circ.x, circ.z, 'roam');
}
// campers hold a building near the safe zone
function pickCamp(b, circ) {
  let best = null, bd = 1e9;
  for (const s of WORLD.lootSpots) {
    if (s.kind !== 'chest' && s.kind !== 'floor') continue;
    const dz = Math.hypot(s.x - circ.x, s.z - circ.z); if (dz > circ.r * 0.7) continue;
    if (Math.abs(s.y - groundH(s.x, s.z)) > 1.5) continue;
    const d = Math.hypot(s.x - b.pos.x, s.z - b.pos.z) + Math.random() * 40;
    if (d < bd) { bd = d; best = s; }
  }
  b.campSpot = best ? new V3(best.x, best.y, best.z) : null;
}
// ---------- movement plumbing ----------
function setMove(b, x, z, kind) {
  const changed = !b.hasMove || Math.hypot(b.moveTarget.x - x, b.moveTarget.z - z) > 3;
  b.moveTarget.set(x, 0, z); b.hasMove = true; b.moveKind = kind;
  if (changed) wantPath(b, x, z);
}
const PATHQ = [];
function wantPath(b, x, z) {
  b.pathTo = { x, z };
  if (!b.pathQueued) { b.pathQueued = true; PATHQ.push(b); }
}
function processPaths(budget) {
  while (budget-- > 0 && PATHQ.length) {
    const b = PATHQ.shift(); b.pathQueued = false;
    if (!b.alive || !b.pathTo || b.mode !== 'ground') continue;
    const elevated = b.pos.y > walkH(b.pos.x, b.pos.z) + 1.4;
    b.path = elevated || !NAV.ready ? null : NAV.find(b.pos.x, b.pos.z, b.pathTo.x, b.pathTo.z, 22000);
    b.pathI = 0; b.pathT = GAME.time;
  }
}
// next point to walk toward: path waypoint if we have one, else the raw move target
function waypoint(b) {
  const P = b.path;
  if (P && b.pathI < P.length) {
    let w = P[b.pathI];
    while (Math.hypot(w[0] - b.pos.x, w[1] - b.pos.z) < 1.3 && b.pathI < P.length - 1) { b.pathI++; w = P[b.pathI]; }
    return w;
  }
  return null;
}
function blockedAhead(b, dx, dz) {
  const ox = b.pos.x, oy = b.pos.y + 0.9, oz = b.pos.z;
  const h = raycastWorld(ox, oy, oz, dx, 0, dz, 1.7, true);
  if (h.t < 1.7 && !(h.c && h.c.shape !== 'box')) return true;
  if (groundH(ox + dx * 2.5, oz + dz * 2.5) < -2.3) return true;
  return false;
}
// ---------- cover ----------
function findCover(b, from) {
  eyeOf(from, _e2);
  let best = null, bs = 1e9;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, r = i % 2 ? 4 : 8, x = b.pos.x + Math.cos(a) * r, z = b.pos.z + Math.sin(a) * r;
    if (NAV.blocked(x, z)) continue;
    const y = walkH(x, z) + 1.3;
    const dx = _e2.x - x, dy = _e2.y - y, dz = _e2.z - z, d = Math.hypot(dx, dy, dz);
    const h = raycastWorld(x, y, z, dx / d, dy / d, dz / d, d, true);
    if (h.t >= d - 0.5) continue;               // the enemy can see this spot
    const sc = r + Math.max(0, 14 - d) * 0.5;
    if (sc < bs) { bs = sc; best = new V3(x, 0, z); }
  }
  return best;
}
function tryLoot(b) {
  const L = b.lootTarget; if (!L) return;
  const dx = L.pos.x - b.pos.x, dz = L.pos.z - b.pos.z;
  if (dx * dx + dz * dz > 5.5 || Math.abs(L.pos.y - b.pos.y) > 2.5) return;
  if (L.opened === false) openChest(L, b);
  b.lootTarget = null; b.hasMove = false; b.think = 0.5;
}
// ---------- brain ----------
function botThink(b) {
  const now = GAME.time, D = DIFF[SETTINGS.diff];
  const t = findTarget(b);
  if (t) {
    if (b.target !== t) { b.target = t; b.reactT = lerp(1.1, 0.4, b.skill) * D.react * (b.lastAttacker === t ? 0.6 : 1); b.aimSettle = 2.4; }
    b.visible = true; b.lastSeen = now; b.lastSeenPos.copy(t.pos);
  } else { b.visible = false; if (b.target && (!b.target.alive || now - b.lastSeen > 5)) b.target = null; }
  if (!b.visible) hear(b);
  if (b.emote) { if (now > b.emoteEnd || b.visible || now - b.lastHurt < 1) stopEmote(b); else return; }
  if (b.npc) { npcThink(b, now); return; }
  botPickupNearby(b);
  const S = STORM;
  const circ = (S.state === 'shrink' || (S.state === 'wait' && S.timer < 25)) ? S.to : S.cur;
  const dC = Math.hypot(b.pos.x - circ.x, b.pos.z - circ.z);
  const outside = dC > Math.max(4, circ.r * 0.9), stormy = inStorm(b.pos);
  b.wantSprint = true;
  // taunt after a kill when nobody is around
  if (b.killEmoteT && now > b.killEmoteT) { b.killEmoteT = 0; if (!b.visible && Math.random() < 0.45 && b.grounded) { playEmote(b, pick(['victory', 'robot', 'hype', 'shuffle', 'wave'])); b.emoteEnd = now + mr(1.6, 2.6); b.hasMove = false; return; } }
  // heal when safe (in cover if we have it)
  if (!b.using && !b.visible && now - b.lastHurt > 2 && (b.hp < 70 || b.shield < 50) && now > b.healCD && !(stormy && b.hp > 30)) {
    if (b.hp < 60 && invCount(b, 'campfire') && now > b.gadgetCD) { const k = b.inv.findIndex((s) => s && s.id === 'campfire'); if (k >= 0) { selectSlot(b, k); useGadget(b, b.inv[k], eyeOf(b, _e1), _e2.set(-Math.sin(b.yaw), 0, -Math.cos(b.yaw))); b.gadgetCD = now + 20; } }
    const s = pickHeal(b);
    if (s >= 0) { selectSlot(b, s); if (!startUse(b)) b.healCD = now + 3; }
  }
  if (b.using) { b.state = 'heal'; b.hasMove = false; setCrouch(b, true); return; }
  if (b.crouch && b.state !== 'camp') setCrouch(b, false);
  // fight
  if (b.target && b.target.alive && (b.visible || now - b.lastSeen < 4) && !(stormy && dC > circ.r + 30)) {
    const d = b.pos.distanceTo(b.target.pos);
    // pick fights we can win: fresh landers loot unless someone is close, nobody starts fights out of their gun's range
    const provoked = b.lastAttacker === b.target && now - b.lastHurt < 6;
    const w = curWeapon(b), reach = w ? (WEAPONS[w.id].fit ? WEAPONS[w.id].fit[1] : 60) : 4;
    const fresh = now - (b.landedAt || 0) < 60 && !provoked && d > 12;
    const tooFar = !provoked && d > Math.min(reach, 70) * (b.persona === 'rusher' ? 1.1 : 0.85) && b.state !== 'fight';
    const weak = !provoked && b.shield <= 0 && b.hp < 60 && d > 15;
    if ((fresh || tooFar || weak) && !b.npc) { b.target = null; b.visible = false; }
    else if (hasWeapon(b) || (d < 4 && provoked)) {
      b.state = 'fight'; b.harvestC = null; b.wantSprint = false;
      chooseWeapon(b, d);
      // break line of sight to heal or reload when losing the trade
      const losing = b.hp + b.shield < 55 && (b.target.hp + b.target.shield) > b.hp + b.shield + 20;
      if ((losing || (b.reloadT > 0 && d < 30)) && Math.random() < b.P.cover && now > b.coverT) { b.cover = findCover(b, b.target); b.coverT = now + 4; if (b.cover) wantPath(b, b.cover.x, b.cover.z); }
      if (b.cover && Math.hypot(b.cover.x - b.pos.x, b.cover.z - b.pos.z) < 1.2 && !b.visible) { b.cover = null; b.healCD = 0; }
      if (!b.visible && !b.cover) setMove(b, b.lastSeenPos.x, b.lastSeenPos.z, 'chase');
      return;
    }
  }
  b.cover = null;
  if (b.harvestC && b.harvestC.alive) { b.state = 'harvest'; return; }
  b.harvestC = null;
  if (outside || stormy) {
    b.state = 'storm';
    // long rotations: drop a launch pad and fly
    if (dC > 220 && invCount(b, 'launchpad') && now > b.gadgetCD && b.grounded) { const k = b.inv.findIndex((s) => s && s.id === 'launchpad'); selectSlot(b, k); b.yaw = Math.atan2(-(circ.x - b.pos.x), -(circ.z - b.pos.z)); if (useGadget(b, b.inv[k], eyeOf(b, _e1), _e2)) { b.gadgetCD = now + 30; b.dropTarget.set(circ.x, 0, circ.z); setMove(b, b.pos.x - Math.sin(b.yaw) * 3, b.pos.z - Math.cos(b.yaw) * 3, 'pad'); return; } }
    if (!b.hasMove || b.moveKind !== 'storm' || Math.hypot(b.moveTarget.x - circ.x, b.moveTarget.z - circ.z) > circ.r * 0.8) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * circ.r * 0.6;
      setMove(b, circ.x + Math.cos(a) * r, circ.z + Math.sin(a) * r, 'storm');
    }
    return;
  }
  // investigate gunfire, depending on temperament
  if (b.alert && now - b.alert.t < 6 && hasWeapon(b) && now > (b.huntCD || 0) && Math.hypot(b.alert.x - b.pos.x, b.alert.z - b.pos.z) < 70 && Math.random() < b.P.aggro * 0.6) {
    b.huntCD = now + 20;
    b.state = 'hunt'; b.huntUntil = now + 12; setMove(b, b.alert.x + mr(-6, 6), b.alert.z + mr(-6, 6), 'hunt'); b.wantSprint = Math.hypot(b.alert.x - b.pos.x, b.alert.z - b.pos.z) > 40;
    if (b.alert.src && b.alert.src.alive) b.yaw = turnToward(b.yaw, Math.atan2(-(b.alert.x - b.pos.x), -(b.alert.z - b.pos.z)), 0.5);
    return;
  }
  if (b.state === 'hunt' && now < (b.huntUntil || 0) && b.hasMove) return;
  if (needsLoot(b)) {
    if (b.lootTarget && now - b.lootSince > 14) { b.lootBan.add(b.lootTarget); b.lootTarget = null; }
    if (!b.lootTarget || !lootValid(b.lootTarget)) { b.lootTarget = findLoot(b); b.lootSince = now; }
    if (b.lootTarget) { b.state = 'loot'; const p = b.lootTarget.pos; setMove(b, p.x, p.z, 'loot'); return; }
  }
  if (b.mats.wood + b.mats.stone + b.mats.metal < 80 && Math.random() < 0.1) { const tr = findHarvest(b, 18); if (tr) { b.harvestC = tr; b.state = 'harvest'; return; } }
  // campers settle in; others roam
  if (Math.random() < b.P.camp * 0.2 && !b.campSpot) pickCamp(b, circ);
  if (b.campSpot && Math.hypot(b.campSpot.x - circ.x, b.campSpot.z - circ.z) < circ.r * 0.8) {
    b.state = 'camp';
    if (Math.hypot(b.campSpot.x - b.pos.x, b.campSpot.z - b.pos.z) > 2) setMove(b, b.campSpot.x, b.campSpot.z, 'camp');
    else { b.hasMove = false; b.wantSprint = false; if (!b.crouch) setCrouch(b, true); b.yaw += 0.6 * (Math.random() - 0.5); }
    return;
  }
  b.campSpot = null;
  b.state = 'roam';
  if (!b.hasMove || b.moveKind !== 'roam') pickRoam(b, circ);
}
// vault crew hold their post and fight whatever comes close
function npcThink(b, now) {
  if (b.target && b.target.alive && (b.visible || now - b.lastSeen < 3) && b.pos.distanceTo(b.post) < 55) { b.state = 'fight'; chooseWeapon(b, b.pos.distanceTo(b.target.pos)); if (!b.visible) setMove(b, b.lastSeenPos.x, b.lastSeenPos.z, 'chase'); return; }
  if (b.hp < 60 && now > b.healCD) { const s = pickHeal(b); if (s >= 0) { selectSlot(b, s); if (!startUse(b)) b.healCD = now + 4; } }
  if (b.using) { b.state = 'heal'; return; }
  b.state = 'guard'; b.wantSprint = false;
  if (b.alert && now - b.alert.t < 4 && Math.hypot(b.alert.x - b.post.x, b.alert.z - b.post.z) < 45) b.yaw = turnToward(b.yaw, Math.atan2(-(b.alert.x - b.pos.x), -(b.alert.z - b.pos.z)), 0.6);
  if (!b.hasMove || Math.hypot(b.pos.x - b.post.x, b.pos.z - b.post.z) > 7) setMove(b, b.post.x + mr(-4, 4), b.post.z + mr(-4, 4), 'guard');
  if (b.slot < 0 || !curWeapon(b)) { const k = b.inv.findIndex((s) => s && s.kind === 'weapon'); if (k >= 0) selectSlot(b, k); }
}
function onBotDamaged(b, src) {
  const now = GAME.time, D = DIFF[SETTINGS.diff];
  b.lastAttacker = src;
  if (b.emote) stopEmote(b);
  if (src.alive && !sameTeam(b, src)) {
    const dS = b.pos.distanceTo(src.pos);
    if (!b.target || b.target === src || !b.target.alive || dS < b.pos.distanceTo(b.target.pos) * 0.8) {
      if (b.target !== src) { b.target = src; b.reactT = lerp(0.5, 0.15, b.skill) * D.react; b.aimSettle = 1.6; }
      b.lastSeen = now; b.lastSeenPos.copy(src.pos);
    }
  }
  if (b.using && Math.random() < 0.7) b.using = null;
  if (b.mode !== 'ground' || b.vehicle) return;
  const mats = b.mats.wood + b.mats.stone + b.mats.metal, bk = b.P.build * D.build;
  if (mats >= 10 && now > b.buildCD && Math.random() < (0.3 + 0.5 * b.skill) * bk) {
    b.buildCD = now + mr(1.0, 2.6) / bk;
    const yaw = Math.atan2(-(src.pos.x - b.pos.x), -(src.pos.z - b.pos.z));
    if (b.hp + b.shield < 70 && Math.random() < 0.55 && mats >= 40) {
      for (const y of [-Math.PI / 2, Math.PI, Math.PI / 2, 0]) tryBuild(b, buildTarget('wall', b, y, 0, 0));
      tryBuild(b, buildTarget('cone', b, yaw, 1.0, 0));
    } else {
      tryBuild(b, buildTarget('wall', b, yaw, 0, 0));
      // skilled builders take height: wall + ramp, and keep pushing
      if (b.skill > 0.45 && mats >= 40 && Math.random() < 0.35 * b.P.build) { tryBuild(b, buildTarget('ramp', b, yaw, 0, 0)); b.rush = 3; b.rushT = 0; }
    }
  }
}
// ramp rush: wall + ramp a step ahead, climb, repeat
function rampRush(b, dt) {
  const tgt = b.target; if (!tgt || b.rush <= 0) return false;
  const mats = b.mats.wood + b.mats.stone + b.mats.metal; if (mats < 20) { b.rush = 0; return false; }
  b.rushT -= dt;
  if (b.rushT <= 0) {
    b.rushT = 0.45 + Math.random() * 0.2; b.rush--;
    const yaw = Math.atan2(-(tgt.pos.x - b.pos.x), -(tgt.pos.z - b.pos.z));
    tryBuild(b, buildTarget('ramp', b, yaw, -0.2, 0)); tryBuild(b, buildTarget('wall', b, yaw, 0.15, 0));
  }
  return true;
}
function botCombat(b, dt) {
  const tgt = b.target; if (!tgt || !tgt.alive) return;
  if (b.using) { if (b.visible && b.pos.distanceTo(tgt.pos) < 25) b.using = null; else return; }
  if (b.reactT > 0) { b.reactT -= dt; return; }
  const w = curWeapon(b);
  b.nadeCD -= dt;
  if (!b.visible) {
    b.aiming = false;
    // flush them out of cover with a grenade
    const dl = b.pos.distanceTo(b.lastSeenPos);
    if (b.nadeCD <= 0 && GAME.time - b.lastSeen < 3 && dl > 7 && dl < 26 && invCount(b, 'grenade') && b.throwT <= 0) {
      const k = b.inv.findIndex((s) => s && s.id === 'grenade'); const prev = b.slot; selectSlot(b, k);
      eyeOf(b, _e1); _e2.set(b.lastSeenPos.x - _e1.x, b.lastSeenPos.y + 1 - _e1.y + dl * 0.18, b.lastSeenPos.z - _e1.z).normalize();
      useGadget(b, b.inv[k], _e1, _e2); b.nadeCD = mr(5, 9); if (prev >= 0 && b.inv[prev]) selectSlot(b, prev);
      return;
    }
    if (w && b.reloadT <= 0 && w.mag < WEAPONS[w.id].mag * 0.5) startReload(b);
    return;
  }
  const d = b.pos.distanceTo(tgt.pos);
  if (!w) {
    if (d < 2.8 && b.swingT <= 0) { eyeOf(b, _e1); _e2.set(tgt.pos.x - _e1.x, tgt.pos.y + 1.1 - _e1.y, tgt.pos.z - _e1.z).normalize(); meleeSwing(b, _e1.x, _e1.y, _e1.z, _e2, 3); }
    return;
  }
  if (b.reloadT > 0) return;
  if (w.mag <= 0) { startReload(b); return; }
  const def = WEAPONS[w.id];
  if (def.spin) { b.spinning = true; if (b.spin < 1) return; }
  if (b.burstQ > 0) { if (b.burstT > 0) return; b.burstQ--; b.burstT = def.burstGap; }
  else if (b.fireCD > 0) return;
  if (d > def.range * 0.92) return;
  const D = DIFF[SETTINGS.diff];
  eyeOf(b, _e1);
  const head = Math.random() < 0.15 * b.skill;
  const H = tgt.height || 2;
  // lead moving targets a little, more for skilled bots
  const lead = b.skill * 0.12 * Math.min(1, d / 40);
  _e2.set(tgt.pos.x + tgt.vel.x * lead - _e1.x, tgt.pos.y + (head ? H * 0.87 : H * 0.52) - _e1.y, tgt.pos.z + tgt.vel.z * lead - _e1.z).normalize();
  let err = lerp(0.105, 0.032, b.skill) * D.aim * b.aimSettle * (1 + Math.max(0, d - 30) / 120);
  err *= 1 + Math.hypot(tgt.vel.x, tgt.vel.z) * 0.035; if (!tgt.grounded) err *= 1.25; if (tgt.crouch) err *= 1.1; if (b.crouch) err *= 0.85;
  applySpread(_e2, err, _e3);
  b.aiming = d > 15 && def.id !== 'shotgun' && def.id !== 'tac';
  fireWeapon(b, w, _e1, _e3); w.mag--;
  const auto = !!def.auto;
  if (def.burst && !(b.burstQ > 0) && b.fireCD <= 0) { b.burstQ = def.burst - 1; b.burstT = def.burstGap; }
  b.fireCD = (1 / def.rate) * (auto ? 1.15 : 1.3) * mr(1, 1.25);
  if (auto) { b.burst++; if (b.burst >= b.burstLen) { b.burst = 0; b.burstLen = 4 + Math.floor(Math.random() * 7); b.fireCD += mr(0.3, 0.8); } }
  b.aimSettle = Math.max(1, b.aimSettle - 0.12);
  if (w.mag <= 0) b.autoReload = 0.3;
}
function deathAnim(c, dt) {
  if (c.deathT <= 0 || !c.rig.root.visible) return;
  c.deathT += dt;
  if (!c.rig.dissolve) startDissolve(c);
  rigDeath(c, dt);
}
function botSky(b, dt) {
  const dx = b.dropTarget.x - b.pos.x, dz = b.dropTarget.z - b.pos.z, d = Math.hypot(dx, dz);
  b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), dt * 3);
  b.pitch = d > 110 ? -0.1 : -1.1;
  skyPhysics(b, dt, 0, d > 3 ? 1 : 0, false);
}
function updateBot(b, dt, camX, camZ) {
  if (!b.alive) { deathAnim(b, dt); return; }
  if (b.mode === 'bus') { if (BUS.t >= b.jumpAt) jumpOut(b); return; }
  const dCam = Math.hypot(b.pos.x - camX, b.pos.z - camZ), near = dCam < 210;
  // AI level of detail: distant, calm bots tick less often
  if (dCam > 290 && b.state !== 'fight' && b.mode === 'ground') { b.lodAcc += dt; if (b.lodAcc < 0.16) return; dt = b.lodAcc; }
  b.lodAcc = 0;
  if (b.mode === 'sky' || b.mode === 'glide') {
    botSky(b, dt);
    if (b.mode === 'ground') rescueFromWater(b);
    b.rig.root.visible = near; if (near) animateRig(b, dt);
    return;
  }
  if (b.mantle) { updateMantle(b, dt); tickEye(b, dt); b.rig.root.visible = near; if (near) animateRig(b, dt); return; }
  b.think -= dt;
  if (b.think <= 0) { b.think = (dCam > 290 ? 0.35 : 0.12) + Math.random() * 0.07; botThink(b); }
  let wx = 0, wz = 0;
  const tgt = b.target;
  if (b.emote) { /* standing still, showing off */ }
  else if (b.state === 'fight' && tgt && b.cover && !b.visible) {
    const w = waypoint(b) || [b.cover.x, b.cover.z], dx = w[0] - b.pos.x, dz = w[1] - b.pos.z, d = Math.hypot(dx, dz) || 1;
    wx = dx / d; wz = dz / d; b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), dt * 7);
  } else if (b.state === 'fight' && tgt && b.visible) {
    const dx = tgt.pos.x - b.pos.x, dz = tgt.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    if (b.cover) { const cw = waypoint(b) || [b.cover.x, b.cover.z], cx = cw[0] - b.pos.x, cz = cw[1] - b.pos.z, cd = Math.hypot(cx, cz) || 1; wx = cx / cd; wz = cz / cd; }
    else if (rampRush(b, dt)) { wx = ux; wz = uz; }
    else {
      const pref = prefDist(b), fwd = d > pref * 1.35 ? 1 : d < pref * 0.6 ? -0.7 : 0;
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = Math.random() < 0.15 ? 0 : (Math.random() < 0.5 ? -1 : 1); b.strafeT = mr(0.45, 1.3); if (b.skill > 0.6 && Math.random() < 0.25 && d < 25) setCrouch(b, !b.crouch); }
      wx = ux * fwd - uz * b.strafe * 0.9; wz = uz * fwd + ux * b.strafe * 0.9;
      // height disadvantage makes builders take the high ground
      if (tgt.pos.y > b.pos.y + 2.5 && b.rush <= 0 && b.P.build > 1 && Math.random() < dt * 0.6 * b.skill) { b.rush = 3; b.rushT = 0; }
    }
    b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), dt * (5 + b.skill * 6));
    b.pitch = Math.atan2(tgt.pos.y - b.pos.y, d);
    if (b.grounded && Math.random() < dt * (0.25 + b.skill * 0.6)) b.wantJump = true;
  } else if (b.state === 'harvest' && b.harvestC) {
    const c = b.harvestC;
    const cx = clamp(b.pos.x, c.minX, c.maxX), cz = clamp(b.pos.z, c.minZ, c.maxZ), dx = cx - b.pos.x, dz = cz - b.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.01) b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), dt * 8);
    if (d > 1.5) { wx = dx / d; wz = dz / d; }
    else if (b.swingT <= 0) {
      if (b.slot !== -1) selectSlot(b, -1);
      eyeOf(b, _e1);
      _e2.set(cx - _e1.x, clamp(_e1.y, c.minY + 0.3, c.maxY - 0.2) - _e1.y, cz - _e1.z);
      if (_e2.lengthSq() < 1e-4) _e2.set(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
      _e2.normalize();
      meleeSwing(b, _e1.x, _e1.y, _e1.z, _e2, 3.2);
      if (!c.alive) { b.harvestC = null; b.state = 'roam'; }
    }
  } else if (b.hasMove) {
    const dx0 = b.moveTarget.x - b.pos.x, dz0 = b.moveTarget.z - b.pos.z, d0 = Math.hypot(dx0, dz0);
    if (b.state === 'loot' && b.lootTarget && d0 < 2.3) tryLoot(b);
    if (d0 < 1.3) b.hasMove = false;
    else {
      if (!b.path && !b.pathQueued && GAME.time - b.pathT > 2.5) wantPath(b, b.moveTarget.x, b.moveTarget.z);
      const w = waypoint(b), tx = w ? w[0] : b.moveTarget.x, tz = w ? w[1] : b.moveTarget.z;
      const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz) || 1;
      wx = dx / d; wz = dz / d; b.yaw = turnToward(b.yaw, Math.atan2(-dx, -dz), dt * 6); b.pitch *= 0.9;
    }
  }
  if ((wx || wz) && b.grounded && b.state !== 'harvest') {
    const len = Math.hypot(wx, wz); let dx = wx / len, dz = wz / len;
    if (blockedAhead(b, dx, dz)) {
      let found = false;
      for (const a of [0.6, -0.6, 1.2, -1.2]) {
        const ca = Math.cos(a), sa = Math.sin(a), nx = dx * ca - dz * sa, nz = dx * sa + dz * ca;
        if (!blockedAhead(b, nx, nz)) { dx = nx; dz = nz; found = true; break; }
      }
      if (!found) { if (!tryMantle(b)) b.wantJump = true; }
      wx = dx * len; wz = dz * len;
    }
  }
  const sp = (b.using ? 2.6 : b.crouch ? 3.6 : b.state === 'fight' ? 6.0 : b.wantSprint ? 8.0 : 6.5) * (b.pos.y < 0.2 ? 0.7 : 1);
  const k = 1 - Math.exp(-(b.grounded ? 10 : 2.5) * dt);
  b.vel.x += (wx * sp - b.vel.x) * k; b.vel.z += (wz * sp - b.vel.z) * k;
  if (b.wantJump && b.grounded) { b.vel.y = 8.2; b.grounded = false; }
  b.wantJump = false;
  charPhysics(b, dt);
  b.stuckT += dt;
  if (b.stuckT > 1.0) {
    const moved = Math.hypot(b.pos.x - b.lastPos.x, b.pos.z - b.lastPos.z), wants = Math.abs(wx) + Math.abs(wz) > 0.2;
    if (wants && moved < 0.8) {
      b.stuckCount++;
      if (b.stuckCount === 1) { b.wantJump = true; b.path = null; if (b.hasMove) wantPath(b, b.moveTarget.x, b.moveTarget.z); }
      else if (b.stuckCount === 2 && destructible(b.blockC)) { b.harvestC = b.blockC; b.state = 'harvest'; }
      else if (b.stuckCount >= 3) { if (b.lootTarget) b.lootBan.add(b.lootTarget); b.hasMove = false; b.lootTarget = null; b.stuckCount = 0; b.harvestC = null; b.cover = null; b.campSpot = null; pickRoam(b, STORM.to); }
    } else b.stuckCount = 0;
    b.lastPos.copy(b.pos); b.stuckT = 0;
  }
  if (b.state === 'fight') botCombat(b, dt); else b.aiming = false;
  tickTimers(b, dt); tickEye(b, dt);
  if (!b.emote) b.modelYaw = b.yaw;
  b.rig.root.visible = near;
  if (near) animateRig(b, dt);
}
