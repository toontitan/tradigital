// JSON description of a template for the editor: slot geometry, depth order, reflection constants.
import { PARTS, VIEWS, instanceName, pivotName } from './rig.js';
import { deriveReflections } from './reflect.js';
import { placeholderFor } from './placeholders.js';

export function describeTemplate(t) {
  const slots = {};
  for (const part of PARTS) for (const view of VIEWS) {
    const key = instanceName(part.id, view);
    if (!t.has(key)) continue;
    const pl = t.placement(key).parsed, bounds = t.instanceBounds(key), local = t.symbolBounds(pl.characterId);
    if (!bounds || !local) continue;
    const pv = t.has(pivotName(part.id, view)) ? t.position(pivotName(part.id, view)) : null;
    const m = pl.matrix;
    slots[key] = {
      part: part.id, view, kind: part.kind, origin: t.position(key), bounds, localBounds: local,
      matrix: [m.scaleX, m.skew0, m.skew1, m.scaleY], // x' = a*x + c*y, y' = b*x + d*y (a,b,c,d)
      flipped: m.scaleX < 0, depth: pl.depth, pivot: pv, placeholder: placeholderFor(t, part.id, view),
    };
  }
  const { xMax, yMax } = t.swf.frameSize;
  return { stage: { width: xMax / 20, height: yMax / 20 }, slots, reflections: Object.fromEntries(deriveReflections(t)) };
}
