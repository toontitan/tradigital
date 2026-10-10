// Variable-width brush: turns a sampled stroke into a closed outline (polygon points) like Animate's Brush tool.
// Input samples are {x, y, p} (p = pressure 0..1). The outline is meant to be filled; width follows pressure (or drawing speed with a
// mouse), eased in/out by the taper settings, and the ends are round.

export const BRUSH_MODES = [['auto', 'Auto (pen pressure, else speed)'], ['pressure', 'Pen pressure'], ['speed', 'Speed (slow = thick)'], ['fixed', 'Fixed width']];
export const BRUSH_DEFAULTS = { size: 14, smoothing: 50, thinning: 60, taperStart: 25, taperEnd: 35, mode: 'auto' };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

/** Pressure source: pass each pointer sample through it. Returns p in 0..1. */
export function makePressure(mode = 'auto') {
  let last = null, sp = 0.5;
  return ({ x, y, t, pressure, pointerType, zoom = 1 }) => {
    const m = mode === 'auto' ? (pointerType === 'pen' ? 'pressure' : 'speed') : mode;
    let p = 1;
    if (m === 'pressure') p = pressure > 0 ? pressure : 0.5;
    else if (m === 'speed') {
      if (last) {
        const dt = Math.max(1, t - last.t), v = Math.hypot(x - last.x, y - last.y) * zoom / dt; // screen px per ms
        const target = clamp(1.05 - v / 2.2, 0.15, 1);
        sp += (target - sp) * 0.25;
      }
      p = sp;
    }
    last = { x, y, t };
    return p;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Remove near-duplicates, then smooth positions with a sliding average (end points stay put). */
function prepare(raw, smoothing) {
  const pts = [];
  for (const r of raw) if (!pts.length || dist(pts[pts.length - 1], r) >= 0.6) pts.push({ ...r });
  if (pts.length < 3) return pts;
  const k = Math.round(clamp(smoothing, 0, 100) / 100 * 5);
  if (!k) return pts;
  return pts.map((q, i) => {
    if (i === 0 || i === pts.length - 1) return q;
    const w = Math.min(k, i, pts.length - 1 - i);
    let x = 0, y = 0, p = 0;
    for (let j = i - w; j <= i + w; j++) { x += pts[j].x; y += pts[j].y; p += pts[j].p; }
    const n = 2 * w + 1;
    return { x: x / n, y: y / n, p: p / n };
  });
}

/** Evenly spaced samples along the polyline (keeps first and last). */
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = dist(a, b);
    let s = step - carry;
    while (s <= d) { const t = s / d; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t }); s += step; }
    carry = d - (s - step);
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.3) out.push({ ...last }); else out[out.length - 1] = { ...last };
  return out;
}

/** @returns {{x:number,y:number}[]} closed outline polygon (empty for no input) */
export function brushOutline(raw, opts = {}) {
  const o = { ...BRUSH_DEFAULTS, ...opts }, R = o.size / 2;
  if (!raw.length) return [];
  const arc = (c, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }; });
  let pts = prepare(raw, o.smoothing);
  if (pts.length < 2 || pts.reduce((s, q, i) => s + (i ? dist(q, pts[i - 1]) : 0), 0) < 1) {
    const q = pts[0], r = Math.max(0.5, R * (o.mode === 'fixed' ? 1 : (1 - o.thinning / 100 * (1 - q.p)))) ;
    return arc(q, r, 0, Math.PI * 2, 24).slice(0, -1);
  }
  pts = resample(pts, Math.max(1.2, o.size * 0.18));
  // arc length and tapered widths
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i], pts[i - 1]));
  const total = s[s.length - 1] || 1;
  const th = clamp(o.thinning, 0, 100) / 100;
  let w = pts.map(q => 2 * R * (o.mode === 'fixed' ? 1 : 1 - th * (1 - q.p)));
  for (let pass = 0; pass < 2; pass++) w = w.map((v, i) => (w[Math.max(0, i - 1)] + 2 * v + w[Math.min(w.length - 1, i + 1)]) / 4);
  const ts = (clamp(o.taperStart, 0, 100) / 100) * total * 0.5, te = (clamp(o.taperEnd, 0, 100) / 100) * total * 0.5;
  w = w.map((v, i) => {
    let f = 1;
    if (ts > 0 && s[i] < ts) f = Math.min(f, 0.08 + 0.92 * ease(s[i] / ts));
    if (te > 0 && total - s[i] < te) f = Math.min(f, 0.08 + 0.92 * ease((total - s[i]) / te));
    return Math.max(0.6, v * f);
  });
  // offset both sides
  const L = [], Rr = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    L.push({ x: pts[i].x - ty * w[i] / 2, y: pts[i].y + tx * w[i] / 2 });
    Rr.push({ x: pts[i].x + ty * w[i] / 2, y: pts[i].y - tx * w[i] / 2 });
  }
  const e = n - 1, angEnd = Math.atan2(L[e].y - pts[e].y, L[e].x - pts[e].x), angStart = Math.atan2(Rr[0].y - pts[0].y, Rr[0].x - pts[0].x);
  return [
    ...L,
    ...arc(pts[e], w[e] / 2, angEnd, angEnd - Math.PI, 8).slice(1, -1),
    ...Rr.slice().reverse(),
    ...arc(pts[0], w[0] / 2, angStart, angStart - Math.PI, 8).slice(1, -1),
  ];
}
