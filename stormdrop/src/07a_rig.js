// ---------- character rigs: cosmetics, rounded toy models, layered procedural animation ----------
const RBCACHE = new Map();
// Rounded box (same idea as three's RoundedBoxGeometry), cached and never disposed.
function roundedBoxGeo(w, h, d, r, seg) {
  seg = seg || 2;
  const key = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3) + ',' + r.toFixed(3) + ',' + seg;
  let g = RBCACHE.get(key); if (g) return g;
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const s = seg * 2 + 1;
  g = new THREE.BoxGeometry(1, 1, 1, s, s, s).toNonIndexed();
  const pos = g.attributes.position, nrm = g.attributes.normal, hs = 0.5 / s;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, p = new V3(), n = new V3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.copy(p);
    n.x -= Math.sign(n.x) * hs; n.y -= Math.sign(n.y) * hs; n.z -= Math.sign(n.z) * hs; n.normalize();
    pos.setXYZ(i, bx * Math.sign(p.x) + n.x * r, by * Math.sign(p.y) + n.y * r, bz * Math.sign(p.z) + n.z * r);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  g.deleteAttribute('uv');
  keepGeo(g); RBCACHE.set(key, g);
  return g;
}
const RB = (w, h, d, r) => roundedBoxGeo(w, h, d, r === undefined ? Math.min(w, h, d) * 0.28 : r, 2);
const _sph = new Map();
function sphGeo(r) { const k = r.toFixed(3); let g = _sph.get(k); if (!g) { g = keepGeo(new THREE.SphereGeometry(r, 10, 8)); _sph.set(k, g); } return g; }
const _cone = new Map();
function coneGeo(r, h, s) { const k = r + ',' + h + ',' + s; let g = _cone.get(k); if (!g) { g = keepGeo(new THREE.ConeGeometry(r, h, s || 6)); _cone.set(k, g); } return g; }
const _cyl = new Map();
function cylGeo(r1, r2, h, s) { const k = r1 + ',' + r2 + ',' + h + ',' + s; let g = _cyl.get(k); if (!g) { g = keepGeo(new THREE.CylinderGeometry(r1, r2, h, s || 10)); _cyl.set(k, g); } return g; }

// one part = geometry + colour + placement inside its bone
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new V3(), _ps = new V3();
function part(list, geo, hex, x, y, z, rx, ry, rz, sx, sy, sz) {
  _pe.set(rx || 0, ry || 0, rz || 0); _pq.setFromEuler(_pe);
  list.push({ geo, col: new THREE.Color(hex).convertSRGBToLinear(), m: new THREE.Matrix4().compose(_pv.set(x || 0, y || 0, z || 0), _pq, _ps.set(sx || 1, sy || 1, sz || 1)) });
}
const _nmat = new THREE.Matrix3(), _mv = new V3();
function taperChest(v) { v.x *= 0.82 + 0.18 * clamp(v.y / 0.5, 0, 1); }
function mergeParts(list, deform) {
  let n = 0;
  for (const p of list) n += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
  if (!n) return null;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of list) {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal, I = p.geo.index;
    _nmat.getNormalMatrix(p.m);
    const cnt = I ? I.count : P.count;
    for (let k = 0; k < cnt; k++) {
      const i = I ? I.getX(k) : k;
      _mv.fromBufferAttribute(P, i).applyMatrix4(p.m); if (deform) deform(_mv); pos[o * 3] = _mv.x; pos[o * 3 + 1] = _mv.y; pos[o * 3 + 2] = _mv.z;
      _mv.fromBufferAttribute(N, i).applyMatrix3(_nmat).normalize(); nrm[o * 3] = _mv.x; nrm[o * 3 + 1] = _mv.y; nrm[o * 3 + 2] = _mv.z;
      col[o * 3] = p.col.r; col[o * 3 + 1] = p.col.g; col[o * 3 + 2] = p.col.b;
      o++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// shared materials: vertex colours + a soft rim light so characters pop off the background
const URIM = { value: new THREE.Color(0.25, 0.22, 0.2) };
function charMaterial(extra) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.58, metalness: 0.02 }, extra || {}));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = URIM;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb += uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);\n#include <tonemapping_fragment>');
  };
  m.customProgramCacheKey = () => 'charmat' + (extra && extra.emissive ? 'f' : '');
  m.userData.keep = true;
  return m;
}
let CHAR_MAT = null, CHAR_FLASH = null;
function initCharMaterials() {
  CHAR_MAT = charMaterial();
  CHAR_FLASH = charMaterial({ emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.4 });
}

// ---------- cosmetics ----------
const SKINS = [0xf6d2b5, 0xf0c8a0, 0xeac2a0, 0xd9a07a, 0xc68f62, 0xa86c45, 0x8d5a3b, 0x6b4430];
const HAIRC = [0x141414, 0x2a1a0e, 0x3b2416, 0x6b4a2a, 0xb0442c, 0xe8c25a, 0xdddddd, 0xff5d8f, 0x41b8ff, 0x6c3fd1, 0x2fd06f, 0xff8a3d];
const VIVID = [0xe0482f, 0x2f6fd6, 0x3fcf9a, 0x6c3fd1, 0xffb02e, 0xff5d8f, 0x41b8ff, 0x2fd06f, 0xffd23f, 0x1d2340, 0xe9f2ff, 0x2b2b2b, 0x8a5a3a, 0x5b7f2a, 0xc0392b, 0x16a085, 0xf39c12, 0x8e44ad, 0x34495e, 0xd35400];
const DARKS = [0x1b1630, 0x2a2f45, 0x2b2d42, 0x3a2a22, 0x1f3b3a, 0x4a3b26, 0x262626, 0x3a5f8f, 0x5a3e9a, 0x6b6b6b];
const HAIR_STYLES = ['crop', 'spiky', 'mohawk', 'long', 'bun', 'bald', 'curly', 'swoop'];
const HEADWEAR = ['none', 'none', 'none', 'beanie', 'cap', 'helmet', 'bandana', 'headphones'];
const TOPS = ['tee', 'hoodie', 'jacket', 'armor', 'tank'];
const PATTERNS = ['none', 'none', 'stripe', 'split', 'band'];
const BACKS = ['backpack', 'backpack', 'jetpack', 'quiver', 'cape', 'wings', 'shield', 'none'];
const GLIDERS = ['wing', 'para', 'umbrella', 'kite'];
const PICKS = ['axe', 'pick', 'hammer', 'sickle', 'crowbar'];
const EYES = ['normal', 'normal', 'happy', 'focused', 'shades'];
function genOutfit(rng) {
  rng = rng || Math.random;
  const P = (a) => a[Math.floor(rng() * a.length)];
  const c1 = P(VIVID); let c2 = P(VIVID); if (c2 === c1) c2 = P(VIVID);
  return {
    skin: P(SKINS), hair: P(HAIR_STYLES), hairC: P(HAIRC), head: P(HEADWEAR), headC: P(VIVID),
    top: P(TOPS), c1, c2, pattern: P(PATTERNS), legs: P(DARKS), shorts: rng() < 0.15, shoes: P([0x1d2026, 0xffffff, 0xe0482f, 0x2f6fd6, 0x8a5a3a, 0x2b2b2b]),
    gloves: rng() < 0.4 ? P([0x1d2026, 0x2b2b2b, c2]) : null, eyes: P(EYES), paint: rng() < 0.12 ? P(VIVID) : null,
    back: P(BACKS), backC: P(VIVID), glider: P(GLIDERS), gliderC1: P(VIVID), gliderC2: P(VIVID), pick: P(PICKS), pickC: P(VIVID), trail: P([0xffffff, 0x41b8ff, 0xff5d8f, 0xffd23f, 0x2fd06f, 0xb45cff]),
  };
}
// old flat outfit records (name, skin, shirt, pants, hair, acc) upgrade into full specs
function upgradeOutfit(o) {
  if (o.top) return o;
  const g = genOutfit(mulberry32(String(o.name || 'x').length * 977 + (o.shirt || 0)));
  return Object.assign(g, { name: o.name, skin: o.skin, c1: o.shirt, c2: o.acc, legs: o.pants, hairC: o.hair, backC: o.acc, gliderC1: o.acc === 0xffffff ? 0xff5d8f : o.acc, gliderC2: o.shirt, pickC: o.acc });
}

// ---------- rig ----------
function buildRig(spec) {
  const o = upgradeOutfit(spec);
  const B = {}; const parts = {};
  const bone = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent ? B[parent] : null)?.add(g); B[name] = g; parts[name] = []; return g; };
  const root = new THREE.Group(); B.root = root;
  const body = new THREE.Group(); root.add(body); B.body = body;
  const hips = new THREE.Group(); hips.position.y = 0.86; body.add(hips); B.hips = hips; parts.hips = [];
  bone('chest', 'hips', 0, 0.1, 0);
  bone('head', 'chest', 0, 0.58, 0);
  bone('upperL', 'chest', -0.35, 0.5, 0); bone('foreL', 'upperL', 0, -0.32, 0); bone('handL', 'foreL', 0, -0.28, 0);
  bone('upperR', 'chest', 0.35, 0.5, 0); bone('foreR', 'upperR', 0, -0.32, 0); bone('handR', 'foreR', 0, -0.28, 0);
  bone('thighL', 'hips', -0.13, 0, 0); bone('shinL', 'thighL', 0, -0.42, 0); bone('footL', 'shinL', 0, -0.38, 0);
  bone('thighR', 'hips', 0.13, 0, 0); bone('shinR', 'thighR', 0, -0.42, 0); bone('footR', 'shinR', 0, -0.38, 0);
  const skin = o.skin, dark = 0x1d2026, sleeveFull = o.top === 'hoodie' || o.top === 'jacket' || o.top === 'armor';
  // hips
  part(parts.hips, RB(0.48, 0.26, 0.3), o.legs, 0, 0.03, 0);
  part(parts.hips, RB(0.5, 0.07, 0.32, 0.02), dark, 0, 0.13, 0);
  part(parts.hips, RB(0.09, 0.07, 0.03, 0.01), 0xd8b25a, 0, 0.13, -0.165);
  // torso
  const T = parts.chest;
  part(T, RB(o.top === 'tank' ? 0.5 : 0.56, 0.56, 0.32, 0.09), o.c1, 0, 0.28, 0);
  if (o.pattern === 'stripe') part(T, RB(0.57, 0.08, 0.33, 0.02), o.c2, 0, 0.3, 0);
  else if (o.pattern === 'split') part(T, RB(0.285, 0.555, 0.325, 0.06), o.c2, -0.14, 0.28, 0);
  else if (o.pattern === 'band') part(T, RB(0.12, 0.57, 0.33, 0.02), o.c2, 0.1, 0.28, 0, 0, 0, 0.5);
  if (o.top === 'jacket') { part(T, RB(0.16, 0.5, 0.05, 0.02), o.c2, 0, 0.27, -0.155); part(T, RB(0.44, 0.08, 0.34, 0.03), o.c1, 0, 0.54, 0); }
  if (o.top === 'hoodie') { part(T, RB(0.4, 0.22, 0.14, 0.06), o.c1, 0, 0.5, 0.17); part(T, RB(0.3, 0.12, 0.05, 0.03), o.c2, 0, 0.14, -0.16); }
  if (o.top === 'armor') { part(T, RB(0.46, 0.34, 0.08, 0.04), o.c2, 0, 0.32, -0.15); part(T, RB(0.38, 0.06, 0.34, 0.02), 0x2b2b2b, 0, 0.12, 0); }
  // back bling
  const bc = o.backC;
  if (o.back === 'backpack') { part(T, RB(0.4, 0.42, 0.18, 0.06), bc, 0, 0.28, 0.24); part(T, RB(0.3, 0.1, 0.06, 0.02), dark, 0, 0.16, 0.34); for (const sx of [-0.14, 0.14]) part(T, RB(0.05, 0.5, 0.04, 0.01), dark, sx, 0.3, -0.16); }
  else if (o.back === 'jetpack') { for (const sx of [-0.1, 0.1]) { part(T, cylGeo(0.08, 0.08, 0.44, 10), bc, sx, 0.28, 0.24); part(T, coneGeo(0.08, 0.1, 10), 0x3a3d42, sx, 0.02, 0.24, Math.PI); } part(T, RB(0.3, 0.08, 0.06, 0.02), dark, 0, 0.42, 0.2); }
  else if (o.back === 'quiver') { part(T, cylGeo(0.07, 0.06, 0.5, 8), bc, 0.06, 0.32, 0.22, 0, 0, -0.4); for (let i = 0; i < 3; i++) part(T, coneGeo(0.03, 0.08, 4), 0xffffff, 0.14 + i * 0.03, 0.62 - i * 0.02, 0.22, 0, 0, -0.4); }
  else if (o.back === 'wings') { for (const s of [-1, 1]) part(T, RB(0.5, 0.36, 0.03, 0.03), bc, s * 0.32, 0.36, 0.22, 0, s * 0.35, s * 0.4); }
  else if (o.back === 'shield') { part(T, cylGeo(0.26, 0.26, 0.05, 16), bc, 0, 0.28, 0.2, Math.PI / 2); part(T, cylGeo(0.1, 0.1, 0.06, 12), o.c2, 0, 0.28, 0.23, Math.PI / 2); }
  // cape hangs from its own bone so it can sway
  if (o.back === 'cape') { bone('cape', 'chest', 0, 0.54, 0.18); part(parts.cape, RB(0.5, 0.95, 0.04, 0.02), bc, 0, -0.47, 0); part(parts.cape, RB(0.52, 0.06, 0.06, 0.02), o.c2, 0, 0, 0); }
  // head + face
  const H = parts.head;
  part(H, RB(0.4, 0.42, 0.4, 0.12), skin, 0, 0.21, 0);
  part(H, RB(0.06, 0.08, 0.05, 0.02), skin, 0, 0.17, -0.21);
  for (const sx of [-0.2, 0.2]) part(H, RB(0.04, 0.09, 0.07, 0.02), skin, sx, 0.2, 0);
  if (o.eyes === 'shades') part(H, RB(0.34, 0.08, 0.03, 0.02), 0x111318, 0, 0.255, -0.205);
  else {
    for (const sx of [-0.085, 0.085]) {
      part(H, RB(0.1, o.eyes === 'happy' ? 0.05 : 0.09, 0.03, 0.015), 0xffffff, sx, 0.25, -0.2);
      part(H, RB(0.05, o.eyes === 'happy' ? 0.04 : 0.06, 0.02, 0.01), 0x1b1d22, sx + (sx > 0 ? -0.01 : 0.01), 0.245, -0.215);
      part(H, RB(0.11, 0.025, 0.02, 0.008), o.hairC, sx, o.eyes === 'focused' ? 0.31 : 0.315, -0.207, 0, 0, o.eyes === 'focused' ? (sx > 0 ? 0.3 : -0.3) : 0);
    }
  }
  part(H, RB(o.eyes === 'happy' ? 0.12 : 0.09, 0.025, 0.02, 0.01), 0x6a2a2a, 0, 0.1, -0.205);
  if (o.paint) part(H, RB(0.41, 0.06, 0.41, 0.03), o.paint, 0, 0.18, 0);
  const hc = o.hairC;
  const hairTop = () => { part(H, RB(0.43, 0.13, 0.43, 0.06), hc, 0, 0.41, 0.005); part(H, RB(0.42, 0.22, 0.12, 0.05), hc, 0, 0.32, 0.165); };
  if (o.head !== 'helmet' && o.head !== 'beanie') {
    if (o.hair === 'crop' || o.hair === 'swoop') { hairTop(); if (o.hair === 'swoop') part(H, RB(0.3, 0.1, 0.16, 0.05), hc, -0.06, 0.45, -0.14, 0.3, 0, 0.2); }
    else if (o.hair === 'spiky') { hairTop(); for (let i = 0; i < 6; i++) part(H, coneGeo(0.07, 0.2, 4), hc, -0.15 + (i % 3) * 0.15, 0.5, -0.1 + Math.floor(i / 3) * 0.2, (Math.floor(i / 3) ? 0.4 : -0.3), 0, (i % 3 - 1) * 0.4); }
    else if (o.hair === 'mohawk') part(H, RB(0.08, 0.18, 0.44, 0.03), hc, 0, 0.49, 0.02);
    else if (o.hair === 'long') { hairTop(); part(H, RB(0.42, 0.44, 0.12, 0.05), hc, 0, 0.16, 0.17); }
    else if (o.hair === 'bun') { hairTop(); part(H, sphGeo(0.1), hc, 0, 0.52, 0.12); }
    else if (o.hair === 'curly') { for (let i = 0; i < 9; i++) part(H, sphGeo(0.1), hc, -0.14 + (i % 3) * 0.14, 0.42 + (i % 2) * 0.03, -0.1 + Math.floor(i / 3) * 0.12); }
  }
  if (o.head === 'beanie') { part(H, RB(0.45, 0.22, 0.45, 0.1), o.headC, 0, 0.43, 0.01); part(H, RB(0.46, 0.07, 0.46, 0.03), o.c2, 0, 0.33, 0.01); }
  else if (o.head === 'cap') { part(H, RB(0.44, 0.14, 0.44, 0.07), o.headC, 0, 0.43, 0.01); part(H, RB(0.3, 0.03, 0.2, 0.01), o.headC, 0, 0.39, -0.26); }
  else if (o.head === 'helmet') { part(H, RB(0.48, 0.4, 0.48, 0.14), o.headC, 0, 0.27, 0.01); part(H, RB(0.38, 0.13, 0.05, 0.03), 0x101828, 0, 0.25, -0.235); }
  else if (o.head === 'bandana') part(H, RB(0.42, 0.07, 0.42, 0.03), o.headC, 0, 0.36, 0);
  else if (o.head === 'headphones') { part(H, RB(0.46, 0.04, 0.12, 0.02), dark, 0, 0.46, 0); for (const sx of [-0.22, 0.22]) part(H, cylGeo(0.08, 0.08, 0.06, 12), o.headC, sx, 0.24, 0, 0, 0, Math.PI / 2); }
  // arms
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1;
    part(parts['upper' + s], RB(0.17, 0.34, 0.17, 0.06), o.top === 'tank' ? skin : o.c1, 0, -0.15, 0);
    if (o.top === 'armor') part(parts['upper' + s], RB(0.22, 0.12, 0.22, 0.06), o.c2, sx * 0.02, 0.0, 0);
    part(parts['fore' + s], RB(0.15, 0.29, 0.15, 0.06), sleeveFull ? o.c1 : skin, 0, -0.135, 0);
    if (sleeveFull) part(parts['fore' + s], RB(0.16, 0.05, 0.16, 0.02), o.c2, 0, -0.25, 0);
    part(parts['hand' + s], RB(0.14, 0.15, 0.12, 0.05), o.gloves || skin, 0, -0.07, 0);
    part(parts['thigh' + s], RB(0.21, 0.44, 0.23, 0.07), o.legs, 0, -0.21, 0);
    part(parts['shin' + s], RB(0.19, 0.4, 0.21, 0.07), o.shorts ? skin : o.legs, 0, -0.19, 0);
    part(parts['foot' + s], RB(0.21, 0.12, 0.32, 0.05), o.shoes, 0, -0.03, -0.05);
    part(parts['foot' + s], RB(0.22, 0.04, 0.33, 0.02), 0xf2f2f2, 0, -0.08, -0.05);
  }
  const meshes = [];
  for (const name in parts) {
    const g = mergeParts(parts[name], name === 'chest' ? taperChest : null); if (!g) continue;
    const m = new THREE.Mesh(g, CHAR_MAT); m.castShadow = true; m.receiveShadow = false;
    B[name].add(m); meshes.push(m);
  }
  // held item mounts: guns ride the chest so they always point where the character aims
  B.aim = new THREE.Group(); B.aim.position.set(0, 0.45, 0); B.chest.add(B.aim);
  B.gunChest = new THREE.Group(); B.aim.add(B.gunChest);
  B.gunHand = new THREE.Group(); B.gunHand.position.set(0, -0.08, -0.02); B.gunHand.rotation.x = -Math.PI / 2; B.handR.add(B.gunHand);
  B.glider = buildGlider(o); B.glider.visible = false; root.add(B.glider);
  return Object.assign(B, { meshes, spec: o, heldKey: '', gun: B.gunHand, flash: 0, dissolve: null });
}
function buildGlider(o) {
  const g = new THREE.Group(); g.position.y = 2.75;
  const L = [], c1 = o.gliderC1, c2 = o.gliderC2, dk = 0x1d2026;
  if (o.glider === 'para') {
    for (let i = -3; i <= 3; i++) part(L, RB(0.62, 0.08, 1.3, 0.03), i % 2 ? c1 : c2, i * 0.6, 0.5 - Math.abs(i) * Math.abs(i) * 0.06, 0, 0, 0, -i * 0.12);
    for (const sx of [-1.6, 1.6]) part(L, RB(0.02, 1.4, 0.02, 0.005), 0xdddddd, sx * 0.6, -0.15, 0, 0, 0, sx > 0 ? -0.55 : 0.55);
  } else if (o.glider === 'umbrella') {
    part(L, coneGeo(1.8, 0.7, 10), c1, 0, 0.4, 0); part(L, coneGeo(1.82, 0.12, 10), c2, 0, 0.08, 0); part(L, RB(0.05, 1.3, 0.05, 0.01), dk, 0, -0.35, 0);
  } else if (o.glider === 'kite') {
    part(L, RB(2.6, 0.05, 2.6, 0.02), c1, 0, 0.2, 0, 0, Math.PI / 4, 0, 1, 1, 0.6); part(L, RB(0.08, 0.06, 2.4, 0.01), c2, 0, 0.24, 0); part(L, RB(2.4, 0.06, 0.08, 0.01), c2, 0, 0.24, 0); part(L, RB(0.04, 1.2, 0.04, 0.01), dk, 0, -0.4, 0);
  } else {
    part(L, RB(2.1, 0.06, 1.1, 0.03), c1, -0.95, 0, 0, 0, 0, 0.22); part(L, RB(2.1, 0.06, 1.1, 0.03), c2, 0.95, 0, 0, 0, 0, -0.22); part(L, RB(0.06, 1.1, 0.06, 0.01), dk, 0, -0.55, 0);
  }
  const m = new THREE.Mesh(mergeParts(L), CHAR_MAT); m.castShadow = true; g.add(m);
  return g;
}
function pickaxeModel(o) {
  const L = [], c = o.pickC || 0xffc62e, h = 0x6b4a2a, mt = 0xb8c2cc;
  part(L, RB(0.05, 0.05, 0.9, 0.02), h, 0, 0, -0.25);
  switch (o.pick) {
    case 'pick': part(L, RB(0.06, 0.6, 0.08, 0.02), mt, 0, 0.0, -0.66, 0, 0, 0); part(L, coneGeo(0.04, 0.16, 4), c, 0, 0.36, -0.66); part(L, coneGeo(0.04, 0.16, 4), c, 0, -0.36, -0.66, Math.PI); break;
    case 'hammer': part(L, RB(0.16, 0.3, 0.16, 0.04), c, 0, 0.05, -0.68); break;
    case 'sickle': part(L, RB(0.04, 0.42, 0.1, 0.02), c, 0, 0.2, -0.7, -0.6); part(L, RB(0.04, 0.2, 0.08, 0.02), c, 0, 0.4, -0.55, -1.4); break;
    case 'crowbar': part(L, RB(0.05, 0.05, 0.3, 0.02), c, 0, 0.12, -0.75, -1.1); break;
    default: part(L, RB(0.06, 0.48, 0.12, 0.02), c, 0, 0.12, -0.68); part(L, RB(0.07, 0.2, 0.2, 0.02), mt, 0, 0.26, -0.62);
  }
  const m = new THREE.Mesh(mergeParts(L), CHAR_MAT); m.castShadow = true;
  return m;
}

// ---------- held items ----------
const HOLD = { ar: 'rifle', smg: 'rifle', shotgun: 'rifle', sniper: 'rifle', pistol: 'pistol', rocket: 'launcher' };
function holdType(c) {
  if (c.buildMode) return 'build';
  const it = curItem(c);
  if (!it) return 'pick';
  if (it.kind === 'weapon') return (WEAPONS[it.id] && WEAPONS[it.id].hold) || HOLD[it.id] || 'rifle';
  return 'item';
}
const HOLDS = {
  ar: { at: [0.1, -0.06, -0.4], r: [0, -0.12, 0.13], l: [0, -0.06, -0.2], blade: -0.6, mag: [0, -0.2, -0.08] },
  smg: { at: [0.1, -0.06, -0.36], r: [0, -0.1, 0.12], l: [0, -0.2, -0.06], blade: -0.45, mag: [0, -0.24, -0.06] },
  shotgun: { at: [0.1, -0.05, -0.32], r: [0, -0.06, 0.2], l: [0, -0.08, -0.26], blade: -0.6, mag: [0, -0.08, -0.3] },
  sniper: { at: [0.1, -0.07, -0.36], r: [0, -0.1, 0.14], l: [0, -0.04, -0.24], blade: -0.65, mag: [0, -0.12, 0.05] },
  pistol: { at: [0.02, -0.04, -0.48], r: [0, -0.12, 0.08], l: [-0.05, -0.15, 0.08], blade: -0.1, mag: [0, -0.2, 0.08] },
  rocket: { at: [0.24, 0.1, 0.08], r: [0, -0.16, 0.05], l: [0, -0.13, -0.28], blade: -0.35, mag: [0, 0, 0.55] },
};
const MUZZLE_Z = { ar: -0.68, smg: -0.41, shotgun: -0.61, pistol: -0.2, sniper: -0.92, rocket: -0.62 };
function updateHeld(c) {
  const R = c.rig, it = curItem(c);
  const key = c.emote ? 'emote' : c.buildMode ? 'build' : it ? (it.kind + ':' + it.id + ':' + (it.rarity || 0)) : 'pick';
  if (R.heldKey === key) return;
  R.heldKey = key;
  for (const mount of [R.gunChest, R.gunHand]) while (mount.children.length) mount.remove(mount.children[0]);
  R.muzzle = null; R.hold = null; R.gunModel = null;
  if (c.buildMode || c.emote) return;
  if (!it) R.gunHand.add(pickaxeModel(R.spec));
  else if (it.kind === 'weapon') {
    const g = gunModel(it.id, it.rarity);
    const H = HOLDS[it.id] || HOLDS.ar;
    g.position.set(H.at[0], H.at[1], H.at[2]); R.hold = H; R.gunModel = g;
    const mz = new THREE.Object3D(); mz.position.set(0, it.id === 'shotgun' ? 0.03 : 0.02, MUZZLE_Z[it.id] || -0.6); g.add(mz); R.muzzle = mz;
    R.gunChest.add(g);
  } else { const m = consModel(it.id); m.rotation.x = Math.PI / 2; R.gunHand.add(m); }
}

// ---------- animation ----------
const EMOTES = {
  victory: { name: 'Victory Pump', len: 0 }, wave: { name: 'Wave', len: 2.4 }, robot: { name: 'Robot', len: 0 }, spin: { name: 'Spin Move', len: 0 }, hype: { name: 'Hype', len: 0 }, shuffle: { name: 'Shuffle', len: 0 },
};
function rigTargets(c, dt, A) {
  const R = c.rig, t = GAME.time;
  const set = (k, x, y, z) => { A[k] = [x || 0, y || 0, z || 0]; };
  for (const k of ['chest', 'head', 'upperL', 'foreL', 'handL', 'upperR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'hips']) set(k);
  A.bodyX = 0; A.bodyY = 0; A.hipsY = 0;
  const em = c.emote;
  if (em) {
    const e = (t - c.emoteStart);
    if (em === 'victory' || em === 'hype') { const w = e * (em === 'hype' ? 9 : 6.5); set('upperL', 0.2, 0, -(2.4 + Math.sin(w) * 0.5)); set('upperR', 0.2, 0, 2.4 + Math.sin(w + Math.PI) * 0.5); set('foreL', 0.4); set('foreR', 0.4); set('thighL', Math.max(0, Math.sin(w)) * 0.7); set('shinL', -Math.max(0, Math.sin(w)) * 1.0); set('thighR', Math.max(0, -Math.sin(w)) * 0.7); set('shinR', -Math.max(0, -Math.sin(w)) * 1.0); set('head', Math.sin(w * 0.5) * 0.25); A.hipsY = Math.abs(Math.sin(w)) * 0.22; }
    else if (em === 'wave') { set('upperR', 0.2, 0, 2.6); set('foreR', 0, 0, Math.sin(e * 9) * 0.6); set('head', 0, 0.2, 0.1); set('upperL', 0, 0, -0.15); }
    else if (em === 'robot') { const s = Math.floor(e * 2.5) % 4; set('upperL', s === 0 || s === 2 ? 1.57 : 0, 0, -0.1); set('foreL', s === 1 ? 1.57 : 0); set('upperR', s === 1 || s === 3 ? 1.57 : 0, 0, 0.1); set('foreR', s === 2 ? 1.57 : 0); set('head', 0, (s - 1.5) * 0.4, 0); set('chest', 0, (s % 2 ? 0.3 : -0.3), 0); }
    else if (em === 'spin') { A.bodyY = e * 9; set('upperL', 0, 0, -1.4); set('upperR', 0, 0, 1.4); set('thighL', 0.4); set('shinL', -0.8); A.hipsY = 0.05; }
    else if (em === 'shuffle') { const w = e * 8; set('thighL', Math.sin(w) * 0.6); set('shinL', -Math.max(0, Math.sin(w)) * 0.9); set('thighR', -Math.sin(w) * 0.6); set('shinR', -Math.max(0, -Math.sin(w)) * 0.9); set('upperL', -0.3 + Math.sin(w) * 0.5, 0, -0.3); set('upperR', -0.3 - Math.sin(w) * 0.5, 0, 0.3); set('foreL', 1.2); set('foreR', 1.2); set('chest', 0, Math.sin(w) * 0.3, 0); A.hipsY = Math.abs(Math.cos(w)) * 0.08; }
    return;
  }
  if (c.mode === 'sky') {
    const fl = Math.sin(t * 13 + c.pos.x) * 0.08;
    A.bodyX = -1.25; set('head', 0.9); set('upperL', 0.1, 0, -1.2 + fl); set('upperR', 0.1, 0, 1.2 - fl); set('foreL', 0.35); set('foreR', 0.35);
    set('thighL', 0.15, 0, -0.3); set('thighR', 0.15, 0, 0.3); set('shinL', -0.55 + fl); set('shinR', -0.55 - fl); A.hipsY = 0.12;
    return;
  }
  if (c.mode === 'glide') {
    const sw = Math.sin(t * 2.3) * 0.06;
    A.bodyX = -0.1; set('upperL', 0, 0, -2.75); set('upperR', 0, 0, 2.75); set('foreL', 0.2); set('foreR', 0.2); set('thighL', 0.3 + sw); set('thighR', 0.1 - sw); set('shinL', -0.4); set('shinR', -0.6);
    return;
  }
  if (c.knocked) {
    A.bodyX = -1.2; A.hipsY = -0.55; const cw = Math.sin(c.anim.phase * 2) * 0.5;
    set('upperL', 2.2 + cw, 0, -0.3); set('upperR', 2.2 - cw, 0, 0.3); set('foreL', 0.6); set('foreR', 0.6); set('thighL', 0.3 - cw * 0.5); set('thighR', 0.3 + cw * 0.5); set('shinL', -0.9); set('shinR', -0.9); set('head', 1.0);
    return;
  }
  if (c.mantle) {
    const k = Math.min(1, c.mantle.t / c.mantle.dur);
    set('upperL', lerp(2.7, 0.6, k), 0, -0.25); set('upperR', lerp(2.7, 0.6, k), 0, 0.25); set('foreL', lerp(0.3, 1.2, k)); set('foreR', lerp(0.3, 1.2, k));
    set('thighL', lerp(1.4, 0.2, k)); set('shinL', lerp(-1.8, -0.3, k)); set('thighR', lerp(0.6, 0.1, k)); set('shinR', lerp(-1.2, -0.2, k)); set('chest', -0.35 * (1 - k)); set('head', 0.25);
    A.hipsY = -0.15 * (1 - k);
    return;
  }
  // ---- locomotion ----
  const an = c.anim;
  const fx = -Math.sin(c.modelYaw), fz = -Math.cos(c.modelYaw);
  const vf = c.vel.x * fx + c.vel.z * fz, vs = c.vel.x * -fz + c.vel.z * fx;
  const sp = Math.hypot(c.vel.x, c.vel.z), amp = Math.min(1, sp / 6.5);
  an.phase += dt * sp * (c.crouch ? 2.2 : 1.55) * (vf < -0.5 ? -1 : 1);
  const ph = an.phase, s1 = Math.sin(ph), c1 = Math.cos(ph);
  const sprint = sp > 7.5 ? Math.min(1, (sp - 7.5) / 1.3) : 0;
  const fwdK = sp > 0.2 ? Math.abs(vf) / sp : 1, sideK = sp > 0.2 ? vs / sp : 0;
  const stride = amp * (0.75 + sprint * 0.25);
  set('thighL', s1 * stride * fwdK, 0, -s1 * stride * sideK * 0.5);
  set('thighR', -s1 * stride * fwdK, 0, -s1 * stride * sideK * 0.5);
  set('shinL', -Math.max(0, -c1) * stride * 1.3 - 0.05);
  set('shinR', -Math.max(0, c1) * stride * 1.3 - 0.05);
  set('footL', Math.max(0, -c1) * stride * 0.4); set('footR', Math.max(0, c1) * stride * 0.4);
  A.hipsY = -Math.abs(Math.cos(ph)) * 0.04 * amp + Math.sin(t * 2) * 0.006;
  A.hips[1] = s1 * 0.12 * amp * fwdK;
  const lean = (vf / 9) * 0.22 + sprint * 0.16;
  set('chest', -lean, -s1 * 0.12 * amp * fwdK, -sideK * amp * 0.08);
  if (c.crouch) { A.hipsY -= 0.36; A.thighL[0] += 1.0; A.thighR[0] += 1.0; A.shinL[0] -= 1.5; A.shinR[0] -= 1.5; A.footL[0] += 0.5; A.footR[0] += 0.5; A.chest[0] -= 0.3; }
  if (c.sliding) { A.hipsY = -0.5; A.bodyX = 0.25; set('thighL', 1.3); set('shinL', -0.2); set('thighR', 0.4); set('shinR', -1.6); A.chest[0] = -0.2; }
  if (!c.grounded && !c.sliding) {
    const up = c.vel.y > 0;
    set('thighL', up ? 0.9 : 0.5); set('shinL', up ? -1.3 : -0.6); set('thighR', up ? -0.2 : 0.1); set('shinR', up ? -0.5 : -0.3);
  }
  if (an.land > 0) { A.hipsY -= an.land * 0.22; A.thighL[0] += an.land * 0.5; A.thighR[0] += an.land * 0.5; A.shinL[0] -= an.land * 0.9; A.shinR[0] -= an.land * 0.9; }
  // ---- upper body by what is held ----
  const p = clamp(c.pitch, -1.2, 1.2), ht = holdType(c), armSw = s1 * 0.55 * amp * (1 + sprint * 0.6);
  A.chest[0] += p * 0.22; set('head', p * 0.5, 0, 0);
  an.ik = 0; an.ikL = 1; an.aimP = p; an.blade = 0;
  const gun = ht === 'rifle' || ht === 'pistol' || ht === 'launcher';
  if (c.swingT > 0 || ht === 'pick') {
    if (c.swingT > 0) { const k = 1 - Math.min(1, c.swingT / (c.isPlayer ? 0.5 : 0.75)); const a = k < 0.3 ? lerp(1.0, 2.8, k / 0.3) : lerp(2.8, 0.25, (k - 0.3) / 0.7); set('upperR', a + p * 0.3, 0, 0.1); set('foreR', 0.4); A.chest[1] = k < 0.3 ? 0.35 : -0.4; A.chest[0] -= k < 0.3 ? 0 : 0.25; set('upperL', 0.3, 0, -0.2); set('foreL', 0.6); }
    else { set('upperR', 0.35 + armSw * 0.3, 0, 0.08); set('foreR', 0.7); set('upperL', -armSw, 0, -0.08); set('foreL', 0.3 + Math.max(0, -armSw)); }
  } else if (gun) {
    // arms are solved by IK onto the gun's grips after the pose blend
    an.ik = 1; an.blade = R.hold ? R.hold.blade : -0.4;
    set('upperR', 0.8, 0, 0); set('foreR', 1.0); set('upperL', 0.9, 0, 0); set('foreL', 1.0);
    const lowered = sprint > 0.3 && !c.aiming && c.fireCD <= 0 && c.reloadT <= 0;
    if (lowered) { an.aimP = lerp(p, -0.75, sprint); an.blade *= 1 - sprint * 0.7; }
    if (c.aiming) an.blade *= 1.15;
  } else if (ht === 'build') {
    set('upperR', 0.9 + p * 0.3, 0, -0.15); set('foreR', 0.8); set('upperL', 0.9 + p * 0.3, 0, 0.15); set('foreL', 0.8);
  } else {
    if (c.using) { const k = Math.sin(t * 7) * 0.12; set('upperR', 1.0 + k, 0, -0.4); set('foreR', 1.5); set('upperL', 0.9 - k, 0, 0.4); set('foreL', 1.4); A.head[0] = -0.3; }
    else { set('upperR', 0.6, 0, -0.05); set('foreR', 1.2); set('upperL', -armSw, 0, -0.08); set('foreL', 0.3); }
  }
  if (c.throwT > 0) { const k = 1 - c.throwT / 0.45; set('upperR', k < 0.5 ? lerp(0.5, 2.9, k * 2) : lerp(2.9, 0.6, (k - 0.5) * 2), 0, 0.2); set('foreR', 0.6); an.ik = 0; }
  A.chest[1] += an.blade;
  // recoil kicks the chest; the gun itself kicks in the aim frame and the IK arms follow it
  A.chest[0] += an.recoil * 0.12;
}
// two-bone IK in the chest's space: bends the elbow toward `pole`
const _ikD = new V3(), _ikE = new V3(), _ikP = new V3(), _ikW = new V3(), _ikQ = new THREE.Quaternion(), _ikQi = new THREE.Quaternion(), _DOWN = new V3(0, -1, 0);
function solveArm(upper, fore, target, pole, l1, l2, w) {
  const S = upper.position;
  _ikD.subVectors(target, S); let d = _ikD.length();
  if (d < 1e-4) return;
  _ikD.multiplyScalar(1 / d); d = clamp(d, Math.abs(l1 - l2) + 0.02, (l1 + l2) * 0.999);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _ikP.copy(pole).addScaledVector(_ikD, -pole.dot(_ikD)).normalize();
  _ikE.copy(S).addScaledVector(_ikD, a).addScaledVector(_ikP, h);
  _ikW.copy(S).addScaledVector(_ikD, d);
  _ikQ.setFromUnitVectors(_DOWN, _ikD.subVectors(_ikE, S).normalize());
  upper.quaternion.slerp(_ikQ, w);
  _ikW.sub(_ikE).normalize().applyQuaternion(_ikQi.copy(upper.quaternion).invert());
  _ikQ.setFromUnitVectors(_DOWN, _ikW);
  fore.quaternion.slerp(_ikQ, w);
}
const _gT = new V3(), _gQ = new THREE.Quaternion(), _gQ2 = new THREE.Quaternion(), _gE = new THREE.Euler(), _poleR = new V3(0.6, -1, 0.35), _poleL = new V3(-0.7, -1, 0.1), _hipT = new V3(-0.24, -0.05, -0.12);
function gripInChest(R, pt, out) {
  out.set(pt[0], pt[1], pt[2]).applyMatrix4(R.gunModel.matrix).applyMatrix4(R.gunChest.matrix).applyMatrix4(R.aim.matrix);
  return out;
}
function rigArmsIK(c, dt) {
  const R = c.rig, an = c.anim;
  an.ikW = (an.ikW || 0) + ((an.ik && R.gunModel ? 1 : 0) - (an.ikW || 0)) * Math.min(1, dt * 14);
  // aim frame: undo hips+chest rotation, then pitch toward the aim
  _gQ.copy(R.hips.quaternion).multiply(R.chest.quaternion).invert();
  _gE.set(an.aimP + an.recoil * 0.22, 0, 0); _gQ2.setFromEuler(_gE);
  R.aim.quaternion.copy(_gQ).multiply(_gQ2);
  R.gunChest.position.set(0, an.recoil * 0.02, an.recoil * 0.09);
  let rz = 0;
  if (c.reloadT > 0 && c.reloadTotal > 0) { const k = 1 - c.reloadT / c.reloadTotal; rz = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.55; }
  R.gunChest.rotation.z += (rz - R.gunChest.rotation.z) * Math.min(1, dt * 12);
  if (an.ikW < 0.01 || !R.gunModel || !R.hold) return;
  R.aim.updateMatrix(); R.gunChest.updateMatrix(); R.gunModel.updateMatrix();
  const H = R.hold, w = an.ikW;
  solveArm(R.upperR, R.foreR, gripInChest(R, H.r, _gT), _poleR, 0.32, 0.35, w);
  // left hand: foregrip, or the reload path (mag -> belt -> mag -> grip)
  let lt = H.l;
  if (c.reloadT > 0 && c.reloadTotal > 0) {
    const k = 1 - c.reloadT / c.reloadTotal;
    if (k < 0.25 || (k > 0.6 && k < 0.85)) lt = H.mag;
    else if (k <= 0.6) { solveArm(R.upperL, R.foreL, _hipT, _poleL, 0.32, 0.35, w); return; }
  }
  solveArm(R.upperL, R.foreL, gripInChest(R, lt, _gT), _poleL, 0.32, 0.35, w);
}
const _A = {};
const RIG_BONES = ['chest', 'head', 'upperL', 'foreL', 'handL', 'upperR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'hips'];
function animateRig(c, dt) {
  const R = c.rig;
  if (!R.root.visible) return;
  if (!c.anim) c.anim = { phase: 0, recoil: 0, land: 0 };
  const an = c.anim;
  R.root.position.copy(c.pos);
  R.root.rotation.y += angleDiff(R.root.rotation.y, c.modelYaw) * Math.min(1, dt * 18);
  an.recoil = Math.max(0, an.recoil - dt * 7); an.land = Math.max(0, an.land - dt * 3.5);
  rigTargets(c, dt, _A);
  const k = Math.min(1, dt * (c.emote ? 20 : 15)), kf = Math.min(1, dt * 30);
  for (const b of RIG_BONES) {
    const g = R[b], t = _A[b], kk = (b === 'upperR' && c.swingT > 0) ? kf : k;
    g.rotation.x += (t[0] - g.rotation.x) * kk; g.rotation.y += (t[1] - g.rotation.y) * kk; g.rotation.z += (t[2] - g.rotation.z) * kk;
  }
  R.body.rotation.x += (_A.bodyX - R.body.rotation.x) * k;
  rigArmsIK(c, dt);
  if (c.emote === 'spin') R.body.rotation.y = _A.bodyY; else R.body.rotation.y += (0 - R.body.rotation.y) * k;
  R.hips.position.y += (0.86 + _A.hipsY - R.hips.position.y) * Math.min(1, dt * 20);
  if (c.mode === 'sky') R.body.position.y = 1.0; else R.body.position.y += (0 - R.body.position.y) * k;
  if (R.cape) { const sp = Math.hypot(c.vel.x, c.vel.z); const tx = -0.15 - Math.min(1.1, sp * 0.1 + (c.mode !== 'ground' ? 0.8 : 0)) + Math.sin(GAME.time * 5 + c.pos.x) * 0.06; R.cape.rotation.x += (tx - R.cape.rotation.x) * Math.min(1, dt * 6); }
  R.glider.visible = c.mode === 'glide';
  if (R.glider.visible) R.glider.rotation.z = Math.sin(GAME.time * 2) * 0.05 - (c.anim.turn || 0) * 0.3;
  // hit flash
  if (R.flash > 0) { R.flash -= dt; const m = R.flash > 0 ? CHAR_FLASH : CHAR_MAT; if (R.meshes[0].material !== m && !R.dissolve) for (const ms of R.meshes) ms.material = m; }
  // skydive contrails
  if (c.mode === 'sky' && Math.random() < dt * 30) for (const h of [R.handL, R.handR]) { h.getWorldPosition(_tmpV); const col = R.trailCol || (R.trailCol = new THREE.Color(R.spec.trail || 0xffffff)); FX.emitA(_tmpV.x, _tmpV.y, _tmpV.z, 0, 2, 0, 0.6, 0.18, 0.04, col.r, col.g, col.b, 0.7, 0, 0); }
}
function rigHitFlash(c) { if (c.rig && !c.rig.dissolve) c.rig.flash = 0.07; }

// digitize-out on elimination: the body dissolves from the top down with a glowing edge
function startDissolve(c) {
  const R = c.rig;
  const mat = charMaterial();
  const U = { uCut: { value: 2.3 }, uBase: { value: c.pos.y }, uGlow: { value: LIN(0x6ff6ff).multiplyScalar(6) } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {
    prev(sh); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWpos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWpos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWpos; uniform float uCut, uBase; uniform vec3 uGlow;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat hh = vWpos.y - uBase + sin(vWpos.x * 23.0) * 0.04 + sin(vWpos.z * 31.0) * 0.04; if (hh > uCut) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * smoothstep(0.18, 0.0, uCut - hh);');
  };
  mat.customProgramCacheKey = () => 'dissolve';
  mat.userData.keep = false;
  for (const m of R.meshes) m.material = mat;
  R.dissolve = { mat, U, t: 0 };
}
function rigDeath(c, dt) {
  const R = c.rig;
  if (!R.dissolve || !R.root.visible) return;
  const D = R.dissolve; D.t += dt;
  D.U.uCut.value = 2.3 - D.t * 2.6; D.U.uBase.value = c.pos.y;
  if (Math.random() < dt * 60) FX.emitA(c.pos.x + mr(-0.4, 0.4), c.pos.y + Math.max(0, D.U.uCut.value) + mr(-0.1, 0.1), c.pos.z + mr(-0.4, 0.4), mr(-0.3, 0.3), mr(1.5, 3.5), mr(-0.3, 0.3), mr(0.6, 1.1), 0.22, 0.04, 0.45, 0.95, 1, 1, 0, 0.3);
  if (D.U.uCut.value < -0.1) { R.root.visible = false; D.mat.dispose(); }
}
