import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TemplateSwf } from '../src/swf/template.js';
import { readSwf, TAG, parsePlaceObject2 } from '../src/swf/reader.js';

const BILLY = process.env.BILLY_SWF;
const opts = { skip: !BILLY };

test('untouched template round-trips to identical tags', opts, () => {
  const src = fs.readFileSync(BILLY);
  const out = new TemplateSwf(src).build();
  const a = readSwf(src), b = readSwf(out);
  assert.equal(b.tags.length, a.tags.length);
  a.tags.forEach((t, i) => { assert.equal(b.tags[i].code, t.code); assert.ok(b.tags[i].body.equals(t.body), `tag ${i} (${t.code})`); });
  assert.deepEqual(b.frameSize, a.frameSize);
});

test('replacing art repoints the named instance and moves its pivot', opts, () => {
  const t = new TemplateSwf(fs.readFileSync(BILLY));
  const [ox, oy] = t.position('Right_arm_0');
  const [px0] = [t.placement('right_arm_0_pivot').parsed.matrix.tx];
  const id = t.defineArt([{ d: 'M0,0 L20,0 L20,60 L0,60 Z', fill: '#ff0000' }], [ox + 10, oy]);
  t.place('Right_arm_0', id, [ox + 10, oy]);
  const out = readSwf(t.build());
  const placed = out.tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body));
  const arm = placed.find(p => p.name === 'Right_arm_0');
  assert.equal(arm.characterId, id);
  assert.equal(arm.matrix.tx, Math.round((ox + 10) * 20));
  assert.equal(placed.find(p => p.name === 'right_arm_0_pivot').matrix.tx, px0 + 200);
  assert.equal(placed.length, 568);
});
