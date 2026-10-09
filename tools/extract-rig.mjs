// Usage: node tools/extract-rig.mjs <template.swf> <name> [out.json]
// Reads the layout of an existing G2 SWF (part positions, matrices, depths, pivots) into a plain rig definition.
import fs from 'node:fs';
import path from 'node:path';
import { TemplateSwf } from '../src/swf/template.js';
import { PARTS, VIEWS, instanceName, pivotName } from '../src/model/rig.js';
import { readSwf, TAG, parsePlaceObject2 } from '../src/swf/reader.js';

const [, , input, name, output] = process.argv;
if (!input || !name) { console.error('usage: extract-rig <template.swf> <name> [out.json]'); process.exit(1); }
const buf = fs.readFileSync(input);
const t = new TemplateSwf(buf);
const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
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
const out = { name, version: 1, stage: { width: stage.width, height: stage.height }, slots, pivots, absent };
const file = output ?? path.join('src/rig/rigs', `${name}.json`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.error(`${file}: ${Object.keys(slots).length} slots, ${Object.keys(pivots).length} pivots, stage ${stage.width}x${stage.height}`);
