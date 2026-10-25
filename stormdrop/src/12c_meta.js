// ---------- progression: profile, cosmetics catalog, 50-tier pass, challenges, XP, career stats, leaderboard ----------
const CATALOG = {
  hair: { crop: 'Crop', spiky: 'Spiky', long: 'Long', bun: 'Bun', bald: 'Shaved', mohawk: 'Mohawk', curly: 'Curls', swoop: 'Swoop' },
  head: { none: 'None', cap: 'Cap', beanie: 'Beanie', helmet: 'Helmet', bandana: 'Bandana', headphones: 'Headphones' },
  top: { tee: 'Tee', hoodie: 'Hoodie', jacket: 'Jacket', armor: 'Armor', tank: 'Tank top' },
  pattern: { none: 'Plain', stripe: 'Stripe', split: 'Split', band: 'Sash' },
  eyes: { normal: 'Neutral', happy: 'Cheerful', focused: 'Focused', shades: 'Shades' },
  back: { none: 'None', backpack: 'Backpack', jetpack: 'Jetpack', quiver: 'Quiver', cape: 'Cape', wings: 'Wings', shield: 'Shield' },
  glider: { wing: 'Delta Wing', para: 'Parafoil', umbrella: 'Brolly', kite: 'Kite' },
  pick: { axe: 'Trusty Axe', pick: 'Rock Pick', hammer: 'Mallet', sickle: 'Sickle', crowbar: 'Pry Bar' },
  trail: { white: 'Cloud', blue: 'Ice', pink: 'Bubblegum', gold: 'Gilded', green: 'Toxic', purple: 'Void' },
  emote: { victory: 'Victory Pump', wave: 'Wave', robot: 'Robot', spin: 'Spin Move', hype: 'Hype', shuffle: 'Shuffle', clap: 'Slow Clap', salute: 'Salute', jacks: 'Jumping Jacks', disco: 'Disco Point', flap: 'Bird Flap', bow: 'Take a Bow' },
};
const TRAIL_HEX = { white: 0xffffff, blue: 0x41b8ff, pink: 0xff5d8f, gold: 0xffd23f, green: 0x2fd06f, purple: 0xb45cff };
const STARTER = {
  outfit: ['Ranger', 'Ember', 'Mint', 'Sunny'], hair: ['crop', 'spiky', 'long', 'bun', 'bald'], head: ['none', 'cap'], top: ['tee', 'hoodie'], pattern: ['none', 'stripe'], eyes: ['normal', 'happy'],
  back: ['none', 'backpack'], glider: ['wing'], pick: ['axe'], trail: ['white'], emote: ['victory', 'wave'],
};
// extra named outfits that only come from the pass
const PASS_OUTFITS = [
  { name: 'Solar Flare', skin: 0xf0c8a0, top: 'armor', c1: 0xff8a3d, c2: 0xffd23f, pattern: 'none', legs: 0x3a2a22, hair: 'spiky', hairC: 0xffd23f, head: 'none', back: 'wings', backC: 0xffd23f, glider: 'wing', gliderC1: 0xff8a3d, gliderC2: 0xffd23f, pick: 'hammer', pickC: 0xffd23f, shoes: 0xff8a3d, eyes: 'focused', gloves: 0xffd23f, trail: 0xffd23f },
  { name: 'Abyss', skin: 0x8d5a3b, top: 'hoodie', c1: 0x1d1630, c2: 0xb45cff, pattern: 'band', legs: 0x120e20, hair: 'swoop', hairC: 0xb45cff, head: 'none', back: 'cape', backC: 0xb45cff, glider: 'kite', gliderC1: 0x1d1630, gliderC2: 0xb45cff, pick: 'sickle', pickC: 0xb45cff, shoes: 0x1d1630, eyes: 'shades', trail: 0xb45cff },
  { name: 'Arctic Fox', skin: 0xf6d2b5, top: 'jacket', c1: 0xe9f2ff, c2: 0xff8a3d, pattern: 'split', legs: 0x9fb4c8, hair: 'long', hairC: 0xdddddd, head: 'beanie', headC: 0xff8a3d, back: 'backpack', backC: 0xe9f2ff, glider: 'para', gliderC1: 0xe9f2ff, gliderC2: 0xff8a3d, pick: 'pick', pickC: 0xff8a3d, shoes: 0xffffff, eyes: 'happy', gloves: 0xe9f2ff, trail: 0x41b8ff },
  { name: 'Neon Rider', skin: 0xd9a07a, top: 'jacket', c1: 0x1d2026, c2: 0x2fd06f, pattern: 'stripe', legs: 0x1d2026, hair: 'mohawk', hairC: 0x2fd06f, head: 'headphones', headC: 0x2fd06f, back: 'jetpack', backC: 0x2fd06f, glider: 'wing', gliderC1: 0x1d2026, gliderC2: 0x2fd06f, pick: 'crowbar', pickC: 0x2fd06f, shoes: 0x2fd06f, eyes: 'shades', trail: 0x2fd06f },
  { name: 'Sandstorm', skin: 0xc68f62, top: 'hoodie', c1: 0xd8b483, c2: 0x8a5a3a, pattern: 'none', legs: 0x8a6a4a, hair: 'curly', hairC: 0x2a1a0e, head: 'bandana', headC: 0x8a5a3a, back: 'quiver', backC: 0x8a5a3a, glider: 'kite', gliderC1: 0xd8b483, gliderC2: 0x8a5a3a, pick: 'axe', pickC: 0xd8b483, shoes: 0x8a5a3a, eyes: 'focused', trail: 0xffd23f },
  { name: 'Warden', skin: 0xa86c45, top: 'armor', c1: 0x1d2026, c2: 0xffc62e, pattern: 'none', legs: 0x1d2026, hair: 'crop', hairC: 0x141414, head: 'helmet', headC: 0xffc62e, back: 'cape', backC: 0xffc62e, glider: 'umbrella', gliderC1: 0x1d2026, gliderC2: 0xffc62e, pick: 'hammer', pickC: 0xffc62e, shoes: 0x1d2026, eyes: 'focused', gloves: 0xffc62e, trail: 0xffd23f },
];
// 50 tiers: one reward each, alternating kinds so every few levels unlocks something you can see
const PASS = (() => {
  const T = [];
  const add = (kind, id, label) => T.push({ kind, id, label });
  const seq = [
    ['emote', 'robot'], ['trail', 'blue'], ['outfit', 'Glacier'], ['hair', 'mohawk'], ['back', 'jetpack'],
    ['pick', 'pick'], ['head', 'beanie'], ['emote', 'clap'], ['glider', 'para'], ['outfit', 'Moss'],
    ['top', 'jacket'], ['trail', 'pink'], ['pattern', 'split'], ['back', 'quiver'], ['emote', 'salute'],
    ['eyes', 'focused'], ['outfit', 'Cherry'], ['pick', 'hammer'], ['head', 'helmet'], ['glider', 'umbrella'],
    ['hair', 'curly'], ['emote', 'spin'], ['outfit', 'Arctic Fox'], ['back', 'cape'], ['trail', 'green'],
    ['top', 'armor'], ['pattern', 'band'], ['emote', 'jacks'], ['outfit', 'Nightshade'], ['head', 'bandana'],
    ['pick', 'sickle'], ['hair', 'swoop'], ['glider', 'kite'], ['emote', 'disco'], ['outfit', 'Sandstorm'],
    ['back', 'shield'], ['eyes', 'shades'], ['trail', 'purple'], ['top', 'tank'], ['emote', 'hype'],
    ['outfit', 'Neon Rider'], ['head', 'headphones'], ['pick', 'crowbar'], ['emote', 'flap'], ['outfit', 'Abyss'],
    ['back', 'wings'], ['emote', 'shuffle'], ['outfit', 'Vanguard'], ['emote', 'bow'], ['outfit', 'Solar Flare'],
  ];
  for (const [k, id] of seq) add(k, id, k === 'outfit' ? id : (CATALOG[k] && CATALOG[k][id]) || id);
  return T;
})();
// later tiers keep going past 50 with "Warden" at 60 and Aurora at 75 for the dedicated
const BONUS_TIERS = { 60: { kind: 'outfit', id: 'Warden', label: 'Warden' }, 75: { kind: 'outfit', id: 'Aurora', label: 'Aurora' }, 100: { kind: 'trail', id: 'gold', label: 'Gilded' } };
const xpForLevel = (lv) => 900 + lv * 45;

// ---------- challenges ----------
const CH_POOL = [
  { id: 'kills', text: 'Eliminate {n} opponents', d: 4, w: 15 },
  { id: 'chests', text: 'Open {n} chests', d: 5, w: 20 },
  { id: 'damage', text: 'Deal {n} damage to opponents', d: 800, w: 3500 },
  { id: 'builds', text: 'Place {n} build pieces', d: 50, w: 250 },
  { id: 'mats', text: 'Harvest {n} materials', d: 350, w: 1500 },
  { id: 'headshots', text: 'Land {n} headshots', d: 8, w: 40 },
  { id: 'top10', text: 'Finish in the top 10', d: 1, w: 4 },
  { id: 'win', text: 'Win a match', d: 1, w: 2, weekOnly: true },
  { id: 'drive', text: 'Drive {n} m in a quad', d: 400, w: 2500 },
  { id: 'zip', text: 'Ride {n} ziplines', d: 2, w: 8 },
  { id: 'pad', text: 'Launch off {n} launch pads', d: 1, w: 5 },
  { id: 'emote', text: 'Emote {n} times', d: 3, w: 12 },
  { id: 'survive', text: 'Survive {n} storm phases', d: 3, w: 15 },
  { id: 'forage', text: 'Eat {n} apples or mushrooms', d: 3, w: 12 },
  { id: 'kills_shotgun', text: 'Eliminate {n} opponents with shotguns', d: 2, w: 8 },
  { id: 'kills_rifle', text: 'Eliminate {n} opponents with rifles', d: 2, w: 10 },
  { id: 'kills_sniper', text: 'Eliminate {n} opponents with snipers', d: 1, w: 4 },
  { id: 'land_snow', text: 'Land in the snow biome', d: 1, w: 3 },
  { id: 'land_desert', text: 'Land in the desert', d: 1, w: 3 },
  { id: 'boss', text: 'Eliminate the Vault Warden', d: 1, w: 1, weekOnly: true },
  { id: 'revive', text: 'Revive {n} teammates', d: 1, w: 5 },
  { id: 'edits', text: 'Edit {n} walls', d: 3, w: 15 },
];
const DAY = () => Math.floor(Date.now() / 86400000), WEEK = () => Math.floor((Date.now() / 86400000 + 3) / 7);
function rollChallenges(seed, n, weekly) {
  const r = mulberry32(seed * 7919 + (weekly ? 13 : 1)), pool = CH_POOL.filter((c) => weekly || !c.weekOnly), out = [];
  while (out.length < n && pool.length) { const c = pool.splice(Math.floor(r() * pool.length), 1)[0]; out.push({ id: c.id, target: weekly ? c.w : c.d, progress: 0, done: false, xp: weekly ? 4000 : 1400 }); }
  return out;
}
function chText(c) { const def = CH_POOL.find((p) => p.id === c.id); return def ? def.text.replace('{n}', c.target.toLocaleString()) : c.id; }

// ---------- profile ----------
const PROFILE_KEY = 'stormdrop.profile';
function freshProfile() {
  return {
    v: 1, level: 1, xp: 0, totalXp: 0, unlocked: JSON.parse(JSON.stringify(STARTER)),
    loadout: { preset: 'Ranger', custom: null, trail: 'white', emotes: ['victory', 'wave', 'robot', 'clap'] },
    stats: { matches: 0, wins: 0, top10: 0, kills: 0, deaths: 0, damage: 0, time: 0, builds: 0, chests: 0, revives: 0, bossKills: 0, longest: 0, headshots: 0, byMode: {}, weapons: {} },
    challenges: { day: -1, week: -1, daily: [], weekly: [] }, history: [], lastWinDay: -1, title: 'Rookie', seenTier: 1,
  };
}
let PROFILE = freshProfile();
function loadProfile() {
  try { const s = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); if (s && s.v === 1) PROFILE = Object.assign(freshProfile(), s); } catch (e) { /* storage unavailable */ }
  for (const k in STARTER) { PROFILE.unlocked[k] = PROFILE.unlocked[k] || []; for (const id of STARTER[k]) if (!PROFILE.unlocked[k].includes(id)) PROFILE.unlocked[k].push(id); }
  refreshChallenges();
}
let _saveT = 0;
function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); } catch (e) { /* ignore */ }
  clearTimeout(_saveT); _saveT = setTimeout(() => CLOUD.push(), 1500);
}
function refreshChallenges() {
  const C = PROFILE.challenges, d = DAY(), w = WEEK();
  if (C.day !== d) { C.day = d; C.daily = rollChallenges(d, 3, false); }
  if (C.week !== w) { C.week = w; C.weekly = rollChallenges(w, 5, true); }
}
// equipped look as a full outfit spec for the rig
function equippedOutfit() {
  const L = PROFILE.loadout;
  let o = L.custom ? Object.assign({}, L.custom) : Object.assign({}, [...OUTFITS, ...PASS_OUTFITS].find((x) => x.name === L.preset) || OUTFITS[0]);
  o.trail = TRAIL_HEX[L.trail] || o.trail || 0xffffff;
  return upgradeOutfit(o);
}
function allOutfits() { return [...OUTFITS, ...PASS_OUTFITS]; }
function isUnlocked(kind, id) { return (PROFILE.unlocked[kind] || []).includes(id); }
function unlock(reward) { const L = PROFILE.unlocked[reward.kind] = PROFILE.unlocked[reward.kind] || []; if (!L.includes(reward.id)) L.push(reward.id); }
function tierReward(lv) { return lv <= PASS.length ? PASS[lv - 1] : BONUS_TIERS[lv] || null; }
// award XP; returns the list of tiers crossed (for the post-match screen)
function grantXP(amount) {
  const gained = []; PROFILE.xp += amount; PROFILE.totalXp += amount;
  while (PROFILE.xp >= xpForLevel(PROFILE.level)) { PROFILE.xp -= xpForLevel(PROFILE.level); PROFILE.level++; const r = tierReward(PROFILE.level); if (r) unlock(r); gained.push({ level: PROFILE.level, reward: r }); }
  return gained;
}

// ---------- in-match tracking: every stat and challenge event flows through ev() ----------
const MATCH = { active: false, xpLog: [], events: {}, startT: 0, landed: false, lastPhase: 0, done: [] };
function matchStart() { Object.assign(MATCH, { active: true, xpLog: [], events: {}, startT: GAME.time, landed: false, lastPhase: STORM.idx, done: [], headshots: 0, driveAcc: 0 }); refreshChallenges(); }
function ev(name, amt) {
  if (!MATCH.active || MODE().creative) return;
  amt = amt === undefined ? 1 : amt;
  MATCH.events[name] = (MATCH.events[name] || 0) + amt;
  for (const c of [...PROFILE.challenges.daily, ...PROFILE.challenges.weekly]) {
    if (c.done || c.id !== name) continue;
    c.progress = Math.min(c.target, c.progress + amt);
    if (c.progress >= c.target) { c.done = true; MATCH.done.push(c); HUD.banner('Challenge complete', chText(c) + '  +' + c.xp.toLocaleString() + ' XP', 2.6); SFX.chestOpen(null); }
  }
}
function weaponGroup(w) { return /Shotgun/.test(w) ? 'shotgun' : /Sniper/.test(w) ? 'sniper' : /Rifle|SMG|Minigun|Pistol|Cannon/.test(w) ? 'rifle' : ''; }
// end-of-match bookkeeping: stats, XP breakdown, tiers, history, leaderboard
function matchEnd(win) {
  if (!MATCH.active) return null;
  MATCH.active = false;
  if (MODE().creative) return null;
  const S = PROFILE.stats, p = player, E = MATCH.events, mode = SETTINGS.mode;
  const alive = Math.round((p.alive ? GAME.time : GAME.deathTime) - MATCH.startT);
  const place = GAME.placement || 99, field = MODE().rumble ? 2 : Math.max(2, new Set(characters.filter((c) => !c.npc).map((c) => c.team)).size);
  if (win) ev('win'); if (place <= 10 && field > 10 || win) ev('top10');
  const log = [];
  log.push(['Survival', Math.round(alive * 1.6)]);
  if (p.kills) log.push(['Eliminations ×' + p.kills, p.kills * 70]);
  if (p.damageDealt) log.push(['Damage dealt', Math.round(p.damageDealt / 8)]);
  if (E.chests) log.push(['Chests ×' + E.chests, E.chests * 20]);
  if (E.builds) log.push(['Building', Math.min(200, E.builds * 2)]);
  const plBonus = win ? 1200 : place <= 3 ? 500 : place <= 10 ? 280 : place <= 25 ? 120 : 0;
  if (plBonus) log.push([win ? 'Victory' : 'Placement #' + place, plBonus]);
  if (win && PROFILE.lastWinDay !== DAY()) { PROFILE.lastWinDay = DAY(); log.push(['First win of the day', 600]); }
  for (const c of MATCH.done) log.push(['Challenge: ' + chText(c), c.xp]);
  const total = log.reduce((s, x) => s + x[1], 0);
  const lv0 = PROFILE.level, xp0 = PROFILE.xp;
  const tiers = grantXP(total);
  S.matches++; if (win) S.wins++; if (place <= 10) S.top10++; S.kills += p.kills; if (!p.alive || !win) S.deaths++;
  S.damage += Math.round(p.damageDealt); S.time += alive; S.builds += E.builds || 0; S.chests += E.chests || 0; S.revives += E.revive || 0; S.bossKills += E.boss || 0; S.headshots += E.headshots || 0;
  const bm = S.byMode[mode] = S.byMode[mode] || { m: 0, w: 0, k: 0 }; bm.m++; if (win) bm.w++; bm.k += p.kills;
  PROFILE.history.unshift({ mode, place, kills: p.kills, dmg: Math.round(p.damageDealt), xp: total, t: Date.now(), win: !!win });
  PROFILE.history.length = Math.min(PROFILE.history.length, 20);
  if (S.wins >= 1) PROFILE.title = S.wins >= 25 ? 'Legend' : S.wins >= 10 ? 'Champion' : S.wins >= 3 ? 'Contender' : 'Victor';
  saveProfile();
  CLOUD.submit();
  return { log, total, lv0, xp0, tiers, place, win, alive };
}

// ---------- cloud: private profile backup + shared leaderboard (artifact db), with local fallback ----------
const CLOUD = (() => {
  let db = null, uid = null, user = null, ready = false;
  async function init() {
    try {
      if (!window.claude || !window.claude.use) return;
      user = await window.claude.use('user'); db = await window.claude.use('db');
      if (!db || !user) { db = null; return; }
      uid = await user.id(); if (!uid) { db = null; return; }
      ready = true;
      // adopt the cloud profile when it is further along than this browser's copy
      const snap = await db.doc('data/users/' + uid + '/profile').get();
      if (snap.exists) { const d = snap.data(); if (d && d.v === 1 && (d.totalXp || 0) > (PROFILE.totalXp || 0)) { PROFILE = Object.assign(freshProfile(), JSON.parse(JSON.stringify(d))); loadProfile(); try { localStorage.setItem(PROFILE_KEY, JSON.stringify(PROFILE)); } catch (e) { /* ignore */ } if (typeof MENU !== 'undefined') MENU.refresh(); } }
    } catch (e) { db = null; ready = false; }
  }
  let pushing = false;
  async function push() {
    if (!ready || pushing) return; pushing = true;
    try { await db.doc('data/users/' + uid + '/profile').set(JSON.parse(JSON.stringify(PROFILE))); } catch (e) { /* offline or read-only */ }
    pushing = false;
  }
  async function submit() {
    if (!ready) return;
    const S = PROFILE.stats;
    try { await db.doc('leaderboard/' + uid).set({ level: PROFILE.level, wins: S.wins, kills: S.kills, matches: S.matches, top10: S.top10, best: Math.max(...PROFILE.history.map((h) => h.kills), 0), updated: Date.now() }); } catch (e) { /* view-only viewers cannot write */ }
  }
  async function top(field) {
    if (!ready) return null;
    try {
      const q = await db.collection('leaderboard').orderBy(field, 'desc').limit(20).get();
      const rows = q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      let names = {};
      try { const ps = await user.profiles(rows.map((r) => r.id)); for (const r of rows) names[r.id] = (ps[r.id] && ps[r.id].name) || ''; } catch (e) { /* names unavailable */ }
      return rows.map((r) => Object.assign(r, { name: r.id === uid ? 'You' : names[r.id] || 'Player', me: r.id === uid }));
    } catch (e) { return null; }
  }
  return { init, push, submit, top, get ready() { return ready; } };
})();
