// Stroke -> filled outline ("Convert Lines to Fills"). Cartoon Animator drops stroke-only SWF shapes,
// so strokes are exported as real filled geometry. Round caps and joins; pieces are merged with Paper.js booleans.
import paper from 'paper';

let ready = false;
const init = () => { if (!ready) { paper.setup(new paper.Size(10, 10)); ready = true; } };
const P = (x, y) => new paper.Point(x, y);

function unionAll(items) {
  let level = items;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? level[i].unite(level[i + 1], { insert: false }) : level[i]);
    level = next;
  }
  return level[0];
}

/** @returns {string|null} SVG path data of the stroke's outline, to be filled with the stroke colour. */
export function strokeToFill(d, width, { tolerance } = {}) {
  init();
  const r = width / 2;
  if (!(r > 0)) return null;
  const src = new paper.CompoundPath({ pathData: d, insert: false });
  const subs = src.children?.length ? [...src.children] : [src];
  const pieces = [];
  for (const sub of subs) {
    const p = sub.clone({ insert: false });
    p.flatten(tolerance ?? Math.max(0.2, width / 25));
    const pts = p.segments.map(s => s.point), n = pts.length, closed = p.closed;
    if (!n) continue;
    const circle = (pt) => pieces.push(new paper.Path.Circle({ center: pt, radius: r, insert: false }));
    if (n === 1) { circle(pts[0]); continue; }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n], v = b.subtract(a), len = v.length;
      if (len < 1e-6) continue;
      const nx = (-v.y / len) * r, ny = (v.x / len) * r;
      pieces.push(new paper.Path({ segments: [P(a.x + nx, a.y + ny), P(b.x + nx, b.y + ny), P(b.x - nx, b.y - ny), P(a.x - nx, a.y - ny)], closed: true, insert: false }));
    }
    for (let i = 0; i < n; i++) {
      const end = !closed && (i === 0 || i === n - 1);
      if (end) { circle(pts[i]); continue; }
      const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
      const v1 = pts[i].subtract(prev), v2 = next.subtract(pts[i]);
      if (v1.length < 1e-6 || v2.length < 1e-6) continue;
      if (Math.abs(v2.angle - v1.angle) % 360 > 6 && 360 - (Math.abs(v2.angle - v1.angle) % 360) > 6) circle(pts[i]); // round join on real corners
    }
  }
  if (!pieces.length) return null;
  const out = unionAll(pieces);
  return out.pathData || null;
}
