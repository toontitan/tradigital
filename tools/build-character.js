// Usage: node tools/build-character.js <character.json> <out.swf> [template.swf]
// character.json is a model/character.js document: { name, art: { "Right_foot_0": {origin, paths} | {mirrorOf} }, options }
import fs from 'node:fs';
import path from 'node:path';
import { compileCharacter } from '../src/model/compile.js';

const [, , input, output, tpl] = process.argv;
if (!input || !output) { console.error('usage: build-character <character.json> <out.swf> [template.swf]'); process.exit(1); }
const ch = JSON.parse(fs.readFileSync(input, 'utf8'));
const templatePath = tpl ?? path.resolve(path.dirname(input), ch.templatePath ?? 'template.swf');
const { swf, report } = compileCharacter(ch, fs.readFileSync(templatePath));
fs.writeFileSync(output, swf);
console.error(`wrote ${output}: ${report.drawn.length} drawn, ${report.mirrored.length} mirrored, ${report.fallback.length} fallback`);
for (const w of report.warnings) console.error(`warning: ${w}`);
