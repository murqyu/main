// ---------- vehicles: arcade quads with per-wheel terrain contact, ramps, ramming, explosions ----------
const VEHICLES = [];
const QUAD = { wb: 1.7, track: 1.3, ride: 0.5, maxV: 27, revV: 9, accel: 15, grip: 7, turn: 1.9, hp: 450 };
function resetVehicles() { for (const v of VEHICLES) { if (v.root.parent) v.root.parent.remove(v.root); if (v.col) removeCollider(v.col); } VEHICLES.length = 0; }
function buildQuadModel(hex) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const L = [], dk = 0x1d2026;
  part(L, RB(1.3, 0.42, 2.0, 0.16), hex, 0, 0.62, 0);
  part(L, RB(1.0, 0.22, 0.9, 0.08), dk, 0, 0.92, 0.25);
  part(L, RB(1.35, 0.14, 0.7, 0.06), hex, 0, 0.9, -0.85);
  part(L, RB(1.35, 0.14, 0.6, 0.06), hex, 0, 0.88, 0.9);
  part(L, RB(0.08, 0.5, 0.08, 0.02), dk, 0, 1.05, -0.62, -0.35);
  part(L, RB(0.9, 0.07, 0.07, 0.02), dk, 0, 1.28, -0.72);
  part(L, RB(0.36, 0.14, 0.06, 0.04), 0xfff2c8, 0.32, 0.72, -1.01); part(L, RB(0.36, 0.14, 0.06, 0.04), 0xfff2c8, -0.32, 0.72, -1.01);
  part(L, RB(0.3, 0.1, 0.05, 0.03), 0xe0282a, 0.4, 0.76, 1.01); part(L, RB(0.3, 0.1, 0.05, 0.03), 0xe0282a, -0.4, 0.76, 1.01);
  part(L, cylGeo(0.07, 0.07, 0.4, 8), 0x8a9098, 0.4, 0.55, 1.05, Math.PI / 2);
  const m = new THREE.Mesh(mergeParts(L), VEH_MAT); m.castShadow = true; body.add(m);
  const lights = new THREE.Mesh(boxGeo(1.0, 0.1, 0.04), lam(0xffffff, { emissive: 0xfff0c0, emissiveIntensity: 2.5 })); lights.position.set(0, 0.72, -1.04); body.add(lights);
  const wheels = [];
  const wgeo = keepGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 14).rotateZ(Math.PI / 2)), wmat = lam(0x23262b, { roughness: 0.9 }), hmat = lam(0xb8c0c8, { metalness: 0.6, roughness: 0.35 });
  for (const [x, z] of [[0.72, -0.85], [-0.72, -0.85], [0.72, 0.85], [-0.72, 0.85]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z); root.add(pivot);
    const w = new THREE.Mesh(wgeo, wmat); w.castShadow = true; pivot.add(w);
    const hub = new THREE.Mesh(boxGeo(0.38, 0.22, 0.22), hmat); w.add(hub);
    wheels.push({ pivot, w, x, z, front: z < 0 });
  }
  return { root, body, wheels };
}
function spawnVehicles(n) {
  resetVehicles();
  let made = 0;
  for (let t = 0; t < 400 && made < n; t++) {
    const p = WORLD.pois[Math.floor(Math.random() * WORLD.pois.length)]; if (!p) break;
    const a = Math.random() * TAU, d = p.r + mr(4, 14), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, h = groundH(x, z);
    if (h < 1.5 || overlapsFootprint(x - 2, z - 2, x + 2, z + 2, 1)) continue;
    if (Math.abs(groundH(x + 2, z) - h) > 0.8 || Math.abs(groundH(x, z + 2) - h) > 0.8) continue;
    if (VEHICLES.some((v) => Math.hypot(v.pos.x - x, v.pos.z - z) < 30)) continue;
    makeQuad(x, z, Math.random() * TAU, pick([0xe0482f, 0x2f6fd6, 0xffb02e, 0x2fd06f, 0x8e44ad, 0xe9f2ff]));
    made++;
  }
}
function makeQuad(x, z, yaw, hex) {
  if (!CHAR_MAT) initCharMaterials();
  const M = buildQuadModel(hex);
  const v = { kind: 'quad', ...M, pos: new V3(x, groundH(x, z) + QUAD.ride, z), vel: new V3(), yaw, pitch: 0, roll: 0, steer: 0, grounded: true, driver: null, hp: QUAD.hp, dead: false, spin: 0, gy: 0, dustT: 0, honk: 0 };
  v.gy = v.pos.y;
  worldGroup.add(v.root);
  v.col = boxCollider(x - 1.1, v.pos.y - 0.4, z - 1.1, x + 1.1, v.pos.y + 1.1, z + 1.1, { kind: 'vehicle', hp: QUAD.hp, maxHp: QUAD.hp, harvest: null, vehicle: v });
  VEHICLES.push(v);
  return v;
}
function nearestVehicle(c, maxD) {
  let best = null, bd = maxD * maxD;
  for (const v of VEHICLES) { if (v.dead || v.driver) continue; const d = (v.pos.x - c.pos.x) ** 2 + (v.pos.z - c.pos.z) ** 2; if (d < bd && Math.abs(v.pos.y - c.pos.y) < 2.5) { bd = d; best = v; } }
  return best;
}
function enterVehicle(c, v) {
  v.driver = c; c.vehicle = v; c.sliding = false; setCrouch(c, false); c.buildMode = null; c.using = null; c.emote = null; c.aiming = false;
  c.prevSlot = c.slot; c.slot = -1; updateHeld(c); c.rig.heldKey = 'drive';
  for (const m of [c.rig.gunChest, c.rig.gunHand]) while (m.children.length) m.remove(m.children[0]);
  if (c.isPlayer) { SFX.click(); HUD.banner('Driving', IS_TOUCH ? 'Stick to drive · JUMP to hop · USE to get out' : 'WASD to drive · Space to hop · E to get out', 2); }
}
function exitVehicle(c, hurt) {
  const v = c.vehicle; if (!v) return;
  v.driver = null; c.vehicle = null;
  const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
  c.pos.set(v.pos.x + rx * 1.6, v.pos.y + 0.4, v.pos.z + rz * 1.6);
  c.vel.set(v.vel.x * 0.5, 3, v.vel.z * 0.5); c.grounded = false; c.mode = 'ground';
  c.rig.heldKey = ''; c.slot = c.prevSlot !== undefined ? c.prevSlot : -1; if (c.slot >= 0 && !c.inv[c.slot]) c.slot = -1; updateHeld(c);
  if (c.isPlayer) SFX.engine(0, 0);
}
const _vq = [], _vh = [0, 0, 0, 0];
function updateVehicle(v, dt, input) {
  if (v.dead) return;
  removeCollider(v.col);   // never collide with or stand on our own box
  const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
  let vf = v.vel.x * fx + v.vel.z * fz, vl = v.vel.x * rx + v.vel.z * rz;
  const thr = input ? clamp(input.my, -1, 1) : 0, st = input ? clamp(input.mx, -1, 1) : 0;
  v.steer += (st * 0.55 - v.steer) * Math.min(1, dt * 8);
  if (v.grounded) {
    if (thr > 0) vf += thr * QUAD.accel * dt * (vf < 0 ? 2.2 : 1);
    else if (thr < 0) vf += thr * QUAD.accel * dt * (vf > 0 ? 2.2 : 0.7);
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
    vf = clamp(vf, -QUAD.revV, QUAD.maxV);
    vf -= vf * 0.12 * dt;
    vl -= vl * Math.min(1, QUAD.grip * dt);
    v.yaw -= v.steer * QUAD.turn * clamp(Math.abs(vf) / 7, 0, 1) * Math.sign(vf) * dt * 1.8;
    if (input && input.jump) { v.vel.y = 6.5; v.grounded = false; }
  }
  const nfx = -Math.sin(v.yaw), nfz = -Math.cos(v.yaw), nrx = Math.cos(v.yaw), nrz = -Math.sin(v.yaw);
  v.vel.x = nfx * vf + nrx * vl; v.vel.z = nfz * vf + nrz * vl;
  // integrate + resolve against the world
  const px = v.pos.x, pz = v.pos.z;
  v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
  const lim = WORLD.half - 20; v.pos.x = clamp(v.pos.x, -lim, lim); v.pos.z = clamp(v.pos.z, -lim, lim);
  const R = 1.15;
  queryBox(v.pos.x - R - 0.5, v.pos.z - R - 0.5, v.pos.x + R + 0.5, v.pos.z + R + 0.5, _vq);
  const sp = Math.hypot(v.vel.x, v.vel.z);
  for (const k of _vq) {
    if (k === v.col || k.shape !== 'box' || k.maxY <= v.pos.y + 0.15 || k.minY >= v.pos.y + 1.3) continue;
    const cx = clamp(v.pos.x, k.minX, k.maxX), cz = clamp(v.pos.z, k.minZ, k.maxZ), dx = v.pos.x - cx, dz = v.pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    const d = Math.sqrt(d2) || 0.001, nx = d2 > 1e-6 ? dx / d : -nfx, nz = d2 > 1e-6 ? dz / d : -nfz;
    v.pos.x += nx * (R - d); v.pos.z += nz * (R - d);
    const vn = v.vel.x * nx + v.vel.z * nz;
    if (vn < 0) {
      v.vel.x -= vn * nx * 1.3; v.vel.z -= vn * nz * 1.3;
      if (-vn > 9) { damageCollider(k, -vn * 9, v.driver, cx, v.pos.y + 0.7, cz); damageVehicle(v, (-vn - 9) * 6, null); if (v.driver && v.driver.isPlayer) CAM.shake = Math.min(1, CAM.shake + 0.35); SFX.impact(_tmpV.set(cx, v.pos.y + 0.7, cz), 'metal'); }
    }
  }
  // wheel heights -> ride height, pitch and roll
  const yProbe = v.pos.y + 1.2;
  for (let i = 0; i < 4; i++) { const w = v.wheels[i]; _vh[i] = surfaceBelow(v.pos.x + nrx * w.x - nfx * w.z, yProbe, v.pos.z + nrz * w.x - nfz * w.z); }
  const hF = (_vh[0] + _vh[1]) / 2, hB = (_vh[2] + _vh[3]) / 2, hL = (_vh[1] + _vh[3]) / 2, hR = (_vh[0] + _vh[2]) / 2;
  const target = (hF + hB) / 2 + QUAD.ride;
  if (v.grounded && v.vel.y <= 0.5) {
    const climb = (target - v.gy) / Math.max(dt, 1e-3);
    if (target < v.pos.y - 0.6) { v.grounded = false; v.vel.y = Math.max(0, v.lastClimb || 0); }
    else { v.pos.y = target; v.vel.y = 0; v.lastClimb = clamp(climb, -20, 14); }
  } else {
    v.vel.y -= GRAV * dt; v.pos.y += v.vel.y * dt;
    if (v.pos.y <= target) { if (v.vel.y < -8 && v.driver && v.driver.isPlayer) CAM.shake = Math.min(1, CAM.shake + 0.25); v.pos.y = target; v.vel.y = 0; v.grounded = true; v.lastClimb = 0; }
  }
  v.gy = target;
  const tp = v.grounded ? Math.atan2(hB - hF, QUAD.wb) : v.pitch * 0.98 + (v.vel.y < 0 ? 0.004 : -0.002);
  const tr = v.grounded ? Math.atan2(hR - hL, QUAD.track) : v.roll * 0.97;
  v.pitch += (tp - v.pitch) * Math.min(1, dt * 12); v.roll += (tr - v.roll) * Math.min(1, dt * 12);
  // deep water drowns the engine
  if (groundH(v.pos.x, v.pos.z) < -2.2) { v.vel.multiplyScalar(0.9); if (v.driver) { const c = v.driver; exitVehicle(c); } v.col.hp -= dt * 80; if (v.col.hp <= 0) { addCollider(v.col); destroyVehicle(v, null); return; } }
  // run people over
  if (sp > 6) for (const c of characters) {
    if (!c.alive || c === v.driver || c.vehicle || c.mode !== 'ground') continue;
    const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z;
    if (dx * dx + dz * dz < 2.6 && Math.abs(c.pos.y - v.pos.y) < 1.6 && !(c.hitByV > GAME.time)) {
      c.hitByV = GAME.time + 0.6; applyDamage(c, sp * 2.4, v.driver, 'Quad', false);
      c.vel.x += v.vel.x * 0.7; c.vel.z += v.vel.z * 0.7; c.vel.y = 7; c.grounded = false;
    }
  }
  // visuals
  v.root.position.set(v.pos.x, v.pos.y - QUAD.ride, v.pos.z); v.root.rotation.set(0, v.yaw, 0);
  v.body.rotation.set(-v.pitch, 0, v.roll); v.body.position.y = Math.sin(GAME.time * 30) * 0.008 * Math.min(1, sp / 8);
  v.spin += vf * dt / 0.42;
  for (const w of v.wheels) { w.w.rotation.x = -v.spin; if (w.front) w.pivot.rotation.y = -v.steer; w.pivot.position.y = 0.42 + (v.grounded ? 0 : -0.1); }
  // collider follows
  if (v.dead) return;
  v.col.minX = v.pos.x - 1.1; v.col.maxX = v.pos.x + 1.1; v.col.minZ = v.pos.z - 1.1; v.col.maxZ = v.pos.z + 1.1; v.col.minY = v.pos.y - 0.4; v.col.maxY = v.pos.y + 1.0; addCollider(v.col);
  // dust + exhaust
  v.dustT -= dt;
  if (v.dustT <= 0 && sp > 4 && v.grounded && camera.position.distanceToSquared(v.pos) < 3600) {
    v.dustT = 0.05; const b = biomeAt(v.pos.x, v.pos.z, v.pos.y), col = b.snow > 0.5 ? [0.92, 0.95, 1] : b.desert > 0.5 ? [0.85, 0.72, 0.52] : [0.62, 0.55, 0.45];
    for (const i of [2, 3]) { const w = v.wheels[i]; FX.emitN(v.pos.x + nrx * w.x - nfx * 0.85, v.pos.y - 0.35, v.pos.z + nrz * w.x - nfz * 0.85, -v.vel.x * 0.12 + mr(-0.6, 0.6), mr(0.4, 1.4), -v.vel.z * 0.12 + mr(-0.6, 0.6), mr(0.6, 1), 0.5, 1.8, col[0], col[1], col[2], 0.55, 0.3, 1.5); }
  }
  if (v.driver && Math.random() < dt * 8) FX.emitN(v.pos.x + nfx * -1.15 + nrx * 0.4, v.pos.y + 0.1, v.pos.z + nfz * -1.15 + nrz * 0.4, mr(-0.2, 0.2), mr(0.3, 0.7), mr(-0.2, 0.2), 0.8, 0.15, 0.6, 0.6, 0.6, 0.62, 0.3, 0.2, 0.5);
  if (v.driver) {
    const c = v.driver; c.pos.set(v.pos.x - nfx * 0.15, v.pos.y + 0.32, v.pos.z - nfz * 0.15); c.vel.copy(v.vel); c.modelYaw = v.yaw; c.grounded = true;
    if (c.isPlayer) SFX.engine(0.14 + Math.min(0.12, Math.abs(vf) * 0.006), 34 + Math.abs(vf) * 5.5 + (thr ? 12 : 0));
  }
}
function damageVehicle(v, amt, src) {
  if (v.dead) return;
  v.col.hp -= amt;
  if (v.col.hp <= 0) destroyVehicle(v, src);
}
function destroyVehicle(v, src) {
  if (v.dead) return;
  v.dead = true;
  if (v.driver) { const c = v.driver; exitVehicle(c); applyDamage(c, 40, src, 'Vehicle explosion', false); }
  removeCollider(v.col);
  explode(v.pos.x, v.pos.y + 0.6, v.pos.z, { radius: 5, dmg: 50, bd: 150, owner: src, name: 'Vehicle explosion' });
  worldGroup.remove(v.root);
  FX.debris(v.pos, 0x23262b, 12);
}
function updateVehicles(dt) {
  for (const v of VEHICLES) { if (v.dead) continue; if (v.driver) { if (!v.driver.isPlayer) updateVehicle(v, dt, null); } else if (Math.hypot(v.vel.x, v.vel.z) > 0.05 || !v.grounded) updateVehicle(v, dt, null); }
}
