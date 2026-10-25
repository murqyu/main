// ---------- weapons, consumables, loot, chests ----------
const RARITY = [
  { name: 'Common', css: '#9aa3ad', hex: 0x9aa3ad },
  { name: 'Uncommon', css: '#4fcf4a', hex: 0x4fcf4a },
  { name: 'Rare', css: '#3aa0ff', hex: 0x3aa0ff },
  { name: 'Epic', css: '#b45cff', hex: 0xb45cff },
  { name: 'Legendary', css: '#ff9e2c', hex: 0xff9e2c },
  { name: 'Mythic', css: '#ffd23f', hex: 0xffd23f },
];
const WEAPONS = {
  ar: { id: 'ar', name: 'Assault Rifle', ammo: 'medium', mag: 30, rate: 5.5, dmg: [30, 31, 33, 35, 36], head: 1.5, spread: 0.04, ads: 0.012, bloom: 0.01, range: 230, falloff: 60, minFall: 0.75, reload: [2.6, 2.5, 2.3, 2.2, 2.0], zoom: 1.4, recoil: 0.006, sound: 'ar', minR: 0 , auto: true, score: 50, pref: 24, fit: [8, 140, 45, 20] },
  smg: { id: 'smg', name: 'SMG', ammo: 'light', mag: 30, rate: 12, dmg: [15, 16, 17, 18, 19], head: 1.6, spread: 0.055, ads: 0.032, bloom: 0.004, range: 120, falloff: 25, minFall: 0.6, reload: [2.2, 2.1, 2.0, 1.9, 1.8], zoom: 1.2, recoil: 0.003, sound: 'smg', minR: 0 , auto: true, score: 40, pref: 12, fit: [0, 25, 40, 10] },
  shotgun: { id: 'shotgun', name: 'Pump Shotgun', ammo: 'shells', mag: 5, rate: 1.1, dmg: [9, 9.5, 10, 10.6, 11.2], pellets: 10, head: 2, spread: 0.085, ads: 0.07, bloom: 0, range: 48, falloff: 9, minFall: 0.35, reloadPer: 0.55, zoom: 1.1, recoil: 0.03, sound: 'shotgun', minR: 0 , score: 48, pref: 5, fit: [0, 12, 60, -20] },
  pistol: { id: 'pistol', name: 'Pistol', ammo: 'light', mag: 16, rate: 6.5, dmg: [24, 25, 26, 27, 28], head: 2, spread: 0.035, ads: 0.015, bloom: 0.01, range: 120, falloff: 30, minFall: 0.65, reload: [1.5, 1.45, 1.4, 1.35, 1.3], zoom: 1.25, recoil: 0.008, sound: 'pistol', minR: 0 , score: 22, pref: 16, fit: [0, 60, 15, 5] },
  sniper: { id: 'sniper', name: 'Bolt Sniper', ammo: 'heavy', mag: 1, rate: 0.4, dmg: [0, 0, 105, 110, 116], head: 2.5, spread: 0.12, ads: 0, bloom: 0, range: 520, falloff: 400, minFall: 0.9, reload: [0, 0, 3.0, 2.85, 2.7], zoom: 4.5, scope: true, recoil: 0.05, sound: 'sniper', minR: 2 , score: 44, pref: 60, fit: [45, 600, 70, -30], buildMult: 1.5 },
  rocket: { id: 'rocket', name: 'Rocket Launcher', ammo: 'rockets', mag: 1, rate: 0.8, dmg: [0, 0, 0, 105, 116], radius: 7, buildDmg: 450, projectile: true, speed: 70, spread: 0.02, ads: 0.004, bloom: 0, range: 320, falloff: 999, minFall: 1, reload: [0, 0, 0, 3.0, 2.8], zoom: 1.3, recoil: 0.04, sound: 'rocket', minR: 3 , score: 46, pref: 30, fit: [14, 90, 42, -40] },
};
Object.assign(WEAPONS, {
  burst: { id: 'burst', name: 'Burst Rifle', ammo: 'medium', mag: 27, rate: 2.7, burst: 3, burstGap: 0.07, dmg: [27, 28, 30, 31, 33], head: 1.5, spread: 0.03, ads: 0.007, bloom: 0.008, range: 230, falloff: 60, minFall: 0.75, reload: [2.7, 2.6, 2.4, 2.3, 2.1], zoom: 1.5, recoil: 0.008, sound: 'ar', minR: 0, score: 49, pref: 26, fit: [10, 160, 46, 18] },
  tac: { id: 'tac', name: 'Tactical Shotgun', ammo: 'shells', mag: 8, rate: 1.55, dmg: [7.4, 7.8, 8.2, 8.6, 9.0], pellets: 10, head: 2, spread: 0.1, ads: 0.085, bloom: 0, range: 40, falloff: 8, minFall: 0.3, reload: [5.6, 5.4, 5.2, 5.0, 4.8], zoom: 1.1, recoil: 0.02, sound: 'shotgun', minR: 0, score: 45, pref: 5, fit: [0, 11, 56, -18] },
  minigun: { id: 'minigun', name: 'Minigun', ammo: 'light', mag: 120, rate: 16, spin: 0.65, auto: true, dmg: [0, 0, 0, 15, 16], head: 1.5, spread: 0.065, ads: 0.05, bloom: 0.002, range: 140, falloff: 40, minFall: 0.6, reload: [0, 0, 0, 4.8, 4.5], zoom: 1.15, recoil: 0.002, sound: 'smg', minR: 3, buildMult: 1.7, kick: 0.15, score: 52, pref: 16, fit: [0, 40, 52, 12] },
  hand: { id: 'hand', name: 'Hand Cannon', ammo: 'heavy', mag: 7, rate: 1.35, dmg: [0, 0, 0, 72, 76], head: 2, spread: 0.032, ads: 0.008, bloom: 0, range: 150, falloff: 45, minFall: 0.7, reload: [0, 0, 0, 2.2, 2.0], zoom: 1.3, recoil: 0.045, sound: 'hand', hold: 'pistol', minR: 3, score: 47, pref: 20, fit: [0, 80, 44, 20], kick: 0.9 },
  heavy: { id: 'heavy', name: 'Heavy Sniper', ammo: 'heavy', mag: 1, rate: 0.33, dmg: [0, 0, 0, 145, 152], head: 2.5, spread: 0.14, ads: 0, bloom: 0, range: 600, falloff: 450, minFall: 0.9, reload: [0, 0, 0, 3.4, 3.2], zoom: 5, scope: true, recoil: 0.07, sound: 'sniper', minR: 3, buildMult: 4, score: 50, pref: 70, fit: [40, 650, 74, -30] },
  tempest: { id: 'tempest', name: 'Tempest Rifle', ammo: 'medium', mag: 32, rate: 6.5, auto: true, dmg: [0, 0, 0, 0, 0, 40], head: 1.6, spread: 0.028, ads: 0.006, bloom: 0.006, range: 260, falloff: 80, minFall: 0.8, reload: [0, 0, 0, 0, 0, 1.8], zoom: 1.5, recoil: 0.005, sound: 'ar', minR: 5, score: 70, pref: 24, fit: [0, 160, 60, 40] },
});
const CONSUMABLES = {
  bandage: { id: 'bandage', name: 'Bandages', stack: 15, time: 2.4, heal: 15, cap: 75, rarity: 0, give: 5 },
  medkit: { id: 'medkit', name: 'Med Kit', stack: 3, time: 5, heal: 100, cap: 100, rarity: 1, give: 1 },
  shieldS: { id: 'shieldS', name: 'Shield Cell', stack: 6, time: 2, shield: 25, cap: 50, rarity: 1, give: 3 },
  shieldL: { id: 'shieldL', name: 'Shield Battery', stack: 3, time: 4.5, shield: 50, cap: 100, rarity: 2, give: 1 },
  slurp: { id: 'slurp', name: 'Fizz Juice', stack: 2, time: 2, regen: 75, cap: 100, rarity: 3, give: 1 },
  grenade: { id: 'grenade', name: 'Grenade', stack: 6, rarity: 1, give: 3, throwable: true },
  launchpad: { id: 'launchpad', name: 'Launch Pad', stack: 1, rarity: 3, give: 1, placeable: true },
  portafort: { id: 'portafort', name: 'Pop-Up Fort', stack: 2, rarity: 3, give: 1, throwable: true },
  campfire: { id: 'campfire', name: 'Campfire', stack: 1, rarity: 2, give: 1, placeable: true },
};
const AMMO = { light: { name: 'Light Ammo', give: 30, color: 0xc9d4e6 }, medium: { name: 'Medium Ammo', give: 30, color: 0x58c470 }, shells: { name: 'Shells', give: 8, color: 0xe0503a }, heavy: { name: 'Heavy Ammo', give: 6, color: 0x4a7bd8 }, rockets: { name: 'Rockets', give: 3, color: 0xe0a030 } };
const MATNAME = { wood: 'Wood', stone: 'Stone', metal: 'Metal' };
const RW_CHEST = [[0, 22], [1, 36], [2, 26], [3, 12], [4, 4]];
const RW_FLOOR = [[0, 42], [1, 34], [2, 17], [3, 6], [4, 1]];
const WEAPON_W = [['ar', 26], ['burst', 13], ['smg', 16], ['shotgun', 22], ['tac', 12], ['pistol', 12], ['sniper', 7], ['rocket', 3], ['minigun', 2], ['hand', 3], ['heavy', 2]];
const CONS_W = [['bandage', 28], ['medkit', 11], ['shieldS', 30], ['shieldL', 13], ['slurp', 5], ['grenade', 12], ['launchpad', 3], ['portafort', 3], ['campfire', 4]];

function rollWeapon(rw) { const id = weighted(WEAPON_W); const def = WEAPONS[id]; const r = Math.max(def.minR, weighted(rw)); return { kind: 'weapon', id, rarity: r, mag: def.mag }; }
function rollCons() { const id = weighted(CONS_W); return { kind: 'consumable', id, count: CONSUMABLES[id].give }; }
function ammoFor(id, mult) { const a = WEAPONS[id].ammo; return { kind: 'ammo', ammo: a, count: Math.round(AMMO[a].give * (mult || 1)) }; }
function chestLoot() {
  const w = rollWeapon(RW_CHEST), out = [w, ammoFor(w.id)];
  if (rand() < 0.68) out.push(rollCons()); else { const w2 = rollWeapon(RW_FLOOR); out.push(w2, ammoFor(w2.id)); }
  out.push({ kind: 'mats', mat: pick(MAT_ORDER), count: 30 });
  return out;
}
function supplyLoot() {
  const out = [];
  for (let i = 0; i < 2; i++) { const w = rollWeapon([[3, 60], [4, 40]]); out.push(w, ammoFor(w.id, 1.5)); }
  out.push({ kind: 'consumable', id: 'shieldL', count: 2 }, { kind: 'consumable', id: 'medkit', count: 1 }, { kind: 'mats', mat: 'metal', count: 60 });
  return out;
}
function floorLoot() {
  const r = rand();
  if (r < 0.55) { const w = rollWeapon(RW_FLOOR); return [w, ammoFor(w.id)]; }
  if (r < 0.85) return [rollCons()];
  const a = pick(Object.keys(AMMO)); return [{ kind: 'ammo', ammo: a, count: AMMO[a].give }];
}
function itemLabel(it) {
  if (it.kind === 'weapon') return RARITY[it.rarity].name + ' ' + WEAPONS[it.id].name;
  if (it.kind === 'consumable') return CONSUMABLES[it.id].name + (it.count > 1 ? ' ×' + it.count : '');
  if (it.kind === 'ammo') return AMMO[it.ammo].name + ' ×' + it.count;
  return MATNAME[it.mat] + ' ×' + it.count;
}
function itemRarity(it) { return it.kind === 'weapon' ? it.rarity : it.kind === 'consumable' ? CONSUMABLES[it.id].rarity : 0; }

// ---------- models ----------
function gunModel(id, rarity) {
  const g = new THREE.Group(), D = MAT.gunDark, M = MAT.gunMid, A = MAT.rarity[rarity];
  const B = (w, h, d, x, y, z, m) => { const mm = new THREE.Mesh(boxGeo(w, h, d), m); mm.position.set(x, y, z); mm.castShadow = true; g.add(mm); return mm; };
  switch (id) {
    case 'ar': B(0.1, 0.14, 0.62, 0, 0, 0, M); B(0.05, 0.05, 0.38, 0, 0.02, -0.48, D); B(0.08, 0.22, 0.1, 0, -0.16, -0.08, A); B(0.08, 0.13, 0.26, 0, -0.02, 0.42, D); B(0.05, 0.07, 0.18, 0, 0.11, -0.04, D); B(0.06, 0.16, 0.07, 0, -0.13, 0.13, D); B(0.104, 0.04, 0.3, 0, 0.06, -0.15, A); break;
    case 'smg': B(0.1, 0.14, 0.42, 0, 0, 0, M); B(0.05, 0.05, 0.2, 0, 0.02, -0.3, D); B(0.06, 0.26, 0.08, 0, -0.18, -0.06, A); B(0.06, 0.15, 0.07, 0, -0.12, 0.12, D); B(0.104, 0.04, 0.2, 0, 0.06, 0, A); break;
    case 'shotgun': B(0.08, 0.08, 0.72, 0, 0.03, -0.24, D); B(0.11, 0.08, 0.24, 0, -0.05, -0.32, A); B(0.1, 0.15, 0.3, 0, 0, 0.12, M); B(0.08, 0.14, 0.34, 0, -0.02, 0.44, MAT.gunWood); break;
    case 'pistol': B(0.08, 0.1, 0.3, 0, 0, -0.04, M); B(0.07, 0.2, 0.08, 0, -0.13, 0.08, A); B(0.084, 0.03, 0.26, 0, 0.055, -0.04, D); break;
    case 'sniper': B(0.09, 0.12, 0.7, 0, 0, 0.05, M); B(0.04, 0.04, 0.62, 0, 0.02, -0.6, D); B(0.08, 0.08, 0.34, 0, 0.13, -0.05, D); B(0.094, 0.04, 0.4, 0, 0.065, 0.1, A); B(0.08, 0.15, 0.3, 0, -0.03, 0.5, MAT.gunWood); B(0.06, 0.14, 0.06, 0, -0.12, 0.14, D); break;
    case 'rocket': { const tube = new THREE.Mesh(keepCyl(0.13, 1.1), A); tube.rotation.x = Math.PI / 2; g.add(tube); B(0.2, 0.2, 0.12, 0, 0, -0.56, D); B(0.06, 0.18, 0.08, 0, -0.18, 0.05, D); B(0.08, 0.1, 0.18, 0, 0.16, -0.1, D); break; }
    case 'burst': B(0.1, 0.15, 0.66, 0, 0, 0, D); B(0.05, 0.05, 0.36, 0, 0.02, -0.5, M); B(0.08, 0.2, 0.12, 0, -0.16, -0.12, A); B(0.08, 0.14, 0.3, 0, -0.01, 0.44, M); B(0.06, 0.16, 0.07, 0, -0.13, 0.13, D); B(0.104, 0.05, 0.42, 0, 0.07, -0.08, A); B(0.05, 0.08, 0.16, 0, 0.14, 0.02, D); break;
    case 'tac': B(0.09, 0.09, 0.64, 0, 0.03, -0.22, D); B(0.12, 0.12, 0.3, 0, -0.04, 0.08, A); B(0.09, 0.18, 0.12, 0, -0.16, -0.06, M); B(0.08, 0.13, 0.32, 0, -0.02, 0.42, D); B(0.11, 0.06, 0.2, 0, -0.06, -0.36, M); break;
    case 'minigun': {
      const spin = new THREE.Group(); spin.position.set(0, 0, -0.35); g.add(spin);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, br = new THREE.Mesh(keepCyl(0.025, 0.8), D); br.rotation.x = Math.PI / 2; br.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.15); br.castShadow = true; spin.add(br); }
      const hub = new THREE.Mesh(keepCyl(0.1, 0.1), A); hub.rotation.x = Math.PI / 2; spin.add(hub);
      B(0.22, 0.24, 0.42, 0, 0, 0.12, M); B(0.05, 0.05, 0.22, 0, 0.17, -0.02, D); B(0.05, 0.12, 0.05, 0, 0.12, 0.1, D); B(0.06, 0.18, 0.08, 0, -0.18, 0.3, D); B(0.18, 0.2, 0.2, 0.14, -0.08, 0.14, A);
      g.userData.spin = spin; break;
    }
    case 'hand': B(0.1, 0.13, 0.4, 0, 0, -0.08, M); B(0.09, 0.22, 0.1, 0, -0.15, 0.08, A); B(0.104, 0.04, 0.36, 0, 0.075, -0.08, D); B(0.06, 0.06, 0.1, 0, 0.01, -0.32, D); break;
    case 'heavy': B(0.11, 0.15, 0.8, 0, 0, 0.05, D); B(0.06, 0.06, 0.8, 0, 0.02, -0.74, M); B(0.1, 0.1, 0.42, 0, 0.16, -0.06, D); B(0.114, 0.05, 0.46, 0, 0.07, 0.1, A); B(0.09, 0.17, 0.32, 0, -0.03, 0.55, M); B(0.07, 0.16, 0.07, 0, -0.13, 0.16, D); B(0.12, 0.08, 0.12, 0, 0.02, -1.15, D); break;
    case 'tempest': B(0.11, 0.15, 0.66, 0, 0, 0, A); B(0.05, 0.05, 0.4, 0, 0.02, -0.52, D); B(0.08, 0.22, 0.1, 0, -0.16, -0.08, D); B(0.08, 0.13, 0.28, 0, -0.02, 0.44, A); B(0.06, 0.16, 0.07, 0, -0.13, 0.13, D); B(0.116, 0.04, 0.5, 0, 0.07, -0.1, MAT.tempestGlow || A); B(0.06, 0.09, 0.2, 0, 0.13, -0.02, D); break;
  }
  return g;
}
const _cylCache = new Map();
function keepCyl(r, h) { const k = r + ',' + h; let g = _cylCache.get(k); if (!g) { g = keepGeo(new THREE.CylinderGeometry(r, r, h, 10)); _cylCache.set(k, g); } return g; }
function consModel(id) {
  const g = new THREE.Group();
  if (id === 'bandage') { const m = new THREE.Mesh(keepCyl(0.14, 0.22), lam(0xf2ede0)); m.rotation.z = Math.PI / 2; g.add(m); const s = new THREE.Mesh(boxGeo(0.23, 0.29, 0.06), lam(0xd94c4c)); g.add(s); }
  else if (id === 'medkit') { g.add(new THREE.Mesh(boxGeo(0.46, 0.28, 0.32), lam(0xf4f4f4))); const a = new THREE.Mesh(boxGeo(0.06, 0.2, 0.33), lam(0x2fb35a)); g.add(a); const b = new THREE.Mesh(boxGeo(0.2, 0.06, 0.33), lam(0x2fb35a)); g.add(b); }
  else if (id === 'shieldS') { const m = new THREE.Mesh(keepCyl(0.11, 0.3), lam(0x41b8ff, { emissive: 0x1a5f99 })); g.add(m); const c = new THREE.Mesh(keepCyl(0.06, 0.08), lam(0xe8e8e8)); c.position.y = 0.19; g.add(c); }
  else if (id === 'slurp') { const m = new THREE.Mesh(keepCyl(0.16, 0.4), lam(0x9b5cff, { emissive: 0x3a1a77 })); g.add(m); const c = new THREE.Mesh(keepCyl(0.07, 0.12), lam(0x2fd06f)); c.position.y = 0.26; g.add(c); }
  else if (id === 'grenade') { const m = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(0.13, 10, 8)), lam(0x4a5a2e, { roughness: 0.6 })); g.add(m); const c = new THREE.Mesh(boxGeo(0.06, 0.1, 0.06), lam(0x9aa0a6, { metalness: 0.6 })); c.position.y = 0.15; g.add(c); }
  else if (id === 'launchpad') { const m = new THREE.Mesh(boxGeo(0.5, 0.1, 0.5), lam(0x2f86e8)); g.add(m); const c = new THREE.Mesh(boxGeo(0.3, 0.12, 0.3), lam(0xffd23f, { emissive: 0x664400 })); c.position.y = 0.04; g.add(c); }
  else if (id === 'portafort') { const m = new THREE.Mesh(boxGeo(0.3, 0.3, 0.3), lam(0x93a6b8, { metalness: 0.5 })); g.add(m); const c = new THREE.Mesh(boxGeo(0.32, 0.06, 0.32), lam(0xffc62e)); g.add(c); }
  else if (id === 'campfire') { for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(boxGeo(0.08, 0.08, 0.45), lam(0x6b4a2a)); l.rotation.y = i * Math.PI / 4; g.add(l); } const f = new THREE.Mesh(keepGeo(new THREE.ConeGeometry(0.12, 0.25, 6)), lam(0xff8a2a, { emissive: 0xff5a00 })); f.position.y = 0.12; g.add(f); }
  else { const m = new THREE.Mesh(keepCyl(0.2, 0.42), lam(0x41b8ff, { emissive: 0x1a5f99 })); g.add(m); const c = new THREE.Mesh(keepCyl(0.08, 0.1), lam(0xe8e8e8)); c.position.y = 0.26; g.add(c); }
  return g;
}
const _beamGeo = keepGeo(new THREE.CylinderGeometry(0.12, 0.2, 3.2, 8, 1, true));
const _ringGeo = keepGeo(new THREE.RingGeometry(0.45, 0.62, 24).rotateX(-Math.PI / 2));
const _beamMats = RARITY.map((r) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r.hex).convertSRGBToLinear().multiplyScalar(1.8), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.userData.keep = true; return m; });
function itemMesh(it) {
  const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
  let model;
  if (it.kind === 'weapon') { model = gunModel(it.id, it.rarity); model.rotation.y = Math.PI / 2; model.scale.setScalar(1.25); }
  else if (it.kind === 'consumable') { model = consModel(it.id); model.scale.setScalar(1.4); }
  else if (it.kind === 'ammo') { model = new THREE.Group(); const b = new THREE.Mesh(boxGeo(0.5, 0.32, 0.36), lam(0x4b5a3a)); model.add(b); const s = new THREE.Mesh(boxGeo(0.52, 0.08, 0.37), lam(AMMO[it.ammo].color)); model.add(s); }
  else { model = new THREE.Group(); const mm = MAT.build[it.mat]; for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(boxGeo(0.7, 0.12, 0.3), mm); p.position.set(0, i * 0.13, (i % 2) * 0.05); model.add(p); } }
  spin.add(model); spin.position.y = 0.45;
  const r = itemRarity(it);
  if (it.kind === 'weapon' || it.kind === 'consumable') {
    const beam = new THREE.Mesh(_beamGeo, _beamMats[r]); beam.position.y = 1.6; root.add(beam);
    const ring = new THREE.Mesh(_ringGeo, _beamMats[r]); ring.position.y = 0.05; root.add(ring);
  }
  root.userData.spin = spin;
  return root;
}

// ---------- ground items ----------
const ITEMS = [], CHESTS = [];
function resetItems() { ITEMS.length = 0; CHESTS.length = 0; ROCKETS.length = 0; SUPPLY.length = 0; }
// ---------- supply drops ----------
const SUPPLY = [];
function spawnSupply() {
  const c = STORM.to; let x = c.x, z = c.z;
  for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * c.r * 0.7; x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r; if (groundH(x, z) > 1.8) break; }
  const g = new THREE.Group();
  const crate = new THREE.Mesh(boxGeo(1.8, 1.2, 1.2), lam(0x2f86e8, { emissive: 0x0c2d66 })); crate.position.y = 0.6; g.add(crate);
  const band = new THREE.Mesh(boxGeo(1.84, 0.16, 1.24), MAT.chestDark); band.position.y = 0.9; g.add(band);
  const rope = new THREE.Mesh(boxGeo(0.05, 4.2, 0.05), lam(0xeeeeee)); rope.position.y = 3.3; g.add(rope);
  const balloon = new THREE.Mesh(keepGeo(new THREE.SphereGeometry(1.5, 16, 12)), lam(0xffc62e, { emissive: 0x553300 })); balloon.position.y = 6.6; balloon.scale.set(1, 1.15, 1); g.add(balloon);
  g.position.set(x, 165, z); worldGroup.add(g);
  SUPPLY.push({ x, z, y: 165, mesh: g, landed: false, chest: null });
  HUD.banner('Supply drop incoming', 'Epic and Legendary loot. Look for the blue square on your map.', 3.5);
  SFX.alert(); SFX.announce('Supply drop incoming');
}
function updateSupply(dt) {
  for (const s of SUPPLY) {
    if (s.landed) continue;
    s.y -= 7 * dt; s.mesh.rotation.y += dt * 0.6;
    const g = surfaceBelow(s.x, s.y, s.z);
    if (s.y <= g) { s.landed = true; worldGroup.remove(s.mesh); s.chest = makeChest(s.x, g, s.z, Math.random() * TAU, true); FX.burst(s.x, g + 1, s.z, 30, 0x7fc0ff, 5, 0.8, 0.4, true, -3); }
    else { s.mesh.position.y = s.y; if (Math.random() < dt * 12) FX.emitA(s.x + mr(-0.5, 0.5), s.y + 0.3, s.z + mr(-0.5, 0.5), 0, -1, 0, 1.2, 0.35, 0.05, 0.5, 0.75, 1, 1, 0, 0); }
  }
}
function dropItem(data, x, y, z, vx, vy, vz) {
  const it = Object.assign({}, data);
  it.pos = new V3(x, y, z); it.vel = new V3(vx || 0, vy || 0, vz || 0);
  it.settled = !(vx || vy || vz); it.t = Math.random() * 10; it.alive = true; it.age = 0;
  it.mesh = itemMesh(it); it.mesh.position.copy(it.pos); worldGroup.add(it.mesh);
  ITEMS.push(it);
  return it;
}
function removeItem(it) {
  if (!it.alive) return; it.alive = false; worldGroup.remove(it.mesh);
  const k = ITEMS.indexOf(it); if (k >= 0) ITEMS.splice(k, 1);
}
function spawnFloorLoot(x, y, z) {
  const list = floorLoot();
  list.forEach((d, i) => dropItem(d, x + (i ? rr(-0.9, 0.9) : 0), y, z + (i ? rr(-0.9, 0.9) : 0)));
}
function spawnLoot() {
  for (const s of WORLD.lootSpots) {
    if (s.kind === 'chest') { if (rand() < 0.72) makeChest(s.x, s.y, s.z, s.rot || 0); else if (rand() < 0.5) spawnFloorLoot(s.x, s.y, s.z); }
    else if (rand() < 0.72) spawnFloorLoot(s.x, s.y, s.z);
  }
  let made = 0;
  const nLoose = Math.round(26 * WORLD.scale * WORLD.scale);
  for (let i = 0; i < 400 * WORLD.scale && made < nLoose; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * WORLD.islandR, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = groundH(x, z); if (h < 2 || overlapsFootprint(x - 1, z - 1, x + 1, z + 1, 0.5)) continue;
    if (rand() < 0.3) makeChest(x, h, z, rand() * TAU); else spawnFloorLoot(x, h, z);
    made++;
  }
}
const _iq = [];
function updateItems(dt, cx, cz) {
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const it = ITEMS[i];
    it.t += dt; it.age += dt;
    const dx = it.pos.x - cx, dz = it.pos.z - cz, vis = dx * dx + dz * dz < 6400;
    it.mesh.visible = vis;
    if (!vis && it.settled) continue;
    if (!it.settled) {
      it.vel.y -= GRAV * dt;
      it.pos.x += it.vel.x * dt; it.pos.y += it.vel.y * dt; it.pos.z += it.vel.z * dt;
      const sb = surfaceBelow(it.pos.x, it.pos.y + 0.3, it.pos.z);
      if (it.pos.y <= sb && it.vel.y <= 0) { it.pos.y = sb; it.settled = true; it.vel.set(0, 0, 0); }
      it.mesh.position.copy(it.pos);
    }
    const sp = it.mesh.userData.spin;
    sp.rotation.y += dt * 1.4; sp.position.y = 0.45 + Math.sin(it.t * 2.4) * 0.08;
  }
}
function nearestItem(c, maxD) {
  let best = null, bd = maxD * maxD;
  for (const it of ITEMS) {
    if (!it.alive || it.age < 0.35) continue;
    const dx = it.pos.x - c.pos.x, dy = it.pos.y - c.pos.y, dz = it.pos.z - c.pos.z;
    if (dy > 2.2 || dy < -1.8) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = it; }
  }
  return best;
}

// ---------- chests ----------
function makeChest(x, y, z, rot, supply) {
  const g = new THREE.Group();
  const gold = supply ? lam(0x2f86e8, { emissive: 0x0c2d66 }) : MAT.chestGold;
  const base = new THREE.Mesh(boxGeo(1.3, 0.62, 0.8), gold); base.position.y = 0.31; g.add(base);
  const trim = new THREE.Mesh(boxGeo(1.34, 0.1, 0.84), MAT.chestDark); trim.position.y = 0.62; g.add(trim);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.66, 0.4); g.add(lidPivot);
  const lid = new THREE.Mesh(boxGeo(1.32, 0.26, 0.82), gold); lid.position.set(0, 0.13, -0.41); lidPivot.add(lid);
  if (supply) g.scale.setScalar(1.35);
  const lock = new THREE.Mesh(boxGeo(0.18, 0.2, 0.06), MAT.chestDark); lock.position.set(0, 0.55, -0.42); g.add(lock);
  for (const sx of [-0.55, 0.55]) { const band = new THREE.Mesh(boxGeo(0.08, 0.64, 0.84), MAT.chestDark); band.position.set(sx, 0.32, 0); g.add(band); }
  g.position.set(x, y, z); g.rotation.y = rot;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  worldGroup.add(g);
  const ch = { pos: new V3(x, y, z), mesh: g, lid: lidPivot, opened: false, rot, openT: 0, sparkT: Math.random(), supply: !!supply };
  CHESTS.push(ch);
  return ch;
}
function openChest(ch, who) {
  if (ch.opened) return;
  ch.opened = true; ch.openT = 0;
  SFX.chestOpen(ch.pos);
  makeNoise(ch.pos.x, ch.pos.y, ch.pos.z, 22, who || null);
  const fx = -Math.sin(ch.rot), fz = -Math.cos(ch.rot);
  (ch.supply ? supplyLoot() : chestLoot()).forEach((d, i) => {
    const a = (i - 1.5) * 0.45;
    const vx = (fx * Math.cos(a) - fz * Math.sin(a)) * mr(2.2, 3.4), vz = (fz * Math.cos(a) + fx * Math.sin(a)) * mr(2.2, 3.4);
    dropItem(d, ch.pos.x, ch.pos.y + 0.8, ch.pos.z, vx, mr(4.5, 6.5), vz);
  });
  FX.burst(ch.pos.x, ch.pos.y + 0.9, ch.pos.z, 26, 0xffd75a, 5, 0.7, 0.35, true, -4);
  VFX.chestOpen(ch.pos);
  if (who && who.isPlayer) GAME.stats.chests++;
}
function nearestChest(c, maxD) {
  let best = null, bd = maxD * maxD;
  for (const ch of CHESTS) {
    if (ch.opened) continue;
    const dx = ch.pos.x - c.pos.x, dy = ch.pos.y - c.pos.y, dz = ch.pos.z - c.pos.z;
    if (Math.abs(dy) > 2.2) continue;
    const d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = ch; }
  }
  return best;
}
function updateChests(dt, lx, lz) {
  let hum = 0;
  for (const ch of CHESTS) {
    const ddx = ch.pos.x - lx, ddz = ch.pos.z - lz; ch.mesh.visible = ddx * ddx + ddz * ddz < 22500;
    if (ch.opened) { if (ch.openT < 1) { ch.openT = Math.min(1, ch.openT + dt * 4); ch.lid.rotation.x = -1.9 * ch.openT; } continue; }
    const dx = ch.pos.x - lx, dz = ch.pos.z - lz, d2 = dx * dx + dz * dz;
    if (d2 < 1600) {
      ch.sparkT -= dt;
      if (ch.sparkT <= 0) { ch.sparkT = 0.12; FX.emitA(ch.pos.x + mr(-0.7, 0.7), ch.pos.y + mr(0.3, 1.1), ch.pos.z + mr(-0.5, 0.5), 0, mr(0.6, 1.4), 0, 0.9, 0.22, 0.05, 1, 0.84, 0.3, 1, 0, 0); }
      if (d2 < 196) hum = Math.max(hum, (1 - Math.sqrt(d2) / 14) * 0.3);
    }
  }
  SFX.loop('hum', hum);
}
