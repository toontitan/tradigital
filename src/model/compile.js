// Character document + template -> SWF. Drawn slots get new art; mirror slots reuse the source sprite
// flipped (scaleX -1) at the reflected position; undrawn single-frame parts get a neutral grey silhouette.
import { TemplateSwf } from '../swf/template.js';
import { PARTS, getPart, instanceName, mirrorOf, parseInstanceName, VIEWS } from './rig.js';
import { deriveReflections, reflectPoint } from './reflect.js';
import { validate } from './character.js';
import { roundedRectPath } from './silhouette.js';

export const FALLBACK_STYLE = { fill: '#d4d4d4', stroke: '#8c8c8c', strokeWidth: 2 };
// Front hair sits above the eyes/brows in the template's z-order; a solid block would hide them, so it is outline-only.
export const FALLBACK_OVERRIDES = { Front_hair: { fill: 'none' } };

/** @returns {{swf:Buffer, report:{drawn:string[], mirrored:string[], fallback:string[], warnings:string[]}}} */
export function compileCharacter(ch, templateBuffer, { compress = true } = {}) {
  const t = new TemplateSwf(templateBuffer);
  const { errors, warnings } = validate(ch, t);
  if (errors.length) throw new Error(`invalid character:\n  ${errors.join('\n  ')}`);
  const refl = deriveReflections(t);
  const report = { drawn: [], mirrored: [], fallback: [], warnings };
  const sprites = new Map(); // drawn key -> {id, origin}

  for (const [key, a] of Object.entries(ch.art)) {
    if (a.mirrorOf) continue;
    const id = t.defineArt(a.paths, a.origin);
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
        // draw in the symbol's own local space and keep the template's matrix, so the placeholder
        // flips and rotates exactly like the template art does
        const b = t.symbolBounds(t.placement(key).parsed.characterId);
        if (!b) continue;
        const [ox, oy] = t.position(key);
        const id = t.defineArt([{ d: roundedRectPath(b, ox, oy), ...FALLBACK_STYLE, ...FALLBACK_OVERRIDES[part.id] }], [ox, oy]);
        t.place(key, id, [ox, oy]);
        report.fallback.push(key);
      }
    }
  }
  return { swf: t.build({ compress }), report };
}

export { mirrorOf, getPart };
