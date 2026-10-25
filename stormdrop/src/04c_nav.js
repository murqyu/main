// ---------- navigation: 1 m walkability grid + A* with path smoothing ----------
const NAV = (() => {
  const S = 1; let MIN = -480, N = 960, NN = N * N;
  let grid = null, g = null, par = null, stamp = null, gen = 1;
  let heapI = null, heapF = null, hn = 0;
  const idx = (x, z) => { const i = Math.floor((x - MIN) / S), j = Math.floor((z - MIN) / S); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  function build() {
    const want = Math.round((WORLD.half - 20) * 2);
    if (grid && want !== N) grid = null;
    MIN = -(WORLD.half - 20); N = want; NN = N * N;
    if (!grid) { grid = new Uint8Array(NN); g = new Float32Array(NN); par = new Int32Array(NN); stamp = new Uint32Array(NN); heapI = new Int32Array(1 << 17); heapF = new Float32Array(1 << 17); }
    grid.fill(0);
    // deep water is not walkable
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) if (groundH(MIN + (i + 0.5) * S, MIN + (j + 0.5) * S) < -2) grid[j * N + i] = 1;
    // anything solid between knee and head height blocks, inflated by a body radius
    const R = 0.4;
    for (const c of colliders) {
      if (c.shape !== 'box' || c.piece || c.vehicle || c.kind === 'gadget') continue;
      const gy = groundH((c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2);
      if (c.maxY < gy + 0.65 || c.minY > gy + 1.9) continue;
      const i0 = Math.max(0, Math.floor((c.minX - R - MIN) / S)), i1 = Math.min(N - 1, Math.floor((c.maxX + R - MIN) / S));
      const j0 = Math.max(0, Math.floor((c.minZ - R - MIN) / S)), j1 = Math.min(N - 1, Math.floor((c.maxZ + R - MIN) / S));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * N + i] = 1;
    }
  }
  const free = (k) => k >= 0 && grid[k] === 0;
  function nearestFree(k, r) {
    if (free(k)) return k;
    const i0 = k % N, j0 = (k / N) | 0;
    for (let d = 1; d <= r; d++) for (let dj = -d; dj <= d; dj++) for (let di = -d; di <= d; di++) {
      if (Math.abs(di) !== d && Math.abs(dj) !== d) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const q = j * N + i; if (grid[q] === 0) return q;
    }
    return -1;
  }
  function push(k, f) { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapI[i] = heapI[p]; heapF[i] = heapF[p]; i = p; } heapI[i] = k; heapF[i] = f; }
  function pop() {
    const top = heapI[0], k = heapI[--hn], f = heapF[hn]; let i = 0;
    for (;;) { let c = i * 2 + 1; if (c >= hn) break; if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= f) break; heapI[i] = heapI[c]; heapF[i] = heapF[c]; i = c; }
    heapI[i] = k; heapF[i] = f; return top;
  }
  // straight walkable line between two cells (supercover-ish stepping)
  function lineFree(a, b) {
    let x0 = a % N, y0 = (a / N) | 0; const x1 = b % N, y1 = (b / N) | 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
    for (let n = 0; n < 2000; n++) {
      if (grid[y0 * N + x0]) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      if (grid[y0 * N + x0 - sx] && grid[(y0 - sy) * N + x0]) return false;
    }
    return false;
  }
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
  function find(sx, sz, tx, tz, maxExp) {
    if (!grid) return null;
    let s = nearestFree(idx(sx, sz), 3), t = nearestFree(idx(tx, tz), 6);
    if (s < 0 || t < 0) return null;
    if (lineFree(s, t)) return [[tx, tz]];
    gen++; if (gen > 4e9) { stamp.fill(0); gen = 1; }
    hn = 0; const ti = t % N, tj = (t / N) | 0;
    g[s] = 0; par[s] = -1; stamp[s] = gen; push(s, 0);
    let exp = 0, found = false;
    maxExp = maxExp || 25000;
    while (hn > 0 && exp < maxExp) {
      const k = pop(); exp++;
      if (k === t) { found = true; break; }
      const ki = k % N, kj = (k / N) | 0, gk = g[k];
      for (let d = 0; d < 8; d++) {
        const i = ki + DI[d], j = kj + DJ[d]; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const q = j * N + i; if (grid[q]) continue;
        if (d >= 4 && (grid[kj * N + i] || grid[j * N + ki])) continue;   // no corner cutting
        const ng = gk + (d < 4 ? 1 : 1.4142);
        if (stamp[q] === gen && ng >= g[q]) continue;
        stamp[q] = gen; g[q] = ng; par[q] = k;
        const di = Math.abs(i - ti), dj = Math.abs(j - tj);
        if (hn < heapI.length - 1) push(q, ng + (di + dj) + (1.4142 - 2) * Math.min(di, dj));
      }
    }
    if (!found) return null;
    const cells = []; for (let k = t; k >= 0; k = par[k]) cells.push(k);
    cells.reverse();
    // string-pull: keep only the turns we cannot see past
    const out = []; let a = 0;
    while (a < cells.length - 1) {
      let b = a + 1;
      for (let k = a + 2; k < cells.length; k += 2) { if (lineFree(cells[a], cells[k])) b = k; else break; }
      if (b < cells.length - 1 && lineFree(cells[a], cells[cells.length - 1])) b = cells.length - 1;
      out.push([MIN + ((cells[b] % N) + 0.5) * S, MIN + (((cells[b] / N) | 0) + 0.5) * S]);
      a = b;
    }
    if (out.length) out[out.length - 1] = [tx, tz];
    return out;
  }
  return { build, find, blocked: (x, z) => { const k = idx(x, z); return k < 0 || grid[k] === 1; }, get ready() { return !!grid; } };
})();
