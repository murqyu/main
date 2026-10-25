// ---------- lobby menu: tabs, mode select, locker with live 3D preview, pass, challenges, career, settings, post-match ----------
const MODE_CARDS = [
  { v: 'solo', ic: '👤', name: 'Solo', d: 'Last one standing' },
  { v: 'duos', ic: '👥', name: 'Duos', d: 'With a bot buddy' },
  { v: 'squads', ic: '🛡', name: 'Squads', d: 'Team of four' },
  { v: 'rumble', ic: '⚔', name: 'Rumble', d: 'Respawns, race to elims' },
  { v: 'creative', ic: '🏗', name: 'Creative', d: 'Free build + practice' },
];
const LOCKER_CATS = [
  ['outfit', 'Outfits'], ['top', 'Top'], ['pattern', 'Pattern'], ['hair', 'Hair'], ['head', 'Headwear'], ['eyes', 'Face'],
  ['back', 'Back bling'], ['glider', 'Glider'], ['pick', 'Pickaxe'], ['trail', 'Contrail'], ['emote', 'Emotes'],
];
const PALETTE = [0xe0482f, 0xff8a3d, 0xffb02e, 0xffd23f, 0x2fd06f, 0x3fcf9a, 0x16a085, 0x41b8ff, 0x2f6fd6, 0x6c3fd1, 0xb45cff, 0xff5d8f, 0xe9f2ff, 0x8a949e, 0x34495e, 0x2b2b2b, 0x1d2026, 0x8a5a3a, 0xd8b483, 0x5b7f2a];
const SKIN_PAL = SKINS, HAIR_PAL = HAIRC;
const KIND_ICON = { outfit: '🧍', top: '👕', pattern: '🎽', hair: '💇', head: '🧢', eyes: '🙂', back: '🎒', glider: '🪂', pick: '⛏', trail: '✨', emote: '💃' };
const LOBBY = { char: null, spot: null, preview: 'idle', emoteT: 0, t: 0 };
const MENU = (() => {
  let tab = 'play', lockCat = 'outfit', lbField = 'wins';
  const $ = (id) => document.getElementById(id);
  const hx = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0').slice(-6);
  function setTab(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tabbody .tab').forEach((s) => { s.hidden = s.dataset.tab !== t; });
    document.querySelector('.tabbody').classList.toggle('wide', t === 'pass' || t === 'career');
    if (t === 'locker') renderLocker(); if (t === 'pass') renderPass(); if (t === 'challenges') renderChallenges(); if (t === 'career') renderCareer();
    LOBBY.preview = t === 'locker' ? previewFor(lockCat) : 'idle';
    SFX.click();
  }
  function previewFor(cat) { return cat === 'glider' ? 'glide' : cat === 'pick' ? 'pick' : cat === 'emote' ? 'emote' : 'idle'; }
  // ---- generic controls ----
  function syncSegs() {
    document.querySelectorAll('.seg[data-opt]').forEach((seg) => {
      const k = seg.dataset.opt;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(SETTINGS[k]) === b.dataset.v));
    });
    document.querySelectorAll('.mcard').forEach((c) => c.classList.toggle('on', c.dataset.v === SETTINGS.mode));
  }
  function bindRange(id, key, fmt, after) {
    const el = $(id), out = $(id + '-out'); if (!el) return;
    el.value = SETTINGS[key]; out.textContent = fmt(SETTINGS[key]);
    el.addEventListener('input', () => { SETTINGS[key] = +el.value; out.textContent = fmt(SETTINGS[key]); saveSettings(); if (after) after(); });
  }
  // ---- top bar + play tab ----
  function refresh() {
    const need = xpForLevel(PROFILE.level);
    $('lvl-n').innerHTML = '<span style="display:block;transform:rotate(-45deg)">' + PROFILE.level + '</span>';
    $('lvl-fill').style.width = (PROFILE.xp / need * 100).toFixed(1) + '%';
    $('lvl-xp').textContent = PROFILE.xp.toLocaleString() + ' / ' + need.toLocaleString() + ' XP';
    const o = equippedOutfit();
    $('lobby-name').textContent = PROFILE.loadout.custom ? 'Custom' : o.name || 'Custom';
    $('lobby-title').textContent = 'Level ' + PROFILE.level + ' · ' + PROFILE.title;
    refreshChallenges();
    $('mini-ch').innerHTML = PROFILE.challenges.daily.map(chRow).join('');
    syncSegs();
  }
  function chRow(c) { return '<div class="chrow' + (c.done ? ' done' : '') + '"><span class="t">' + esc(chText(c)) + '</span><span class="x">' + c.xp.toLocaleString() + ' XP</span><div class="bar"><i style="width:' + (c.progress / c.target * 100).toFixed(0) + '%"></i></div></div>'; }
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // ---- locker ----
  function renderLocker() {
    $('lk-cats').innerHTML = LOCKER_CATS.map(([k, n]) => '<button data-k="' + k + '" class="' + (k === lockCat ? 'on' : '') + '">' + n + '</button>').join('');
    const grid = $('lk-grid'), o = equippedOutfit(), L = PROFILE.loadout;
    let items = [];
    if (lockCat === 'outfit') items = allOutfits().map((x) => ({ id: x.name, name: x.name, on: !L.custom && L.preset === x.name, locked: !isUnlocked('outfit', x.name), sw: [x.c1, x.c2, x.legs, x.hairC] }));
    else if (lockCat === 'trail') items = Object.keys(CATALOG.trail).map((id) => ({ id, name: CATALOG.trail[id], on: L.trail === id, locked: !isUnlocked('trail', id), sw: [TRAIL_HEX[id]] }));
    else if (lockCat === 'emote') items = Object.keys(CATALOG.emote).map((id) => ({ id, name: CATALOG.emote[id], on: L.emotes.includes(id), locked: !isUnlocked('emote', id), sub: L.emotes.includes(id) ? 'Slot ' + (L.emotes.indexOf(id) + 1) : '' }));
    else items = Object.keys(CATALOG[lockCat]).map((id) => ({ id, name: CATALOG[lockCat][id], on: o[lockCat] === id, locked: !isUnlocked(lockCat, id) }));
    for (const it of items) if (it.locked) { const t = PASS.findIndex((r) => r.kind === lockCat && r.id === it.id); it.sub = t >= 0 ? 'Pass tier ' + (t + 1) : 'Locked'; }
    grid.innerHTML = items.map((it) => '<div class="lk-item' + (it.on ? ' on' : '') + (it.locked ? ' locked' : '') + '" data-id="' + esc(it.id) + '">' + (it.sw ? '<span class="sw">' + it.sw.map((c) => '<i style="background:' + hx(c) + '"></i>').join('') + '</span>' : '<span style="position:absolute;top:6px;left:8px;font-size:18px">' + KIND_ICON[lockCat] + '</span>') + '<b>' + esc(it.name) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</div>').join('');
    // colour pickers for custom looks
    const pal = (label, key, list) => '<label>' + label + ' <span class="pal" data-key="' + key + '">' + list.map((c) => '<i data-c="' + c + '" class="' + (o[key] === c ? 'on' : '') + '" style="background:' + hx(c) + '"></i>').join('') + '</span></label>';
    $('lk-colors').innerHTML = lockCat === 'outfit' || lockCat === 'trail' || lockCat === 'emote' ? '<small style="color:var(--ink-dim)">' + (lockCat === 'emote' ? 'Pick up to four emotes for the T key.' : lockCat === 'outfit' ? 'Pick any part on the other tabs to start a custom look.' : '') + '</small>'
      : pal('Main', 'c1', PALETTE) + pal('Accent', 'c2', PALETTE) + pal('Legs', 'legs', PALETTE) + pal('Hair', 'hairC', HAIR_PAL) + pal('Skin', 'skin', SKIN_PAL) + pal('Gear', 'backC', PALETTE);
  }
  function customize(key, val) {
    const L = PROFILE.loadout, base = equippedOutfit();
    L.custom = Object.assign({}, base, { name: 'Custom', [key]: val });
    if (key === 'glider') L.custom.glider = val;
    saveProfile(); refreshLobbyChar(); renderLocker(); refresh();
  }
  function lockerClick(e) {
    const cat = e.target.closest('.lk-cats button');
    if (cat) { lockCat = cat.dataset.k; LOBBY.preview = previewFor(lockCat); renderLocker(); SFX.click(); return; }
    const sw = e.target.closest('.pal i');
    if (sw) { customize(sw.parentElement.dataset.key, +sw.dataset.c); SFX.click(); return; }
    const it = e.target.closest('.lk-item'); if (!it || it.classList.contains('locked')) return;
    const id = it.dataset.id, L = PROFILE.loadout;
    if (lockCat === 'outfit') { L.preset = id; L.custom = null; saveProfile(); refreshLobbyChar(); }
    else if (lockCat === 'trail') { L.trail = id; saveProfile(); refreshLobbyChar(); }
    else if (lockCat === 'emote') { const k = L.emotes.indexOf(id); if (k >= 0) { if (L.emotes.length > 1) L.emotes.splice(k, 1); } else { L.emotes.push(id); if (L.emotes.length > 4) L.emotes.shift(); } saveProfile(); lobbyEmote(id); }
    else customize(lockCat, id);
    SFX.click(); renderLocker(); refresh();
  }
  // ---- pass ----
  function renderPass() {
    $('pass-sub').innerHTML = 'Level ' + PROFILE.level + ' · ' + PROFILE.xp.toLocaleString() + ' / ' + xpForLevel(PROFILE.level).toLocaleString() + ' XP<br>Earn XP from matches and challenges. Every level unlocks something.';
    $('pass-track').innerHTML = PASS.map((r, i) => {
      const lv = i + 1, got = PROFILE.level >= lv;
      return '<div class="tier' + (got ? ' got' : '') + (PROFILE.level + 1 === lv ? ' cur' : '') + '"><span class="n">' + lv + '</span><span class="ic">' + KIND_ICON[r.kind] + '</span><b>' + esc(r.label) + '</b><small>' + r.kind + '</small></div>';
    }).join('');
    const cur = $('pass-track').querySelector('.cur'); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  // ---- challenges ----
  function renderChallenges() {
    refreshChallenges();
    $('ch-daily').innerHTML = PROFILE.challenges.daily.map(chRow).join('');
    $('ch-weekly').innerHTML = PROFILE.challenges.weekly.map(chRow).join('');
    const now = Date.now(), dLeft = 86400000 - (now % 86400000), wLeft = ((7 - ((Math.floor(now / 86400000) + 3) % 7)) * 86400000) - (now % 86400000);
    const fmtH = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60; return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm'; };
    $('ch-dtime').textContent = 'New in ' + fmtH(dLeft); $('ch-wtime').textContent = 'New in ' + fmtH(wLeft);
  }
  // ---- career ----
  function renderCareer() {
    const S = PROFILE.stats, kd = S.deaths ? (S.kills / S.deaths).toFixed(2) : S.kills.toFixed(2);
    const cells = [['Matches', S.matches], ['Wins', S.wins], ['Win rate', S.matches ? Math.round(S.wins / S.matches * 100) + '%' : '0%'], ['Top 10', S.top10], ['Eliminations', S.kills], ['K/D', kd], ['Damage', S.damage.toLocaleString()], ['Headshots', S.headshots], ['Builds', S.builds.toLocaleString()], ['Chests', S.chests], ['Revives', S.revives], ['Wardens', S.bossKills], ['Time played', fmtTime(S.time)], ['Level', PROFILE.level]];
    $('career-stats').innerHTML = cells.map((c) => '<div class="sg"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>').join('');
    $('career-hist').innerHTML = PROFILE.history.length ? PROFILE.history.slice(0, 8).map((h) => '<div class="hist' + (h.win ? ' win' : '') + '"><span class="p">#' + h.place + '</span><span>' + esc((MODES[h.mode] || MODES.solo).name) + ' · ' + h.kills + ' elims · ' + h.dmg + ' dmg</span><span>+' + h.xp + ' XP</span></div>').join('') : '<p style="color:var(--ink-dim);font-size:13px">No matches yet. Drop in!</p>';
    renderLeaderboard();
  }
  async function renderLeaderboard() {
    const el = $('lb');
    if (!CLOUD.ready) { el.innerHTML = '<p style="color:var(--ink-dim);font-size:13px">Personal bests (sign in on claude.ai to compare with others):</p>' + [['Wins', PROFILE.stats.wins], ['Most elims in a match', Math.max(0, ...PROFILE.history.map((h) => h.kills))], ['Best placement', PROFILE.history.length ? '#' + Math.min(...PROFILE.history.map((h) => h.place)) : '-']].map((r) => '<div class="lbrow"><span class="p">★</span><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join(''); return; }
    el.innerHTML = '<p style="color:var(--ink-dim);font-size:13px">Loading…</p>';
    const rows = await CLOUD.top(lbField);
    if (!rows) { el.innerHTML = '<p style="color:var(--ink-dim);font-size:13px">Leaderboard unavailable right now.</p>'; return; }
    if (!rows.length) { el.innerHTML = '<p style="color:var(--ink-dim);font-size:13px">Nobody on the board yet. Finish a match to claim #1.</p>'; return; }
    el.innerHTML = '';
    rows.forEach((r, i) => { const d = document.createElement('div'); d.className = 'lbrow' + (r.me ? ' me' : ''); d.innerHTML = '<span class="p">' + (i + 1) + '</span><span class="nm"></span><span>' + (r[lbField] || 0) + '</span>'; d.querySelector('.nm').textContent = r.name; el.appendChild(d); });
  }
  // ---- wiring ----
  function init() {
    document.body.classList.toggle('is-touch', IS_TOUCH);
    $('controls-help').hidden = IS_TOUCH; $('touch-help').hidden = !IS_TOUCH;
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
    $('modecards').innerHTML = MODE_CARDS.map((m) => '<div class="mcard" data-v="' + m.v + '"><div class="ic">' + m.ic + '</div><b>' + m.name + '</b><small>' + m.d + '</small></div>').join('');
    $('modecards').addEventListener('click', (e) => { const c = e.target.closest('.mcard'); if (!c) return; SETTINGS.mode = c.dataset.v; saveSettings(); syncSegs(); SFX.click(); });
    document.querySelectorAll('.seg[data-opt]').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = seg.dataset.opt, v = b.dataset.v;
      SETTINGS[k] = seg.dataset.bool ? v === 'true' : k === 'bots' ? +v : v; saveSettings(); syncSegs(); SFX.click();
      if (k === 'quality' || k === 'autoRes' || k === 'blur' || k === 'grain') applyQuality();
      if (k === 'fps') $('fps').hidden = !SETTINGS.fps;
    }));
    $('set-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#set-tabs button').forEach((x) => x.classList.toggle('on', x === b)); document.querySelectorAll('.set-page').forEach((p) => { p.hidden = p.dataset.page !== b.dataset.v; }); SFX.click(); });
    $('lb-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; lbField = b.dataset.v; document.querySelectorAll('#lb-tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderLeaderboard(); });
    $('lk-cats').addEventListener('click', lockerClick); $('lk-grid').addEventListener('click', lockerClick); $('lk-colors').addEventListener('click', lockerClick);
    bindRange('fov', 'fov', (v) => Math.round(v) + '°');
    bindRange('vol0', 'vol', (v) => Math.round(v * 100), () => SFX.setVolume(SETTINGS.vol));
    bindRange('music', 'music', (v) => Math.round(v * 100), () => SFX.setMusic(SETTINGS.music));
    bindRange('sens', 'sens', (v) => (+v).toFixed(2));
    bindRange('adsSens', 'adsSens', (v) => (+v).toFixed(2));
    $('lobby-emote').addEventListener('click', () => lobbyEmote(pick(PROFILE.loadout.emotes)));
    $('reset-profile').addEventListener('click', () => { if (confirm('Reset all levels, unlocks, stats and challenges?')) { PROFILE = freshProfile(); refreshChallenges(); saveProfile(); refreshLobbyChar(); refresh(); } });
    document.querySelectorAll('#menu button, .mcard').forEach((b) => b.addEventListener('mouseenter', () => SFX.hover()));
    refresh();
  }
  return { init, refresh, setTab, syncSegs, get tab() { return tab; } };
})();
// ---------- 3D lobby: your character on a hill, framed on the right of the screen ----------
function pickLobbySpot() {
  const sd = WORLD.sunDir || new V3(0.5, 0.8, 0.3), sa = Math.atan2(sd.z, sd.x);
  for (let i = 0; i < 400; i++) {
    const a = sa + mr(-0.9, 0.9) * (1 + i / 200), d = WORLD.islandR * mr(0.4, 0.72), x = Math.cos(a) * d, z = Math.sin(a) * d, h = groundH(x, z);
    if (h < 3 || h > 16 || nearPOI(x, z, 12) || overlapsFootprint(x - 3, z - 3, x + 3, z + 3, 2)) continue;
    if (Math.abs(groundH(x + 3, z) - h) > 0.8 || Math.abs(groundH(x, z + 3) - h) > 0.8) continue;
    const yaw = Math.atan2(-sd.x, -sd.z);   // face the sun: front-lit, with the island behind
    return { x, y: h, z, yaw };
  }
  return { x: 0, y: groundH(0, 0), z: 0, yaw: 0 };
}
function refreshLobbyChar() {
  if (!worldGroup) return;
  if (!LOBBY.spot) LOBBY.spot = pickLobbySpot();
  if (LOBBY.char) { if (LOBBY.char.rig.root.parent) LOBBY.char.rig.root.parent.remove(LOBBY.char.rig.root); }
  const c = LOBBY.char = makeCharacter(false, 'lobby', equippedOutfit());
  c.pos.set(LOBBY.spot.x, LOBBY.spot.y, LOBBY.spot.z); c.yaw = c.modelYaw = LOBBY.spot.yaw; c.mode = 'ground'; c.grounded = true;
  c.rig.root.visible = GAME.state === 'menu'; c.rig.root.rotation.y = c.modelYaw;
}
function lobbyEmote(id) { const c = LOBBY.char; if (!c || !id) return; c.mode = 'ground'; playEmote(c, id); LOBBY.emoteT = GAME.time + 4.5; LOBBY.lastEmote = performance.now(); }
function updateLobby(dt) {
  const c = LOBBY.char; if (!c) return;
  LOBBY.t += dt;
  c.rig.root.visible = true;
  const pv = LOBBY.preview;
  c.mode = pv === 'glide' ? 'glide' : 'ground';
  c.pos.set(LOBBY.spot.x, LOBBY.spot.y + (pv === 'glide' ? 1.2 + Math.sin(LOBBY.t * 1.4) * 0.15 : 0), LOBBY.spot.z);
  if (pv === 'pick' && c.swingT <= 0 && Math.random() < dt * 0.7) c.swingT = 0.5;
  if (c.swingT > 0) c.swingT -= dt;
  if (c.emote && performance.now() - (LOBBY.lastEmote || 0) > 4500) stopEmote(c);
  if (!c.emote && pv === 'idle' && performance.now() - (LOBBY.lastEmote || 0) > 14000 && Math.random() < dt * 0.2) lobbyEmote(pick(PROFILE.loadout.emotes));
  c.vel.set(0, 0, 0); c.grounded = true;
  animateRig(c, dt);
  // camera: in front of the character, offset so it sits right of the menu panels
  const yaw = LOBBY.spot.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const narrow = innerWidth < 760, close = MENU.tab === 'locker' ? 0.78 : 1;
  const glide = pv === 'glide', sway = Math.sin(LOBBY.t * 0.25) * 0.25, dist = (glide ? 7.5 : 4.8) * close, shift = narrow ? 0 : dist * 0.3 * (innerWidth / innerHeight) / 1.78;
  const tx = c.pos.x + fx * dist + rx * sway, tz = c.pos.z + fz * dist + rz * sway, ty = LOBBY.spot.y + 1.5 + (pv === 'glide' ? 1 : 0);
  _tmpV.set(tx, Math.max(ty, walkH(tx, tz) + 0.6), tz);
  if (camera.position.distanceToSquared(_tmpV) > 400) camera.position.copy(_tmpV); else camera.position.lerp(_tmpV, Math.min(1, dt * 3));
  // aiming at a point on the character's right puts them on the right of the screen, clear of the menu
  camera.lookAt(c.pos.x + rx * shift, LOBBY.spot.y + (glide ? 3.1 : 1.05), c.pos.z + rz * shift);
  if (Math.abs(camera.fov - 50) > 0.01) { camera.fov = 50; camera.updateProjectionMatrix(); FX.setScale(pointScale()); }
}
// ---------- post-match: XP breakdown, animated bar, unlock reveals ----------
function showMatchRewards(res) {
  const box = document.getElementById('xpbox');
  if (!res) { box.hidden = true; return; }
  box.hidden = false;
  const rows = document.getElementById('xprows'), fill = document.getElementById('xp-fill'), lvEl = document.getElementById('xp-lvl'), gain = document.getElementById('xp-gain'), unl = document.getElementById('unlocks');
  rows.innerHTML = res.log.map((r) => '<div class="xprow"><span></span><b>+' + r[1].toLocaleString() + '</b></div>').join('');
  [...rows.children].forEach((el, i) => { el.firstChild.textContent = res.log[i][0]; setTimeout(() => el.classList.add('in'), 200 + i * 140); });
  unl.innerHTML = '';
  let lv = res.lv0, xp = res.xp0, left = res.total, shown = 0;
  const badge = (n) => { lvEl.innerHTML = '<span style="display:block;transform:rotate(-45deg)">' + n + '</span>'; };
  badge(lv); fill.style.transition = 'none'; fill.style.width = (xp / xpForLevel(lv) * 100) + '%';
  const t0 = performance.now() + 300 + res.log.length * 140, dur = 1600;
  let last = t0;
  function step(now) {
    if (now < t0) { requestAnimationFrame(step); return; }
    const k = Math.min(1, (now - t0) / dur), want = Math.round(res.total * (1 - Math.pow(1 - k, 3)));
    let add = want - shown; shown = want; gain.textContent = '+' + shown.toLocaleString();
    while (add > 0) {
      const need = xpForLevel(lv) - xp, take = Math.min(need, add);
      xp += take; add -= take; left -= take;
      if (xp >= xpForLevel(lv)) {
        xp = 0; lv++; badge(lv); SFX.chestOpen(null);
        const r = tierReward(lv);
        const d = document.createElement('div'); d.className = 'unl'; d.innerHTML = '<small>Level ' + lv + '</small>' + (r ? KIND_ICON[r.kind] + ' ' : '') + '<span></span>';
        d.querySelector('span').textContent = r ? r.label : 'Level up'; unl.appendChild(d);
      }
    }
    fill.style.width = (xp / xpForLevel(lv) * 100).toFixed(1) + '%';
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
