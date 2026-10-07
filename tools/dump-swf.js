// Usage: node tools/dump-swf.js <file.swf> [out.json]
// Dumps the structure of a G2 template SWF: root placements (name, character,
// twip matrix) and the character library (shapes / sprites).
import fs from 'node:fs';
import {
  readSwf, TAG, parsePlaceObject2, parseDefineSprite, parseShapeHeader, parseSymbolClass,
} from '../src/swf/reader.js';

const [, , input, output] = process.argv;
if (!input) { console.error('usage: dump-swf <file.swf> [out.json]'); process.exit(1); }

const swf = readSwf(fs.readFileSync(input));
const shapeCodes = new Set([TAG.DefineShape, TAG.DefineShape2, TAG.DefineShape3, TAG.DefineShape4]);
const characters = {};
const placements = [];
const symbolClass = [];
const tagCounts = {};

for (const t of swf.tags) {
  tagCounts[t.code] = (tagCounts[t.code] || 0) + 1;
  if (shapeCodes.has(t.code)) {
    const s = parseShapeHeader(t.code, t.body);
    characters[s.id] = { type: 'shape', ...s, bytes: t.body.length };
  } else if (t.code === TAG.DefineSprite) {
    const s = parseDefineSprite(t.body);
    const kids = s.tags.filter(k => k.code === TAG.PlaceObject2).map(k => parsePlaceObject2(k.body));
    characters[s.id] = { type: 'sprite', id: s.id, frames: s.frameCount, children: kids.map(k => ({ ...k })) };
  } else if (t.code === TAG.PlaceObject2) {
    placements.push(parsePlaceObject2(t.body));
  } else if (t.code === TAG.SymbolClass) {
    symbolClass.push(...parseSymbolClass(t.body));
  }
}

const out = {
  header: { version: swf.version, frameRate: swf.frameRate, frameCount: swf.frameCount, frameSize: swf.frameSize },
  tagCounts, symbolClass, placements, characters,
};
const json = JSON.stringify(out, null, 1);
if (output) fs.writeFileSync(output, json); else console.log(json.slice(0, 4000));
console.error(`${placements.length} root placements, ${Object.keys(characters).length} characters`);
