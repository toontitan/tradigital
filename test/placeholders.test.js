import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TemplateSwf } from '../src/swf/template.js';
import { limbGeometry, placeholderFor, isLimb } from '../src/model/placeholders.js';
import { VIEWS, instanceName } from '../src/model/rig.js';
import { readSwf, TAG, parsePlaceObject2, parseDefineSprite } from '../src/swf/reader.js';
import { decodeShape } from '../src/swf/shapeDecode.js';

const TPL = process.env.BILLY_SWF;
const opts = { skip: !TPL };
const stage = (t, key, [x, y]) => { const m = t.placement(key).parsed.matrix, [ox, oy] = t.position(key); return [ox + m.scaleX * x + m.skew1 * y, oy + m.skew0 * x + m.scaleY * y]; };

test('joints are shared circles: same centre and radius from both adjacent segments, in every view', opts, () => {
  const t = new TemplateSwf(fs.readFileSync(TPL));
  let checked = 0;
  for (const side of ['Left_', 'Right_']) for (const view of VIEWS) {
    for (const [a, b] of [['arm', 'forearm'], ['thigh', 'shank'], ['shank', 'foot']]) {
      const A = side + a, B = side + b, ga = limbGeometry(t, A, view), gb = limbGeometry(t, B, view);
      const joint = stage(t, instanceName(A, view), ga.c1), origin = t.position(instanceName(B, view));
      assert.ok(Math.hypot(joint[0] - origin[0], joint[1] - origin[1]) < 1e-6, `${A}->${B}@${view} centre`);
      assert.ok(Math.abs(ga.r1 - gb.r0) < 1e-9, `${A}->${B}@${view} radius ${ga.r1} vs ${gb.r0}`);
      assert.ok(ga.r1 > 3, 'sane radius');
      checked++;
    }
  }
  assert.equal(checked, 2 * 10 * 3);
});

test('placeholder styles: limbs are fill-only, torso translucent, hair outline', opts, () => {
  const t = new TemplateSwf(fs.readFileSync(TPL));
  assert.ok(isLimb('Left_shank') && !isLimb('Face') && !isLimb('Left_hand'));
  const arm = placeholderFor(t, 'Left_arm', '0'), torso = placeholderFor(t, 'Upper_torso', '0'), hair = placeholderFor(t, 'Front_hair', '0'), foot = placeholderFor(t, 'Left_foot', '0');
  assert.ok(arm.paths.every(p => !p.stroke) && arm.joints.length === 2);
  assert.equal(foot.paths.length, 2); // body + ankle circle
  assert.match(torso.paths[0].fill, /^#[0-9a-f]{6}8c$/i);
  assert.equal(hair.paths[0].fill, 'none');
});

test('exported torso placeholder keeps its alpha; limb shapes carry no outline', opts, async () => {
  const { compileCharacter } = await import('../src/model/compile.js');
  const { createCharacter } = await import('../src/model/character.js');
  const { swf } = compileCharacter(createCharacter(), fs.readFileSync(TPL));
  const out = readSwf(swf), by = Object.fromEntries(out.tags.filter(x => x.code === TAG.PlaceObject2).map(x => parsePlaceObject2(x.body)).filter(p => p.name).map(p => [p.name, p]));
  const shapes = (name) => parseDefineSprite(out.tags.find(x => x.code === TAG.DefineSprite && x.body.readUInt16LE(0) === by[name].characterId).body)
    .tags.filter(x => x.code === TAG.PlaceObject2).map(x => decodeShape(TAG.DefineShape4, out.tags.find(s => s.code === TAG.DefineShape4 && s.body.readUInt16LE(0) === parsePlaceObject2(x.body).characterId).body));
  assert.equal(shapes('Upper_torso_0')[0].fills[0].color[3], 0x8c);
  for (const s of shapes('Left_forearm_45')) assert.equal(s.lines.length, 0);
  assert.equal(shapes('Left_arm_0').length, 1);
});
