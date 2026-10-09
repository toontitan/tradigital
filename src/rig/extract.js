// Reads the layout of an existing G2 SWF (part positions, matrices, depths, pivots) into a plain rig definition.
import { PARTS, VIEWS, instanceName, pivotName } from '../model/rig.js';
import { TemplateSwf } from '../swf/template.js';
import { readSwf, TAG, parsePlaceObject2 } from '../swf/reader.js';

const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;

/** @param {Buffer} buf SWF file bytes @returns rig data (JSON-serialisable), see rig/rig.js */
export function extractRig(buf, name) {
  const t = new TemplateSwf(buf);
  const slots = {}, pivots = {}, absent = {};
  for (const view of VIEWS) {
    absent[view] = [];
    for (const part of PARTS) {
      const key = instanceName(part.id, view);
      if (!t.has(key)) { absent[view].push(part.id); continue; }
      const m = t.matrix(key), b = t.localBounds(key);
      if (!b) { absent[view].push(part.id); continue; }
      slots[key] = {
        origin: t.position(key).map(r2), matrix: [m.scaleX, m.skew0, m.skew1, m.scaleY].map(r4), depth: t.depth(key),
        local: { xMin: r2(b.xMin), xMax: r2(b.xMax), yMin: r2(b.yMin), yMax: r2(b.yMax) },
      };
      const pn = pivotName(part.id, view);
      if (t.has(pn)) pivots[pn] = t.position(pn).map(r2);
    }
  }
  for (const p of readSwf(buf).tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body))) {
    if (p.name && /_nud_.*_pivot$/.test(p.name)) pivots[p.name] = [r2(p.matrix.tx / 20), r2(p.matrix.ty / 20)];
  }
  const stage = t.stageSize();
  return { name, version: 1, stage: { width: stage.width, height: stage.height }, slots, pivots, absent };
}
