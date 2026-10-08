import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PARTS, VIEWS, counterpart, mirrorOf, parseInstanceName, instanceName } from '../src/model/rig.js';
import { createCharacter, setArt, validate } from '../src/model/character.js';

test('rig vocabulary', () => {
  assert.equal(PARTS.length, 26);
  assert.equal(VIEWS.length, 10);
  assert.equal(counterpart('Left_forearm'), 'Right_forearm');
  assert.equal(counterpart('Face'), 'Face');
  assert.deepEqual(parseInstanceName('Left_forearm_270'), { part: 'Left_forearm', view: '270' });
  assert.equal(parseInstanceName('Nope_0'), null);
});

test('mirror topology is an involution', () => {
  for (const p of PARTS) for (const v of VIEWS) {
    const m = mirrorOf(p.id, v);
    if (!m) continue;
    const back = mirrorOf(m.part, m.view);
    assert.deepEqual(back, { part: p.id, view: v });
  }
  assert.deepEqual(mirrorOf('Left_foot', '45'), { part: 'Right_foot', view: '315' });
  assert.deepEqual(mirrorOf('Left_arm', '0'), { part: 'Right_arm', view: '0' });
  assert.deepEqual(mirrorOf('Face', '45'), { part: 'Face', view: '315' });
  assert.equal(mirrorOf('Face', '0'), null);
});

test('validate flags bad mirrors', () => {
  let ch = createCharacter();
  const art = { origin: [1, 2], paths: [{ d: 'M0,0L1,1Z', fill: '#fff' }] };
  ch = setArt(ch, 'Right_arm', '0', art);
  ch = setArt(ch, 'Left_arm', '0', { mirrorOf: 'Right_arm_0' });
  assert.deepEqual(validate(ch).errors, []);
  ch = setArt(ch, 'Left_arm', '45', { mirrorOf: 'Right_arm_0' }); // wrong target
  assert.match(validate(ch).errors[0], /not the reflection/);
  ch = setArt(createCharacter(), 'Left_arm', '0', { mirrorOf: 'Right_arm_0' });
  assert.match(validate(ch).errors[0], /empty slot/);
  assert.equal(instanceName('Left_arm', '0'), 'Left_arm_0');
});

const TPL = process.env.BILLY_SWF;
test('compile: drawn + mirrored + fallback against the Billy template', { skip: !TPL }, async () => {
  const { compileCharacter } = await import('../src/model/compile.js');
  const { readSwf, TAG, parsePlaceObject2 } = await import('../src/swf/reader.js');
  const tpl = fs.readFileSync(TPL);
  let ch = createCharacter();
  ch = setArt(ch, 'Right_foot', '45', { origin: [1470.35, 801], paths: [{ d: 'M1400,790L1500,790L1500,837L1400,837Z', fill: '#ff0000' }] });
  ch = setArt(ch, 'Left_foot', '315', { mirrorOf: 'Right_foot_45' });
  const { swf, report } = compileCharacter(ch, tpl);
  assert.deepEqual(report.drawn, ['Right_foot_45']);
  assert.deepEqual(report.mirrored, ['Left_foot_315']);
  assert.ok(report.fallback.length > 150, `fallback ${report.fallback.length}`);
  assert.ok(!report.fallback.some(k => /^(Left|Right)_(eye|brow|hand)|^(Nose|Mouth)/.test(k)), 'expression sets keep template frames');
  const placed = Object.fromEntries(readSwf(swf).tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body)).filter(p => p.name).map(p => [p.name, p]));
  assert.equal(placed.Right_foot_45.matrix.scaleX, 1);
  assert.equal(placed.Left_foot_315.matrix.scaleX, -1);
  assert.equal(placed.Left_foot_315.characterId, placed.Right_foot_45.characterId);
  // reflection: K - x with K = 3009.6 for 45>315
  assert.ok(Math.abs(placed.Left_foot_315.matrix.tx / 20 - (3009.6 - placed.Right_foot_45.matrix.tx / 20)) < 0.1);
  assert.equal(placed.Neck_0.matrix.scaleX, 1);
  // placeholders keep the template's matrix exactly (rotation + flip), art placements are clean
  const orig = Object.fromEntries(readSwf(tpl).tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body)).filter(p => p.name).map(p => [p.name, p]));
  for (const key of report.fallback) assert.deepEqual(placed[key].matrix, orig[key].matrix, key);
  assert.ok(report.fallback.includes('Left_arm_45') && Math.abs(orig.Left_arm_45.matrix.skew0) > 0.5, 'rotated arm covered');
  assert.deepEqual({ ...placed.Right_foot_45.matrix, tx: 0, ty: 0 }, { scaleX: 1, scaleY: 1, skew0: 0, skew1: 0, tx: 0, ty: 0 });
  // the hair placeholder must not be a solid fill (it would cover the eyes/brows beneath it)
  const { decodeShape } = await import('../src/swf/shapeDecode.js');
  const { parseDefineSprite } = await import('../src/swf/reader.js');
  const out = readSwf(swf);
  const sprite = out.tags.find(x => x.code === TAG.DefineSprite && x.body.readUInt16LE(0) === placed.Front_hair_0.characterId);
  const child = parseDefineSprite(sprite.body).tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body))[0];
  const shape = decodeShape(TAG.DefineShape4, out.tags.find(x => x.code === TAG.DefineShape4 && x.body.readUInt16LE(0) === child.characterId).body);
  assert.equal(shape.fills.length, 0, 'Front_hair fallback is outline-only');
  assert.equal(shape.lines.length, 1);
});
