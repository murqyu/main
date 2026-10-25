// ---------- input: keyboard, mouse, pointer lock, touch ----------
const INPUT = (() => {
  const keys = {}, pressed = new Set();
  let dx = 0, dy = 0, wheel = 0, mouseL = false, mouseR = false, locked = false, expectUnlock = false;
  const T = { jx: 0, jy: 0, joyId: null, jox: 0, joyY: 0, looks: new Map(), fire: 0, aim: false, crouch: false, useHeld: false };
  const canvas = document.getElementById('c');
  const GAME_KEYS = new Set(['Space', 'Tab', 'F1', 'F2', 'F3', 'F4', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  function inGame() { return GAME.state !== 'menu' && !GAME.paused; }
  function init() {
    addEventListener('keydown', (e) => {
      if (GAME.state === 'menu') return;
      const k = e.code;
      if (k === 'Escape' && INV.open) { INV.toggle(false); return; }
      if (k === 'Escape') { if (locked) document.exitPointerLock(); else if (GAME.paused) resume(); else pause(); return; }
      if (GAME_KEYS.has(k) || k.startsWith('Key') || k.startsWith('Digit') || k.startsWith('Shift')) e.preventDefault();
      if (e.repeat) return;
      keys[k] = true; pressed.add(k);
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; T.fire = 0; T.looks.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!inGame()) return;
      try { canvas.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      if (!locked && !IS_TOUCH) requestLock();
      if (e.button === 0) { mouseL = true; pressed.add('Mouse0'); }
      if (e.button === 2) { mouseR = true; pressed.add('Mouse2'); }
      if (e.button === 1) { e.preventDefault(); pressed.add('Mouse1'); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!inGame()) return;
      if (locked || (!IS_TOUCH && (e.buttons & 3))) { dx += e.movementX || 0; dy += e.movementY || 0; }
    });
    canvas.addEventListener('wheel', (e) => { if (inGame()) { wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
      if (!locked) { if (!expectUnlock && GAME.state !== 'menu' && !GAME.paused && document.getElementById('endscreen').hidden) pause(); expectUnlock = false; }
    });
    initTouch();
  }
  function initTouch() {
    const $ = (id) => document.getElementById(id);
    const look = $('look-zone'), joyZ = $('joy-zone'), joy = $('joy'), knob = $('joy-knob'), R = 52;
    joyZ.addEventListener('pointerdown', (e) => {
      if (T.joyId !== null) return; e.preventDefault();
      T.joyId = e.pointerId; joyZ.setPointerCapture(e.pointerId); T.jox = e.clientX; T.joyY = e.clientY;
      joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; T.jx = T.jy = 0; knob.style.transform = '';
    });
    joyZ.addEventListener('pointermove', (e) => {
      if (e.pointerId !== T.joyId) return;
      let x = e.clientX - T.jox, y = e.clientY - T.joyY; const l = Math.hypot(x, y);
      if (l > R) { x *= R / l; y *= R / l; }
      T.jx = x / R; T.jy = y / R; knob.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    const endJoy = (e) => { if (e.pointerId !== T.joyId) return; T.joyId = null; T.jx = T.jy = 0; knob.style.transform = ''; joy.style.left = ''; joy.style.top = ''; };
    joyZ.addEventListener('pointerup', endJoy); joyZ.addEventListener('pointercancel', endJoy);
    const lookStart = (el, e, fire) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } T.looks.set(e.pointerId, { x: e.clientX, y: e.clientY, fire }); if (fire) { T.fire++; pressed.add('Mouse0'); el.classList.add('on'); } SFX.init(); };
    const lookMove = (e) => { const L = T.looks.get(e.pointerId); if (!L) return; dx += (e.clientX - L.x) * 2.2; dy += (e.clientY - L.y) * 2.2; L.x = e.clientX; L.y = e.clientY; };
    const lookEnd = (e) => { const L = T.looks.get(e.pointerId); if (!L) return; if (L.fire) { T.fire = Math.max(0, T.fire - 1); e.currentTarget.classList.remove('on'); } T.looks.delete(e.pointerId); };
    look.addEventListener('pointerdown', (e) => lookStart(look, e, false));
    for (const id of ['tb-fire', 'tb-fire2']) { const b = $(id); b.addEventListener('pointerdown', (e) => lookStart(b, e, true)); b.addEventListener('pointermove', lookMove); b.addEventListener('pointerup', lookEnd); b.addEventListener('pointercancel', lookEnd); }
    look.addEventListener('pointermove', lookMove); look.addEventListener('pointerup', lookEnd); look.addEventListener('pointercancel', lookEnd);
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
    tap('tb-jump', () => pressed.add('Space'));
    tap('tb-crouch', () => { T.crouch = !T.crouch; $('tb-crouch').classList.toggle('on', T.crouch); if (T.crouch) pressed.add('TouchCrouch'); });
    tap('tb-reload', () => pressed.add('KeyR'));
    tap('tb-build', () => pressed.add('KeyQ'));
    tap('tb-edit', () => pressed.add('KeyG'));
    tap('tb-use', () => { pressed.add('KeyE'); T.useHeld = true; });
    $('tb-use').addEventListener('pointerup', () => { T.useHeld = false; }); $('tb-use').addEventListener('pointercancel', () => { T.useHeld = false; });
    tap('tb-map', () => pressed.add('KeyM'));
    tap('tb-ping', () => pressed.add('TouchPing'));
    tap('tb-inv', () => pressed.add('KeyI'));
    tap('tb-pause', () => pause());
    tap('tb-aim', () => { if (player && player.buildMode) pressed.add('Mouse2'); else { T.aim = !T.aim; $('tb-aim').classList.toggle('on', T.aim); } });
    $('tb-pieces').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-p]'); if (!b) return; e.preventDefault();
      const p = b.dataset.p; pressed.add(p === 'wall' ? 'KeyZ' : p === 'floor' ? 'KeyX' : p === 'ramp' ? 'KeyV' : p === 'cone' ? 'KeyB' : 'Mouse2');
    });
    $('hotbar').addEventListener('pointerdown', (e) => {
      const s = e.target.closest('[data-slot]'); if (!s) return; e.preventDefault();
      const i = +s.dataset.slot; pressed.add(i < 0 ? 'KeyF' : 'Digit' + (i + 1));
    });
  }
  return {
    init,
    get dx() { return dx; }, get dy() { return dy; },
    get locked() { return locked; },
    expectUnlock() { expectUnlock = !!document.pointerLockElement; },
    clearCrouch() { T.crouch = false; const b = document.getElementById('tb-crouch'); if (b) b.classList.remove('on'); },
    clearAim() { T.aim = false; const b = document.getElementById('tb-aim'); if (b) b.classList.remove('on'); },
    actions() {
      const A = {};
      A.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + T.jx;
      A.my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - T.jy;
      A.sprint = !!(keys.ShiftLeft || keys.ShiftRight) || Math.hypot(T.jx, T.jy) > 0.96;
      A.jump = pressed.has('Space');
      A.crouch = !!keys.KeyC || T.crouch;
      A.crouchPressed = pressed.has('KeyC') || pressed.has('TouchCrouch');
      A.emote = pressed.has('KeyT');
      A.inventory = pressed.has('Tab') || pressed.has('KeyI');
      A.ping = pressed.has('Mouse1') || pressed.has('TouchPing');
      A.fire = mouseL || T.fire > 0;
      A.firePressed = pressed.has('Mouse0');
      A.aim = mouseR || T.aim;
      A.aimPressed = pressed.has('Mouse2');
      A.reload = pressed.has('KeyR');
      A.interact = pressed.has('KeyE');
      A.interactHeld = !!keys.KeyE || T.useHeld;
      A.pickaxe = pressed.has('KeyF');
      A.buildToggle = pressed.has('KeyQ');
      A.edit = pressed.has('KeyG');
      A.piece = (pressed.has('KeyZ') || pressed.has('F1')) ? 'wall' : (pressed.has('KeyX') || pressed.has('F2')) ? 'floor' : (pressed.has('KeyV') || pressed.has('F3')) ? 'ramp' : (pressed.has('KeyB') || pressed.has('F4')) ? 'cone' : null;
      A.slotKey = -1; for (let i = 1; i <= 5; i++) if (pressed.has('Digit' + i)) A.slotKey = i - 1;
      A.wheel = wheel;
      A.map = pressed.has('KeyM');
      return A;
    },
    endFrame() { dx = 0; dy = 0; wheel = 0; pressed.clear(); },
  };
})();
