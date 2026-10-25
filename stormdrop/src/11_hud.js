// ---------- HUD ----------
const ICON = {
  ar: 'M2 11h7l2-3h25l3 2h13V8h3v2h7v4H47l-3 2h-6l-1 9h-6l1-9h-7l-4 9h-7l3-9H2z',
  smg: 'M8 9h28l3 2h11v4H39l-2 2h-4v9h-6l1-9h-6v5h-5l1-5H8z',
  shotgun: 'M2 12h14l2-2h40v2h5v3H40l-2 2H27l-3 7h-7l3-7h-6l-3 2H2z',
  pistol: 'M16 8h30v6H32l-2 2h-2l-2 10h-8l3-12h-5z',
  sniper: 'M1 13h11l2-2h13V7h14v4h22v3H38l-3 2h-6l-2 8h-6l2-8h-9l-3 2H1z',
  rocket: 'M4 9h48l5 3v4l-5 3H38v7h-6v-7h-6v5h-6v-5H4z',
};
const CONS_SVG = {
  bandage: '<rect x="17" y="6" width="30" height="16" rx="8"/><rect x="29" y="6" width="6" height="16" fill="#d94c4c"/>',
  medkit: '<rect x="18" y="4" width="28" height="20" rx="3"/><path d="M30 7h4v5h5v4h-5v5h-4v-5h-5v-4h5z" fill="#2fb35a"/>',
  shieldS: '<rect x="29" y="2" width="6" height="4" fill="#e8e8e8"/><path d="M28 6h8v4l5 6v10H23V16l5-6z" fill="#41b8ff"/>',
  shieldL: '<rect x="28" y="1" width="8" height="4" fill="#e8e8e8"/><path d="M24 5h16v4l5 4v14H19V13l5-4z" fill="#41b8ff"/>',
};
const PICK_SVG = '<svg viewBox="0 0 32 32"><path d="M8 27L22 11" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M11 7c7-3 14-1 18 6l-3 1.5c-3-4-8-6-14-4.5z"/></svg>';
const MAT_SVG = {
  wood: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="6" rx="1" fill="#c99657"/><rect x="2" y="11" width="16" height="6" rx="1" fill="#a9753f"/></svg>',
  stone: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="7" height="6" fill="#b8bcc2"/><rect x="11" y="3" width="7" height="6" fill="#9ca1a8"/><rect x="6" y="11" width="8" height="6" fill="#aab0b6"/></svg>',
  metal: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="2" fill="#93a6b8"/><circle cx="5" cy="6" r="1.2" fill="#48525c"/><circle cx="15" cy="6" r="1.2" fill="#48525c"/><circle cx="5" cy="14" r="1.2" fill="#48525c"/><circle cx="15" cy="14" r="1.2" fill="#48525c"/></svg>',
};
const PIECE_SVG = {
  wall: '<svg viewBox="0 0 32 32"><rect x="6" y="5" width="20" height="22"/></svg>',
  floor: '<svg viewBox="0 0 32 32"><path d="M3 19 L16 26 L29 19 L16 12 Z"/></svg>',
  ramp: '<svg viewBox="0 0 32 32"><path d="M4 26 L28 26 L28 7 Z"/></svg>',
  cone: '<svg viewBox="0 0 32 32"><path d="M3 24 L16 7 L29 24 Z"/></svg>',
};
const PIECE_KEYS = { wall: 'Z', floor: 'X', ramp: 'V', cone: 'B' };
const HUD = (() => {
  const $ = (id) => document.getElementById(id);
  let E = {}, hotSig = '', matSig = '', buildSig = '', promptSig = '', bannerT = 0, toastT = 0, hitT = 0, flashT = 0, mmT = 0;
  const dds = [], compassMarks = [];
  const setT = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
  const setW = (el, v) => { if (el._w !== v) { el._w = v; el.style.width = v; } };
  let mm, bm;
  function init() {
    for (const id of ['hud', 'killfeed', 'compass-strip', 'storm-text', 'stormline', 'alive', 'kills', 'crosshair', 'hitmarker', 'dmgdirs', 'prompt', 'progress', 'progress-label', 'progress-fill', 'banner', 'elimtoast', 'shield-fill', 'shield-num', 'hp-fill', 'hp-num', 'ammo', 'hotbar', 'buildbar', 'mats', 'buildhint', 'scope', 'storm-tint', 'flash', 'bigmap', 'touch', 'tb-use', 'tb-pieces', 'tb-build', 'tb-aim', 'tb-reload', 'fps', 'clickplay']) E[id] = $(id);
    mm = $('minimap').getContext('2d'); bm = $('bigmap-c').getContext('2d');
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let h = 0; h < 360; h += 15) { const el = document.createElement('div'); el.className = 'cm' + (labels[h] ? '' : ' minor'); el.textContent = labels[h] || h; E['compass-strip'].appendChild(el); compassMarks.push({ el, h }); }
    for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'dd'; d.style.opacity = '0'; E.dmgdirs.appendChild(d); dds.push({ el: d, t: 0, src: null, x: 0, z: 0 }); }
    E.buildbar.innerHTML = ['wall', 'floor', 'ramp', 'cone'].map((p) => '<div class="bp" data-p="' + p + '"><span class="k">' + PIECE_KEYS[p] + '</span>' + PIECE_SVG[p] + '</div>').join('');
    E.buildhint.innerHTML = '<span class="key">Q</span>build &nbsp;<span class="key">R-Click</span>material<br><span class="key">R</span>rotate ramp &nbsp;<span class="key">E</span>open / pick up';
    E['tb-pieces'].innerHTML = ['wall', 'floor', 'ramp', 'cone'].map((p) => '<button class="tb" data-p="' + p + '" aria-label="' + p + '">' + PIECE_SVG[p] + '</button>').join('') + '<button class="tb" data-p="mat" aria-label="Switch material" style="font-size:12px">MAT</button>';
    if (IS_TOUCH) E.buildhint.hidden = true;
  }
  function slotHTML(s, i, sel) {
    if (i < 0) return '<div class="slot pick' + (sel ? ' sel' : '') + '" data-slot="-1"><span class="k">' + (IS_TOUCH ? '' : 'F') + '</span>' + PICK_SVG + '</div>';
    if (!s) return '<div class="slot' + (sel ? ' sel' : '') + '" data-slot="' + i + '"><span class="k">' + (IS_TOUCH ? '' : i + 1) + '</span></div>';
    if (s.kind === 'weapon') return '<div class="slot r' + s.rarity + (sel ? ' sel' : '') + '" data-slot="' + i + '"><span class="k">' + (IS_TOUCH ? '' : i + 1) + '</span><svg viewBox="0 0 64 28"><path d="' + ICON[s.id] + '"/></svg><span class="n">' + s.mag + '</span></div>';
    const r = CONSUMABLES[s.id].rarity;
    return '<div class="slot r' + r + (sel ? ' sel' : '') + '" data-slot="' + i + '"><span class="k">' + (IS_TOUCH ? '' : i + 1) + '</span><svg viewBox="0 0 64 28" fill="#f4f4f4">' + CONS_SVG[s.id] + '</svg><span class="n">' + s.count + '</span></div>';
  }
  function updateHotbar(p) {
    let sig = p.slot + '|' + (p.buildMode || '') + '|';
    for (const s of p.inv) sig += s ? (s.kind + s.id + (s.rarity || 0) + ':' + (s.mag !== undefined ? s.mag : s.count)) + ',' : '-,';
    if (sig === hotSig) return; hotSig = sig;
    let h = slotHTML(null, -1, p.slot === -1 && !p.buildMode);
    for (let i = 0; i < 5; i++) h += slotHTML(p.inv[i], i, p.slot === i && !p.buildMode);
    E.hotbar.innerHTML = h;
  }
  function updateMats(p) {
    const sig = p.mats.wood + ',' + p.mats.stone + ',' + p.mats.metal + ',' + p.buildMat + ',' + !!p.buildMode;
    if (sig === matSig) return; matSig = sig;
    E.mats.innerHTML = MAT_ORDER.map((k) => '<div class="mat' + (p.buildMode && p.buildMat === k ? ' sel' : '') + '">' + MAT_SVG[k] + '<span>' + p.mats[k] + '</span></div>').join('');
  }
  function updateBuildbar(p) {
    const sig = (p.buildMode || '') + p.buildMat;
    if (sig === buildSig) return; buildSig = sig;
    E.buildbar.hidden = !p.buildMode || IS_TOUCH;
    E.hotbar.style.visibility = p.buildMode && !IS_TOUCH ? 'hidden' : 'visible';
    for (const el of E.buildbar.children) el.classList.toggle('sel', el.dataset.p === p.buildMode);
    E['tb-pieces'].hidden = !p.buildMode;
    for (const el of E['tb-pieces'].children) el.classList.toggle('on', el.dataset.p === p.buildMode);
    E['tb-build'].classList.toggle('on', !!p.buildMode);
    E['tb-reload'].textContent = p.buildMode ? '⟳' : 'R';
  }
  function updateCompass(yaw) {
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const W = E['compass-strip'].clientWidth || 400, ppd = W / 150;
    for (const m of compassMarks) {
      let d = m.h - heading; d = ((d + 540) % 360) - 180;
      const x = W / 2 + d * ppd;
      if (Math.abs(d) > 80) { m.el.style.display = 'none'; continue; }
      m.el.style.display = ''; m.el.style.left = x.toFixed(1) + 'px';
    }
  }
  function drawMap(g, W, H, cx, cz, span, full) {
    const img = WORLD.mapCanvas, k = img.width / 1000, scale = W / span;
    g.fillStyle = '#1b5f99'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true;
    g.drawImage(img, (cx - span / 2 + 500) * k, (cz - span / 2 + 500) * k, span * k, span * k, 0, 0, W, H);
    const toX = (x) => (x - cx) * scale + W / 2, toY = (z) => (z - cz) * scale + H / 2;
    const S = STORM;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(toX(S.cur.x), toY(S.cur.z), Math.max(0, S.cur.r * scale), 0, TAU); g.fillStyle = 'rgba(138,52,222,.42)'; g.fill('evenodd'); g.restore();
    g.lineWidth = full ? 3 : 2; g.strokeStyle = 'rgba(214,168,255,.95)';
    g.beginPath(); g.arc(toX(S.cur.x), toY(S.cur.z), Math.max(0, S.cur.r * scale), 0, TAU); g.stroke();
    if (S.state !== 'done') { g.strokeStyle = '#fff'; g.setLineDash(full ? [10, 6] : [6, 4]); g.beginPath(); g.arc(toX(S.to.x), toY(S.to.z), Math.max(0, S.to.r * scale), 0, TAU); g.stroke(); g.setLineDash([]); }
    if (GAME.state === 'bus' || (player && player.mode === 'bus')) {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = full ? 4 : 3; g.setLineDash([2, full ? 8 : 6]); g.lineCap = 'round';
      g.beginPath(); g.moveTo(toX(BUS.start.x), toY(BUS.start.z)); g.lineTo(toX(BUS.end.x), toY(BUS.end.z)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffc62e'; g.beginPath(); g.arc(toX(BUS.pos.x), toY(BUS.pos.z), full ? 9 : 6, 0, TAU); g.fill();
    }
    for (const s of SUPPLY) {
      if (s.chest && s.chest.opened) continue;
      const x = toX(s.x), y = toY(s.z), q = full ? 9 : 6;
      g.fillStyle = '#3aa0ff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.fillRect(x - q, y - q, q * 2, q * 2); g.strokeRect(x - q, y - q, q * 2, q * 2);
    }
    if (full) {
      g.font = '800 ' + Math.round(W / 40) + 'px "Saira Extra Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const p of WORLD.pois) { const x = toX(p.x), y = toY(p.z); g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(p.name.toUpperCase(), x, y); g.fillStyle = '#fff'; g.fillText(p.name.toUpperCase(), x, y); }
    }
    const f = focusChar();
    if (f) {
      const inBus = f.mode === 'bus', fx = inBus ? BUS.pos.x : f.pos.x, fz = inBus ? BUS.pos.z : f.pos.z;
      const x = toX(fx), y = toY(fz), s = full ? 13 : 9;
      g.save(); g.translate(x, y); g.rotate(inBus ? -Math.atan2(-BUS.dir.x, -BUS.dir.z) : -f.yaw);
      g.fillStyle = '#ffc62e'; g.strokeStyle = '#1b1300'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.72, s * 0.8); g.lineTo(0, s * 0.4); g.lineTo(-s * 0.72, s * 0.8); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
  function crosshair(p) {
    const w = curWeapon(p);
    let spread = 0.02;
    if (w) { const def = WEAPONS[w.id]; spread = (p.aiming ? def.ads : def.spread) * (Math.hypot(p.vel.x, p.vel.z) > 1.5 ? 1.25 : 1) * (p.grounded ? 1 : 1.6) + p.bloom; }
    const px = Math.max(3, Math.tan(spread) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2);
    const ls = E.crosshair.children;
    ls[0].style.top = (-px - 9) + 'px'; ls[1].style.top = px + 'px'; ls[2].style.left = (-px - 9) + 'px'; ls[3].style.left = px + 'px';
    E.crosshair.classList.toggle('build', !!p.buildMode);
    E.crosshair.classList.toggle('enemy', !!(p.aimChar && p.aimChar.alive));
  }
  const api = {
    init,
    show(on) { E.hud.hidden = !on; E.touch.hidden = !(on && IS_TOUCH); },
    reset() { hotSig = matSig = buildSig = promptSig = ''; E.killfeed.innerHTML = ''; bannerT = toastT = 0; E.banner.style.opacity = '0'; E.elimtoast.style.opacity = '0'; for (const d of dds) { d.t = 0; d.el.style.opacity = '0'; } E['storm-tint'].style.opacity = '0'; E.flash.style.opacity = '0'; },
    feed(html) {
      const el = document.createElement('div'); el.className = 'kf'; el.innerHTML = html;
      E.killfeed.appendChild(el);
      while (E.killfeed.children.length > 5) E.killfeed.removeChild(E.killfeed.firstChild);
      setTimeout(() => { el.style.opacity = '0'; }, 6000); setTimeout(() => el.remove(), 6600);
    },
    banner(t, s, dur, cls) { E.banner.querySelector('.t').textContent = t; E.banner.querySelector('.s').textContent = s || ''; E.banner.className = cls || ''; E.banner.style.opacity = '1'; bannerT = dur || 2.5; },
    elimToast(name, n) { E.elimtoast.querySelector('.t').innerHTML = 'Eliminated <span></span>'; E.elimtoast.querySelector('.t span').textContent = name; E.elimtoast.querySelector('.s').textContent = n + (n === 1 ? ' elimination' : ' eliminations'); E.elimtoast.style.opacity = '1'; toastT = 2.2; },
    hitmarker(head) { E.hitmarker.className = head ? 'head' : ''; E.hitmarker.style.opacity = '1'; hitT = 0.14; },
    hurt(src) {
      flashT = 0.35; E.flash.style.opacity = '1';
      if (!src || src === player) return;
      let d = dds.find((q) => q.src === src) || dds.find((q) => q.t <= 0) || dds[0];
      d.src = src; d.t = 1.6; d.x = src.pos.x; d.z = src.pos.z;
    },
    matPop(mat, amt) { matSig = ''; },
    prompt(text, rarity) {
      const sig = text ? text + rarity : '';
      if (sig === promptSig) return; promptSig = sig;
      if (!text) { E.prompt.hidden = true; E['tb-use'].hidden = true; return; }
      E.prompt.hidden = IS_TOUCH; E.prompt.innerHTML = '<span class="key">E</span>';
      E.prompt.appendChild(document.createTextNode(text));
      E.prompt.style.borderLeftColor = RARITY[rarity || 0].css;
      E['tb-use'].hidden = !IS_TOUCH; E['tb-use'].textContent = text.startsWith('Open') ? 'OPEN' : 'PICK UP';
    },
    update(dt) {
      const p = player; if (!p) return;
      const f = focusChar() || p;
      E.hud.classList.toggle('spec', f !== p || !p.alive);
      setW(E['shield-fill'], Math.min(100, f.shield).toFixed(1) + '%'); setT(E['shield-num'], String(Math.ceil(f.shield)));
      setW(E['hp-fill'], clamp(f.hp, 0, 100).toFixed(1) + '%'); setT(E['hp-num'], String(Math.max(0, Math.ceil(f.hp))));
      setT(E.alive, String(GAME.alive)); setT(E.kills, String(p.kills));
      updateHotbar(p); updateMats(p); updateBuildbar(p);
      const w = curWeapon(p);
      const ammoKey = w && !p.buildMode && p.alive ? w.mag + '/' + p.ammo[WEAPONS[w.id].ammo] : '';
      if (E.ammo._k !== ammoKey) { E.ammo._k = ammoKey; if (ammoKey) { E.ammo.innerHTML = w.mag + '<small>' + p.ammo[WEAPONS[w.id].ammo] + '</small>'; E.ammo.className = w.mag === 0 ? 'empty' : ''; } else E.ammo.innerHTML = ''; }
      const S = STORM;
      if (S.state === 'wait') { setT(E['storm-text'], (S.idx === 0 ? 'Storm forms ' : 'Storm moves ') + fmtTime(S.timer)); E.stormline.classList.remove('shrinking'); }
      else if (S.state === 'shrink') { setT(E['storm-text'], 'Storm closing ' + fmtTime(S.timer)); E.stormline.classList.add('shrinking'); }
      else setT(E['storm-text'], 'Final storm');
      updateCompass(CAM.yaw);
      crosshair(p);
      E.crosshair.style.display = (p.alive && p.mode === 'ground' && !CAM.scoped && GAME.state !== 'won') ? '' : 'none';
      E.scope.hidden = !CAM.scoped;
      if (p.alive && (p.reloadT > 0 || p.using)) {
        E.progress.hidden = false;
        const frac = p.using ? p.useT / p.useTotal : 1 - p.reloadT / p.reloadTotal;
        E['progress-label'].textContent = p.using ? 'Using ' + CONSUMABLES[p.using.id].name : 'Reloading';
        E['progress-fill'].style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
      } else E.progress.hidden = true;
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) E.banner.style.opacity = '0'; }
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) E.elimtoast.style.opacity = '0'; }
      if (hitT > 0) { hitT -= dt; if (hitT <= 0) E.hitmarker.style.opacity = '0'; }
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) E.flash.style.opacity = '0'; }
      for (const d of dds) {
        if (d.t <= 0) continue; d.t -= dt;
        if (!p.alive) d.t = 0;
        if (d.src && d.src.alive) { d.x = d.src.pos.x; d.z = d.src.pos.z; }
        const ang = Math.atan2(-(d.x - p.pos.x), -(d.z - p.pos.z)), rel = angleDiff(CAM.yaw, ang);
        d.el.style.transform = 'rotate(' + (-rel * 180 / Math.PI).toFixed(1) + 'deg)';
        d.el.style.opacity = Math.min(1, d.t).toFixed(2);
        if (d.t <= 0) d.src = null;
      }

      mmT -= dt;
      if (mmT <= 0) { mmT = 1 / 30; const fc = focusChar() || p; drawMap(mm, 368, 368, fc.mode === 'bus' ? BUS.pos.x : fc.pos.x, fc.mode === 'bus' ? BUS.pos.z : fc.pos.z, fc.mode === 'bus' ? 520 : 220, false); if (!E.bigmap.hidden) drawMap(bm, 900, 900, 0, 0, 1000, true); }
    },
    hideBanner() { bannerT = 0; E.banner.style.opacity = '0'; },
    toggleMap(on) { E.bigmap.hidden = on === undefined ? !E.bigmap.hidden : !on; if (!E.bigmap.hidden) drawMap(bm, 900, 900, 0, 0, 1000, true); },
  };
  return api;
})();
