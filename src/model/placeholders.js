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

export const STYLE = {
  body: { fill: '#d4d4d4', stroke: '#8c8c8c', strokeWidth: 2 },
  limb: { fill: '#d0d0d0' }, // fill only: overlaps at joints merge instead of showing seams
  // large pieces drawn above other parts: translucent so what is behind them stays visible
  translucent: { Upper_torso: '#d4d4d48c', Lower_torso: '#d4d4d48c' },
  // Front hair sits above the eyes/brows; outline only
  outline: ['Front_hair'],
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
    if (g.c1) { paths.push({ d: capsulePath(g.c0, g.r0, g.c1, g.r1), ...STYLE.limb }); joints.push({ c: g.c1, r: g.r1 }); }
    else { paths.push({ d: roundedRectPath(b, 0, 0), ...STYLE.limb }); paths.push({ d: circlePath(g.c0, g.r0), ...STYLE.limb }); } // foot: body + ankle circle
    return { paths, joints };
  }
  const style = { ...STYLE.body };
  if (STYLE.translucent[part]) style.fill = STYLE.translucent[part];
  if (STYLE.outline.includes(part)) style.fill = 'none';
  return { paths: [{ d: roundedRectPath(b, 0, 0), ...style }], joints: [] };
}
