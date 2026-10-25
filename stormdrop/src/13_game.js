// ---------- game flow, player control, camera, main loop ----------
const GAME = { deathLog: [], state: 'menu', time: 0, alive: 0, paused: false, spectating: null, placement: 0, killer: null, deathKind: '', deathTime: 0, stats: { mats: 0, builds: 0, chests: 0 }, menuWorldFresh: false };
const CAM = { yaw: 0, dist: 3.6, shoulder: 0.85, scoped: false, shake: 0, orbit: 0.6, storm: 0, specYaw: 0 };
const BUS = { start: new V3(), end: new V3(), pos: new V3(), dir: new V3(), t: 0, dur: 36, mesh: null, prop: null, alt: 175 };
const FOG_COL = new THREE.Color(0xcfe8ff), STORM_FOG = new THREE.Color(0x5a2a8a);
const AIM = { origin: new V3(), dir: new V3(), point: new V3() };

function focusChar() {
  if (!player) return null;
  if (!player.alive && GAME.spectating && GAME.spectating.alive && !document.getElementById('spec').hidden) return GAME.spectating;
  return player;
}
function makeBusMesh() {
  const g = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), lam(0xffc62e)); env.scale.set(7, 6.5, 17); g.add(env);
  const band = new THREE.Mesh(new THREE.SphereGeometry(1.012, 28, 18, 0, TAU, 1.25, 0.64), lam(0x6c3fd1)); band.scale.set(7, 6.5, 17); g.add(band);
  const gond = new THREE.Mesh(boxGeo(4, 2.6, 9), lam(0x1d2340)); gond.position.set(0, -8, 1); g.add(gond);
  const win = new THREE.Mesh(boxGeo(4.05, 0.8, 7), lam(0xbfe6ff, { emissive: 0x4a88aa })); win.position.set(0, -7.6, 1.2); g.add(win);
  for (const sx of [-1.6, 1.6]) for (const sz of [-2.5, 4]) { const s = new THREE.Mesh(boxGeo(0.2, 3, 0.2), lam(0x333a4a)); s.position.set(sx, -5.6, sz); g.add(s); }
  const finV = new THREE.Mesh(boxGeo(0.4, 7, 4), lam(0x6c3fd1)); finV.position.set(0, 3, -15); g.add(finV);
  const finH = new THREE.Mesh(boxGeo(12, 0.4, 4), lam(0x6c3fd1)); finH.position.set(0, 0, -15); g.add(finH);
  BUS.prop = new THREE.Group(); BUS.prop.position.set(0, -8, -4.2); g.add(BUS.prop);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(boxGeo(0.4, 3.2, 0.15), lam(0xe8e8e8)); b.rotation.z = i * TAU / 3; b.position.set(Math.sin(i * TAU / 3) * 1.4, Math.cos(i * TAU / 3) * 1.4, 0); BUS.prop.add(b); }
  g.visible = false; scene.add(g); BUS.mesh = g;
}
function setupBus() {
  const a = Math.random() * TAU, off = mr(-130, 130), px = -Math.sin(a), pz = Math.cos(a);
  BUS.start.set(Math.cos(a) * 560 + px * off, BUS.alt, Math.sin(a) * 560 + pz * off);
  BUS.end.set(-Math.cos(a) * 560 + px * off, BUS.alt, -Math.sin(a) * 560 + pz * off);
  BUS.dir.subVectors(BUS.end, BUS.start).normalize();
  BUS.t = 0; BUS.pos.copy(BUS.start);
  BUS.mesh.visible = true; BUS.mesh.position.copy(BUS.start); BUS.mesh.lookAt(BUS.end);
}
function updateBus(dt) {
  if (!BUS.mesh.visible) return;
  BUS.t = Math.min(1.1, BUS.t + dt / BUS.dur);
  BUS.pos.lerpVectors(BUS.start, BUS.end, BUS.t);
  BUS.mesh.position.copy(BUS.pos); BUS.mesh.position.y += Math.sin(GAME.time * 0.8) * 0.6;
  BUS.prop.rotation.z += dt * 14;
  if (BUS.t >= 1.1) BUS.mesh.visible = false;
}
function jumpOut(c) {
  c.mode = 'sky'; c.grounded = false;
  c.pos.set(BUS.pos.x + mr(-2, 2), BUS.pos.y - 11, BUS.pos.z + mr(-2, 2));
  c.vel.set(BUS.dir.x * 10, -6, BUS.dir.z * 10);
  c.rig.root.visible = true;
  if (c.isPlayer) { SFX.deploy(); HUD.banner('Skydiving', IS_TOUCH ? 'Steer with the left stick. Look down to dive faster.' : 'Steer with WASD. Look down to dive faster. Space opens the glider.', 3); }
  else c.yaw = Math.atan2(-BUS.dir.x, -BUS.dir.z);
}
function rescueFromWater(c) {
  if (groundH(c.pos.x, c.pos.z) > -2.5) return;
  let x = c.pos.x, z = c.pos.z;
  for (let i = 0; i < 200 && groundH(x, z) < 0.6; i++) { x *= 0.985; z *= 0.985; }
  c.pos.set(x, walkH(x, z) + 0.1, z);
}

// ---------- player ----------
function enterBuild(p, piece) { p.buildMode = piece; p.lastPiece = piece; p.using = null; p.reloadT = 0; p.aiming = false; INPUT.clearAim(); updateHeld(p); }
function exitBuild(p) { p.buildMode = null; showGhost(null); updateHeld(p); }
function updatePlayer(dt) {
  const p = player, A = INPUT.actions();
  GAME.pendingA = A;
  if (A.map) HUD.toggleMap();
  if (!p.alive) return;
  if (GAME.state === 'won') { p.vel.x = 0; p.vel.z = 0; p.aiming = false; charPhysics(p, dt); animateRig(p, dt); return; }
  const w0 = curWeapon(p);
  const zoom = p.aiming && w0 ? WEAPONS[w0.id].zoom : 1;
  const s = 0.0021 * SETTINGS.sens / zoom;
  p.yaw -= INPUT.dx * s; p.pitch = clamp(p.pitch - INPUT.dy * s, -1.45, 1.45);
  if (p.mode === 'bus') { if (A.jump || BUS.t >= 1) jumpOut(p); return; }
  if (p.mode === 'sky' || p.mode === 'glide') {
    skyPhysics(p, dt, clamp(A.mx, -1, 1), clamp(A.my, -1, 1), A.jump);
    if (p.mode === 'ground') rescueFromWater(p);
    SFX.loop('wind', p.mode === 'sky' ? 0.35 : p.mode === 'glide' ? 0.14 : 0);
    animateRig(p, dt);
    return;
  }
  if (A.slotKey >= 0) selectSlot(p, A.slotKey);
  if (A.pickaxe) selectSlot(p, -1);
  if (A.wheel && !p.buildMode) {
    let i = p.slot;
    for (let k = 0; k < 6; k++) { i += A.wheel > 0 ? 1 : -1; if (i > 4) i = -1; if (i < -1) i = 4; if (i === -1 || p.inv[i]) break; }
    selectSlot(p, i);
  }
  if (A.buildToggle) { if (p.buildMode) exitBuild(p); else enterBuild(p, p.lastPiece || 'wall'); }
  if (A.piece) enterBuild(p, A.piece);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const mx = clamp(A.mx, -1, 1), my = clamp(A.my, -1, 1);
  let wx = fx * my + rx * mx, wz = fz * my + rz * mx; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  p.aiming = A.aim && !p.buildMode && !!curWeapon(p);
  let spd = 6.6;
  if (p.aiming) spd = 4.2; else if (A.sprint && my > 0.3 && !p.using) spd = 8.8;
  if (p.using) spd = 2.8;
  if (p.pos.y < 0.2) spd *= 0.7;
  const k = 1 - Math.exp(-(p.grounded ? 14 : 3) * dt);
  p.vel.x += (wx * spd - p.vel.x) * k; p.vel.z += (wz * spd - p.vel.z) * k;
  if (A.jump && p.grounded) { p.vel.y = 8.4; p.grounded = false; }
  charPhysics(p, dt);
  p.modelYaw = p.yaw;
}
function computeAim(p) {
  camera.getWorldDirection(_tmpV);
  const cp = camera.position;
  eyeOf(p, AIM.origin);
  const skip = Math.max(0, _tmpV2.copy(AIM.origin).sub(cp).dot(_tmpV));
  const ox = cp.x + _tmpV.x * skip, oy = cp.y + _tmpV.y * skip, oz = cp.z + _tmpV.z * skip;
  const h = traceShot(p, ox, oy, oz, _tmpV.x, _tmpV.y, _tmpV.z, 600, true);
  AIM.point.set(ox + _tmpV.x * h.t, oy + _tmpV.y * h.t, oz + _tmpV.z * h.t);
  p.aimChar = h.char;
  AIM.dir.subVectors(AIM.point, AIM.origin);
  const L = AIM.dir.length();
  if (L < 0.6) AIM.dir.copy(_tmpV); else AIM.dir.multiplyScalar(1 / L);
}
function playerCombat(p, A) {
  const it = curItem(p);
  if (!it) { if (A.fire && p.swingT <= 0) meleeSwing(p, AIM.origin.x, AIM.origin.y, AIM.origin.z, AIM.dir, 3.3); return; }
  if (it.kind === 'consumable') { if (A.firePressed && !p.using) startUse(p); return; }
  const def = WEAPONS[it.id];
  if (A.reload) startReload(p);
  if (!A.fire) return;
  if (p.reloadT > 0) { if (def.reloadPer && it.mag > 0) p.reloadT = 0; else return; }
  p.using = null;
  if (p.fireCD > 0) return;
  if (it.mag <= 0) { if (A.firePressed && !startReload(p)) { SFX.dry(); if (p.ammo[def.ammo] <= 0) HUD.banner('Out of ' + AMMO[def.ammo].name.toLowerCase(), 'Find ammo in chests or on the ground', 1.4); } return; }
  fireWeapon(p, it, AIM.origin, AIM.dir);
  it.mag--; p.fireCD = 1 / def.rate;
  p.pitch = Math.min(1.45, p.pitch + def.recoil * (p.aiming ? 0.55 : 1));
  if (it.mag === 0 && p.ammo[def.ammo] > 0) p.autoReload = 0.3;
}
function playerBuild(p, A, dt) {
  if (A.aimPressed) { p.buildMat = MAT_ORDER[(MAT_ORDER.indexOf(p.buildMat) + 1) % 3]; SFX.click(); }
  if (A.reload) p.buildRot = (p.buildRot + 1) % 4;
  const s = buildTarget(p.buildMode, p, p.yaw, p.pitch, p.buildRot);
  const ok = canPlace(s) && p.mats[p.buildMat] >= 10;
  showGhost(s, ok);
  p.buildCD -= dt;
  if (A.fire && p.buildCD <= 0) {
    if (ok) { p.mats[p.buildMat] -= 10; placePiece(s, p.buildMat, p); GAME.stats.builds++; p.buildCD = 0.1; }
    else if (A.firePressed && p.mats[p.buildMat] < 10) HUD.banner('Not enough ' + MATNAME[p.buildMat].toLowerCase(), IS_TOUCH ? 'Hit trees and walls with your pickaxe' : 'Hit trees and walls with your pickaxe (F)', 1.6);
  }
}
function playerInteract(p, A) {
  const ch = nearestChest(p, 2.6);
  let target = ch, label = ch ? 'Open chest' : '', rar = 4;
  if (!ch) { const it = nearestItem(p, 2.3); if (it && it.kind !== 'ammo' && it.kind !== 'mats') { target = it; label = 'Pick up ' + itemLabel(it); rar = itemRarity(it); } }
  HUD.prompt(target ? label : null, rar);
  if (A.interact && target) { if (ch) openChest(ch, p); else pickupItem(p, target); }
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const it = ITEMS[i]; if (it.kind !== 'ammo' && it.kind !== 'mats') continue; if (it.age < 0.6) continue;
    const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z;
    if (dx * dx + dz * dz < 2.8 && Math.abs(it.pos.y - p.pos.y) < 1.8) { giveItem(p, it); removeItem(it); SFX.pickup(); }
  }
}
function playerActions(dt) {
  const p = player, A = GAME.pendingA;
  if (!A || !p.alive || p.mode !== 'ground' || GAME.state === 'won') { if (ghostMesh) ghostMesh.visible = false; HUD.prompt(null); return; }
  computeAim(p);
  if (p.buildMode) playerBuild(p, A, dt); else { showGhost(null); playerCombat(p, A); }
  playerInteract(p, A);
  tickTimers(p, dt);
  animateRig(p, dt);
}

// ---------- camera + environment ----------
function pointScale() { return renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)); }
function setFov(target, dt) {
  const nf = lerp(camera.fov, target, 1 - Math.exp(-dt * 12));
  if (Math.abs(nf - camera.fov) > 0.01) { camera.fov = nf; camera.updateProjectionMatrix(); FX.setScale(pointScale()); }
}
function updateCamera(dt) {
  const f = focusChar(); if (!f) return;
  if (f === player && player.mode === 'bus') {
    const yaw = player.yaw, pitch = clamp(player.pitch, -1.2, 0.6), cd = 36, cpch = Math.cos(pitch);
    camera.position.set(BUS.pos.x + Math.sin(yaw) * cpch * cd, BUS.pos.y + 4 - Math.sin(pitch) * cd, BUS.pos.z + Math.cos(yaw) * cpch * cd);
    camera.rotation.set(pitch, yaw, 0);
    CAM.yaw = yaw; CAM.scoped = false; setFov(75, dt);
    return;
  }
  if (GAME.state === 'won' && f === player) {
    CAM.orbit += dt * 0.5;
    const r = 5.5;
    camera.position.set(player.pos.x + Math.sin(CAM.orbit) * r, player.pos.y + 2.4, player.pos.z + Math.cos(CAM.orbit) * r);
    camera.lookAt(player.pos.x, player.pos.y + 1.2, player.pos.z);
    CAM.yaw = CAM.orbit; CAM.scoped = false; player.rig.root.visible = true; setFov(70, dt);
    return;
  }
  let yaw, pitch;
  if (f === player) { yaw = player.yaw; pitch = player.pitch; }
  else { CAM.specYaw += angleDiff(CAM.specYaw, f.yaw) * Math.min(1, dt * 3); yaw = CAM.specYaw; pitch = -0.3; }
  const w = f === player && player.aiming ? curWeapon(player) : null;
  const scoped = !!(w && WEAPONS[w.id].scope);
  const tDist = f.mode === 'sky' ? 7.5 : f.mode === 'glide' ? 6.5 : scoped ? 0 : w ? 1.9 : (f === player && player.buildMode) ? 4.3 : f === player ? 3.6 : 4.6;
  CAM.dist = lerp(CAM.dist, tDist, 1 - Math.exp(-dt * 14));
  CAM.shoulder = lerp(CAM.shoulder, scoped ? 0 : w ? 0.62 : 0.85, 1 - Math.exp(-dt * 14));
  const px = f.pos.x, py = f.pos.y + (f.mode === 'ground' ? 1.62 : 1.2), pz = f.pos.z;
  const cp = Math.cos(pitch), fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let tx = px + rx * CAM.shoulder - fx * CAM.dist, ty = py + (scoped ? 0 : 0.3) - fy * CAM.dist, tz = pz + rz * CAM.shoulder - fz * CAM.dist;
  if (CAM.dist > 0.1) {
    let dx = tx - px, dy = ty - py, dz = tz - pz; const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L > 0.01) {
      dx /= L; dy /= L; dz /= L;
      const h = raycastWorld(px, py, pz, dx, dy, dz, L + 0.25, true);
      if (h.t < L + 0.25) { const t = Math.max(0.15, h.t - 0.25); tx = px + dx * t; ty = py + dy * t; tz = pz + dz * t; }
    }
  }
  ty = Math.max(ty, walkH(tx, tz) + 0.3);
  camera.position.set(tx, ty, tz);
  if (CAM.shake > 0) { CAM.shake = Math.max(0, CAM.shake - dt * 2.2); camera.position.x += mr(-1, 1) * CAM.shake * 0.35; camera.position.y += mr(-1, 1) * CAM.shake * 0.35; }
  camera.rotation.set(pitch, yaw, 0);
  CAM.yaw = yaw; CAM.scoped = scoped && CAM.dist < 0.35;
  if (player.alive && player.mode !== 'bus') player.rig.root.visible = !CAM.scoped;
  setFov(w ? 75 / WEAPONS[w.id].zoom : f.mode === 'sky' ? 84 : 75, dt);
}
function updateEnv(dt) {
  const cp = camera.position;
  skyMesh.position.copy(cp);
  for (const cl of cloudGroup.children) { cl.position.x += cl.userData.v * dt; if (cl.position.x > 750) cl.position.x = -750; }
  const f = focusChar();
  const fp = !f ? cp : f.mode === 'bus' ? BUS.pos : f.pos;
  sun.position.set(fp.x + WORLD.sunDir.x * 160, fp.y + WORLD.sunDir.y * 160, fp.z + WORLD.sunDir.z * 160);
  sun.target.position.copy(fp); sun.target.updateMatrixWorld();
  const inS = (GAME.state !== 'menu' && f && f.alive && f.mode !== 'bus' && inStorm(f.pos)) ? 1 : 0;
  CAM.storm = lerp(CAM.storm, inS, 1 - Math.exp(-dt * 3));
  scene.fog.color.copy(FOG_COL).lerp(STORM_FOG, CAM.storm);
  scene.fog.near = lerp(140, 6, CAM.storm); scene.fog.far = lerp(560, 150, CAM.storm);
  skyMesh.material.uniforms.storm.value = CAM.storm * 0.85;
  SFX.loop('storm', CAM.storm * 0.5);
  updateStaticCulling(dt, cp.x, cp.z);
  SFX.setListener(cp.x, cp.y, cp.z, CAM.yaw);
}
function menuCamera(dt) {
  CAM.orbit += dt * 0.03;
  const a = CAM.orbit, r = 360;
  camera.position.set(Math.cos(a) * r, 120, Math.sin(a) * r);
  camera.lookAt(Math.cos(a + 1.2) * 60, 10, Math.sin(a + 1.2) * 60);
  if (Math.abs(camera.fov - 62) > 0.01) { camera.fov = 62; camera.updateProjectionMatrix(); FX.setScale(pointScale()); }
}

// ---------- match flow ----------
function requestLock() {
  if (IS_TOUCH) return;
  try { const r = renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { /* lock refused; drag-to-look still works */ }); } catch (e) { /* ignore */ }
}
function releaseLock() { INPUT.expectUnlock(); if (document.pointerLockElement) document.exitPointerLock(); }
const $id = (id) => document.getElementById(id);
function startMatch() {
  SFX.init();
  try { renderer.domElement.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  if (IS_TOUCH && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try { document.documentElement.requestFullscreen().then(() => { try { const o = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (o && o.catch) o.catch(() => {}); } catch (e) { /* no orientation lock */ } }).catch(() => {}); } catch (e) { /* fullscreen unavailable */ }
  }
  for (const id of ['menu', 'endscreen', 'spec', 'pause']) $id(id).hidden = true;
  $id('loading').hidden = false;
  requestLock();
  setTimeout(() => {
    try { setupMatch(); } catch (e) { console.error(e); }
    $id('loading').hidden = true;
  }, 50);
}
function setupMatch() {
  if (!GAME.menuWorldFresh) newWorld((Math.random() * 1e9) | 0);
  GAME.menuWorldFresh = false;
  characters.length = 0; bots.length = 0; usedNames.clear();
  FX.clear(); HUD.reset(); INPUT.clearAim();
  player = makeCharacter(true, 'You', OUTFITS[SETTINGS.outfit % OUTFITS.length]); player.dance = false;
  characters.push(player);
  for (let i = 0; i < SETTINGS.bots; i++) { const b = makeBot(); bots.push(b); characters.push(b); }
  setupBus(); stormInit();
  // bots pick a landing spot and leave the dropship when it passes closest to it
  const pathLen = BUS.start.distanceTo(BUS.end);
  for (const b of bots) {
    chooseDrop(b);
    const t = ((b.dropTarget.x - BUS.start.x) * BUS.dir.x + (b.dropTarget.z - BUS.start.z) * BUS.dir.z) / pathLen;
    b.jumpAt = clamp(t - 0.06 + Math.random() * 0.05, 0.04, 0.95);
  }
  Object.assign(GAME, { deathLog: [], state: 'play', time: 0, alive: characters.length, spectating: null, placement: 0, killer: null, deathKind: '', deathTime: 0, paused: false, stats: { mats: 0, builds: 0, chests: 0 } });
  player.yaw = Math.atan2(-BUS.dir.x, -BUS.dir.z) + 0.7; player.pitch = -0.28;
  CAM.dist = 3.6; CAM.storm = 0; CAM.shake = 0;
  HUD.show(true); HUD.toggleMap(false);
  HUD.banner('Jump when ready', IS_TOUCH ? 'Tap JUMP to leave the dropship' : 'Press Space to leave the dropship', 5);
  STORM.mesh.visible = true;
}
function onPlayerDeath(src, kind) {
  GAME.placement = GAME.alive + 1;
  GAME.deathTime = GAME.time; GAME.state = 'dead'; GAME.deathKind = kind || '';
  GAME.killer = src && src !== player ? src : null;
  GAME.spectating = GAME.killer && GAME.killer.alive ? GAME.killer : null;
  CAM.specYaw = player.yaw;
  showGhost(null); HUD.prompt(null); SFX.loop('wind', 0);
  setTimeout(() => { if (GAME.state === 'dead') showEnd(false); }, 1700);
}
function checkEnd() {
  if (GAME.state === 'play' && player && player.alive && GAME.alive <= 1) {
    GAME.state = 'won'; GAME.placement = 1; SFX.victory();
    HUD.banner('Victory', 'Last one standing', 3);
    player.dance = true; player.slot = -1; player.buildMode = null; updateHeld(player); CAM.orbit = player.yaw;
    const cols = [0xffc62e, 0x41b8ff, 0xff5d8f, 0x5ee05a, 0xb45cff];
    for (let i = 0; i < 5; i++) setTimeout(() => FX.burst(player.pos.x + mr(-3, 3), player.pos.y + mr(4, 7), player.pos.z + mr(-3, 3), 40, cols[i], 7, 1.6, 0.35, true, -3), i * 260);
    setTimeout(() => showEnd(true), 1500);
  } else if (GAME.state === 'dead' && GAME.alive === 1) {
    const w = characters.find((c) => c.alive);
    if (w) HUD.feed('<b>' + w.name + '</b> is the last one standing');
  }
}
function showEnd(win) {
  releaseLock(); HUD.hideBanner();
  $id('endscreen').hidden = false; $id('spec').hidden = true;
  HUD.toggleMap(false);
  const pl = $id('end-place'); pl.textContent = '#' + GAME.placement; pl.className = 'place' + (win ? ' win' : '');
  $id('end-sub').textContent = win ? 'Last one standing' : GAME.placement <= 5 ? 'So close' : GAME.placement <= 10 ? 'Top 10' : 'Eliminated';
  let detail;
  if (win) detail = 'You outlasted ' + (characters.length - 1) + ' players.';
  else if (GAME.killer) detail = 'Eliminated by ' + GAME.killer.name + '.';
  else if (GAME.deathKind === 'storm') detail = 'The storm caught you.';
  else if (GAME.deathKind === 'fall') detail = 'That fall was too far.';
  else detail = 'Better luck next drop.';
  $id('end-detail').textContent = detail;
  $id('st-kills').textContent = player.kills;
  $id('st-dmg').textContent = Math.round(player.damageDealt);
  $id('st-builds').textContent = GAME.stats.builds;
  $id('st-time').textContent = fmtTime(win ? GAME.time : GAME.deathTime);
  $id('spectate').hidden = win || !bots.some((b) => b.alive);
}
function startSpectate() {
  $id('endscreen').hidden = true; $id('spec').hidden = false;
  if (!GAME.spectating || !GAME.spectating.alive) nextSpectate(); else updateSpecName();
}
function nextSpectate() {
  const alive = bots.filter((b) => b.alive && b.mode !== 'bus');
  if (!alive.length) { backToResults(); return; }
  GAME.spectating = alive[(alive.indexOf(GAME.spectating) + 1) % alive.length];
  CAM.specYaw = GAME.spectating.yaw; updateSpecName();
}
function updateSpecName() { $id('spec-name').textContent = GAME.spectating ? GAME.spectating.name + ' · ' + GAME.spectating.kills + ' elims' : ''; }
function backToResults() { $id('spec').hidden = true; showEnd(GAME.state === 'won'); }
function pause() {
  if (GAME.state === 'menu' || GAME.paused || !$id('endscreen').hidden) return;
  GAME.paused = true; $id('pause').hidden = false; releaseLock();
  SFX.loop('wind', 0); SFX.loop('hum', 0); SFX.loop('storm', 0);
}
function resume() { GAME.paused = false; $id('pause').hidden = true; requestLock(); SFX.init(); }
function quitToMenu() {
  releaseLock();
  GAME.paused = false; GAME.state = 'menu';
  for (const id of ['pause', 'endscreen', 'spec', 'clickplay', 'rotate']) $id(id).hidden = true;
  $id('menu').hidden = false;
  HUD.show(false); HUD.toggleMap(false);
  for (const c of characters) c.rig.root.visible = false;
  BUS.mesh.visible = false; showGhost(null); STORM.mesh.visible = false;
  for (const n of ['wind', 'hum', 'storm']) SFX.loop(n, 0);
  CAM.storm = 0;
}

// ---------- settings + menu ----------
function applyQuality() {
  const hi = SETTINGS.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1));
  renderer.shadowMap.enabled = hi; sun.castShadow = hi;
  scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  for (const m of Object.values(MAT.build)) m.needsUpdate = true;
  onResize();
}
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  FX.setScale(pointScale());
}
function syncSegs() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const k = seg.dataset.opt;
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(SETTINGS[k]) === b.dataset.v));
  });
}
function syncOutfit() {
  const o = OUTFITS[SETTINGS.outfit % OUTFITS.length];
  $id('of-name').textContent = o.name;
  $id('of-chips').innerHTML = [o.shirt, o.pants, o.acc, o.hair].map((c) => '<i style="background:' + hexCss(c) + '"></i>').join('');
}
function wireMenu() {
  document.body.classList.toggle('is-touch', IS_TOUCH);
  $id('controls-help').hidden = IS_TOUCH; $id('touch-help').hidden = !IS_TOUCH;
  document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = seg.dataset.opt, v = b.dataset.v;
    SETTINGS[k] = k === 'bots' ? +v : v; saveSettings(); syncSegs(); SFX.click();
    if (k === 'quality') applyQuality();
  }));
  $id('of-prev').addEventListener('click', () => { SETTINGS.outfit = (SETTINGS.outfit + OUTFITS.length - 1) % OUTFITS.length; saveSettings(); syncOutfit(); });
  $id('of-next').addEventListener('click', () => { SETTINGS.outfit = (SETTINGS.outfit + 1) % OUTFITS.length; saveSettings(); syncOutfit(); });
  const bindRange = (id, key, fmt) => {
    const el = $id(id), out = $id(id + '-out');
    el.value = SETTINGS[key]; out.textContent = fmt(SETTINGS[key]);
    el.addEventListener('input', () => {
      SETTINGS[key] = +el.value; out.textContent = fmt(SETTINGS[key]); saveSettings();
      if (key === 'vol') SFX.setVolume(SETTINGS.vol);
      for (const other of ['sens', 'sens2']) if (other !== id && key === 'sens') { $id(other).value = SETTINGS.sens; $id(other + '-out').textContent = fmt(SETTINGS.sens); }
    });
  };
  bindRange('sens', 'sens', (v) => (+v).toFixed(1)); bindRange('sens2', 'sens', (v) => (+v).toFixed(1)); bindRange('vol', 'vol', (v) => Math.round(v * 100));
  $id('play').addEventListener('click', startMatch);
  $id('again').addEventListener('click', startMatch);
  $id('resume').addEventListener('click', resume);
  $id('quit').addEventListener('click', quitToMenu);
  $id('tomenu').addEventListener('click', quitToMenu);
  $id('spectate').addEventListener('click', startSpectate);
  $id('spec-next').addEventListener('click', nextSpectate);
  $id('spec-back').addEventListener('click', backToResults);
  syncSegs(); syncOutfit();
}

// ---------- main loop ----------
let _last = performance.now(), _fpsT = 0, _fpsN = 0;
function frame(dt) {
  if (GAME.state === 'menu') { menuCamera(dt); updateEnv(dt); FX.update(dt); INPUT.endFrame(); return; }
  if (GAME.paused) { INPUT.endFrame(); return; }
  GAME.time += dt;
  updateBus(dt);
  updatePlayer(dt);
  const cp = camera.position;
  for (const b of bots) updateBot(b, dt, cp.x, cp.z);
  if (!player.alive) deathAnim(player, dt);
  updateItems(dt, cp.x, cp.z);
  updateChests(dt, cp.x, cp.z);
  updateRockets(dt);
  updateSupply(dt);
  updateBuild(dt);
  updateShaking(dt);
  updateStorm(dt);
  updateWeak(dt);
  updateCamera(dt);
  playerActions(dt);
  FX.update(dt);
  updateEnv(dt);
  HUD.update(dt);
  if (!$id('spec').hidden && (!GAME.spectating || !GAME.spectating.alive)) nextSpectate();
  $id('clickplay').hidden = IS_TOUCH || INPUT.locked || GAME.state !== 'play' || !player.alive;
  $id('rotate').hidden = !(IS_TOUCH && innerHeight > innerWidth * 1.1);
  INPUT.endFrame();
}
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - _last) / 1000; _last = now;
  if (!(dt > 0)) return;
  if (dt > 0.05) dt = 0.05;
  try { frame(dt); } catch (e) { console.error(e); }
  renderer.render(scene, camera);
  _fpsT += dt; _fpsN++;
  if (_fpsT > 1) { GAME.fps = Math.round(_fpsN / _fpsT); _fpsT = 0; _fpsN = 0; }
}
function init() {
  renderer = new THREE.WebGLRenderer({ canvas: $id('c'), antialias: !IS_TOUCH, powerPreference: 'high-performance' });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COL.getHex(), 140, 560);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  camera.rotation.order = 'YXZ';
  hemi = new THREE.HemisphereLight(0xdcecff, 0x4d5f3c, 0.58); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 0.72);
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 420;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  makeTextures(); makeMaterials(); makeEnvironment(); initBuildGeo(); makeStormMesh(); makeBusMesh();
  FX.init(); HUD.init(); INPUT.init(); wireMenu();
  addEventListener('resize', onResize);
  newWorld((Math.random() * 1e9) | 0); GAME.menuWorldFresh = true;
  stormInit(); STORM.mesh.visible = false;
  applyQuality();
  requestAnimationFrame(loop);
  window.STORMDROP = { renderOnce() { const t0 = performance.now(); renderer.render(scene, camera); return performance.now() - t0; }, frameOnce(dt) { const t0 = performance.now(); frame(dt); return performance.now() - t0; }, dbg: { traceShot, AIM, raycastWorld, rayCharacters, computeAim, eyeOf }, get info() { return renderer.info.render; }, step(n, dt) { for (let i = 0; i < n; i++) frame(dt || 0.05); }, GAME, get player() { return player; }, bots, characters, STORM, BUS, WORLD, startMatch, setupMatch, jumpOut, CAM, PIECES, ITEMS, CHESTS, SETTINGS };
}
init();
