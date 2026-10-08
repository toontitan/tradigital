// Neutral placeholder art for undrawn parts, in each symbol's LOCAL space (origin = the part's joint).
// Limb segments are tapered capsules running joint-to-joint; neighbouring segments share one circle at their joint
// (same centre, same radius), so any rotation at the joint reads as one continuous limb.
import { roundedRectPath } from './silhouette.js';
import { getPart, instanceName } from './rig.js';

const LIMB_CHILD = { arm: 'forearm', forearm: 'hand', thigh: 'shank', shank: 'foot', foot: null };
const LIMB_PARENT = { forearm: 'arm', shank: 'thigh', foot: 'shank' };
const side = (id) => (id.startsWith('Left_') ? 'Left_' : id.startsWith('Right_') ? 'Right_' : null);
const base = (id) => (side(id) ? id.slice(side(id).length) : id);
export const isLimb = (id) => !!side(id) && base(id) in LIMB_CHILD;

export const EDGE = 3; // outline thickness (px) - thick enough to stay visible when the actor is scaled down
export const STYLE = {
  body: { fill: '#d4d4d4', stroke: '#8c8c8c', strokeWidth: EDGE },
  limb: { fill: '#d0d0d0' }, // fill only; the outline is added as separate filled strips so no line crosses a joint
  edge: { fill: '#8c8c8c' },
  // large pieces drawn above other parts: translucent so what is behind them stays visible
  translucent: { Upper_torso: '#d4d4d48c', Lower_torso: '#d4d4d48c' },
};

const JOINT_FILL = 0.9; // joint radius as a fraction of half the segment thickness

function capsulePath([x0, y0], r0, [x1, y1], r1) {
  const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy);
  const circle = (x, y, r) => `M${x - r},${y}A${r},${r} 0 1 1 ${x + r},${y}A${r},${r} 0 1 1 ${x - r},${y}Z`;
  if (D <= Math.abs(r0 - r1) + 1e-6) return r0 >= r1 ? circle(x0, y0, r0) : circle(x1, y1, r1);
  const th = Math.atan2(dy, dx), phi = Math.acos((r0 - r1) / D);
  const P = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const f = (p) => `${+p[0].toFixed(3)},${+p[1].toFixed(3)}`;
  const a0 = P(x0, y0, r0, th + phi), a1 = P(x1, y1, r1, th + phi), b1 = P(x1, y1, r1, th - phi), b0 = P(x0, y0, r0, th - phi);
  return `M${f(a0)}L${f(a1)}A${r1},${r1} 0 ${2 * phi > Math.PI ? 1 : 0} 0 ${f(b1)}L${f(b0)}A${r0},${r0} 0 ${2 * Math.PI - 2 * phi > Math.PI ? 1 : 0} 0 ${f(a0)}Z`;
}
/** Filled quad of thickness `w` along a->b (an outline segment that is real geometry, not a hairline stroke). */
function strip([x0, y0], [x1, y1], w) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2, f = (x, y) => `${+x.toFixed(3)},${+y.toFixed(3)}`;
  return `M${f(x0 + nx, y0 + ny)}L${f(x1 + nx, y1 + ny)}L${f(x1 - nx, y1 - ny)}L${f(x0 - nx, y0 - ny)}Z`;
}
/** The two straight sides of a capsule (tangent lines), pushed outward by half the thickness. */
function capsuleSides([x0, y0], r0, [x1, y1], r1) {
  const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy);
  if (D <= Math.abs(r0 - r1) + 1e-6) return [];
  const th = Math.atan2(dy, dx), phi = Math.acos((r0 - r1) / D), out = [];
  for (const sgn of [1, -1]) {
    const a = th + sgn * phi, c = Math.cos(a), s = Math.sin(a);
    out.push(strip([x0 + r0 * c, y0 + r0 * s], [x1 + r1 * c, y1 + r1 * s], EDGE));
  }
  return out;
}
const circlePath = (c, r) => `M${c[0] - r},${c[1]}A${r},${r} 0 1 1 ${c[0] + r},${c[1]}A${r},${r} 0 1 1 ${c[0] - r},${c[1]}Z`;

/** Position of `child`'s origin expressed in `parent`'s local space (inverse of the parent's 2x2 matrix). */
function toLocal(t, parentKey, childKey) {
  const m = t.placement(parentKey).parsed.matrix, [px, py] = t.position(parentKey), [cx, cy] = t.position(childKey);
  const a = m.scaleX, b = m.skew0, c = m.skew1, d = m.scaleY, det = a * d - b * c, dx = cx - px, dy = cy - py;
  return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det];
}

function thickness(t, key) {
  const b = t.symbolBounds(t.placement(key).parsed.characterId);
  return b ? Math.min(b.xMax - b.xMin, b.yMax - b.yMin) : 30;
}

/** Point given in stage px -> a slot's local space (inverse of its 2x2 matrix + origin). */
function stageToLocal(t, key, [sx, sy]) {
  const m = t.placement(key).parsed.matrix, [ox, oy] = t.position(key);
  const a = m.scaleX, b = m.skew0, c = m.skew1, d = m.scaleY, det = a * d - b * c, dx = sx - ox, dy = sy - oy;
  return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det];
}

/**
 * Front hair is a cap across the top of the head, kept above the eyebrows so it never covers the eyes.
 * Worked out in on-screen terms (views such as 'bottom' flip the hair vertically), then mapped to local space.
 */
function hairCapBounds(t, view, b) {
  const key = instanceName('Front_hair', view), m = t.placement(key).parsed.matrix, vb = t.instanceBounds(key), oy = t.position(key)[1];
  if (Math.abs(m.skew0) > 1e-3 || Math.abs(m.skew1) > 1e-3 || Math.abs(m.scaleY) < 1e-3) return { xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMin + (b.yMax - b.yMin) * 0.35 };
  let bottom = vb.yMin + (vb.yMax - vb.yMin) * 0.35; // on-screen, relative to the hair origin
  for (const brow of ['Left_brow', 'Right_brow']) {
    const k = instanceName(brow, view);
    if (!t.has(k)) continue; // side views carry one brow
    const top = t.position(k)[1] + t.instanceBounds(k).yMin - oy;
    if (top > vb.yMin) bottom = Math.min(bottom, top - 6);
  }
  bottom = Math.max(bottom, vb.yMin + 10);
  const y0 = vb.yMin / m.scaleY, y1 = bottom / m.scaleY;
  return { xMin: b.xMin, xMax: b.xMax, yMin: Math.min(y0, y1), yMax: Math.max(y0, y1) };
}

/** Joint geometry of a limb segment in its local space: {c0, r0, c1, r1}; c1/r1 null for the last segment. */
export function limbGeometry(t, part, view) {
  const s = side(part), b = base(part), key = instanceName(part, view);
  const own = thickness(t, key) / 2 * JOINT_FILL;
  const shared = (otherBase) => {
    const ok = instanceName(s + otherBase, view);
    return t.has(ok) && getPart(s + otherBase)?.kind !== 'expression' ? Math.min(own, thickness(t, ok) / 2 * JOINT_FILL) : own;
  };
  const parentBase = LIMB_PARENT[b], childBase = LIMB_CHILD[b];
  const r0 = parentBase ? shared(parentBase) : own;
  let c1 = null, r1 = null;
  if (childBase && t.has(instanceName(s + childBase, view))) { c1 = toLocal(t, key, instanceName(s + childBase, view)); r1 = shared(childBase); }
  return { c0: [0, 0], r0, c1, r1 };
}

/**
 * Placeholder shapes for a part/view in local coordinates (origin = joint).
 * @returns {{paths:{d:string,fill:string,stroke?:string,strokeWidth?:number}[], joints:{c:number[],r:number}[]}}
 */
export function placeholderFor(t, part, view) {
  const key = instanceName(part, view), b = t.symbolBounds(t.placement(key).parsed.characterId);
  if (!b) return null;
  if (isLimb(part)) {
    const g = limbGeometry(t, part, view), joints = [{ c: g.c0, r: g.r0 }];
    const paths = [];
    if (g.c1) {
      paths.push({ d: capsulePath(g.c0, g.r0, g.c1, g.r1), ...STYLE.limb });
      for (const d of capsuleSides(g.c0, g.r0, g.c1, g.r1)) paths.push({ d, ...STYLE.edge });
      joints.push({ c: g.c1, r: g.r1 });
    } else { // foot: outlined body, then the ankle circle on top so the outline does not cross the joint
      paths.push({ d: roundedRectPath(b, 0, 0), ...STYLE.body });
      paths.push({ d: circlePath(g.c0, g.r0), ...STYLE.limb });
    }
    return { paths, joints };
  }
  const style = { ...STYLE.body };
  if (STYLE.translucent[part]) style.fill = STYLE.translucent[part];
  if (part === 'Front_hair') return { paths: [{ d: roundedRectPath(hairCapBounds(t, view, b), 0, 0), ...style }], joints: [] };
  return { paths: [{ d: roundedRectPath(b, 0, 0), ...style }], joints: [] };
}
