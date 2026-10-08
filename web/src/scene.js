// Pure scene logic shared by the stage and thumbnails: resolve slot art (incl. mirrors) and order by depth.
import { MIRROR_VIEW, getPart, instanceName, mirrorOf, parseInstanceName } from '../../src/model/rig.js';
import { reflectPath, transformPath } from '../../src/svg/path.js';
import { roundedRectPath } from '../../src/model/silhouette.js';

/** Resolved art for a slot: {paths, origin, derived, source} or null. */
export function resolveSlot(art, tpl, key) {
  const a = art[key];
  if (!a) return null;
  if (!a.mirrorOf) return { paths: a.paths ?? [], origin: a.origin, derived: false, source: null };
  const src = art[a.mirrorOf];
  const sv = parseInstanceName(a.mirrorOf)?.view;
  const r = sv && tpl.reflections[`${sv}>${MIRROR_VIEW[sv]}`];
  if (!src || src.mirrorOf || !r) return null;
  return {
    paths: (src.paths ?? []).map(p => ({ ...p, d: reflectPath(p.d, r.K, r.dy) })),
    origin: [r.K - src.origin[0], src.origin[1] + r.dy], derived: true, source: a.mirrorOf,
  };
}

export function viewSlots(tpl, view) {
  return Object.entries(tpl.slots).filter(([, s]) => s.view === view).sort((a, b) => a[1].depth - b[1].depth);
}

export function viewBounds(tpl, view, pad = 30) {
  let b = null;
  for (const [, s] of viewSlots(tpl, view)) {
    const r = { x0: s.origin[0] + s.bounds.xMin, x1: s.origin[0] + s.bounds.xMax, y0: s.origin[1] + s.bounds.yMin, y1: s.origin[1] + s.bounds.yMax };
    b = b ? { x0: Math.min(b.x0, r.x0), x1: Math.max(b.x1, r.x1), y0: Math.min(b.y0, r.y0), y1: Math.max(b.y1, r.y1) } : r;
  }
  return b ? { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad } : { x: 0, y: 0, w: 100, h: 100 };
}

/** Placeholder outline as it appears on stage: local rounded rect through the instance's own matrix. */
export function silhouetteD(slot) {
  const [a, b, c, d] = slot.matrix ?? [1, 0, 0, 1], [ox, oy] = slot.origin;
  return transformPath(roundedRectPath(slot.localBounds ?? slot.bounds, 0, 0), ([x, y]) => [ox + a * x + c * y, oy + b * x + d * y]);
}

/** Items to draw for a view, back to front. */
export function viewScene(art, tpl, view) {
  return viewSlots(tpl, view).map(([key, slot]) => {
    const r = resolveSlot(art, tpl, key);
    return { key, slot, silhouette: silhouetteD(slot), resolved: r, drawn: !!r && r.paths.length > 0 };
  });
}

export function slotStatus(art, key) {
  const a = art[key];
  if (!a) return 'empty';
  return a.mirrorOf ? 'mirrored' : (a.paths?.length ? 'drawn' : 'empty');
}

export const partnerKey = (part, view) => { const m = mirrorOf(part, view); return m ? instanceName(m.part, m.view) : null; };
export { getPart };
