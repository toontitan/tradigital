// Usage: node tools/extract-rig.mjs <template.swf> <name> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import { extractRig } from '../src/rig/extract.js';
import { complete } from '../src/rig/library.js';

const [, , input, name, output] = process.argv;
if (!input || !name) { console.error('usage: extract-rig <template.swf> <name> [out.json]'); process.exit(1); }
const raw = extractRig(fs.readFileSync(input), name);
const { data: rig, filled } = complete(raw); // skeletons are always complete
if (filled.length) console.error(`filled ${filled.length} missing slots (see "filled" in the output)`);
const file = output ?? path.join('src/rig/rigs', `${name}.json`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(rig));
console.error(`${file}: ${Object.keys(rig.slots).length} slots, ${Object.keys(rig.pivots).length} pivots, stage ${rig.stage.width}x${rig.stage.height}`);
