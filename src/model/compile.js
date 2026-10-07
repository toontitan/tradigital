// Character document + template -> SWF. Drawn slots get new art; mirror slots reuse the source sprite
// flipped (scaleX -1) at the reflected position; undrawn single-frame parts get a neutral grey silhouette.
import { TemplateSwf } from '../swf/template.js';
import { PARTS, getPart, instanceName, mirrorOf, parseInstanceName, VIEWS } from './rig.js';
import { deriveReflections, reflectPoint } from './reflect.js';
import { validate } from './character.js';

export const FALLBACK_STYLE = { fill: '#d4d4d4', stroke: '#8c8c8c', strokeWidth: 2 };

function roundedRect({ xMin, xMax, yMin, yMax }, ox, oy) {
  const x0 = xMin + ox, x1 = xMax + ox, y0 = yMin + oy, y1 = yMax + oy;
  const r = Math.max(0.5, Math.min((x1 - x0), (y1 - y0)) * 0.35);
  return `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}`
    + `H${x0 + r}A${r},${r} 0 0 1 ${x0},${y1 - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`;
}

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
        const b = t.instanceBounds(key);
        if (!b) continue;
        const [ox, oy] = t.position(key);
        const id = t.defineArt([{ d: roundedRect(b, ox, oy), ...FALLBACK_STYLE }], [ox, oy]);
        t.place(key, id, [ox, oy], { scaleX: 1 });
        report.fallback.push(key);
      }
    }
  }
  return { swf: t.build({ compress }), report };
}

export { mirrorOf, getPart };
