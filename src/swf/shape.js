// SVG-style vector paths -> DefineShape4 tag bodies.
import { BitWriter, sbits, rectBytes } from './bits.js';
import { parsePath, toQuadPaths, flatten } from '../svg/path.js';

export function parseColor(c, opacity = 1) {
  if (!c || c === 'none') return null;
  const m = /^#([0-9a-f]{3,8})$/i.exec(c.trim());
  if (!m) throw new Error(`unsupported color ${c}`);
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, Math.round(a * opacity * 255)];
}

const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * @param {{d:string, fill?:string, stroke?:string, strokeWidth?:number, opacity?:number}} path
 *        d is in "stage pixels"; origin = [ox, oy] pixel point that becomes (0,0) of the shape.
 * @returns {{body:Buffer, bounds:object}} DefineShape4 body (without tag header) for the given id.
 */
export function encodeShape4(id, path, origin = [0, 0], opts = {}) {
  const SC = opts.scale ?? 20, tol = (opts.tolerance ?? 2) / SC;
  const fill = parseColor(path.fill, path.opacity ?? 1);
  const stroke = parseColor(path.stroke, path.opacity ?? 1);
  const sw = stroke ? Math.max(1, Math.round((path.strokeWidth ?? 1) * SC)) : 0;
  const subs = toQuadPaths(parsePath(path.d), tol);
  const T = (p) => [Math.round((p[0] - origin[0]) * SC), Math.round((p[1] - origin[1]) * SC)];
  const polys = subs.map(s => flatten(s));
  const nf = fill ? 1 : 0, nl = stroke ? 1 : 0;
  const fillBits = nf ? 1 : 0, lineBits = nl ? 1 : 0;

  const rec = new BitWriter();
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  const grow = (p) => { xMin = Math.min(xMin, p[0]); xMax = Math.max(xMax, p[0]); yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); };
  let cx = 0, cy = 0, first = true;

  subs.forEach((s, i) => {
    if (!s.segs.length) return;
    const segs = s.segs.slice();
    if (fill || s.closed) { // close explicitly with a line back to start
      const last = segs[segs.length - 1].p;
      if (Math.abs(last[0] - s.start[0]) > 1e-9 || Math.abs(last[1] - s.start[1]) > 1e-9) segs.push({ t: 'L', p: s.start });
    }
    // fill side: interior is on the right of travel when screen-clockwise (area>0, y down)
    let f0 = 0, f1 = 0;
    if (fill) {
      const poly = polys[i];
      const depth = polys.reduce((n, other, j) => (j !== i && polys[j].length > 2 && inside(poly[0], other) ? n + 1 : n), 0);
      const filledSide = (area(poly) > 0) === (depth % 2 === 0) ? 'right' : 'left';
      if (filledSide === 'right') f1 = 1; else f0 = 1;
    }
    const st = T(s.start); grow(st);
    rec.ub(0, 1); rec.ub(0, 1); rec.ub(nl ? 1 : 0, 1); rec.ub(f1, 1); rec.ub(f0, 1); rec.ub(1, 1);
    const mb = Math.max(sbits(st[0]), sbits(st[1]));
    rec.ub(mb, 5); rec.sb(st[0], mb); rec.sb(st[1], mb);
    if (f0) rec.ub(1, fillBits); if (f1) rec.ub(1, fillBits); if (nl) rec.ub(1, lineBits);
    cx = st[0]; cy = st[1]; first = false;
    for (const g of segs) {
      const a = T(g.p);
      if (g.t === 'L') {
        const dx = a[0] - cx, dy = a[1] - cy; if (!dx && !dy) continue;
        const nb = Math.max(2, sbits(dx), sbits(dy));
        rec.ub(1, 1); rec.ub(1, 1); rec.ub(nb - 2, 4);
        if (dx && dy) { rec.ub(1, 1); rec.sb(dx, nb); rec.sb(dy, nb); }
        else { rec.ub(0, 1); rec.ub(dy ? 1 : 0, 1); rec.sb(dy || dx, nb); }
      } else {
        const c = T(g.c), cdx = c[0] - cx, cdy = c[1] - cy, adx = a[0] - c[0], ady = a[1] - c[1];
        const nb = Math.max(2, sbits(cdx), sbits(cdy), sbits(adx), sbits(ady));
        if (nb > 17) throw new Error('shape too large for SWF edge records');
        rec.ub(1, 1); rec.ub(0, 1); rec.ub(nb - 2, 4);
        rec.sb(cdx, nb); rec.sb(cdy, nb); rec.sb(adx, nb); rec.sb(ady, nb); grow(c);
      }
      grow(a); cx = a[0]; cy = a[1];
    }
  });
  rec.ub(0, 6); // end of shape

  if (first) { xMin = yMin = xMax = yMax = 0; }
  const edge = { xMin, xMax, yMin, yMax }, pad = Math.ceil(sw / 2);
  const bounds = { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad };

  const w = new BitWriter();
  w.u16(id); w.raw(rectBytes(bounds)); w.raw(rectBytes(edge));
  w.u8(0); // flags: no scaling/non-scaling-stroke hints
  w.u8(nf);
  if (fill) { w.u8(0x00); for (const v of fill) w.u8(v); }
  w.u8(nl);
  if (stroke) { w.u16(sw); w.u8(0); w.u8(0); for (const v of stroke) w.u8(v); } // round caps/joins, solid color
  w.ub(fillBits, 4); w.ub(lineBits, 4);
  w.raw(rec.toBuffer());
  return { body: w.toBuffer(), bounds };
}
