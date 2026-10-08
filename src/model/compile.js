// Character document + template -> SWF. Drawn slots get new art; mirror slots reuse the source sprite
// flipped (scaleX -1) at the reflected position; undrawn single-frame parts get a neutral grey silhouette.
import { TemplateSwf } from '../swf/template.js';
import { PARTS, getPart, instanceName, mirrorOf, parseInstanceName, VIEWS } from './rig.js';
import { deriveReflections, reflectPoint } from './reflect.js';
import { validate } from './character.js';
import { placeholderFor } from './placeholders.js';
import { transformPath } from '../svg/path.js';
import { strokeToFill } from '../svg/stroke.js';

const MIN_STROKE = 1; // px: thinner strokes are widened so they keep some area

/** @returns {{swf:Buffer, report:{drawn:string[], mirrored:string[], fallback:string[], warnings:string[]}}} */
export function compileCharacter(ch, templateBuffer, { compress = true } = {}) {
  const t = new TemplateSwf(templateBuffer);
  const { errors, warnings } = validate(ch, t);
  if (errors.length) throw new Error(`invalid character:\n  ${errors.join('\n  ')}`);
  const refl = deriveReflections(t);
  const report = { drawn: [], mirrored: [], fallback: [], warnings };
  const sprites = new Map(); // drawn key -> {id, origin}

  // Cartoon Animator drops stroke-only SWF shapes (any width), so every stroke is exported as filled geometry:
  // the fill (if any) first, then the stroke's outline filled with the stroke colour on top.
  const expand = (paths, key) => paths.flatMap((p) => {
    if (!p.stroke || p.stroke === 'none' || !((p.strokeWidth ?? 1) > 0)) return [{ ...p, stroke: 'none' }];
    const outline = strokeToFill(p.d, Math.max(p.strokeWidth ?? 1, MIN_STROKE));
    if (!outline) { warnings.push(`${key}: a stroke could not be converted and was skipped`); return p.fill && p.fill !== 'none' ? [{ ...p, stroke: 'none' }] : []; }
    return [...(p.fill && p.fill !== 'none' ? [{ ...p, stroke: 'none' }] : []), { d: outline, fill: p.stroke, stroke: 'none', opacity: p.opacity }];
  });
  for (const [key, a] of Object.entries(ch.art)) {
    if (a.mirrorOf) continue;
    const id = t.defineArt(expand(a.paths, key), a.origin);
    sprites.set(key, { id, origin: a.origin });
    t.place(key, id, a.origin, { scaleX: 1, pivot: a.pivot });
    report.drawn.push(key);
  }

  for (const [key, a] of Object.entries(ch.art)) {
    if (!a.mirrorOf) continue;
    const src = sprites.get(a.mirrorOf);
    const origin = reflectPoint(refl, parseInstanceName(a.mirrorOf).view, src.origin);
    t.place(key, src.id, origin, { scaleX: -1 });
    report.mirrored.push(key);
  }

  if (ch.options?.fallback !== false) {
    for (const part of PARTS) {
      if (part.kind !== 'single') continue;
      for (const view of VIEWS) {
        const key = instanceName(part.id, view);
        if (!t.has(key) || ch.art[key]) continue;
        // placeholders are built in the symbol's local space and placed with the template's own matrix,
        // so they flip and rotate exactly like the template art does
        const ph = placeholderFor(t, part.id, view);
        if (!ph) continue;
        const [ox, oy] = t.position(key);
        const id = t.defineArt(ph.paths.map(p => ({ ...p, d: transformPath(p.d, ([x, y]) => [x + ox, y + oy]) })), [ox, oy]);
        t.place(key, id, [ox, oy]);
        report.fallback.push(key);
      }
    }
  }
  return { swf: t.build({ compress }), report };
}

export { mirrorOf, getPart };
export { STYLE as FALLBACK_STYLE } from './placeholders.js';
