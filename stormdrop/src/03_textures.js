// ---------- procedural textures + shared materials ----------
const TEX = {}, MAT = {};
function canvasTex(w, h, draw, rep, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep !== true) t.repeat.set(rep, rep); }
  return t;
}
// grey detail texture whose mean sits around 0.8; the terrain shader multiplies it back up
function detailTex(size, draw) { return canvasTex(size, size, (g, w, h) => { g.fillStyle = 'rgb(204,204,204)'; g.fillRect(0, 0, w, h); draw(g, w, h); }, true, false); }
function makeTextures() {
  const R = Math.random;
  TEX.wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4e321a'; g.fillRect(0, 0, w, h);
    const cols = ['#c08a4f', '#ad783f', '#c99657', '#b17d45'];
    for (let i = 0; i < 4; i++) {
      const y = 18 + i * 56;
      const gr = g.createLinearGradient(0, y, 0, y + 50); gr.addColorStop(0, cols[i]); gr.addColorStop(1, '#8e5f31'); g.fillStyle = gr; g.fillRect(18, y, w - 36, 50);
      g.strokeStyle = 'rgba(80,45,15,.35)'; g.lineWidth = 1.5;
      for (let k = 0; k < 9; k++) { const yy = y + 4 + R() * 42; g.beginPath(); g.moveTo(18, yy); g.bezierCurveTo(90, yy + R() * 6 - 3, 170, yy + R() * 6 - 3, w - 18, yy + R() * 4 - 2); g.stroke(); }
      g.fillStyle = 'rgba(255,230,190,.12)'; g.fillRect(18, y, w - 36, 4);
      g.fillStyle = '#3a2410'; for (const x of [32, w - 38]) { g.beginPath(); g.arc(x, y + 25, 4, 0, TAU); g.fill(); }
    }
    g.strokeStyle = '#3d2610'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
    g.strokeStyle = 'rgba(255,220,170,.22)'; g.lineWidth = 3; g.strokeRect(19, 19, w - 38, h - 38);
  });
  TEX.stone = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#50545b'; g.fillRect(0, 0, w, h);
    const bh = 40;
    for (let r = 0; r < 6; r++) {
      const off = (r % 2) * 40;
      for (let c = -1; c < 4; c++) {
        const x = c * 80 + off + 14, y = r * bh + 12, v = 140 + R() * 50 | 0;
        const gr = g.createLinearGradient(x, y, x, y + bh - 6); gr.addColorStop(0, `rgb(${v + 20},${v + 22},${v + 28})`); gr.addColorStop(1, `rgb(${v - 15},${v - 13},${v - 8})`);
        g.fillStyle = gr; g.fillRect(x, y, 72, bh - 6);
        for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.15})`; g.fillRect(x + R() * 70, y + R() * (bh - 8), 2, 2); }
      }
    }
    g.strokeStyle = '#3a3d42'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
  });
  TEX.metal = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#b3c2cf'); gr.addColorStop(1, '#6f7f8e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 24; x < w - 20; x += 24) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, 20, 6, h - 40); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 6, 20, 4, h - 40); }
    g.fillStyle = '#434d57';
    for (const [x, y] of [[24, 24], [w - 34, 24], [24, h - 34], [w - 34, h - 34], [w / 2 - 5, 24], [w / 2 - 5, h - 34]]) { g.beginPath(); g.arc(x + 5, y + 5, 5, 0, TAU); g.fill(); }
    g.strokeStyle = '#353e47'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
  });
  TEX.siding = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(0, y + 12, w, 4); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, y, w, 2); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  });
  TEX.concrete = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 165 + R() * 75 | 0; g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, h - 7, w, 7); g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  });
  TEX.brick = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8ddd0'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) { const off = (r % 2) * 16; for (let c = -1; c < 5; c++) { const v = R() * 30 | 0; g.fillStyle = `rgb(${190 + v},${150 + v / 2},${140 + v / 2})`; g.fillRect(c * 32 + off + 1, r * 12.8 + 1, 30, 10.8); } }
  });
  TEX.roof = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const off = (r % 2) * 8; g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, r * 8 + 6, w, 2); for (let c = 0; c < 5; c++) g.fillRect(c * 16 + off, r * 8, 2, 8); }
  });
  // terrain detail (linear data, not colour)
  TEX.dGrass = detailTex(256, (g, w, h) => { for (let i = 0; i < 9000; i++) { const v = 150 + R() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; const x = R() * w, y = R() * h; g.fillRect(x, y, 1 + R() * 1.5, 2 + R() * 5); } });
  TEX.dDirt = detailTex(256, (g, w, h) => { for (let i = 0; i < 2600; i++) { const v = 130 + R() * 120 | 0, s = 1 + R() * 4; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(R() * w, R() * h, s, 0, TAU); g.fill(); } });
  TEX.dSand = detailTex(256, (g, w, h) => { for (let y = 0; y < h; y += 2) { const v = 190 + Math.sin(y * 0.25 + Math.sin(y * 0.05) * 3) * 25 | 0; g.fillStyle = `rgba(${v},${v},${v},.7)`; g.fillRect(0, y, w, 2); } for (let i = 0; i < 6000; i++) { const v = 160 + R() * 95 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * w, R() * h, 1, 1); } });
  TEX.dRock = detailTex(256, (g, w, h) => { for (let i = 0; i < 60; i++) { const v = 140 + R() * 100 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x + R() * 70 - 35, y + R() * 70 - 35); g.fill(); } g.strokeStyle = 'rgba(70,70,70,.6)'; g.lineWidth = 1.5; for (let i = 0; i < 40; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += R() * 30 - 15; y += R() * 30 - 15; g.lineTo(x, y); } g.stroke(); } });
  TEX.noise = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data, p1 = makePerlin(Math.random), p2 = makePerlin(Math.random);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tile = (fn, s) => { const u = x / w, v = y / h; const a = fn(u * s, v * s), b = fn((u - 1) * s, v * s), c = fn(u * s, (v - 1) * s), e = fn((u - 1) * s, (v - 1) * s); return lerp(lerp(a, b, u), lerp(c, e, u), v); };
      const k = (y * w + x) * 4; d[k] = (tile(p1, 4) * 0.5 + 0.5) * 255; d[k + 1] = (tile(p2, 16) * 0.5 + 0.5) * 255; d[k + 2] = 128; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, true, false);
}
function makeMaterials() {
  MAT.build = {
    wood: new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.88 }),
    metal: new THREE.MeshStandardMaterial({ map: TEX.metal, roughness: 0.42, metalness: 0.55 }),
  };
  MAT.ghost = new THREE.MeshBasicMaterial({ color: 0x3a9cff, transparent: true, opacity: 0.3, depthWrite: false });
  MAT.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.28, depthWrite: false });
  MAT.gunDark = lam(0x24282e, { roughness: 0.45, metalness: 0.6 }); MAT.gunMid = lam(0x4a505a, { roughness: 0.5, metalness: 0.45 }); MAT.gunWood = lam(0x7a4a26, { roughness: 0.7 });
  MAT.rarity = [0x9aa3ad, 0x4fcf4a, 0x3aa0ff, 0xb45cff, 0xff9e2c, 0xffd23f].map((c) => lam(c, { emissive: c, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 }));
  MAT.chestGold = lam(0xf2b632, { emissive: 0x8a5a00, emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.75 });
  MAT.chestDark = lam(0x5a3412, { roughness: 0.7 });
  MAT.trunk = lam(0x6e4a2e, { roughness: 0.95 });
  MAT.leaf = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), 0.35, 4);
  MAT.rock = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 });
  MAT.bush = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 }), 0.12, 1.4);
  for (const k of ['ghost', 'ghostBad', 'leaf', 'rock', 'bush']) MAT[k].userData.keep = true;
  for (const k in MAT.build) MAT.build[k].userData.keep = true;
}
function sidingMat(hex) { return lam(hex, { map: TEX.siding, roughness: 0.75 }); }
function concreteMat(hex) { return lam(hex, { map: TEX.concrete, roughness: 0.9 }); }
function brickMat(hex) { return lam(hex, { map: TEX.brick, roughness: 0.88 }); }
function roofMat(hex) { return lam(hex, { map: TEX.roof, roughness: 0.7 }); }
function metalMat(hex) { return lam(hex, { map: TEX.metal, roughness: 0.45, metalness: 0.5 }); }
function woodMat(hex) { return lam(hex, { map: TEX.wood, roughness: 0.8 }); }
