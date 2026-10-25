// ---------- game flow, player control, camera, main loop ----------
const GAME = { deathLog: [], state: 'menu', time: 0, alive: 0, paused: false, spectating: null, placement: 0, killer: null, deathKind: '', deathTime: 0, stats: { mats: 0, builds: 0, chests: 0 }, menuWorldFresh: false };
const CAM = { yaw: 0, dist: 3.6, shoulder: 0.85, scoped: false, shake: 0, orbit: 0.6, storm: 0, specYaw: 0, kick: 0, kickYaw: 0, swing: 0, roll: 0, fovAdd: 0 };
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
  const R = WORLD.islandR + 200;
  BUS.start.set(Math.cos(a) * R + px * off, BUS.alt, Math.sin(a) * R + pz * off);
  BUS.end.set(-Math.cos(a) * R + px * off, BUS.alt, -Math.sin(a) * R + pz * off);
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
  if (c.isPlayer) { let k = 0; for (const b of bots) if (b.mate && b.mode === 'bus') b.jumpAt = BUS.t + 0.004 * ++k; }
  if (c.isPlayer) { SFX.jump(); HUD.banner('Skydiving', IS_TOUCH ? 'Steer with the left stick. Look down to dive faster.' : 'Steer with WASD. Look down to dive faster. Space opens the glider.', 3); }
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
  const p = player, A = GAME.forceA ? Object.assign({ mx: 0, my: 0, slotKey: -1 }, GAME.forceA) : INPUT.actions();
  GAME.pendingA = A;
  if (A.map) HUD.toggleMap();
  if (A.inventory && GAME.state === 'play') INV.toggle();
  if (A.ping && p.alive && GAME.state === 'play' && p.mode !== 'bus') PING.place(p);
  if (!p.alive) return;
  if (GAME.state === 'won') { p.vel.x = 0; p.vel.z = 0; p.aiming = false; charPhysics(p, dt); animateRig(p, dt); return; }
  const w0 = curWeapon(p);
  const zoom = p.aiming && w0 ? WEAPONS[w0.id].zoom : 1;
  const s = 0.0021 * SETTINGS.sens / zoom * (p.aiming ? SETTINGS.adsSens / 0.75 : 1);
  p.yaw -= INPUT.dx * s; p.pitch = clamp(p.pitch - INPUT.dy * s * (SETTINGS.invertY ? -1 : 1), -1.45, 1.45);
  if (p.mode === 'bus') { if (A.jump || BUS.t >= 1) jumpOut(p); return; }
  if (p.mode === 'sky' || p.mode === 'glide') {
    skyPhysics(p, dt, clamp(A.mx, -1, 1), clamp(A.my, -1, 1), A.jump);
    if (p.mode === 'ground') rescueFromWater(p);
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
  const mx = clamp(A.mx, -1, 1), my = clamp(A.my, -1, 1);
  // emotes: T cycles through them; any action cancels
  if (p.emote) {
    const E = EMOTES[p.emote];
    if (Math.abs(mx) + Math.abs(my) > 0.1 || A.fire || A.jump || A.aim || A.buildToggle || A.piece || A.slotKey >= 0 || A.crouchPressed || (E && E.len && GAME.time - p.emoteStart > E.len)) stopEmote(p);
  }
  if (A.emote && p.grounded && !p.sliding && !p.mantle && !p.knocked) { const ids = PROFILE.loadout.emotes.filter((k) => EMOTES[k]); if (ids.length) { playEmote(p, ids[(ids.indexOf(p.emote) + 1) % ids.length]); HUD.banner(EMOTES[p.emote].name, '', 0.9); ev('emote'); } }
  if (p.mantle) { updateMantle(p, dt); tickEye(p, dt); p.modelYaw = p.yaw; return; }
  if (p.zip) { updateZip(p, dt, A.jump); tickEye(p, dt); return; }
  if (p.vehicle) { updateVehicle(p.vehicle, dt, { mx, my, jump: A.jump }); if (A.interact) exitVehicle(p); tickEye(p, dt); return; }
  if (p.knocked) { A.jump = false; A.crouchPressed = false; A.crouch = false; p.buildMode = null; }
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let wx = fx * my + rx * mx, wz = fz * my + rz * mx; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  p.aiming = A.aim && !p.buildMode && !!curWeapon(p) && !p.emote;
  // crouch / slide
  const sp0 = Math.hypot(p.vel.x, p.vel.z);
  if (A.crouchPressed && p.grounded && !p.sliding && sp0 > 7.4 && !p.emote) startSlide(p);
  else if (A.crouch && !p.crouch && !p.sliding) setCrouch(p, true);
  else if (!A.crouch && (p.crouch || (p.sliding && p.slideT > 0.2))) setCrouch(p, false);
  const sprintKey = IS_TOUCH || !SETTINGS.autoSprint ? A.sprint : !A.sprint;
  p.sprinting = sprintKey && my > 0.3 && !p.aiming && !p.using && !p.crouch && p.fireCD <= 0 && p.reloadT <= 0;
  let spd = 6.6;
  if (p.aiming) spd = 4.2; else if (p.sprinting) spd = 8.8;
  if (p.crouch) spd = p.aiming ? 2.8 : 3.8;
  if (p.using) spd = 2.8;
  if (p.pos.y < 0.2) spd *= 0.7;
  if (p.emote) spd = 0;
  if (p.knocked) spd = 1.7;
  if (p.reviving) spd = 0;
  if (p.sliding) slidePhysics(p, dt, wx, wz, A.crouch);
  else {
    const k = 1 - Math.exp(-(p.grounded ? 14 : 3) * dt);
    p.vel.x += (wx * spd - p.vel.x) * k; p.vel.z += (wz * spd - p.vel.z) * k;
  }
  if (A.jump && p.grounded) {
    if (!tryMantle(p)) {
      p.vel.y = p.crouch ? 7.2 : 8.4; p.grounded = false;
      if (p.sliding) { p.sliding = false; setCrouch(p, false); p.vel.x *= 1.05; p.vel.z *= 1.05; }
      else if (p.crouch) setCrouch(p, false);
    }
  }
  if (!p.mantle) charPhysics(p, dt);
  if (!p.grounded && !p.mantle && my > 0.5 && p.blocked && p.vel.y < 4) tryMantle(p);
  tickEye(p, dt);
  if (!p.emote) p.modelYaw = p.yaw;
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
function playerCombat(p, A, dt) {
  const it = curItem(p);
  if (!it) { if (A.fire && p.swingT <= 0) meleeSwing(p, AIM.origin.x, AIM.origin.y, AIM.origin.z, AIM.dir, 3.3); return; }
  if (it.kind === 'consumable') {
    const cd = CONSUMABLES[it.id];
    if (cd.throwable || cd.placeable) { if (A.firePressed && p.throwT <= 0) useGadget(p, it, AIM.origin, AIM.dir); return; }
    if (A.firePressed && !p.using) startUse(p); return;
  }
  const def = WEAPONS[it.id];
  // queued burst rounds keep firing along the current aim
  if (p.burstQ > 0) { if (p.burstT <= 0 && it.mag > 0) { shootOnce(p, it, def); p.burstQ--; p.burstT = def.burstGap; } return; }
  if (A.reload) startReload(p);
  if (!A.fire) return;
  if (p.reloadT > 0) { if (def.reloadPer && it.mag > 0) p.reloadT = 0; else return; }
  p.using = null;
  if (def.spin) { p.spinning = true; if (p.spin < 1) return; }
  if (p.fireCD > 0) return;
  if (it.mag <= 0) { if (A.firePressed && !startReload(p)) { SFX.dry(); if (p.ammo[def.ammo] <= 0) HUD.banner('Out of ' + AMMO[def.ammo].name.toLowerCase(), 'Find ammo in chests or on the ground', 1.4); } return; }
  shootOnce(p, it, def);
  p.fireCD = 1 / def.rate;
  if (def.burst) { p.burstQ = def.burst - 1; p.burstT = def.burstGap; }
}
function shootOnce(p, it, def) {
  fireWeapon(p, it, AIM.origin, AIM.dir);
  it.mag--;
  const rk = def.recoil * (p.aiming ? 0.55 : 1) * (p.crouch ? 0.8 : 1);
  p.pitch = Math.min(1.45, p.pitch + rk * 0.45); CAM.kick += rk * 0.85; CAM.kickYaw += mr(-1, 1) * rk * 0.3;
  CAM.shake = Math.min(1, CAM.shake + (def.id === 'sniper' || def.id === 'heavy' || def.id === 'shotgun' || def.id === 'tac' || def.id === 'rocket' || def.id === 'hand' ? 0.32 : 0.1));
  if (it.mag === 0) { p.burstQ = 0; if (p.ammo[def.ammo] > 0) p.autoReload = 0.3; }
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
  const down = teamMode() ? nearestKnockedMate(p, 2.4) : null;
  if (down) { target = down; label = (A.interactHeld ? 'Reviving ' : 'Hold E to revive ') + down.name; rar = 1; if (A.interactHeld && !p.reviving) p.reviving = { target: down, t: 0 }; }
  tickRevive(p, GAME.dtLast || 0.016, !!A.interactHeld && !!down);
  if (down) { HUD.prompt(label, rar); return; }
  let car = null;
  if (!target) { car = nearestVehicle(p, 3); if (car) { target = car; label = 'Drive quad'; rar = 2; } }
  let zipT = null;
  if (!target && !p.zip) { zipT = nearestZip(p, 2.6); if (zipT) { target = zipT; label = 'Ride zipline'; rar = 2; } }
  let food = null;
  if (!target) { food = nearestForage(p, 1.8); if (food) { target = food; label = food.type === 'apple' ? 'Eat apple (+5 health)' : 'Eat mushroom (+5 shield)'; rar = 1; } }
  HUD.prompt(target ? label : null, rar);
  if (A.interact && target) { if (ch) openChest(ch, p); else if (car) enterVehicle(p, car); else if (zipT) startZip(p, zipT); else if (food) eatForage(p, food); else pickupItem(p, target); }
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const it = ITEMS[i]; if (it.kind !== 'ammo' && it.kind !== 'mats') continue; if (it.age < 0.6) continue;
    const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z;
    if (dx * dx + dz * dz < 2.8 && Math.abs(it.pos.y - p.pos.y) < 1.8) { giveItem(p, it); removeItem(it); SFX.pickup(); }
  }
}
function playerActions(dt) {
  const p = player, A = GAME.pendingA;
  if (!A || !p.alive || p.mode !== 'ground' || GAME.state === 'won') { if (ghostMesh) ghostMesh.visible = false; HUD.prompt(null); return; }
  if (p.zip) { HUD.prompt(IS_TOUCH ? 'Tap JUMP to let go' : 'Space to let go', 2); tickTimers(p, dt); animateRig(p, dt); return; }
  if (p.vehicle) { HUD.prompt(null); showGhost(null); tickTimers(p, dt); animateRig(p, dt); return; }
  if (p.knocked) { showGhost(null); HUD.prompt('You are down: crawl to safety', 4); tickTimers(p, dt); tickEye(p, dt); animateRig(p, dt); return; }
  computeAim(p);
  if (p.editing) { showGhost(null); updateEdit(p, A); }
  else if (A.edit && editTarget(p)) startEdit(p, editTarget(p));
  else if (p.buildMode) playerBuild(p, A, dt); else { showGhost(null); playerCombat(p, A, dt); }
  if (IS_TOUCH) { GAME.editT = (GAME.editT || 0) - dt; if (GAME.editT <= 0) { GAME.editT = 0.25; GAME.canEdit = !p.buildMode && !!editTarget(p); } $id('tb-edit').hidden = !(p.editing || GAME.canEdit); }
  if (!p.editing) playerInteract(p, A);
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
  CAM.kick += (0 - CAM.kick) * (1 - Math.exp(-dt * 9)); CAM.kickYaw += (0 - CAM.kickYaw) * (1 - Math.exp(-dt * 11));
  CAM.swing += ((f === player && player.emote ? Math.PI * 0.9 : 0) - CAM.swing) * (1 - Math.exp(-dt * 4));
  if (f === player) { yaw = player.yaw + CAM.kickYaw + CAM.swing; pitch = clamp(player.pitch + CAM.kick, -1.5, 1.5); if (player.emote) pitch = clamp(pitch, -0.7, 0.35); }
  else { CAM.specYaw += angleDiff(CAM.specYaw, f.yaw) * Math.min(1, dt * 3); yaw = CAM.specYaw; pitch = -0.3; }
  const w = f === player && player.aiming ? curWeapon(player) : null;
  const scoped = !!(w && WEAPONS[w.id].scope);
  const emo = f === player && player.emote;
  const tDist = f.vehicle ? 7 : f.mode === 'sky' ? 7.5 : f.mode === 'glide' ? 6.5 : emo ? 4.6 : scoped ? 0 : w ? 1.9 : (f === player && player.buildMode) ? 4.3 : f === player ? 3.6 : 4.6;
  CAM.dist = lerp(CAM.dist, tDist, 1 - Math.exp(-dt * (emo ? 5 : 14)));
  CAM.shoulder = lerp(CAM.shoulder, scoped || emo || f.vehicle ? 0 : w ? 0.62 : 0.85, 1 - Math.exp(-dt * 14));
  const an = f.anim || { land: 0, phase: 0 }, fsp = Math.hypot(f.vel.x, f.vel.z);
  const bob = f.mode === 'ground' && f.grounded && !f.sliding ? Math.sin(an.phase * 2) * 0.03 * Math.min(1, fsp / 7) : 0;
  const px = f.pos.x, py = f.pos.y + (f.mode === 'ground' ? (f.eyeH || 1.6) + 0.02 - an.land * 0.2 + bob : 1.2), pz = f.pos.z;
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
  // trauma shake: smooth noise, squared so small hits stay subtle
  let roll = 0;
  if (CAM.shake > 0) {
    CAM.shake = Math.max(0, CAM.shake - dt * 1.5);
    const tr = CAM.shake * CAM.shake, T = GAME.time * 24;
    tx += (Math.sin(T * 1.13) + Math.sin(T * 2.71 + 1.3) * 0.5) * tr * 0.16;
    ty += (Math.sin(T * 1.37 + 2.1) + Math.sin(T * 3.1 + 0.4) * 0.5) * tr * 0.16;
    roll += Math.sin(T * 0.93 + 4.2) * tr * 0.05;
    pitch += Math.sin(T * 1.9 + 0.7) * tr * 0.025;
  }
  camera.position.set(tx, ty, tz);
  if (f === player && f.mode === 'ground') { const side = f.vel.x * rx + f.vel.z * rz; CAM.roll = lerp(CAM.roll, -side * 0.0022 - (f.sliding ? 0.025 : 0), 1 - Math.exp(-dt * 6)); } else CAM.roll = lerp(CAM.roll, 0, 1 - Math.exp(-dt * 6));
  camera.rotation.set(pitch, yaw, roll + CAM.roll);
  CAM.yaw = yaw; CAM.scoped = scoped && CAM.dist < 0.35;
  if (player.alive && player.mode !== 'bus') player.rig.root.visible = !CAM.scoped;
  CAM.fovAdd = lerp(CAM.fovAdd, f === player && !w ? (player.sliding ? 9 : player.sprinting && fsp > 7.5 ? 5 : 0) : 0, 1 - Math.exp(-dt * 6));
  setFov(w ? SETTINGS.fov / WEAPONS[w.id].zoom : f.mode === 'sky' ? SETTINGS.fov + 9 : SETTINGS.fov + CAM.fovAdd, dt);
}
function updateEnv(dt) {
  const cp = camera.position;
  UTIME.value += dt;
  ENVSTATE.sky.position.copy(cp);
  for (const cl of cloudGroup.children) { cl.position.x += cl.userData.v * dt * (0.6 + UWIND.value); if (cl.position.x > 900) cl.position.x = -900; }
  const f = focusChar();
  const fp = !f ? cp : f.mode === 'bus' ? BUS.pos : f.pos;
  const sd = 220;
  sun.position.set(fp.x + WORLD.sunDir.x * sd, fp.y + WORLD.sunDir.y * sd, fp.z + WORLD.sunDir.z * sd);
  sun.target.position.copy(fp); sun.target.updateMatrixWorld();
  const inS = (GAME.state !== 'menu' && f && f.alive && f.mode !== 'bus' && inStorm(f.pos)) ? 1 : 0;
  CAM.storm = lerp(CAM.storm, inS, 1 - Math.exp(-dt * 3));
  scene.fog.color.copy(ENVSTATE.fogCol).lerp(STORM_FOG, CAM.storm);
  scene.fog.near = lerp(ENVSTATE.fogNear, 6, CAM.storm); scene.fog.far = lerp(ENVSTATE.fogFar, 150, CAM.storm);
  ENVSTATE.sky.material.uniforms.uStorm.value = CAM.storm * 0.85;
  if (WATER.mat) { WATER.mat.uniforms.uFogColor.value.copy(scene.fog.color); WATER.mat.uniforms.uFogNear.value = scene.fog.near; WATER.mat.uniforms.uFogFar.value = scene.fog.far; }
  POST.U.storm.value = CAM.storm * 0.55;
  const p = player;
  if (p && GAME.state !== 'menu') {
    POST.U.hurt.value = Math.max(0, POST.U.hurt.value - dt * 2.2);
    POST.U.lowhp.value = lerp(POST.U.lowhp.value, p.alive && p.hp < 35 && p.mode === 'ground' ? (1 - p.hp / 35) * 0.9 + 0.1 : 0, 1 - Math.exp(-dt * 4));
    POST.U.speed.value = lerp(POST.U.speed.value, p.alive && p.mode === 'sky' && SETTINGS.blur ? clamp((-p.vel.y - 30) / 22, 0, 1) * 0.9 : 0, 1 - Math.exp(-dt * 5));
    UPLAYER.value.copy(p.pos);
  } else { POST.U.hurt.value = 0; POST.U.lowhp.value = 0; POST.U.speed.value = 0; }
  POST.U.flash.value = Math.max(0, POST.U.flash.value - dt * 4);
  updateWater(cp.x, cp.z);
  updateGrass(cp.x, cp.z);
  RAIN.update(dt, cp.x, cp.y, cp.z);
  SNOWFALL.update(dt, cp.x, cp.y, cp.z);
  updateWorldFx(dt);
  updateStaticCulling(dt, cp.x, cp.z);
  SFX.setListener(camera);
}
// ---------- audio direction: loops, music state + intensity, heartbeat ----------
function updateAudio(dt) {
  if (!SFX.ready) return;
  const p = player, inMatch = GAME.state !== 'menu', tod = ENVSTATE.tod;
  SFX.ambience(dt, { day: tod !== 'dusk', dusk: tod === 'dusk', rain: RAIN.active, storm: CAM.storm > 0.3, menu: !inMatch });
  SFX.loop('storm', CAM.storm * 0.5);
  if (!inMatch || !p) { SFX.MUSIC.setState('menu'); for (const n of ['bus', 'wind', 'glide', 'slide']) SFX.loop(n, 0); return; }
  const mode = p.alive ? p.mode : 'dead';
  SFX.loop('bus', mode === 'bus' ? 0.2 : 0);
  const fall = mode === 'sky' ? clamp(-p.vel.y / 50, 0.3, 1) : 0;
  SFX.loop('wind', mode === 'sky' ? 0.16 + fall * 0.3 : 0, 600 + fall * 1500);
  SFX.loop('glide', mode === 'glide' ? 0.11 : 0);
  SFX.loop('slide', p.alive && p.sliding && p.grounded ? 0.15 : 0);
  if (GAME.state === 'play' && p.alive) {
    const st = mode === 'bus' ? 'bus' : (GAME.alive <= 6 || STORM.idx >= 4) ? 'end' : 'match';
    SFX.MUSIC.setState(st);
    SFX.MUSIC.setIntensity(clamp(1.15 - (GAME.time - (GAME.combatT === undefined ? -99 : GAME.combatT)) / 10, 0, 1) + (st === 'end' ? 0.25 : 0));
  }
  if (p.alive && p.mode === 'ground' && p.hp < 30) { GAME.hbT = (GAME.hbT || 0) - dt; if (GAME.hbT <= 0) { GAME.hbT = 0.55 + p.hp / 60; SFX.heartbeat(); } }
}
function menuCamera(dt) {
  CAM.orbit += dt * 0.03;
  const a = CAM.orbit, r = WORLD.islandR;
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
// the vault's boss and two guards: on the ground from the start, not counted as players
function spawnVaultCrew() {
  const V = WORLD.vault; if (!V) return;
  const mk = (name, weapon, rar, outfit, boss) => {
    const b = makeBot(); b.name = name; b.npc = true; b.boss = boss; b.skill = boss ? 0.95 : 0.7;
    if (outfit) { b.rig.root.parent.remove(b.rig.root); b.outfit = outfit; b.rig = buildRig(outfit); b.rig.root.visible = false; worldGroup.add(b.rig.root); }
    b.mode = 'ground'; b.state = 'guard'; b.post = new V3(V.x + mr(-3, 3), V.y, V.z + mr(-3, 3)); b.pos.copy(b.post); b.grounded = true;
    b.shield = boss ? 100 : 50; b.armor = boss ? 0.45 : 0;
    giveItem(b, { kind: 'weapon', id: weapon, rarity: rar, mag: WEAPONS[weapon].mag }); b.slot = 0;
    b.ammo[WEAPONS[weapon].ammo] = 400; giveItem(b, { kind: 'consumable', id: 'medkit', count: 2 });
    updateHeld(b); bots.push(b); characters.push(b);
    return b;
  };
  const gold = Object.assign(genOutfit(), { name: 'Vault Warden', top: 'armor', c1: 0x1d2026, c2: 0xffc62e, legs: 0x1d2026, head: 'helmet', headC: 0xffc62e, eyes: 'focused', back: 'cape', backC: 0xffc62e, gloves: 0xffc62e, shoes: 0x1d2026 });
  mk('Vault Warden', 'tempest', 5, gold, true);
  const guard = () => Object.assign(genOutfit(), { top: 'armor', c1: 0x34495e, c2: 0xe0482f, legs: 0x262626, head: 'helmet', headC: 0x34495e, back: 'backpack', backC: 0x262626 });
  mk('Vault Guard', 'burst', 3, guard(), false); mk('Vault Guard', 'tac', 3, guard(), false);
}
function setupMatch() {
  if (!GAME.menuWorldFresh || WORLD.scale !== islandScaleFor(SETTINGS.bots) || GAME.worldMut !== SETTINGS.mutator) { newWorld((Math.random() * 1e9) | 0); GAME.worldMut = SETTINGS.mutator; }
  GAME.menuWorldFresh = false;
  characters.length = 0; bots.length = 0; usedNames.clear(); NOISE.length = 0; PATHQ.length = 0; DROPS.clear();
  FX.clear(); VFX.clear(); HUD.reset(); INPUT.clearAim(); INPUT.clearCrouch();
  player = makeCharacter(true, 'You', equippedOutfit()); player.emote = null;
  if (LOBBY.char) LOBBY.char.rig.root.visible = false;
  GAME.rewards = null;
  characters.push(player);
  const nb = MODE().creative ? 6 : SETTINGS.bots;
  for (let i = 0; i < nb; i++) { const b = makeBot(); bots.push(b); characters.push(b); }
  setupBus(); stormInit();
  if (!MODE().creative) spawnVaultCrew();
  spawnVehicles(Math.round(7 * WORLD.scale));
  // bots pick a landing spot and leave the dropship when it passes closest to it
  const pathLen = BUS.start.distanceTo(BUS.end);
  for (const b of bots) {
    chooseDrop(b);
    const t = ((b.dropTarget.x - BUS.start.x) * BUS.dir.x + (b.dropTarget.z - BUS.start.z) * BUS.dir.z) / pathLen;
    b.jumpAt = clamp(t - 0.06 + Math.random() * 0.05, 0.04, 0.95);
  }
  assignTeams(); applyMutators();
  const [tod, wx] = pickTimeOfDay(); applyEnvironment(tod, wx);
  Object.assign(GAME, { combatT: -99, hbT: 0, deathLog: [], state: 'play', time: 0, alive: characters.filter((c) => !c.npc).length, spectating: null, placement: 0, killer: null, deathKind: '', deathTime: 0, paused: false, stats: { mats: 0, builds: 0, chests: 0 } });
  player.yaw = Math.atan2(-BUS.dir.x, -BUS.dir.z) + 0.7; player.pitch = -0.28;
  CAM.dist = 3.6; CAM.storm = 0; CAM.shake = 0;
  HUD.show(true); HUD.toggleMap(false);
  HUD.banner('Jump when ready', TOD[tod].name + ' · ' + WEATHER[wx].name + ' — ' + (IS_TOUCH ? 'tap JUMP to leave the dropship' : 'press Space to leave the dropship'), 5);
  STORM.mesh.visible = true;
  GAME.endShown = false;
  matchStart();
  PING.clear(); if (INV.open) INV.toggle(false);
  if (MODE().rumble) rumbleSetup();
  if (MODE().creative) creativeSetup();
  if (MODE().name !== 'Solo' || MUT().name !== 'No mutator') HUD.banner(MODE().creative ? 'Creative' : 'Jump when ready', MODE().name + (MUT().name !== 'No mutator' ? ' · ' + MUT().name : '') + ' — ' + (IS_TOUCH ? 'tap JUMP to leave the dropship' : 'press Space to leave the dropship'), 5);
  TEAMHUD.reset();
}
function onPlayerDeath(src, kind) {
  const M = MODE();
  if (M.rumble) {
    GAME.state = 'dead'; GAME.deathTime = GAME.time; GAME.killer = src && src !== player ? src : null;
    GAME.spectating = GAME.killer && GAME.killer.alive ? GAME.killer : null; CAM.specYaw = player.yaw;
    showGhost(null); HUD.prompt(null); SFX.loop('wind', 0); endEdit(player, false);
    HUD.banner('Eliminated', 'Respawning in 6 seconds', 3);
    return;
  }
  if (teamMode() && teamStanding(player.team)) {
    GAME.state = 'dead'; GAME.deathTime = GAME.time; GAME.deathKind = kind || ''; GAME.killer = src && src !== player ? src : null;
    GAME.spectating = mates(player).find((c) => c.alive) || null; CAM.specYaw = player.yaw;
    showGhost(null); HUD.prompt(null); SFX.loop('wind', 0); endEdit(player, false);
    HUD.banner('Eliminated', 'Spectating your team', 2.5); $id('spec').hidden = false; updateSpecName();
    return;
  }
  GAME.placement = teamMode() ? new Set(characters.filter((c) => c.alive && !c.npc).map((c) => c.team)).size + 1 : GAME.alive + 1;
  GAME.deathTime = GAME.time; GAME.state = 'dead'; GAME.deathKind = kind || '';
  GAME.killer = src && src !== player ? src : null;
  GAME.spectating = GAME.killer && GAME.killer.alive ? GAME.killer : null;
  CAM.specYaw = player.yaw;
  showGhost(null); HUD.prompt(null); SFX.loop('wind', 0); SFX.loop('slide', 0); SFX.defeat(); endEdit(player, false);
  GAME.endShown = true;
  setTimeout(() => { if (GAME.state === 'dead') showEnd(false); }, 1700);
}
function checkEnd() {
  const M = MODE();
  if (M.rumble || M.creative || !player) return;
  if (teamMode()) {
    const teams = new Set(characters.filter((c) => c.alive && !c.npc).map((c) => c.team));
    const mine = teams.has(player.team);
    if (mine && teams.size <= 1 && (GAME.state === 'play' || GAME.state === 'dead')) {
      const wasDead = GAME.state === 'dead';
      GAME.state = 'won'; GAME.placement = 1; SFX.victory();
      HUD.banner('Victory', 'Your team is the last one standing', 3);
      for (const c of characters) if (c.alive && c.knocked) reviveDone(c, c);
      if (player.alive) { player.slot = -1; playEmote(player, 'victory'); CAM.orbit = player.yaw; }
      setTimeout(() => showEnd(true), wasDead ? 900 : 1600);
    } else if (!mine && GAME.state === 'dead' && !GAME.endShown) { GAME.endShown = true; GAME.placement = teams.size + 1; setTimeout(() => showEnd(false), 1500); }
    return;
  }
  if (GAME.state === 'play' && player && player.alive && GAME.alive <= 1) {
    GAME.state = 'won'; GAME.placement = 1; SFX.victory();
    HUD.banner('Victory', 'Last one standing', 3);
    player.slot = -1; playEmote(player, "victory"); CAM.orbit = player.yaw;
    const cols = [0xffc62e, 0x41b8ff, 0xff5d8f, 0x5ee05a, 0xb45cff];
    for (let i = 0; i < 5; i++) setTimeout(() => FX.burst(player.pos.x + mr(-3, 3), player.pos.y + mr(4, 7), player.pos.z + mr(-3, 3), 40, cols[i], 7, 1.6, 0.35, true, -3), i * 260);
    setTimeout(() => showEnd(true), 1500);
  } else if (GAME.state === 'dead' && GAME.alive === 1) {
    const w = characters.find((c) => c.alive);
    if (w) HUD.feed('<b>' + w.name + '</b> is the last one standing');
  }
}
function showEnd(win) {
  if (INV.open) INV.toggle(false);
  if (!GAME.rewards) GAME.rewards = matchEnd(win) || 'none';
  showMatchRewards(GAME.rewards === 'none' ? null : GAME.rewards);
  releaseLock(); HUD.hideBanner();
  $id('endscreen').hidden = false; $id('spec').hidden = true;
  HUD.toggleMap(false);
  const pl = $id('end-place'); pl.textContent = '#' + GAME.placement; pl.className = 'place' + (win ? ' win' : '');
  const M = MODE();
  $id('end-sub').textContent = M.rumble ? (win ? 'Your team won' : 'Your team lost') : win ? (teamMode() ? 'Your team is the last one standing' : 'Last one standing') : GAME.placement <= 5 ? 'So close' : GAME.placement <= 10 ? 'Top 10' : 'Eliminated';
  let detail;
  if (M.rumble) detail = 'Final score ' + RUMBLE.score[1] + ' - ' + RUMBLE.score[2] + '.';
  else if (win) detail = 'You outlasted ' + (characters.filter((c) => !c.npc).length - 1) + ' players.';
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
  const team = bots.filter((b) => b.alive && b.mode !== 'bus' && b.team === player.team && teamMode());
  const alive = team.length ? team : bots.filter((b) => b.alive && b.mode !== 'bus');
  if (!alive.length) { backToResults(); return; }
  GAME.spectating = alive[(alive.indexOf(GAME.spectating) + 1) % alive.length];
  CAM.specYaw = GAME.spectating.yaw; updateSpecName();
}
function updateSpecName() { $id('spec-name').textContent = GAME.spectating ? GAME.spectating.name + ' · ' + GAME.spectating.kills + ' elims' : ''; }
function backToResults() { $id('spec').hidden = true; showEnd(GAME.state === 'won'); }
function pause() {
  if (GAME.state === 'menu' || GAME.paused || !$id('endscreen').hidden) return;
  GAME.paused = true; $id('pause').hidden = false; releaseLock();
  for (const n of ['wind', 'hum', 'storm', 'glide', 'slide', 'bus']) SFX.loop(n, 0);
}
function resume() { GAME.paused = false; $id('pause').hidden = true; requestLock(); SFX.init(); }
function quitToMenu() {
  releaseLock();
  GAME.paused = false; GAME.state = 'menu';
  for (const id of ['pause', 'endscreen', 'spec', 'clickplay', 'rotate']) $id(id).hidden = true;
  $id('menu').hidden = false;
  HUD.show(false); HUD.toggleMap(false);
  for (const c of characters) c.rig.root.visible = false;
  BUS.mesh.visible = false; showGhost(null); STORM.mesh.visible = false; if (player) endEdit(player, false);
  for (const n of ['wind', 'hum', 'storm', 'glide', 'slide', 'bus']) SFX.loop(n, 0);
  CAM.storm = 0;
  if (MATCH.active) matchEnd(false);
  PING.clear(); if (INV.open) INV.toggle(false);
  if (LOBBY.char && LOBBY.char.rig.root.parent !== worldGroup) LOBBY.spot = null;
  refreshLobbyChar(); MENU.refresh(); MENU.setTab('play');
}

// ---------- settings + menu ----------
function applyQuality() {
  POST.U.grain.value = SETTINGS.grain ? 0.025 : 0;
  VFX.setLights(Q().lights);
  const q = Q();
  const sh = q.shadows > 0;
  renderer.shadowMap.enabled = sh; sun.castShadow = sh;
  if (sh && sun.shadow.mapSize.x !== q.shadows) {
    sun.shadow.mapSize.set(q.shadows, q.shadows);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const ext = q.shadows >= 4096 ? 95 : q.shadows >= 2048 ? 75 : 60, sc = sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
  }
  scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  for (const m of Object.values(MAT.build)) m.needsUpdate = true;
  if (WORLD.terrainMat) WORLD.terrainMat.needsUpdate = true;
  if (ENVSTATE.sky) { ENVSTATE.sky.material.defines.CLOUD_OCT = q.cloudOct; ENVSTATE.sky.material.needsUpdate = true; }
  POST.dynScale = 1;
  onResize();
  if (WORLD.heights) initGrass();
}
function onResize() {
  POST.resize();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  FX.setScale(pointScale());
}
function wireMenu() {
  MENU.init();
  const bindRange = (id, key, fmt) => {
    const el = $id(id), out = $id(id + '-out');
    el.value = SETTINGS[key]; out.textContent = fmt(SETTINGS[key]);
    el.addEventListener('input', () => { SETTINGS[key] = +el.value; out.textContent = fmt(SETTINGS[key]); saveSettings(); if (key === 'vol') SFX.setVolume(SETTINGS.vol); });
  };
  bindRange('sens2', 'sens', (v) => (+v).toFixed(1)); bindRange('vol', 'vol', (v) => Math.round(v * 100));
  $id('play').addEventListener('click', startMatch);
  $id('again').addEventListener('click', startMatch);
  $id('resume').addEventListener('click', resume);
  $id('quit').addEventListener('click', quitToMenu);
  $id('tomenu').addEventListener('click', quitToMenu);
  $id('spectate').addEventListener('click', startSpectate);
  $id('spec-next').addEventListener('click', nextSpectate);
  $id('spec-back').addEventListener('click', backToResults);
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => SFX.init(), { once: true });
}

// ---------- main loop ----------
let _last = performance.now(), _fpsT = 0, _fpsN = 0;
function frame(dt) {
  GAME.dtLast = dt;
  if (GAME.state === 'menu') { updateLobby(dt); updateEnv(dt); updateAudio(dt); FX.update(dt); VFX.update(dt); INPUT.endFrame(); return; }
  if (GAME.paused) { INPUT.endFrame(); return; }
  GAME.time += dt;
  updateBus(dt);
  updatePlayer(dt);
  const cp = camera.position;
  processPaths(4);
  for (const b of bots) updateBot(b, dt, cp.x, cp.z);
  if (!player.alive) deathAnim(player, dt);
  updateItems(dt, cp.x, cp.z);
  updateChests(dt, cp.x, cp.z);
  updateRockets(dt);
  updateGadgets(dt);
  updateVehicles(dt);
  if (MODE().rumble) updateRumble(dt);
  if (MODE().creative) creativeTick(dt);
  updateSupply(dt);
  updateBuild(dt);
  updateShaking(dt);
  updateStorm(dt);
  updateWeak(dt);
  updateCamera(dt);
  playerActions(dt);
  FX.update(dt); VFX.update(dt);
  updateEnv(dt);
  updateAudio(dt);
  HUD.update(dt);
  TEAMHUD.update(dt);
  PING.update(dt);
  if (!$id('spec').hidden && (!GAME.spectating || !GAME.spectating.alive)) nextSpectate();
  $id('clickplay').hidden = IS_TOUCH || INPUT.locked || GAME.state !== 'play' || !player.alive;
  $id('rotate').hidden = !(IS_TOUCH && innerHeight > innerWidth * 1.1);
  INPUT.endFrame();
}
function loop(now) {
  requestAnimationFrame(loop);
  if (GAME.freeze) { _last = now; return; }
  let raw = now - _last, dt = raw / 1000; _last = now;
  if (!(dt > 0)) return;
  if (dt > 0.05) dt = 0.05;
  try { frame(dt); } catch (e) { console.error(e); }
  POST.render();
  updateDynRes(raw);
  _fpsT += dt; _fpsN++;
  if (_fpsT > 1) { GAME.fps = Math.round(_fpsN / _fpsT); _fpsT = 0; _fpsN = 0; const fe = $id('fps'); fe.hidden = !SETTINGS.fps; if (SETTINGS.fps) fe.textContent = GAME.fps + ' fps'; }
}
function init() {
  renderer = new THREE.WebGLRenderer({ canvas: $id('c'), antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping;
  POST.init();
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcd8f2, 140, 700);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 1600);
  camera.rotation.order = 'YXZ';
  hemi = new THREE.HemisphereLight(0xdcecff, 0x4d5f3c, 0.3); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.shadow.mapSize.set(1, 1);
  const sc = sun.shadow.camera; sc.near = 10; sc.far = 520;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);
  loadProfile();
  makeTextures(); makeMaterials(); makeEnvironment(); initBuildGeo(); makeStormMesh(); makeBusMesh();
  FX.init(); VFX.init(); HUD.init(); INPUT.init(); wireMenu();
  addEventListener('resize', onResize);
  applyEnvironment('golden', 'clear');
  newWorld((Math.random() * 1e9) | 0); GAME.menuWorldFresh = true; GAME.worldMut = SETTINGS.mutator;
  stormInit(); STORM.mesh.visible = false;
  refreshLobbyChar(); MENU.refresh();
  CLOUD.init();
  applyQuality();
  requestAnimationFrame(loop);
  window.STORMDROP = { grassWeight, groundH, WATER, RAIN, GRASS, sun, renderer: () => renderer, setEnv(v) { scene.environment = v ? ENVSTATE.envRT.texture : null; }, scene: () => scene, applyEnvironment, POST, ENVSTATE, renderOnce() { const t0 = performance.now(); POST.render(); return performance.now() - t0; }, frameOnce(dt) { const t0 = performance.now(); frame(dt); return performance.now() - t0; }, dbg: { traceShot, AIM, raycastWorld, rayCharacters, computeAim, eyeOf }, get info() { return renderer.info.render; }, step(n, dt) { for (let i = 0; i < n; i++) frame(dt || 0.05); }, GAME, get player() { return player; }, bots, characters, STORM, BUS, WORLD, startMatch, setupMatch, jumpOut, CAM, PIECES, ITEMS, CHESTS, SETTINGS, animateRig, updateHeld, giveItem, playEmote, makeCharacter, genOutfit, camera: () => camera, SFX, FX, VFX, placePiece, buildTarget, explode, fireWeapon, updateBuild, frame: (dt) => frame(dt), updateCamera: (dt) => updateCamera(dt), WEAPONS, CONSUMABLES, GADGETS, useGadget, AIM, ZIPS, biomeAt, VEHICLES, enterVehicle, RUMBLE, MODE, showEnd, PROFILE_: () => PROFILE, MENU, INV, PING, ev, startEdit, endEdit, editTarget, applyWallEdit, PIECES_: () => PIECES, testBox(x, y, z, w, h, d) { const c = boxCollider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, { kind: "test", hp: Infinity }); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.build.stone); m.position.set(x, y + h / 2, z); worldGroup.add(m); return c; } };
}
init();
