// ---------- in-match UI: Tab inventory and pings ----------
const INV = (() => {
  let el = null, open = false, sel = -1;
  function ensure() {
    if (el) return;
    el = document.createElement('div'); el.id = 'inv'; el.hidden = true;
    el.innerHTML = '<div class="inv-panel"><div class="inv-head"><h2 class="disp">Inventory</h2><span>Click two slots to swap · Tab to close</span></div><div class="inv-slots" id="inv-slots"></div><div class="inv-row"><div class="inv-box"><h3 class="disp">Ammo</h3><div id="inv-ammo"></div></div><div class="inv-box"><h3 class="disp">Materials</h3><div id="inv-mats"></div></div></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el) { toggle(false); return; }
      const drop = e.target.closest('[data-drop]'), dm = e.target.closest('[data-dropmat]'), s = e.target.closest('.inv-slot');
      if (drop) { dropSlot(+drop.dataset.drop); e.stopPropagation(); return; }
      if (dm) { dropMat(dm.dataset.dropmat); return; }
      if (s) { const i = +s.dataset.i; if (sel < 0) sel = i; else { const p = player, t = p.inv[i]; p.inv[i] = p.inv[sel]; p.inv[sel] = t; if (p.slot === sel) p.slot = i; else if (p.slot === i) p.slot = sel; updateHeld(p); sel = -1; SFX.click(); } render(); }
    });
  }
  function itemHTML(s) {
    if (!s) return '<span class="empty">Empty</span>';
    if (s.kind === 'weapon') return '<svg viewBox="0 0 64 28"><path d="' + ICON[s.id] + '"/></svg><b>' + WEAPONS[s.id].name + '</b><small>' + RARITY[s.rarity].name + ' · ' + s.mag + '/' + WEAPONS[s.id].mag + '</small>';
    const d = CONSUMABLES[s.id];
    return '<svg viewBox="0 0 64 28">' + (CONS_SVG[s.id] || '') + '</svg><b>' + d.name + '</b><small>×' + s.count + '</small>';
  }
  function render() {
    const p = player; if (!p) return;
    document.getElementById('inv-slots').innerHTML = p.inv.map((s, i) => '<div class="inv-slot' + (s && s.kind === 'weapon' ? ' r' + s.rarity : '') + (sel === i ? ' sel' : '') + (p.slot === i ? ' eq' : '') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' + itemHTML(s) + (s ? '<button class="btn mini" data-drop="' + i + '">Drop</button>' : '') + '</div>').join('');
    document.getElementById('inv-ammo').innerHTML = Object.keys(AMMO).map((k) => '<div class="inv-line"><i style="background:' + hexCss(AMMO[k].color) + '"></i><span>' + AMMO[k].name + '</span><b>' + (p.ammo[k] || 0) + '</b></div>').join('');
    document.getElementById('inv-mats').innerHTML = MAT_ORDER.map((k) => '<div class="inv-line">' + MAT_SVG[k] + '<span>' + MATNAME[k] + '</span><b>' + p.mats[k] + '</b><button class="btn mini" data-dropmat="' + k + '">Drop 30</button></div>').join('');
  }
  function dropSlot(i) {
    const p = player, s = p.inv[i]; if (!s) return;
    p.inv[i] = null; if (p.slot === i) { p.slot = -1; updateHeld(p); }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    dropItem(invToItem(s), p.pos.x + fx, p.pos.y + 1, p.pos.z + fz, fx * 3, 3, fz * 3);
    SFX.click(); render();
  }
  function dropMat(k) {
    const p = player, n = Math.min(30, p.mats[k]); if (!n || MODE().creative) return;
    p.mats[k] -= n; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    dropItem({ kind: 'mats', mat: k, count: n }, p.pos.x + fx, p.pos.y + 1, p.pos.z + fz, fx * 3, 3, fz * 3); render();
  }
  function toggle(on) {
    ensure(); open = on === undefined ? !open : on; el.hidden = !open; sel = -1;
    if (open) { releaseLock(); render(); } else if (GAME.state === 'play' && !GAME.paused) requestLock();
  }
  return { toggle, render, get open() { return open; } };
})();
// ---------- pings ----------
const PINGS = [];
const PING = (() => {
  let host = null;
  function ensure() { if (!host) { host = document.createElement('div'); host.id = 'pings'; document.getElementById('hud').appendChild(host); } }
  function place(p) {
    camera.getWorldDirection(_tmpV);
    const o = camera.position;
    const hc = rayCharacters(o.x, o.y, o.z, _tmpV.x, _tmpV.y, _tmpV.z, 300, p);
    const hw = raycastWorld(o.x, o.y, o.z, _tmpV.x, _tmpV.y, _tmpV.z, 400, true);
    let ping;
    if (hc.c && hc.t < hw.t && !sameTeam(hc.c, p)) ping = { type: 'enemy', char: hc.c, pos: hc.c.pos.clone(), label: 'Enemy', life: 5 };
    else {
      const t = Math.min(hw.t, 400), pos = new V3(o.x + _tmpV.x * t, o.y + _tmpV.y * t, o.z + _tmpV.z * t);
      let it = null, bd = 4; for (const q of ITEMS) { if (!q.alive) continue; const d = q.pos.distanceTo(pos); if (d < bd) { bd = d; it = q; } }
      const ch = CHESTS.find((c) => !c.opened && c.pos.distanceTo(pos) < 3);
      ping = it ? { type: 'item', pos: it.pos.clone(), label: itemLabel(it), life: 12, rar: itemRarity(it) } : ch ? { type: 'item', pos: ch.pos.clone(), label: 'Chest', life: 12, rar: 4 } : { type: 'go', pos, label: 'Go here', life: 12 };
    }
    ping.t = GAME.time; ping.by = p;
    // one location ping per player: a new one replaces the old
    for (let i = PINGS.length - 1; i >= 0; i--) if (PINGS[i].by === p && PINGS[i].type === ping.type) PINGS.splice(i, 1);
    PINGS.push(ping);
    SFX.ping ? SFX.ping(ping.type) : SFX.click();
    // teammates react
    for (const b of bots) {
      if (!b.alive || b.team !== p.team || b === p || !teamMode()) continue;
      if (ping.type === 'enemy' && hasWeapon(b)) { b.target = ping.char; b.lastSeen = GAME.time; b.lastSeenPos.copy(ping.char.pos); }
      else if (ping.type === 'go' && !b.visible) { b.pingGo = { x: ping.pos.x, z: ping.pos.z, until: GAME.time + 25 }; }
    }
  }
  const _p = new V3();
  function update(dt) {
    ensure();
    for (let i = PINGS.length - 1; i >= 0; i--) { const P = PINGS[i]; if (GAME.time - P.t > P.life || (P.char && !P.char.alive)) { if (P.el) P.el.remove(); PINGS.splice(i, 1); } }
    const W = innerWidth, H = innerHeight;
    for (const P of PINGS) {
      if (!P.el) { P.el = document.createElement('div'); P.el.className = 'ping ' + P.type; P.el.innerHTML = '<span class="ic"></span><span class="lb"></span>'; P.el.querySelector('.lb').textContent = P.label; host.appendChild(P.el); }
      if (P.char) P.pos.copy(P.char.pos);
      _p.set(P.pos.x, P.pos.y + (P.char ? 2.6 : 0.6), P.pos.z).project(camera);
      let x = (_p.x * 0.5 + 0.5) * W, y = (-_p.y * 0.5 + 0.5) * H;
      if (_p.z > 1) { x = W - x; y = H - 12; }
      x = clamp(x, 30, W - 30); y = clamp(y, 40, H - 40);
      P.el.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px) translate(-50%,-100%)';
      const d = player ? Math.round(player.pos.distanceTo(P.pos)) : 0;
      P.el.querySelector('.lb').textContent = P.label + ' · ' + d + 'm';
      P.el.style.opacity = Math.min(1, (P.life - (GAME.time - P.t)) * 1.5).toFixed(2);
    }
  }
  function clear() { for (const P of PINGS) if (P.el) P.el.remove(); PINGS.length = 0; }
  return { place, update, clear };
})();
