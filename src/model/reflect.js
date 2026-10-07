// Derive the stage-space reflection constants from a template. For every view pair the template
// places mirrored part pairs at x' = K - x, y' = y + dy (exact in the Billy kit, zero spread).
import { VIEWS, MIRROR_VIEW, PART_IDS, counterpart, instanceName } from './rig.js';

const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];

/** @returns {Map<string,{K:number,dy:number,n:number,spread:number}>} keyed `${from}>${to}` (stage px) */
export function deriveReflections(template) {
  const out = new Map();
  for (const from of VIEWS) {
    const to = MIRROR_VIEW[from];
    const ks = [], ds = [];
    for (const part of PART_IDS) {
      const a = instanceName(part, from), b = instanceName(counterpart(part), to);
      if (!template.has(a) || !template.has(b) || (a === b)) continue;
      const [ax, ay] = template.position(a), [bx, by] = template.position(b);
      ks.push(ax + bx); ds.push(by - ay);
    }
    if (ks.length) out.set(`${from}>${to}`, { K: median(ks), dy: median(ds), n: ks.length, spread: Math.max(...ks) - Math.min(...ks) });
  }
  return out;
}

/** Reflect a stage point lying in view `from` into view MIRROR_VIEW[from]. */
export function reflectPoint(reflections, from, [x, y]) {
  const r = reflections.get(`${from}>${MIRROR_VIEW[from]}`);
  if (!r) throw new Error(`no reflection constants for view ${from}`);
  return [r.K - x, y + r.dy];
}
