// ---------- modes: solo / duos / squads (knock + revive), team rumble (respawns), creative; mutators ----------
const MODES = {
  solo:     { name: 'Solo', team: 1 },
  duos:     { name: 'Duos', team: 2 },
  squads:   { name: 'Squads', team: 4 },
  rumble:   { name: 'Team Rumble', rumble: true },
  creative: { name: 'Creative', creative: true },
};
const MUTATORS = {
  none:    { name: 'No mutator' },
  lowgrav: { name: 'Low gravity', grav: 9.5 },
  snipers: { name: 'Snipers only', loot: [['sniper', 40], ['heavy', 25], ['hand', 22], ['pistol', 13]] },
  boom:    { name: 'Explosives', loot: [['rocket', 70], ['tac', 15], ['burst', 15]], cons: [['grenade', 60], ['shieldS', 20], ['medkit', 20]] },
  rich:    { name: 'Loaded', rich: true },
};
const MODE = () => MODES[SETTINGS.mode] || MODES.solo;
const MUT = () => MUTATORS[SETTINGS.mutator] || MUTATORS.none;
const TEAM_COLORS = ['#41b8ff', '#ffd23f', '#ff5d8f', '#5ee05a'];
function teamMode() { const M = MODE(); return (M.team || 1) > 1; }
function standing(c) { return c.alive && !c.knocked; }
function teamStanding(team) { return characters.some((c) => c.team === team && standing(c) && !c.npc); }
function mates(c) { return characters.filter((q) => q !== c && q.team && q.team === c.team); }
// ---------- teams ----------
function assignTeams() {
  const M = MODE();
  for (const c of characters) c.team = 0;
  if (M.rumble) {
    const pool = characters.filter((c) => !c.npc);
    pool.forEach((c, i) => { c.team = c === player ? 1 : (i % 2 ? 1 : 2); });
    // keep the sides even
    let a = pool.filter((c) => c.team === 1).length, b = pool.length - a;
    for (const c of pool) { if (a - b > 1 && c !== player && c.team === 1) { c.team = 2; a--; b++; } }
    return;
  }
  const size = M.team || 1;
  if (size === 1) { characters.forEach((c, i) => { if (!c.npc) c.team = i + 1; }); return; }
  const pool = characters.filter((c) => !c.npc && c !== player);
  player.team = 1; let t = 1, n = 1;
  for (const c of pool) { if (n >= size) { t++; n = 0; } c.team = t; n++; }
  // squads land together: everyone copies their first member's drop
  const lead = new Map();
  for (const c of characters) {
    if (c.isPlayer || c.npc || !c.team) continue;
    if (c.team === 1) { c.mate = true; c.followDrop = true; c.jumpAt = 2; continue; }
    const L = lead.get(c.team);
    if (!L) lead.set(c.team, c);
    else { c.dropTarget.set(L.dropTarget.x + mr(-12, 12), 0, L.dropTarget.z + mr(-12, 12)); c.jumpAt = L.jumpAt + mr(0.002, 0.012); }
  }
}
// ---------- knocks + revives ----------
function canKnock(t, kind) {
  if (!teamMode() || t.knocked || t.npc || kind === 'storm') return false;
  return characters.some((c) => c !== t && c.team === t.team && standing(c));
}
function knock(t, src, wname) {
  t.knocked = true; t.hp = 100; t.shield = 0; t.using = null; t.reloadT = 0; t.buildMode = null; t.emote = null; t.aiming = false; t.sliding = false;
  t.height = 1.05; t.knockT = GAME.time; t.reviving = null; t.knockedBy = src;
  if (t.vehicle) exitVehicle(t); t.zip = null; t.mantle = null;
  t.prevSlot = t.slot; t.slot = -1; updateHeld(t); t.rig.heldKey = 'knock';
  for (const m of [t.rig.gunChest, t.rig.gunHand]) while (m.children.length) m.remove(m.children[0]);
  HUD.feed((src && src !== t ? nm(src) + ' knocked ' : '') + nm(t) + (src && src !== t ? '' : ' is down'));
  if (src && src.isPlayer) { HUD.banner('Knocked ' + t.name, '', 1.2); SFX.hit(true, false); }
  if (t.isPlayer) { HUD.banner('You are down', 'Crawl to safety. A teammate can revive you.', 3); SFX.hurt(); endEdit(t, false); }
  FX.burst(t.pos.x, t.pos.y + 1, t.pos.z, 20, 0xff4a4a, 4, 0.5, 0.25, true, -4);
}
function reviveDone(t, by) {
  t.knocked = false; t.hp = 30; t.shield = 0; t.height = 2.0; t.reviving = null; t.rig.heldKey = '';
  t.slot = t.prevSlot !== undefined ? t.prevSlot : -1; if (t.slot >= 0 && !t.inv[t.slot]) t.slot = -1; updateHeld(t);
  HUD.feed(nm(by) + ' revived ' + nm(t));
  FX.burst(t.pos.x, t.pos.y + 1, t.pos.z, 24, 0x5ee05a, 4, 0.6, 0.25, true, -2);
  if (t.isPlayer || by.isPlayer) SFX.heal(false);
}
// called when a standing character goes down for good: knocked teammates with nobody left are wiped
function checkTeamWipe(team, src) {
  if (!teamMode() || !team || teamStanding(team)) return;
  for (const c of characters) if (c.team === team && c.alive && c.knocked) eliminate(c, c.knockedBy || src, '', 'wipe');
}
function tickKnocked(c, dt) {
  if (!c.knocked || !c.alive) return;
  c.hp -= dt * 2.2;
  if (c.hp <= 0) { c.hp = 0; eliminate(c, c.knockedBy || c.lastAttacker, '', 'bleed'); }
}
// revive progress for whoever is holding the interaction (player or bot)
function tickRevive(r, dt, holding) {
  const R = r.reviving; if (!R) return;
  const t = R.target;
  if (!holding || !t.alive || !t.knocked || r.knocked || !r.alive || r.pos.distanceTo(t.pos) > 2.6 || GAME.time - r.lastHurt < 0.2) { r.reviving = null; return; }
  R.t += dt; r.vel.x = 0; r.vel.z = 0;
  if (R.t >= 5) { r.reviving = null; reviveDone(t, r); }
}
function nearestKnockedMate(c, maxD) {
  let best = null, bd = maxD;
  for (const q of characters) { if (q === c || !q.alive || !q.knocked || q.team !== c.team) continue; const d = q.pos.distanceTo(c.pos); if (d < bd) { bd = d; best = q; } }
  return best;
}
// ---------- team rumble ----------
const RUMBLE = { target: 60, score: [0, 0, 0], respawns: [] };
function rumbleSetup() {
  RUMBLE.score = [0, 0, 0]; RUMBLE.respawns = [];
  RUMBLE.target = Math.max(25, Math.round(characters.filter((c) => !c.npc).length * 1.6));
  const S = STORM, r = 230 * (WORLD.scale || 1);
  S.state = 'rumble'; S.cur = { x: 0, z: 0, r }; S.from = { x: 0, z: 0, r }; S.to = { x: 0, z: 0, r }; S.timer = 0; S.dmg = 2;
}
function rumbleElim(t, src) {
  if (src && src !== t && src.team && src.team !== t.team) RUMBLE.score[src.team] = (RUMBLE.score[src.team] || 0) + 1;
  RUMBLE.respawns.push({ c: t, at: GAME.time + 6 });
  if (RUMBLE.score[1] >= RUMBLE.target || RUMBLE.score[2] >= RUMBLE.target) rumbleEnd(RUMBLE.score[1] >= RUMBLE.target ? 1 : 2);
}
function rumbleEnd(winner) {
  if (GAME.state !== 'play' && GAME.state !== 'dead') return;
  const win = winner === player.team;
  GAME.state = win ? 'won' : 'lost'; GAME.placement = win ? 1 : 2;
  HUD.banner(win ? 'Victory' : 'Defeat', 'Team ' + winner + ' reached ' + RUMBLE.target + ' eliminations', 3);
  if (win) { SFX.victory(); if (player.alive) { player.slot = -1; playEmote(player, 'victory'); } } else SFX.defeat();
  setTimeout(() => showEnd(win), 2200);
}
function respawn(c) {
  const S = STORM, a = Math.random() * TAU, r = Math.sqrt(Math.random()) * S.cur.r * 0.7;
  // drop in near living teammates when there are any
  const buddies = characters.filter((q) => q !== c && q.alive && q.team === c.team && q.mode === 'ground');
  const near = buddies.length ? pick(buddies).pos : null;
  const x = near ? near.x + mr(-40, 40) : S.cur.x + Math.cos(a) * r, z = near ? near.z + mr(-40, 40) : S.cur.z + Math.sin(a) * r;
  c.alive = true; c.hp = 100; c.shield = 0; c.knocked = false; c.height = 2; c.deathT = 0; c.using = null; c.reloadT = 0; c.regen = 0;
  for (const k of MAT_ORDER) c.mats[k] = Math.max(c.mats[k], 60);
  c.mode = 'sky'; c.grounded = false; c.pos.set(x, Math.max(groundH(x, z), 0) + 110, z); c.vel.set(0, -10, 0);
  if (c.rig.dissolve) { c.rig.dissolve = null; for (const m of c.rig.meshes) m.material = CHAR_MAT; }
  c.rig.root.visible = true; c.rig.root.scale.set(1, 1, 1);
  if (!c.isPlayer) { c.state = 'roam'; c.target = null; c.dropTarget.set(x + mr(-20, 20), 0, z + mr(-20, 20)); }
  else { GAME.state = 'play'; $id('spec').hidden = true; HUD.banner('Back in the fight', '', 1.5); }
}
function updateRumble(dt) {
  for (let i = RUMBLE.respawns.length - 1; i >= 0; i--) { const R = RUMBLE.respawns[i]; if (GAME.time >= R.at) { RUMBLE.respawns.splice(i, 1); if (GAME.state === 'play' || (GAME.state === 'dead' && R.c.isPlayer)) respawn(R.c); } }
}
// ---------- creative ----------
function creativeSetup() {
  const S = STORM; S.state = 'off'; S.cur = { x: 0, z: 0, r: 99999 }; S.from = S.cur; S.to = S.cur; STORM.mesh.visible = false;
  const spot = WORLD.lodge || WORLD.pois.find((p) => p.type === 'town') || WORLD.pois[0];
  const x = spot ? spot.x + spot.r + 8 : 0, z = spot ? spot.z : 0;
  player.mode = 'ground'; player.pos.set(x, walkH(x, z) + 0.2, z); player.rig.root.visible = true; player.grounded = false;
  BUS.mesh.visible = false; BUS.t = 2;
  player.inv = [null, null, null, null, null];
  for (const [id, r] of [['ar', 4], ['shotgun', 4], ['heavy', 4], ['rocket', 4]]) giveItem(player, { kind: 'weapon', id, rarity: r, mag: WEAPONS[id].mag });
  giveItem(player, { kind: 'consumable', id: 'portafort', count: 2 });
  for (const k in player.ammo) player.ammo[k] = 999;
  selectSlot(player, 0);
  // practice dummies that pop back up
  for (const b of bots) {
    if (b.npc) continue;
    const a = Math.random() * TAU, d = mr(12, 30), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    b.dummy = true; b.mode = 'ground'; b.pos.set(bx, walkH(bx, bz), bz); b.home = new V3(bx, 0, bz); b.rig.root.visible = true; b.state = 'dummy'; b.shield = 50;
  }
  HUD.banner('Creative', 'Infinite materials · no storm · practice dummies respawn · try the vehicles and ziplines', 5);
}
function creativeTick(dt) {
  for (const k of MAT_ORDER) player.mats[k] = 999;
  for (const k in player.ammo) player.ammo[k] = 999;
  for (const b of bots) {
    if (!b.dummy || b.alive) continue;
    b.respawnT = (b.respawnT || 0) + dt;
    if (b.respawnT > 3) { b.respawnT = 0; b.alive = true; b.hp = 100; b.shield = 50; b.deathT = 0; b.pos.set(b.home.x, walkH(b.home.x, b.home.z), b.home.z); if (b.rig.dissolve) { b.rig.dissolve = null; for (const m of b.rig.meshes) m.material = CHAR_MAT; } b.rig.root.visible = true; GAME.alive = characters.filter((c) => c.alive).length; }
  }
}
// ---------- mutators ----------
function applyMutators() {
  const M = MUT();
  GRAV = M.grav || 24;
  if (M.rich) for (const c of characters) { for (const k of MAT_ORDER) c.mats[k] = 300; c.shield = 100; }
}
function mutatorLoot() { return MUT().loot || null; }
function mutatorCons() { return MUT().cons || null; }
// ---------- teammate brains ----------
// returns true when it took over this bot's decision
function mateThink(b, now) {
  // revive downed teammates when the coast is clear
  const k = nearestKnockedMate(b, 80);
  if (k && !b.visible) {
    b.state = 'revive'; b.wantSprint = true;
    if (b.pos.distanceTo(k.pos) > 1.8) { setMove(b, k.pos.x, k.pos.z, 'revive'); b.reviving = null; }
    else { b.hasMove = false; if (!b.reviving || b.reviving.target !== k) b.reviving = { target: k, t: 0 }; }
    return true;
  }
  if (b.knocked) {
    b.state = 'crawl'; const help = characters.find((q) => q !== b && q.alive && !q.knocked && q.team === b.team);
    if (help) setMove(b, help.pos.x, help.pos.z, 'crawl'); else b.hasMove = false;
    return true;
  }
  if (!b.mate || !player) return false;
  // share the player's fights
  if (!b.visible && player.alive && player.aimChar && player.aimChar.alive && now - (GAME.combatT || -99) < 2 && !sameTeam(b, player.aimChar) && hasWeapon(b)) {
    const t = player.aimChar; if (b.pos.distanceTo(t.pos) < 90) { b.target = t; b.lastSeen = now; b.lastSeenPos.copy(t.pos); }
  }
  // stay with the player when nothing urgent is going on
  if (!b.target && player.alive && player.mode === 'ground' && !needsLoot(b)) {
    const d = b.pos.distanceTo(player.pos);
    if (d > 18) { b.state = 'follow'; b.wantSprint = d > 30; const a = (bots.indexOf(b) % 4) * 1.6; setMove(b, player.pos.x + Math.cos(a) * 5, player.pos.z + Math.sin(a) * 5, 'follow'); return true; }
  }
  return false;
}
// ---------- team HUD: roster, overhead markers, rumble score ----------
const TEAMHUD = (() => {
  let panel = null, marks = null, score = null, rows = new Map(), tags = new Map(), sig = '';
  function ensure() {
    if (panel) return;
    const hud = document.getElementById('hud');
    panel = document.createElement('div'); panel.id = 'teampanel'; hud.appendChild(panel);
    marks = document.createElement('div'); marks.id = 'marks'; hud.appendChild(marks);
    score = document.createElement('div'); score.id = 'rumblescore'; score.hidden = true; hud.appendChild(score);
  }
  function reset() {
    ensure(); panel.innerHTML = ''; marks.innerHTML = ''; rows.clear(); tags.clear(); sig = '';
    score.hidden = !MODE().rumble;
  }
  const _v = new V3();
  function update() {
    if (!panel || !player || GAME.state === 'menu') return;
    const M = MODE();
    if (M.rumble) score.innerHTML = '<span class="t1">' + RUMBLE.score[1] + '</span><span class="goal">first to ' + RUMBLE.target + '</span><span class="t2">' + RUMBLE.score[2] + '</span>';
    const squad = teamMode() ? characters.filter((c) => c.team === player.team) : [];
    const s = squad.map((c) => c.name).join('|');
    if (s !== sig) {
      sig = s; panel.innerHTML = ''; rows.clear();
      squad.forEach((c, i) => {
        const r = document.createElement('div'); r.className = 'tm';
        r.innerHTML = '<i style="background:' + TEAM_COLORS[i % 4] + '"></i><span class="n"></span><span class="bars"><b class="sh"></b><b class="hp"></b></span>';
        r.querySelector('.n').textContent = c.isPlayer ? 'You' : c.name;
        panel.appendChild(r); rows.set(c, r); c.teamColor = TEAM_COLORS[i % 4];
      });
    }
    for (const [c, r] of rows) {
      r.classList.toggle('down', c.alive && !!c.knocked); r.classList.toggle('out', !c.alive);
      r.querySelector('.hp').style.width = (c.alive ? clamp(c.hp, 0, 100) : 0) + '%';
      r.querySelector('.sh').style.width = (c.alive && !c.knocked ? clamp(c.shield, 0, 100) : 0) + '%';
    }
    // markers over teammates' heads, visible through walls
    const W = innerWidth, H = innerHeight, show = [];
    if (teamMode() || M.rumble) for (const c of characters) if (c !== player && c.alive && c.team === player.team && c.mode !== 'bus') show.push(c);
    for (const [c, el] of tags) if (!show.includes(c)) { el.remove(); tags.delete(c); }
    for (const c of show) {
      let el = tags.get(c);
      if (!el) { el = document.createElement('div'); el.className = 'mk'; el.innerHTML = '<span class="d"></span><span class="n"></span>'; el.querySelector('.n').textContent = c.name; marks.appendChild(el); tags.set(c, el); }
      _v.set(c.pos.x, c.pos.y + (c.knocked ? 1.3 : 2.5), c.pos.z).project(camera);
      if (_v.z > 1) { el.style.display = 'none'; continue; }
      const d = player.pos.distanceTo(c.pos);
      el.style.display = ''; el.style.transform = 'translate(' + ((_v.x * 0.5 + 0.5) * W).toFixed(0) + 'px,' + ((-_v.y * 0.5 + 0.5) * H).toFixed(0) + 'px) translate(-50%,-100%)';
      el.classList.toggle('down', !!c.knocked); el.querySelector('.d').style.background = c.knocked ? '#ff4a4a' : (c.teamColor || '#41b8ff');
      el.querySelector('.n').textContent = (c.knocked ? '✚ ' : '') + c.name + (d > 25 ? ' · ' + Math.round(d) + 'm' : '');
    }
  }
  return { reset, update };
})();
