// Platonic solids, their faces, and a non-overlapping net (spanning tree of faces)
const PHI = (1 + Math.sqrt(5)) / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(...a), norm = a => mul(a, 1 / len(a));
const signs = (arr) => arr.reduce((out, v) => out.flatMap(o => (v === 0 ? [0] : [v, -v]).map(s => [...o, s])), [[]]);
function verts(kind) {
  const p = PHI, q = 1 / PHI, V = [];
  const push = (base) => signs(base).forEach(v => V.push(v));
  if (kind === 'tetra') return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  if (kind === 'cube') push([1, 1, 1]);
  if (kind === 'octa') { push([1, 0, 0]); push([0, 1, 0]); push([0, 0, 1]); }
  if (kind === 'icosa') { push([0, 1, p]); push([1, p, 0]); push([p, 0, 1]); }
  if (kind === 'dodeca') { push([1, 1, 1]); push([0, q, p]); push([q, p, 0]); push([p, 0, q]); }
  return V;
}
// faces = supporting planes of the convex hull, vertices ordered counter-clockwise from outside
function solid(kind) {
  let V = verts(kind); const n = V.length;
  let e = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e = Math.min(e, len(sub(V[i], V[j])));
  V = V.map(v => mul(v, 1 / e)); // edge length 1
  const F = [], seen = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nr = cross(sub(V[j], V[i]), sub(V[k], V[i])); if (len(nr) < 1e-9) continue; nr = norm(nr);
    let d = dot(nr, V[i]); if (d < 0) { nr = mul(nr, -1); d = -d; }
    if (V.some(v => dot(nr, v) > d + 1e-9)) continue;
    const on = V.map((v, m) => Math.abs(dot(nr, v) - d) < 1e-9 ? m : -1).filter(m => m >= 0), key = on.join(',');
    if (seen.has(key)) continue; seen.add(key);
    const c = on.reduce((s, m) => add(s, V[m]), [0, 0, 0]).map(x => x / on.length), u = norm(sub(V[on[0]], c)), w = cross(nr, u);
    on.sort((a, b) => Math.atan2(dot(sub(V[a], c), w), dot(sub(V[a], c), u)) - Math.atan2(dot(sub(V[b], c), w), dot(sub(V[b], c), u)));
    F.push({ v: on, n: nr, c });
  }
  // face adjacency through shared edges
  const adj = F.map(() => []);
  F.forEach((f, a) => F.forEach((g, b) => { if (a < b) { const s = f.v.filter(x => g.v.includes(x)); if (s.length === 2) { adj[a].push([b, s]); adj[b].push([a, s]); } } }));
  return { V, F, adj };
}
// 4x4 column-major matrices (same layout as THREE.Matrix4.elements)
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mm(a, b) { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rI = 0; rI < 4; rI++) for (let k = 0; k < 4; k++) r[c * 4 + rI] += a[k * 4 + rI] * b[c * 4 + k]; return r; }
const ap = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
function rot(p, ax, t) { // rotation by t around the line through p with direction ax
  const [x, y, z] = norm(ax), c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  const R = [c + x * x * C, y * x * C + z * s, z * x * C - y * s, 0, x * y * C - z * s, c + y * y * C, z * y * C + x * s, 0, x * z * C + y * s, y * z * C - x * s, c + z * z * C, 0, 0, 0, 0, 1];
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1], Ti = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1];
  return mm(T, mm(R, Ti));
}
// hinge of face f to its parent: axis, point, and the signed angle that lays f flat onto the parent's plane
function hinge(S, f, p, shared) {
  const a = S.V[shared[0]], b = S.V[shared[1]], ax = sub(b, a), nf = S.F[f].n, np = S.F[p].n, ang = Math.acos(Math.max(-1, Math.min(1, dot(nf, np))));
  const t = [ang, -ang].find(t => dot(norm(sub(ap(rot(a, ax, t), add(a, nf)), a)), np) > 1 - 1e-6);
  return { a, ax, t };
}
// world matrix of every face for fold amounts k[f] (1 = folded into the solid, 0 = flat)
function poses(S, net, k) {
  const M = [];
  net.order.forEach(f => { const h = net.h[f]; M[f] = h ? mm(M[net.parent[f]], rot(h.a, h.ax, h.t * (1 - k[f]))) : net.base; });
  return M;
}
// root face lies on the floor (y = 0), solid above it
function baseMatrix(S, r) {
  const n = S.F[r].n, c = S.F[r].c, to = [0, -1, 0], ax = cross(n, to), ang = Math.acos(Math.max(-1, Math.min(1, dot(n, to))));
  let R = len(ax) < 1e-9 ? (dot(n, to) > 0 ? I() : rot([0, 0, 0], [1, 0, 0], Math.PI)) : rot([0, 0, 0], ax, ang);
  const cc = ap(R, c); return mm([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cc[0], -cc[1], -cc[2], 1], R);
}
function convexOverlap(A, B) { // 2D polygons (shrunk), separating axis test
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], nx = q[1] - p[1], ny = p[0] - q[0];
    const pa = A.map(v => v[0] * nx + v[1] * ny), pb = B.map(v => v[0] * nx + v[1] * ny);
    if (Math.max(...pa) < Math.min(...pb) + 1e-9 || Math.max(...pb) < Math.min(...pa) + 1e-9) return false; }
  return true;
}
function flat2D(S, net) {
  const k = S.F.map(() => 0), M = poses(S, net, k);
  return S.F.map((f, i) => { const P = f.v.map(v => ap(M[i], S.V[v])), c = P.reduce((s, p) => add(s, p), [0, 0, 0]).map(x => x / P.length);
    return P.map(p => { const q = add(c, mul(sub(p, c), 0.98)); return [q[0], q[2]]; }); });
}
// seeded search for a compact net whose faces never overlap
function buildNet(S, seed = 1) {
  let rnd = seed; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let best = null;
  for (let tries = 0; tries < 400; tries++) {
    const parent = S.F.map(() => -1), order = [0], h = [], used = new Set([0]), q = [0];
    while (q.length) { const f = q.shift(), nb = S.adj[f].slice().sort(() => tries ? rand() - .5 : 0);
      nb.forEach(([g, s]) => { if (used.has(g)) return; used.add(g); parent[g] = f; h[g] = hinge(S, g, f, s); order.push(g); q.push(g); }); }
    const net = { parent, order, h, base: baseMatrix(S, 0) }, P = flat2D(S, net);
    let ok = true; for (let i = 0; i < P.length && ok; i++) for (let j = i + 1; j < P.length; j++) if (convexOverlap(P[i], P[j])) { ok = false; break; }
    if (!ok) continue;
    const xs = P.flat().map(p => p[0]), zs = P.flat().map(p => p[1]), size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    if (!best || size < best.size) best = { net, size, cx: (Math.max(...xs) + Math.min(...xs)) / 2, cz: (Math.max(...zs) + Math.min(...zs)) / 2 };
  }
  return best;
}
if (typeof module !== 'undefined') module.exports = { solid, buildNet, poses, ap };
