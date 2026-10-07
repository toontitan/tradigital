// Usage: node tools/build-swf.js <character.json> <out.swf>
// character.json: { template, parts: [{ name, origin:[x,y], paths:[{d,fill,stroke,strokeWidth}], mirrorTo?, pivot? }] }
// Coordinates are stage pixels (stage is 2600x1900 for the Billy template); path data is in the same space.
import fs from 'node:fs';
import path from 'node:path';
import { TemplateSwf } from '../src/swf/template.js';

const [, , input, output] = process.argv;
if (!input || !output) { console.error('usage: build-swf <character.json> <out.swf>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(input, 'utf8'));
const t = new TemplateSwf(fs.readFileSync(path.resolve(path.dirname(input), spec.template)));

for (const part of spec.parts ?? []) {
  if (t.isMirrored(part.name)) throw new Error(`${part.name} is the mirrored side in this template; draw its partner instead`);
  if (part.mirrorTo && !t.isMirrored(part.mirrorTo)) throw new Error(`${part.mirrorTo} is not a mirrored instance in this template`);
  // symmetry axis = midpoint of the template pair, read before anything moves
  const axis = part.mirrorTo ? (t.position(part.name)[0] + t.position(part.mirrorTo)[0]) / 2 : null;
  const id = t.defineArt(part.paths, part.origin);
  t.place(part.name, id, part.origin, { pivot: part.pivot });
  if (part.mirrorTo) t.place(part.mirrorTo, id, [2 * axis - part.origin[0], part.origin[1]]);
}
fs.writeFileSync(output, t.build());
console.error(`wrote ${output}`);
