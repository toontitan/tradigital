import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Rig } from '../src/rig/rig.js';
import { describeTemplate } from '../src/model/templateInfo.js';
import { deriveReflections } from '../src/model/reflect.js';
import { limbGeometry, placeholderFor } from '../src/model/placeholders.js';
import { VIEWS, PARTS, instanceName, MIRROR_VIEW } from '../src/model/rig.js';
import { parsePath } from '../src/svg/path.js';
import { TemplateSwf } from '../src/swf/template.js';

const rig = new Rig(JSON.parse(fs.readFileSync(new URL('../src/rig/rigs/mojo.json', import.meta.url))));
const stage = (r, key, [x, y]) => { const m = r.matrix(key), [ox, oy] = r.position(key); return [ox + m.scaleX * x + m.skew1 * y, oy + m.skew0 * x + m.scaleY * y]; };

test('built-in rig: layout summary', () => {
  assert.deepEqual(rig.stageSize(), { width: 2500, height: 2000 });
  assert.equal(Object.keys(rig.slots).length, 248);
  assert.deepEqual(rig.absentParts('top'), ['Left_eye', 'Right_eye', 'Left_brow', 'Right_brow', 'Nose', 'Mouth']);
  assert.equal(rig.presentParts('0').length, 26);
  assert.equal(rig.presentParts('bottom').length, 20);
  assert.ok(rig.has('left_arm_0_pivot') && rig.has('head_nud_315_pivot'));
});

test('built-in rig: reflections exist for every view pair and agree within a few px', () => {
  const refl = deriveReflections(rig);
  for (const v of VIEWS) assert.ok(refl.has(`${v}>${MIRROR_VIEW[v]}`), v);
  const r = refl.get('45>315');
  assert.ok(r.n >= 20 && r.spread < 10 && Math.abs(r.dy) > 900, JSON.stringify(r));
});

test('built-in rig: describeTemplate gives the editor every present slot with placeholders', () => {
  const info = describeTemplate(rig);
  assert.equal(Object.keys(info.slots).length, 248);
  for (const s of Object.values(info.slots)) assert.ok(s.placeholder.paths.length >= 1, `${s.part}@${s.view}`);
  assert.equal(info.stage.width, 2500);
});

test('built-in rig: neighbouring limb segments share one joint circle in every view', () => {
  let checked = 0;
  for (const side of ['Left_', 'Right_']) for (const view of VIEWS) {
    for (const [a, b] of [['arm', 'forearm'], ['thigh', 'shank'], ['shank', 'foot']]) {
      const A = side + a, B = side + b, ga = limbGeometry(rig, A, view), gb = limbGeometry(rig, B, view);
      const joint = stage(rig, instanceName(A, view), ga.c1), origin = rig.position(instanceName(B, view));
      assert.ok(Math.hypot(joint[0] - origin[0], joint[1] - origin[1]) < 1e-6, `${A}->${B}@${view}`);
      assert.ok(Math.abs(ga.r1 - gb.r0) < 1e-9 && ga.r1 > 3, `${A}->${B}@${view} radius`);
      checked++;
    }
  }
  assert.equal(checked, 60);
});

test('built-in rig: hair cap stays above the eyebrows in every view', () => {
  for (const view of VIEWS) {
    const hair = placeholderFor(rig, 'Front_hair', view), key = instanceName('Front_hair', view), m = rig.matrix(key), [, hy] = rig.position(key);
    const ys = parsePath(hair.paths[0].d).flatMap(sub => [sub.start, ...sub.segs.map(g => g.p)]).map(p => p[1]);
    const capBottom = Math.max(hy + m.scaleY * Math.min(...ys), hy + m.scaleY * Math.max(...ys));
    for (const brow of ['Left_brow', 'Right_brow']) {
      const bk = instanceName(brow, view); if (!rig.has(bk)) continue;
      assert.ok(capBottom <= rig.position(bk)[1] + rig.instanceBounds(bk).yMin + 0.5, `${brow}@${view}`);
    }
  }
});

const MOJO = process.env.MOJO_SWF;
test('rig JSON matches a live read of the SWF it was extracted from', { skip: !MOJO }, () => {
  const t = new TemplateSwf(fs.readFileSync(MOJO));
  for (const [key, s] of Object.entries(rig.slots)) {
    assert.ok(Math.abs(t.position(key)[0] - s.origin[0]) < 0.01 && Math.abs(t.position(key)[1] - s.origin[1]) < 0.01, key);
    assert.equal(t.depth(key), s.depth);
  }
});
