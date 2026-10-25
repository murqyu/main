'use strict';
// ---------- math + random helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = Math.random;                 // seeded per match for world generation
const rr = (a, b) => a + (b - a) * rand();
const ri = (a, b) => Math.floor(a + (b - a + 1) * rand());
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const mr = (a, b) => a + (b - a) * Math.random();   // gameplay randomness
function weighted(list) {
  let tot = 0; for (const e of list) tot += e[1];
  let r = rand() * tot;
  for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
  return list[list.length - 1][0];
}
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function turnToward(cur, target, maxStep) { const d = angleDiff(cur, target); return cur + clamp(d, -maxStep, maxStep); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function makePerlin(rng) {
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x, y) {
    const fx = Math.floor(x), fy = Math.floor(y);
    const X = fx & 255, Y = fy & 255; x -= fx; y -= fy;
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
                lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v) * 0.75;
  };
}
function fbm(noise, x, y, oct) { let a = 0, amp = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { a += noise(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; } return a / n; }

const V3 = THREE.Vector3;
const IS_TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || /[?&]touch=1/.test(location.search);

// ---------- shared geometry + material caches (never disposed) ----------
const _geoCache = new Map();
function boxGeo(w, h, d) {
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let g = _geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); g.userData.keep = true; _geoCache.set(k, g); }
  return g;
}
function keepGeo(g) { g.userData.keep = true; return g; }
const _matCache = new Map();
function lam(hex, extra) {
  let k = String(hex);
  if (extra) for (const n in extra) { const v = extra[n]; k += '|' + n + ':' + (v && v.isTexture ? v.uuid : v); }
  let m = _matCache.get(k);
  if (!m) {
    const o = Object.assign({ color: hex }, extra || {});
    if (o.emissive !== undefined) o.emissive = new THREE.Color(o.emissive);
    m = new THREE.MeshLambertMaterial(o); m.userData.keep = true; _matCache.set(k, m);
  }
  return m;
}
function hexCss(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
const _tmpV = new V3(), _tmpV2 = new V3(), _tmpV3 = new V3(), _tmpV4 = new V3();
const UP = new V3(0, 1, 0);

let SETTINGS = { bots: 29, diff: 'normal', quality: IS_TOUCH ? 'low' : 'high', sens: 1, vol: 0.8, outfit: 0 };
try { const s = JSON.parse(localStorage.getItem('stormdrop.settings') || 'null'); if (s) SETTINGS = Object.assign(SETTINGS, s); } catch (e) { /* storage unavailable */ }
function saveSettings() { try { localStorage.setItem('stormdrop.settings', JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ } }
