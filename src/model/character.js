// Character document: what the user has drawn, per part and view. Pure data, serialisable to JSON.
// art[instanceName] = { origin:[x,y], paths:[...], pivot? }  - drawn directly
//                   | { mirrorOf: instanceName }              - reflection of another DRAWN slot
import { getPart, instanceName, isPart, isView, mirrorOf, parseInstanceName } from './rig.js';

export function createCharacter(name = 'G2_Custom_Actor') {
  return { name, rigVersion: '2.0', template: 'billy', art: {}, options: { fallback: true } };
}

export function setArt(ch, part, view, art) {
  const key = instanceName(part, view);
  if (!parseInstanceName(key)) throw new Error(`unknown slot ${key}`);
  return { ...ch, art: { ...ch.art, [key]: art } };
}

export const clearArt = (ch, part, view) => {
  const art = { ...ch.art }; delete art[instanceName(part, view)]; return { ...ch, art };
};

/** @returns {{errors:string[], warnings:string[]}} */
export function validate(ch, template) {
  const problems = [], warnings = [];
  for (const [key, a] of Object.entries(ch.art)) {
    const slot = parseInstanceName(key);
    if (!slot) { problems.push(`${key}: not a valid part/view`); continue; }
    if (template && !template.has(key)) problems.push(`${key}: not present in template`);
    if (a.mirrorOf) {
      const src = parseInstanceName(a.mirrorOf);
      if (!src) { problems.push(`${key}: mirrorOf ${a.mirrorOf} is not a valid slot`); continue; }
      const expect = mirrorOf(src.part, src.view);
      if (!expect || instanceName(expect.part, expect.view) !== key) {
        problems.push(`${key}: is not the reflection of ${a.mirrorOf}${expect ? ` (that is ${instanceName(expect.part, expect.view)})` : ' (it is its own mirror)'}`);
      }
      const srcArt = ch.art[a.mirrorOf];
      if (!srcArt) problems.push(`${key}: mirrors empty slot ${a.mirrorOf}`);
      else if (srcArt.mirrorOf) problems.push(`${key}: ${a.mirrorOf} is itself a mirror; point at the drawn slot`);
    } else {
      if (!Array.isArray(a.paths) || !a.paths.length) problems.push(`${key}: no paths`);
      if (!Array.isArray(a.origin) || a.origin.length !== 2) problems.push(`${key}: origin must be [x, y] in stage px`);
      if (getPart(slot.part)?.kind === 'expression') warnings.push(`${key}: replaces the template's ${getPart(slot.part).frames}-frame set with a single drawing`);
    }
  }
  return { errors: problems, warnings };
}

export { isPart, isView };
