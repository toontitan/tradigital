// Cartoon Animator drops stroke-only SWF shapes (any width), so every stroke is exported as filled geometry:
// the fill (if any) first, then the stroke's outline filled with the stroke colour on top.
import { strokeToFill } from '../svg/stroke.js';

export const MIN_STROKE = 1; // px: thinner strokes are widened so they keep some area

/** @returns paths with no line styles left */
export function expandStrokes(paths, key, warnings) {
  return paths.flatMap((p) => {
    if (!p.stroke || p.stroke === 'none' || !((p.strokeWidth ?? 1) > 0)) return [{ ...p, stroke: 'none' }];
    const outline = strokeToFill(p.d, Math.max(p.strokeWidth ?? 1, MIN_STROKE));
    if (!outline) { warnings.push(`${key}: a stroke could not be converted and was skipped`); return p.fill && p.fill !== 'none' ? [{ ...p, stroke: 'none' }] : []; }
    return [...(p.fill && p.fill !== 'none' ? [{ ...p, stroke: 'none' }] : []), { d: outline, fill: p.stroke, stroke: 'none', opacity: p.opacity }];
  });
}
