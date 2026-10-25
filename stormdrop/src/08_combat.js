// ---------- combat: hit detection, damage, eliminations, projectiles, effects ----------
const characters = [];
let player = null;
const ROCKETS = [];

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - r * r, disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc); let t = -b - s; if (t < 0) t = -b + s;
  return t >= 0 ? t : -1;
}
function rayCyl(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
  const lx = ox - cx, lz = oz - cz, a = dx * dx + dz * dz;
  if (a < 1e-9) return -1;
  const b = lx * dx + lz * dz, c = lx * lx + lz * lz - r * r, disc = b * b - a * c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc); let t = (-b - s) / a;
  if (t < 0) { if ((-b + s) / a < 0) return -1; t = 0; }
  const y = oy + dy * t; if (y < y0 || y > y1) return -1;
  return t;
}
const CH = { t: 0, c: null, head: false };
function rayCharacters(ox, oy, oz, dx, dy, dz, maxT, ignore) {
  CH.c = null; CH.head = false; let best = maxT;
  for (const c of characters) {
    if (c === ignore || !c.alive || c.mode === 'bus') continue;
    const cx = c.pos.x - ox, cy = c.pos.y + 1 - oy, cz = c.pos.z - oz, tc = cx * dx + cy * dy + cz * dz;
    if (tc < -2 || tc > best + 2) continue;
    const px = cx - dx * tc, py = cy - dy * tc, pz = cz - dz * tc;
    if (px * px + py * py + pz * pz > 5) continue;
    const H = c.height || 2;
    let t = raySphere(ox, oy, oz, dx, dy, dz, c.pos.x, c.pos.y + H * 0.88, c.pos.z, 0.27);
    if (t >= 0 && t < best) { best = t; CH.c = c; CH.head = true; }
    t = rayCyl(ox, oy, oz, dx, dy, dz, c.pos.x, c.pos.z, 0.42, c.pos.y, c.pos.y + H * 0.765);
    if (t >= 0 && t < best) { best = t; CH.c = c; CH.head = false; }
  }
  CH.t = best;
  return CH;
}
const SH = { t: 0, char: null, head: false, col: null, terrain: false, nx: 0, ny: 0, nz: 0 };
function traceShot(shooter, ox, oy, oz, dx, dy, dz, maxT, skipInside) {
  const w = raycastWorld(ox, oy, oz, dx, dy, dz, maxT, skipInside);
  SH.col = w.c; SH.terrain = w.terrain; SH.nx = w.nx; SH.ny = w.ny; SH.nz = w.nz; SH.t = w.t; SH.char = null; SH.head = false;
  const h = rayCharacters(ox, oy, oz, dx, dy, dz, w.t, shooter);
  if (h.c) { SH.char = h.c; SH.head = h.head; SH.t = h.t; SH.col = null; SH.terrain = false; }
  return SH;
}
const _sb1 = new V3(), _sb2 = new V3();
function applySpread(d, ang, out) {
  out.copy(d); if (ang <= 0) return out;
  _sb1.crossVectors(d, Math.abs(d.y) < 0.95 ? UP : _sb2.set(1, 0, 0)).normalize();
  _sb2.crossVectors(d, _sb1);
  const r = Math.sqrt(Math.random()) * Math.tan(ang), th = Math.random() * TAU;
  return out.addScaledVector(_sb1, Math.cos(th) * r).addScaledVector(_sb2, Math.sin(th) * r).normalize();
}
const _fd = new V3(), _mz = new V3();
function colMatKind(col) {
  if (!col) return 'dirt';
  if (col.piece) return col.piece.mat;
  return col.harvest === 'metal' ? 'metal' : col.harvest === 'stone' ? 'stone' : 'wood';
}
const IMPACT_COL = { wood: 0xc79a62, stone: 0xb8bcc2, metal: 0xe8f0ff, dirt: 0x9a8a6a };
function fireWeapon(c, w, origin, aim) {
  const def = WEAPONS[w.id], r = w.rarity;
  const moving = Math.hypot(c.vel.x, c.vel.z) > 1.5;
  let spread = (c.aiming ? def.ads : def.spread) * (moving ? 1.25 : 1) * (c.grounded ? 1 : 1.6) + c.bloom;
  spread *= c.crouch ? 0.72 : c.sliding ? 1.3 : 1;
  if (def.id === 'sniper' && c.aiming) spread = moving ? 0.01 : 0;
  SFX.shot(def.sound, c.pos, c.isPlayer);
  if (c.isPlayer) GAME.combatT = GAME.time;
  muzzleOf(c, _mz);
  const big = def.id === 'shotgun' || def.id === 'sniper' || def.id === 'rocket';
  VFX.muzzle(c, _mz.x, _mz.y, _mz.z, big);
  FX.burst(_mz.x, _mz.y, _mz.z, 3, 0xffd27a, 2.5, 0.08, 0.22, true, 0);
  if (!def.projectile) VFX.casing(c, def.id === 'shotgun');
  if (def.projectile) { applySpread(aim, spread, _fd); spawnRocket(c, _mz, _fd, def, r); }
  else {
    const n = def.pellets || 1;
    for (let p = 0; p < n; p++) {
      applySpread(aim, spread, _fd);
      const h = traceShot(c, origin.x, origin.y, origin.z, _fd.x, _fd.y, _fd.z, def.range);
      const ex = origin.x + _fd.x * h.t, ey = origin.y + _fd.y * h.t, ez = origin.z + _fd.z * h.t;
      const fall = h.t <= def.falloff ? 1 : lerp(1, def.minFall, clamp((h.t - def.falloff) / Math.max(1, def.range - def.falloff), 0, 1));
      const dmg = def.dmg[r] * fall;
      if (h.char) { applyDamage(h.char, dmg * (h.head ? def.head : 1), c, def.name, h.head); FX.burst(ex, ey, ez, 5, h.head ? 0xffe066 : 0xffffff, 3, 0.18, 0.18, true, -5); }
      else if (h.col) { VFX.bulletHole(h, ex, ey, ez); damageCollider(h.col, dmg * (def.buildMult || 1), c, ex, ey, ez); const k = colMatKind(h.col); FX.burst(ex + h.nx * 0.05, ey + h.ny * 0.05, ez + h.nz * 0.05, 4, IMPACT_COL[k], 3.5, 0.3, 0.16, false, -12); if (p === 0) SFX.impact({ x: ex, y: ey, z: ez }, k); }
      else if (h.terrain) { VFX.bulletHole(h, ex, ey, ez); FX.burst(ex, ey + 0.05, ez, 5, IMPACT_COL.dirt, 3, 0.45, 0.24, false, -8); FX.emitN(ex, ey + 0.1, ez, 0, 0.6, 0, 0.7, 0.3, 0.9, 0.7, 0.62, 0.5, 0.5, 0, 1); }
      if (p === 0 && !c.isPlayer && player && player.alive) nearMiss(origin, _fd, h.t, def);
      if (p < 4) FX.tracer(_mz.x, _mz.y, _mz.z, ex, ey, ez, c.isPlayer ? 0xfff2b0 : 0xffd27a, def.id === 'sniper' ? 2.4 : 1);
      if (def.id === 'sniper') VFX.smokeTrail(_mz.x, _mz.y, _mz.z, ex, ey, ez);
    }
  }
  c.bloom = Math.min(c.bloom + def.bloom, 0.07);
  if (c.anim) c.anim.recoil = Math.min(1.2, c.anim.recoil + (def.kick || (def.id === 'sniper' || def.id === 'rocket' ? 1 : def.id === 'shotgun' ? 0.85 : 0.35)));
}
// bullets passing close to the player's head whiz (and crack for fast rounds)
const _nm = new V3();
function nearMiss(o, d, t, def) {
  const ex = player.pos.x - o.x, ey = player.pos.y + 1.6 - o.y, ez = player.pos.z - o.z, k = ex * d.x + ey * d.y + ez * d.z;
  if (k < 2 || k > t + 1) return;
  _nm.set(o.x + d.x * k, o.y + d.y * k, o.z + d.z * k);
  const miss = Math.hypot(_nm.x - player.pos.x, _nm.y - player.pos.y - 1.6, _nm.z - player.pos.z);
  if (miss < 3.2 && miss > 0.35) { SFX.whiz(_nm, def.id === 'sniper' || def.id === 'ar'); GAME.combatT = GAME.time; }
}
function damageMult(src, target) {
  if (src && !src.isPlayer && target && target.isPlayer) return DIFF[SETTINGS.diff].dmg;
  return 1;
}
function applyDamage(t, amt, src, wname, head, kind) {
  if (!t.alive || amt <= 0) return;
  if (kind === 'storm' || kind === 'fall') { /* bypass shield */ }
  else {
    amt *= damageMult(src, t);
    if (t.shield > 0) {
      const s = Math.min(t.shield, amt); t.shield -= s; amt -= s;
      if (src && src.isPlayer) FX.number(t.pos.x, t.pos.y + 2.1, t.pos.z, s, 'sh', t);
      if (t.shield <= 0) { if (t.isPlayer) SFX.shieldBreak(); if (t.rig.root.visible) VFX.shieldBreak(t); }
      if (src && src.isPlayer) src.damageDealt += s;
    }
  }
  if (t.armor) amt *= 1 - t.armor;
  amt = Math.round(amt * 10) / 10;
  if (amt > 0) {
    t.hp -= amt;
    if (src && src.isPlayer && src !== t) { FX.number(t.pos.x, t.pos.y + 2.1, t.pos.z, amt, head ? 'head' : '', t); src.damageDealt += amt; }
  }
  if (src && src.isPlayer && src !== t) { SFX.hit(head, t.shield > 0); HUD.hitmarker(head); }
  if (t.isPlayer) { if (kind !== 'storm') { HUD.hurt(src); SFX.hurt(); GAME.combatT = GAME.time; CAM.shake = Math.min(1, CAM.shake + 0.12 + Math.min(0.3, amt / 140)); } }
  else if (src && src !== t) onBotDamaged(t, src);
  t.lastHurt = GAME.time;
  if (kind !== 'storm') rigHitFlash(t);
  if (t.hp <= 0) eliminate(t, src, wname, kind);
}
function nm(c) { return c.isPlayer ? '<b class="me">You</b>' : '<b>' + c.name + '</b>'; }
function eliminate(t, src, wname, kind) {
  if (!t.alive) return;
  if (t.vehicle) exitVehicle(t);
  t.zip = null; t.mantle = null;
  t.alive = false; t.hp = 0; t.deathT = 0.0001; t.using = null; t.reloadT = 0; t.emote = null;
  if (t.rig.root.visible) startDissolve(t);
  GAME.deathLog.push({ t: GAME.time, kind: kind || '', w: wname || '', bySelf: src === t, since: GAME.time - (t.landedAt || 0), y: t.pos.y });
  dropAll(t);
  let msg;
  if (kind === 'storm') msg = nm(t) + ' <span class="st">got lost in the storm</span>';
  else if (kind === 'fall') msg = nm(t) + ' fell too far';
  else if (src && src !== t) msg = nm(src) + ' eliminated ' + nm(t) + (wname ? ' with the ' + wname : '');
  else msg = nm(t) + ' was eliminated';
  HUD.feed(msg);
  if (src && src !== t && src.alive) { src.kills++; if (src.isPlayer) { HUD.elimToast(t.name, src.kills); SFX.elim(); HUD.elimMark(); src.streak = (GAME.time - (src.lastElimT || -99) < 5) ? (src.streak || 1) + 1 : 1; src.lastElimT = GAME.time; if (src.streak >= 2) SFX.announce(['', '', 'Double elimination', 'Triple elimination', 'Quad elimination', 'Unstoppable'][Math.min(5, src.streak)], true); } }
  FX.elim(t.pos);
  GAME.alive = characters.reduce((n, c) => n + (c.alive && !c.npc ? 1 : 0), 0);
  if (player && player.alive && [25, 10, 5, 3, 2].includes(GAME.alive) && GAME.state === 'play') SFX.announce(GAME.alive === 2 ? 'Final two' : GAME.alive + ' players remain');
  if (t.isPlayer) onPlayerDeath(src, kind);
  else if (GAME.spectating === t) GAME.spectating = src && src.alive ? src : null;
  checkEnd();
}
function dropAll(c) {
  const drops = [];
  for (let i = 0; i < 5; i++) if (c.inv[i]) { drops.push(invToItem(c.inv[i])); c.inv[i] = null; }
  for (const k in c.ammo) if (c.ammo[k] > 0) drops.push({ kind: 'ammo', ammo: k, count: c.ammo[k] });
  if (!c.isPlayer) for (const w of drops) if (w.kind === 'weapon') { const a = WEAPONS[w.id].ammo; drops.push({ kind: 'ammo', ammo: a, count: AMMO[a].give }); }
  for (const k of MAT_ORDER) if (c.mats[k] > 0) drops.push({ kind: 'mats', mat: k, count: Math.min(c.mats[k], 120) });
  drops.slice(0, 12).forEach((d, i) => { const a = i / Math.max(1, drops.length) * TAU; dropItem(d, c.pos.x, c.pos.y + 1, c.pos.z, Math.cos(a) * mr(1.5, 3), mr(4, 6), Math.sin(a) * mr(1.5, 3)); });
}
function damageCollider(col, amt, src, x, y, z) {
  if (!col.alive) return;
  if (col.piece) { damagePiece(col.piece, amt); if (src && src.isPlayer) FX.number(x, y, z, amt, 'bld', col); return; }
  if (col.vehicle) { damageVehicle(col.vehicle, amt, src); if (src && src.isPlayer) FX.number(x, y, z, amt, 'bld', col); return; }
  if (col.hp === Infinity) return;
  col.hp -= amt;
  if (col.tree) { col.tree.shakeT = 0.35; SHAKING.add(col.tree); }
  if (src && src.isPlayer) FX.number(x, y, z, amt, 'bld', col);
  if (col.hp <= 0) destroyCollider(col);
}
function destroyCollider(col) {
  removeCollider(col);
  const cx = (col.minX + col.maxX) / 2, cy = (col.minY + col.maxY) / 2, cz = (col.minZ + col.maxZ) / 2;
  const k = colMatKind(col);
  if (col.tree) {
    hideInstParts(col.tree); SHAKING.delete(col.tree);
    if (col.kind === 'tree') FX.burst(cx, col.maxY - 2, cz, 30, 0x4f9e34, 6, 1.2, 0.5, false, -6);
  }
  if (col.mesh) worldGroup.remove(col.mesh);
  if (col.asm) { if (col.asmAll) killAsm(col.asm); else if (col.part) { col.part.alive = false; rebuildAsm(col.asm, col.partMat); } }
  FX.debris(_tmpV.set(cx, cy, cz), IMPACT_COL[k], col.kind === 'tree' ? 10 : 7);
  SFX.impact(_tmpV, k);
}
// pickaxe / melee from character c along direction d
function meleeSwing(c, ox, oy, oz, d, reach) {
  c.swingT = c.isPlayer ? 0.5 : 0.75;
  const h = traceShot(c, ox, oy, oz, d.x, d.y, d.z, reach, true);
  if (h.t >= reach) return;
  const ex = ox + d.x * h.t, ey = oy + d.y * h.t, ez = oz + d.z * h.t;
  if (h.char) { applyDamage(h.char, 20, c, 'Pickaxe', false); SFX.pickaxe(h.char.pos, false, 'flesh'); return; }
  if (!h.col) return;
  const col = h.col;
  let crit = false;
  if (c.isPlayer && WEAK.col === col && Math.hypot(ex - WEAK.x, ey - WEAK.y, ez - WEAK.z) < 0.75) crit = true;
  const dmg = col.piece ? 50 : crit ? 100 : 50;
  SFX.pickaxe({ x: ex, y: ey, z: ez }, crit, colMatKind(col));
  FX.burst(ex, ey, ez, crit ? 14 : 6, crit ? 0x7fe0ff : IMPACT_COL[colMatKind(col)], 3.5, 0.35, 0.2, crit, -10);
  if (col.harvest && !col.piece) {
    const mat = col.harvest, amt = Math.round((col.kind === 'tree' ? 7 : col.kind === 'rock' ? 8 : 6) * (crit ? 2 : 1) * mr(0.85, 1.25));
    c.mats[mat] = Math.min(999, c.mats[mat] + amt);
    if (c.isPlayer) { HUD.matPop(mat, amt); GAME.stats.mats += amt; }
  }
  damageCollider(col, dmg, c, ex, ey, ez);
  if (c.isPlayer) placeWeakSpot(col, ex, ey, ez, h.nx, h.ny, h.nz);
}
// weak point marker for harvesting
const WEAK = { col: null, x: 0, y: 0, z: 0, mesh: null };
function placeWeakSpot(col, x, y, z, nx, ny, nz) {
  if (!WEAK.mesh) {
    WEAK.mesh = new THREE.Mesh(keepGeo(new THREE.RingGeometry(0.2, 0.34, 20)), new THREE.MeshBasicMaterial({ color: LIN(0x7fe0ff).multiplyScalar(3), transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }));
    WEAK.mesh.material.userData.keep = true; WEAK.mesh.renderOrder = 10; scene.add(WEAK.mesh);
  }
  if (!col.alive || col.piece || !col.harvest) { WEAK.col = null; WEAK.mesh.visible = false; return; }
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; }
  const bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;
  const cx = ny * bz - nz * by, cy = nz * bx - nx * bz, cz = nx * by - ny * bx;
  const u = mr(-0.9, 0.9), v = mr(-0.7, 0.9);
  let px = x + bx * u + cx * v, py = y + by * u + cy * v, pz = z + bz * u + cz * v;
  px = clamp(px, col.minX - 0.05, col.maxX + 0.05); py = clamp(py, col.minY + 0.3, col.maxY - 0.2); pz = clamp(pz, col.minZ - 0.05, col.maxZ + 0.05);
  WEAK.col = col; WEAK.x = px + nx * 0.06; WEAK.y = py + ny * 0.06; WEAK.z = pz + nz * 0.06;
  WEAK.mesh.position.set(WEAK.x, WEAK.y, WEAK.z);
  WEAK.mesh.lookAt(WEAK.x + nx, WEAK.y + ny, WEAK.z + nz);
  WEAK.mesh.visible = true; WEAK.t = 4;
}
function updateWeak(dt) {
  if (!WEAK.mesh || !WEAK.mesh.visible) return;
  WEAK.t -= dt; const s = 1 + Math.sin(GAME.time * 10) * 0.12; WEAK.mesh.scale.set(s, s, s);
  if (WEAK.t <= 0 || !WEAK.col || !WEAK.col.alive) { WEAK.mesh.visible = false; WEAK.col = null; }
}

// ---------- rockets ----------
const _rocketGeo = keepGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8).rotateX(Math.PI / 2));
function spawnRocket(c, m, d, def, r) {
  const mesh = new THREE.Mesh(_rocketGeo, lam(0xdfe3e8, { emissive: 0x332211 }));
  mesh.position.copy(m); worldGroup.add(mesh);
  ROCKETS.push({ pos: m.clone(), vel: d.clone().multiplyScalar(def.speed), owner: c, dmg: def.dmg[r], radius: def.radius, bd: def.buildDmg, life: 5, mesh, trail: 0 });
}
const _rd = new V3();
function updateRockets(dt) {
  for (let i = ROCKETS.length - 1; i >= 0; i--) {
    const R = ROCKETS[i];
    R.life -= dt;
    const len = R.vel.length() * dt; _rd.copy(R.vel).normalize();
    const h = traceShot(R.owner, R.pos.x, R.pos.y, R.pos.z, _rd.x, _rd.y, _rd.z, len);
    if (h.t < len || R.life <= 0) {
      const t = Math.min(h.t, len);
      explode(R.pos.x + _rd.x * Math.max(0, t - 0.2), R.pos.y + _rd.y * Math.max(0, t - 0.2), R.pos.z + _rd.z * Math.max(0, t - 0.2), R);
      worldGroup.remove(R.mesh); ROCKETS.splice(i, 1); continue;
    }
    R.pos.addScaledVector(_rd, len);
    R.mesh.position.copy(R.pos); R.mesh.lookAt(R.pos.x + _rd.x, R.pos.y + _rd.y, R.pos.z + _rd.z);
    R.trail -= dt;
    if (R.trail <= 0) { R.trail = 0.016; FX.emitN(R.pos.x - _rd.x * 0.5, R.pos.y - _rd.y * 0.5, R.pos.z - _rd.z * 0.5, mr(-0.4, 0.4), mr(0.2, 0.8), mr(-0.4, 0.4), 1.1, 0.4, 1.6, 0.8, 0.8, 0.82, 0.55, 0, 0.5); FX.emitA(R.pos.x - _rd.x * 0.45, R.pos.y - _rd.y * 0.45, R.pos.z - _rd.z * 0.45, 0, 0, 0, 0.12, 0.5, 0.2, 1, 0.7, 0.3, 1, 0, 0); }
  }
}
const _eq = [];
function explode(x, y, z, R) {
  SFX.explode({ x, y, z });
  VFX.explosion(x, y, z, R.radius);
  const rad = R.radius;
  for (const c of characters) {
    if (!c.alive || c.mode === 'bus') continue;
    const d = Math.hypot(c.pos.x - x, c.pos.y + 1 - y, c.pos.z - z);
    if (d < rad) applyDamage(c, R.dmg * (1 - (d / rad) * 0.65), R.owner, R.name || 'Rocket Launcher', false);
  }
  queryBox(x - rad, z - rad, x + rad, z + rad, _eq);
  for (const col of _eq.slice()) {
    const cx = clamp(x, col.minX, col.maxX), cy = clamp(y, col.minY, col.maxY), cz = clamp(z, col.minZ, col.maxZ);
    const d = Math.hypot(cx - x, cy - y, cz - z);
    if (d < rad) damageCollider(col, R.bd * (1 - d / rad * 0.5), null, cx, cy, cz);
  }
  if (player && player.alive) { const d = player.pos.distanceTo(_tmpV.set(x, y, z)); if (d < 30) CAM.shake = Math.max(CAM.shake, (1 - d / 30) * 0.9); }
}

// ---------- particles, debris, tracers, damage numbers ----------
const FX = (() => {
  const VS = 'attribute float size; attribute float seed; attribute vec4 pcolor; varying vec4 vC; varying float vS; uniform float uScale; void main(){ vC = pcolor; vS = seed; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(320.0, size * uScale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }';
  const FS = 'varying vec4 vC; varying float vS; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r * 2.4)); }';
  // non-additive particles are smoke/dust: noisy puffs with a little top-lighting
  const FS_PUFF = `varying vec4 vC; varying float vS;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
      float n = n2(gl_PointCoord * 3.5 + vS * 37.0) * 0.6 + n2(gl_PointCoord * 8.0 - vS * 19.0) * 0.4;
      float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.8);
      float lit = 0.8 + 0.4 * (0.5 - gl_PointCoord.y) + (n - 0.5) * 0.3;
      gl_FragColor = vec4(vC.rgb * lit, vC.a * a); }`;
  function sys(max, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max), seed = new Float32Array(max);
    for (let i = 0; i < max; i++) seed[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, vertexShader: VS, fragmentShader: additive ? FS : FS_PUFF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    return { max, pos, col, size, geo, mat, vel: new Float32Array(max * 3), life: new Float32Array(max), ml: new Float32Array(max), s0: new Float32Array(max), s1: new Float32Array(max), rgba: new Float32Array(max * 4), grav: new Float32Array(max), drag: new Float32Array(max), next: 0, live: 0 };
  }
  let A, N, debris, tracers, dnPool = [], dnLive = [];
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), dp = new V3(), ds = new V3(), de = new THREE.Euler(), dcol = new THREE.Color();
  const DEB = 160, TR = 90;
  const deb = [], trs = [];
  function init() {
    A = sys(1800, true); N = sys(1600, false);
    debris = new THREE.InstancedMesh(keepGeo(new THREE.BoxGeometry(0.28, 0.28, 0.28)), new THREE.MeshLambertMaterial({ color: 0xffffff }), DEB);
    debris.material.userData.keep = true; debris.frustumCulled = false; debris.castShadow = false;
    for (let i = 0; i < DEB; i++) { dm.makeScale(0, 0, 0); debris.setMatrixAt(i, dm); debris.setColorAt(i, dcol.set(0xffffff)); deb.push({ life: 0, p: new V3(), v: new V3(), r: new V3(), rv: new V3(), s: 1 }); }
    scene.add(debris);
    tracers = new THREE.InstancedMesh(keepGeo(new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), TR);
    tracers.material.userData.keep = true; tracers.frustumCulled = false;
    for (let i = 0; i < TR; i++) { dm.makeScale(0, 0, 0); tracers.setMatrixAt(i, dm); tracers.setColorAt(i, dcol.set(0xffffff)); trs.push({ life: 0, a: new V3(), b: new V3() }); }
    scene.add(tracers);
    const host = document.getElementById('dmgnums');
    for (let i = 0; i < 40; i++) { const el = document.createElement('div'); el.className = 'dn'; el.style.opacity = '0'; host.appendChild(el); dnPool.push({ el, life: 0, x: 0, y: 0, z: 0, vy: 0, ox: 0 }); }
  }
  function emit(S, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const i = S.next; S.next = (S.next + 1) % S.max;
    S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z;
    S.vel[i * 3] = vx; S.vel[i * 3 + 1] = vy; S.vel[i * 3 + 2] = vz;
    S.life[i] = life; S.ml[i] = life; S.s0[i] = s0; S.s1[i] = s1;
    const boost = S === A ? 2.6 : 1;   // additive particles go above 1.0 so the bloom catches them
    S.rgba[i * 4] = r * r * boost; S.rgba[i * 4 + 1] = g * g * boost; S.rgba[i * 4 + 2] = b * b * boost; S.rgba[i * 4 + 3] = a;
    S.grav[i] = grav; S.drag[i] = drag || 0;
  }
  function step(S, dt) {
    let any = false;
    for (let i = 0; i < S.max; i++) {
      if (S.life[i] <= 0) { if (S.size[i] !== 0) { S.size[i] = 0; any = true; } continue; }
      any = true;
      S.life[i] -= dt;
      const t = 1 - Math.max(0, S.life[i]) / S.ml[i];
      const dr = 1 - S.drag[i] * dt;
      S.vel[i * 3] *= dr; S.vel[i * 3 + 2] *= dr; S.vel[i * 3 + 1] = S.vel[i * 3 + 1] * dr + S.grav[i] * dt;
      S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
      S.size[i] = S.life[i] > 0 ? lerp(S.s0[i], S.s1[i], t) : 0;
      S.col[i * 4] = S.rgba[i * 4]; S.col[i * 4 + 1] = S.rgba[i * 4 + 1]; S.col[i * 4 + 2] = S.rgba[i * 4 + 2];
      S.col[i * 4 + 3] = S.rgba[i * 4 + 3] * (1 - t * t);
    }
    if (any) { S.geo.attributes.position.needsUpdate = true; S.geo.attributes.pcolor.needsUpdate = true; S.geo.attributes.size.needsUpdate = true; }
  }
  const bc = new THREE.Color();
  const api = {
    init,
    setScale(v) { A.mat.uniforms.uScale.value = v; N.mat.uniforms.uScale.value = v; },
    emitA(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) { emit(A, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag); },
    emitN(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) { emit(N, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag); },
    burst(x, y, z, n, hex, speed, life, size, additive, grav) {
      bc.set(hex); const S = additive ? A : N;
      for (let i = 0; i < n; i++) {
        const th = Math.random() * TAU, ph = Math.acos(mr(-1, 1)), sp = speed * mr(0.3, 1);
        emit(S, x, y, z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.8 + speed * 0.2, Math.sin(ph) * Math.sin(th) * sp, life * mr(0.6, 1.2), size, additive ? size * 0.3 : size * 1.6, bc.r, bc.g, bc.b, 1, grav, 1.5);
      }
    },
    elim(p) {
      for (let i = 0; i < 46; i++) emit(A, p.x + mr(-0.4, 0.4), p.y + mr(0, 2), p.z + mr(-0.4, 0.4), mr(-0.6, 0.6), mr(1.5, 4.5), mr(-0.6, 0.6), mr(0.7, 1.4), 0.35, 0.05, 0.4, 0.85, 1, 1, 0, 0.5);
    },
    debris(p, hex, n) {
      dcol.set(hex).convertSRGBToLinear();
      for (let k = 0; k < n; k++) {
        let i = deb.findIndex((d) => d.life <= 0); if (i < 0) i = Math.floor(Math.random() * DEB);
        const d = deb[i]; d.life = mr(0.9, 1.6); d.p.set(p.x + mr(-1, 1), p.y + mr(-0.8, 0.8), p.z + mr(-1, 1)); d.v.set(mr(-4, 4), mr(2, 7), mr(-4, 4)); d.r.set(Math.random() * 6, Math.random() * 6, 0); d.rv.set(mr(-8, 8), mr(-8, 8), 0); d.s = mr(0.6, 1.4);
        debris.setColorAt(i, dcol);
      }
      debris.instanceColor.needsUpdate = true;
    },
    tracer(ax, ay, az, bx, by, bz, hex, wid) {
      let i = trs.findIndex((t) => t.life <= 0); if (i < 0) i = Math.floor(Math.random() * TR);
      trs[i].life = 0.07 * (wid > 1 ? 2.5 : 1); trs[i].ml = trs[i].life; trs[i].w = wid || 1; trs[i].a.set(ax, ay, az); trs[i].b.set(bx, by, bz);
      tracers.setColorAt(i, dcol.set(hex).convertSRGBToLinear().multiplyScalar(6)); tracers.instanceColor.needsUpdate = true;
    },
    number(x, y, z, amt, kind, target) {
      // hits on the same target within a short window stack into one growing number
      const sk = kind === 'sh' ? 'sh' : 'hp';
      let d = target ? dnLive.find((q) => q.target === target && q.sk === sk && q.life > 0.45) : null;
      if (d) { d.total += amt; d.life = 0.95; d.pop = 1; if (kind === 'head') d.head = true; }
      else { d = dnPool.find((q) => q.life <= 0) || dnPool[0]; d.total = amt; d.target = target || null; d.sk = sk; d.head = kind === 'head'; d.life = 0.95; d.x = x + mr(-0.4, 0.4); d.y = y; d.z = z + mr(-0.4, 0.4); d.vy = 1.6; d.ox = mr(-12, 12); d.pop = 1; }
      d.el.textContent = Math.max(1, Math.round(d.total)); d.el.className = 'dn' + (d.sk === 'sh' ? ' sh' : d.head ? ' head' : (kind ? ' ' + kind : '')) + (d.total >= 100 && kind !== 'bld' ? ' big' : '');
      if (!dnLive.includes(d)) dnLive.push(d);
    },
    clear() {
      for (const S of [A, N]) S.life.fill(0);
      for (const d of deb) d.life = 0;
      for (const t of trs) t.life = 0;
      for (const d of dnPool) { d.life = 0; d.el.style.opacity = '0'; }
      dnLive = [];
    },
    update(dt) {
      step(A, dt); step(N, dt);
      let dirty = false;
      for (let i = 0; i < DEB; i++) {
        const d = deb[i]; if (d.life <= 0) { if (d.s !== 0) { d.s = 0; dm.makeScale(0, 0, 0); debris.setMatrixAt(i, dm); dirty = true; } continue; }
        d.life -= dt; d.v.y -= GRAV * dt; d.p.addScaledVector(d.v, dt); d.r.addScaledVector(d.rv, dt);
        const g = surfaceBelow(d.p.x, d.p.y + 0.2, d.p.z); if (d.p.y < g + 0.1) { d.p.y = g + 0.1; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; }
        const sc = d.s * Math.min(1, d.life * 3);
        de.set(d.r.x, d.r.y, 0); dq.setFromEuler(de); dm.compose(d.p, dq, ds.set(sc, sc, sc)); debris.setMatrixAt(i, dm); dirty = true;
        if (d.life <= 0) d.s = 1;
      }
      if (dirty) debris.instanceMatrix.needsUpdate = true;
      let td = false;
      for (let i = 0; i < TR; i++) {
        const t = trs[i]; if (t.life <= 0) continue;
        t.life -= dt; td = true;
        if (t.life <= 0) { dm.makeScale(0, 0, 0); tracers.setMatrixAt(i, dm); continue; }
        dp.subVectors(t.b, t.a); const len = dp.length(); if (len < 0.01) continue;
        dp.multiplyScalar(1 / len); dq.setFromUnitVectors(_tmpV2.set(0, 0, 1), dp);
        const w = (0.035 * (t.life / (t.ml || 0.07)) + 0.01) * (t.w || 1);
        dm.compose(_tmpV3.copy(t.a).lerp(t.b, 0.5), dq, ds.set(w, w, len)); tracers.setMatrixAt(i, dm);
      }
      if (td) tracers.instanceMatrix.needsUpdate = true;
      const W = innerWidth, H = innerHeight;
      for (let i = dnLive.length - 1; i >= 0; i--) {
        const d = dnLive[i]; d.life -= dt; d.y += d.vy * dt; d.vy *= 0.96;
        if (d.life <= 0) { d.el.style.opacity = '0'; dnLive.splice(i, 1); continue; }
        _tmpV4.set(d.x, d.y, d.z).project(camera);
        if (_tmpV4.z > 1) { d.el.style.opacity = '0'; continue; }
        const sx = (_tmpV4.x * 0.5 + 0.5) * W + d.ox * (1 - d.life), sy = (-_tmpV4.y * 0.5 + 0.5) * H;
        d.pop = Math.max(0, (d.pop || 0) - dt * 6);
        const sc = 1 + d.pop * d.pop * 0.7;
        d.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
        d.el.style.opacity = Math.min(1, d.life * 3).toFixed(2);
      }
    },
  };
  return api;
})();
