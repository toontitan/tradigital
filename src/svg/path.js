// SVG path data -> subpaths of absolute segments (L, Q, C). Arcs become cubics.
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d) {
  const out = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) out.push(m[1] ? m[1] : parseFloat(m[2]));
  return out;
}

function arcToCubics(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [{ t: 'L', p: [x2, y2] }];
  const phi = (phiDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI; else if (fs && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
  const step = dth / n, k = (4 / 3) * Math.tan(step / 4), segs = [];
  const pt = (t) => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const dv = (t) => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  for (let i = 0; i < n; i++) {
    const a = th1 + i * step, b = a + step, p0 = pt(a), p3 = i === n - 1 ? [x2, y2] : pt(b);
    const d0 = dv(a), d3 = dv(b);
    segs.push({ t: 'C', c1: [p0[0] + k * d0[0], p0[1] + k * d0[1]], c2: [p3[0] - k * d3[0], p3[1] - k * d3[1]], p: p3 });
  }
  return segs;
}

/** @returns {{start:number[], segs:object[], closed:boolean}[]} */
export function parsePath(d) {
  const tk = tokenize(d), subs = [];
  let i = 0, cmd = null, cur = [0, 0], start = [0, 0], sub = null, lastC = null, lastQ = null;
  const num = () => { const v = tk[i++]; if (typeof v !== 'number') throw new Error('bad path data'); return v; };
  while (i < tk.length) {
    if (typeof tk[i] === 'string') cmd = tk[i++];
    else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
    if (cmd == null) throw new Error('path must start with a command');
    const up = cmd.toUpperCase(), rel = cmd !== up;
    const ox = rel ? cur[0] : 0, oy = rel ? cur[1] : 0;
    const a = []; for (let k = 0; k < ARGS[up]; k++) a.push(num());
    let c1 = null, q1 = null;
    if (up === 'Z') {
      if (sub) sub.closed = true;
      cur = start; sub = null;
    } else if (up === 'M') {
      cur = [a[0] + ox, a[1] + oy]; start = cur; sub = { start: cur, segs: [], closed: false }; subs.push(sub);
    } else {
      if (!sub) { sub = { start: cur, segs: [], closed: false }; subs.push(sub); }
      if (up === 'L') cur = [a[0] + ox, a[1] + oy], sub.segs.push({ t: 'L', p: cur });
      else if (up === 'H') cur = [a[0] + ox, cur[1]], sub.segs.push({ t: 'L', p: cur });
      else if (up === 'V') cur = [cur[0], a[0] + oy], sub.segs.push({ t: 'L', p: cur });
      else if (up === 'C' || up === 'S') {
        const f = up === 'C' ? 2 : 0;
        const p1 = up === 'C' ? [a[0] + ox, a[1] + oy] : (lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : cur);
        const p2 = [a[f] + ox, a[f + 1] + oy], p = [a[f + 2] + ox, a[f + 3] + oy];
        sub.segs.push({ t: 'C', c1: p1, c2: p2, p }); c1 = p2; cur = p;
      } else if (up === 'Q' || up === 'T') {
        const c = up === 'Q' ? [a[0] + ox, a[1] + oy] : (lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur);
        const p = up === 'Q' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
        sub.segs.push({ t: 'Q', c, p }); q1 = c; cur = p;
      } else if (up === 'A') {
        const p = [a[5] + ox, a[6] + oy];
        sub.segs.push(...arcToCubics(cur[0], cur[1], a[0], a[1], a[2], a[3], a[4], p[0], p[1])); cur = p;
      }
    }
    lastC = c1; lastQ = q1;
  }
  return subs;
}

function cubicToQuads(p0, c1, c2, p3, tol) {
  const dx = p3[0] - 3 * c2[0] + 3 * c1[0] - p0[0], dy = p3[1] - 3 * c2[1] + 3 * c1[1] - p0[1];
  const n = Math.min(32, Math.max(1, Math.ceil(Math.cbrt((Math.sqrt(3) / 36) * Math.hypot(dx, dy) / tol))));
  const pt = (t) => { const u = 1 - t; return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]; };
  const dv = (t) => { const u = 1 - t; return [
    3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p3[0] - c2[0]),
    3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p3[1] - c2[1])]; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, a = pt(t0), b = i === n - 1 ? p3 : pt(t1);
    const da = dv(t0), db = dv(t1), h = (t1 - t0) / 3;
    const ca = [a[0] + da[0] * h, a[1] + da[1] * h], cb = [b[0] - db[0] * h, b[1] - db[1] * h];
    out.push({ t: 'Q', c: [(3 * (ca[0] + cb[0]) - a[0] - b[0]) / 4, (3 * (ca[1] + cb[1]) - a[1] - b[1]) / 4], p: b });
  }
  return out;
}

/** Subpaths using only L and Q segments (what SWF can store). tol in input units. */
export function toQuadPaths(subs, tol = 0.1) {
  return subs.map((s) => {
    const segs = []; let cur = s.start;
    for (const g of s.segs) {
      if (g.t === 'C') segs.push(...cubicToQuads(cur, g.c1, g.c2, g.p, tol)); else segs.push(g);
      cur = g.p;
    }
    return { start: s.start, segs, closed: s.closed };
  });
}

/** Flatten to a polygon (for area / containment tests). */
export function flatten(sub, steps = 8) {
  const pts = [sub.start]; let cur = sub.start;
  for (const g of sub.segs) {
    if (g.t === 'Q') for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      pts.push([u * u * cur[0] + 2 * u * t * g.c[0] + t * t * g.p[0], u * u * cur[1] + 2 * u * t * g.c[1] + t * t * g.p[1]]);
    } else pts.push(g.p);
    cur = g.p;
  }
  return pts;
}

const f = (v) => +v.toFixed(3);
const pair = (p) => `${f(p[0])},${f(p[1])}`;

/** Serialize subpaths back to absolute SVG path data. */
export function serializePath(subs) {
  return subs.map((s) => {
    let d = `M${pair(s.start)}`;
    for (const g of s.segs) {
      if (g.t === 'L') d += `L${pair(g.p)}`;
      else if (g.t === 'Q') d += `Q${pair(g.c)} ${pair(g.p)}`;
      else d += `C${pair(g.c1)} ${pair(g.c2)} ${pair(g.p)}`;
    }
    return d + (s.closed ? 'Z' : '');
  }).join('');
}

/** Apply fn([x,y]) -> [x,y] to every point (anchors and control points) of path data. */
export function transformPath(d, fn) {
  return serializePath(parsePath(d).map(s => ({
    ...s,
    start: fn(s.start),
    segs: s.segs.map(g => (g.t === 'L' ? { t: 'L', p: fn(g.p) } : g.t === 'Q' ? { t: 'Q', c: fn(g.c), p: fn(g.p) } : { t: 'C', c1: fn(g.c1), c2: fn(g.c2), p: fn(g.p) })),
  })));
}

/** Reflect path data horizontally about the vertical line x = axis. */
export const mirrorPathX = (d, axis) => transformPath(d, ([x, y]) => [2 * axis - x, y]);

/** Stage-space reflection used by the rig: x' = K - x, y' = y + dy. */
export const reflectPath = (d, K, dy) => transformPath(d, ([x, y]) => [K - x, y + dy]);
