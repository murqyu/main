// ---------- procedural textures + shared materials ----------
const TEX = {}, MAT = {};
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  return t;
}
function makeTextures() {
  const R = Math.random;
  TEX.wood = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, w, h);
    const cols = ['#c08a4f', '#ad783f', '#c99657', '#b17d45'];
    for (let i = 0; i < 4; i++) {
      const y = 9 + i * 28;
      g.fillStyle = cols[i]; g.fillRect(9, y, w - 18, 25);
      g.strokeStyle = 'rgba(90,50,20,.32)'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { const yy = y + 3 + R() * 19; g.beginPath(); g.moveTo(9, yy); g.bezierCurveTo(45, yy + R() * 4 - 2, 85, yy + R() * 4 - 2, w - 9, yy + R() * 3 - 1.5); g.stroke(); }
      g.fillStyle = 'rgba(55,30,12,.7)'; g.fillRect(16, y + 10, 3, 3); g.fillRect(w - 19, y + 10, 3, 3);
    }
    g.strokeStyle = '#4a2d15'; g.lineWidth = 9; g.strokeRect(4.5, 4.5, w - 9, h - 9);
    g.strokeStyle = 'rgba(255,220,170,.25)'; g.lineWidth = 2; g.strokeRect(9, 9, w - 18, h - 18);
  });
  TEX.stone = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5b5f66'; g.fillRect(0, 0, w, h);
    const bh = 20;
    for (let r = 0; r < 6; r++) {
      const off = (r % 2) * 20;
      for (let c = -1; c < 4; c++) {
        const x = c * 40 + off + 7, y = r * bh + 6;
        const v = 150 + R() * 40 | 0;
        g.fillStyle = `rgb(${v},${v + 3},${v + 8})`; g.fillRect(x, y, 36, bh - 3);
        g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, 36, 3);
      }
    }
    g.strokeStyle = '#43464c'; g.lineWidth = 9; g.strokeRect(4.5, 4.5, w - 9, h - 9);
  });
  TEX.metal = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#a8b8c6'); gr.addColorStop(1, '#748493');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 12; x < w - 10; x += 12) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, 10, 3, h - 20); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 3, 10, 2, h - 20); }
    g.fillStyle = '#48525c';
    for (const [x, y] of [[12, 12], [w - 17, 12], [12, h - 17], [w - 17, h - 17], [w / 2 - 2, 12], [w / 2 - 2, h - 17]]) g.fillRect(x, y, 5, 5);
    g.strokeStyle = '#38414a'; g.lineWidth = 9; g.strokeRect(4.5, 4.5, w - 9, h - 9);
  });
  TEX.siding = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.11)'; g.fillRect(0, y + 12, w, 4); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, y, w, 2); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  });
  TEX.concrete = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = 170 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, h - 7, w, 7); g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  });
  TEX.brick = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8ddd0'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 10; r++) { const off = (r % 2) * 16; for (let c = -1; c < 5; c++) { const v = R() * 30 | 0; g.fillStyle = `rgb(${190 + v},${150 + v / 2},${140 + v / 2})`; g.fillRect(c * 32 + off + 1, r * 12.8 + 1, 30, 10.8); } }
  });
  TEX.roof = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const off = (r % 2) * 8; g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, r * 8 + 6, w, 2); for (let c = 0; c < 5; c++) g.fillRect(c * 16 + off, r * 8, 2, 8); }
  });
  TEX.grass = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 205 + R() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 3); }
  }, 170);
}
function makeMaterials() {
  MAT.build = {
    wood: new THREE.MeshLambertMaterial({ map: TEX.wood }),
    stone: new THREE.MeshLambertMaterial({ map: TEX.stone }),
    metal: new THREE.MeshLambertMaterial({ map: TEX.metal }),
  };
  MAT.ghost = new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.36, depthWrite: false });
  MAT.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.3, depthWrite: false });
  MAT.gunDark = lam(0x2b2f36); MAT.gunMid = lam(0x4a505a); MAT.gunWood = lam(0x7a4a26);
  MAT.rarity = [0x9aa3ad, 0x4fcf4a, 0x3aa0ff, 0xb45cff, 0xff9e2c].map((c) => lam(c, { emissive: c, emissiveIntensity: 0.25 }));
  MAT.chestGold = lam(0xf2b632, { emissive: 0x6a4200 });
  MAT.chestDark = lam(0x6b3f12);
  MAT.trunk = lam(0x7a5233);
  MAT.leaf = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  MAT.rock = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  MAT.bush = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  for (const k of ['ghost', 'ghostBad', 'leaf', 'rock', 'bush']) MAT[k].userData.keep = true;
  for (const k in MAT.build) MAT.build[k].userData.keep = true;
}
function sidingMat(hex) { return lam(hex, { map: TEX.siding }); }
function concreteMat(hex) { return lam(hex, { map: TEX.concrete }); }
function brickMat(hex) { return lam(hex, { map: TEX.brick }); }
function roofMat(hex) { return lam(hex, { map: TEX.roof }); }
function metalMat(hex) { return lam(hex, { map: TEX.metal }); }
function woodMat(hex) { return lam(hex, { map: TEX.wood }); }
