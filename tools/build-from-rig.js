// Usage: node tools/build-from-rig.js <character.json> <out.swf> [--rig mojo] [--views seven]
// Builds a SWF with no template file, from the built-in rig. character.json may be {} for an all-placeholder character.
import fs from 'node:fs';
import { Rig } from '../src/rig/rig.js';
import { compileFromRig, DRAWN_VIEWS } from '../src/model/compile-rig.js';
import { createCharacter } from '../src/model/character.js';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [input, output] = args.filter(a => !a.startsWith('--') && !['mojo', 'seven', 'all'].includes(a));
if (!input || !output) { console.error('usage: build-from-rig <character.json> <out.swf> [--rig mojo] [--views all|seven]'); process.exit(1); }
const rig = new Rig(JSON.parse(fs.readFileSync(new URL(`../src/rig/rigs/${flag('--rig', 'mojo')}.json`, import.meta.url))));
const ch = { ...createCharacter(), ...JSON.parse(fs.readFileSync(input, 'utf8')) };
const views = flag('--views', 'all') === 'seven' ? DRAWN_VIEWS : undefined;
const { swf, report } = compileFromRig(ch, rig, { views });
fs.writeFileSync(output, swf);
console.error(`wrote ${output}: ${report.drawn.length} drawn, ${report.mirrored.length} mirrored, ${report.expression.length} generated sets, ${report.placeholders.length} placeholders, ${report.dots.length} dots, ${swf.length} bytes`);
for (const w of report.warnings) console.error(`warning: ${w}`);
