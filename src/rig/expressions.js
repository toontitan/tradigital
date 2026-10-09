// Generic placeholder drawings for the multi-frame parts, built with the exact nested structure Cartoon Animator expects:
// every frame is a NAMED wrapper sprite, and an open eye is wrapper -> Image + Mask (a real clip) + Pupil.
import { SETS, SET_OF_PART, MOUTH_SHAPE, CLOSED_EYES } from './expression-sets.js';
import { roundedRectPath } from '../model/silhouette.js';

const ellipse = (cx, cy, rx, ry) => `M${cx - rx},${cy}A${rx},${ry} 0 1 1 ${cx + rx},${cy}A${rx},${ry} 0 1 1 ${cx - rx},${cy}Z`;
const INK = '#2b2b2b', SKIN_LINE = '#8c8c8c';

/**
 * Build the full set for one expression part. Drawn in the slot's local space (origin = the slot's joint),
 * using the part's local bounds for size and position.
 * @returns {number} sprite id (frames named per SETS)
 */
export function buildExpressionSet(b, part, bounds) {
  const kind = SET_OF_PART[part];
  if (!kind) throw new Error(`${part} is not an expression part`);
  const names = SETS[kind], w = bounds.xMax - bounds.xMin, h = bounds.yMax - bounds.yMin;
  const cx = (bounds.xMin + bounds.xMax) / 2, cy = (bounds.yMin + bounds.yMax) / 2;
  const shape = (d, fill, extra = {}) => b.shape({ d, fill, ...extra }, [0, 0]);
  const wrap = (children) => b.sprite([children]);

  const frameOf = (name) => {
    if (kind === 'eye') {
      const rx = w * 0.45, ry = h * 0.4;
      if (CLOSED_EYES.has(name)) return wrap([{ id: shape(ellipse(cx, cy, rx, 2), INK), depth: 1 }]);
      const scale = /Scare|Stretch/.test(name) ? 1.2 : 1;
      const eye = ellipse(cx, cy, rx, ry * scale);
      const pupil = b.sprite([[{ id: shape(ellipse(cx, cy, Math.min(rx, ry) * 0.7, Math.min(rx, ry) * 0.7), INK), depth: 2 }]]);
      return wrap([
        { id: shape(eye, '#ffffff', { stroke: SKIN_LINE, strokeWidth: 2 }), depth: 1, name: 'Image' },
        { id: shape(eye, '#ffffff'), depth: 3, name: 'Mask', clipDepth: 8 }, // real clipping mask: keeps the pupil inside the eye
        { id: pupil, depth: 5, name: 'Pupil' },
      ]);
    }
    if (kind === 'mouth') {
      const [open, wide] = MOUTH_SHAPE[name] ?? [0, 1];
      return wrap([{ id: shape(ellipse(cx, cy, w * 0.45 * wide, Math.max(2, h * 0.4 * open)), '#b0605a', { stroke: '#7a3b36', strokeWidth: 2 }), depth: 1 }]);
    }
    if (kind === 'brow') return wrap([{ id: shape(ellipse(cx, cy, w * 0.45, Math.max(3, h * 0.22)), INK), depth: 1 }]);
    if (kind === 'nose') return wrap([{ id: shape(ellipse(cx, cy, w * 0.35, h * 0.35), '#c9a893', { stroke: SKIN_LINE, strokeWidth: 2 }), depth: 1 }]);
    return wrap([{ id: shape(roundedRectPath(bounds, 0, 0), '#d4d4d4', { stroke: SKIN_LINE, strokeWidth: 3 }), depth: 1 }]); // hand
  };

  // identical frames share one wrapper definition only when the name repeats; names are per-frame instance names
  return b.sprite(names.map((name) => [{ id: frameOf(name), depth: 1, name }]));
}
