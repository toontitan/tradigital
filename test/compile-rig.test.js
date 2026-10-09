import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Rig } from '../src/rig/rig.js';
import { compileFromRig, DRAWN_VIEWS } from '../src/model/compile-rig.js';
import { createCharacter, setArt } from '../src/model/character.js';
import { PARTS, VIEWS, instanceName, pivotName } from '../src/model/rig.js';
import { EYE_FRAMES, MOUTH_FRAMES, NOSE_FRAMES } from '../src/rig/expression-sets.js';
import { EXPECTED_PARTS } from '../src/rig/spec.js';
import { readSwf, TAG, parsePlaceObject2, parseDefineSprite } from '../src/swf/reader.js';
import { decodeShape } from '../src/swf/shapeDecode.js';
import { TemplateSwf } from '../src/swf/template.js';

const rig = new Rig(JSON.parse(fs.readFileSync(new URL('../src/rig/rigs/mojo.json', import.meta.url))));
const { swf, report } = compileFromRig(createCharacter(), rig, { views: 'all' });
const parsed = readSwf(swf);
const defs = new Map();
for (const t of parsed.tags) if ([2, 22, 32, 83, 39].includes(t.code)) defs.set(t.body.readUInt16LE(0), t);
const placed = parsed.tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body));
const byName = Object.fromEntries(placed.map(p => [p.name, p]));
const spriteFrames = (id) => { const s = parseDefineSprite(defs.get(id).body); const frames = [[]]; for (const k of s.tags) { if (k.code === 1) frames.push([]); else if (k.code === 26) frames.at(-1).push(parsePlaceObject2(k.body)); } frames.pop(); return frames; };

test('default character: exactly the parts Cartoon Animator expects per view, each with a pivot, unique depths', () => {
  let parts = 0;
  for (const v of VIEWS) for (const p of PARTS) {
    const exp = EXPECTED_PARTS[v].includes(p.id);
    assert.equal(!!byName[instanceName(p.id, v)], exp, instanceName(p.id, v));
    assert.equal(!!byName[pivotName(p.id, v)], exp, pivotName(p.id, v));
    if (exp) parts++;
  }
  assert.equal(parts, 26 * 3 + 23 * 2 + 17 * 5); // 0/45/315, 90/270, 135/225/180/top/bottom
  assert.equal(placed.length, parts * 2 + 50);
  assert.equal(new Set(placed.map(p => p.depth)).size, placed.length);
  assert.equal(parsed.version, 20);
  assert.deepEqual(report.dots, []);
});

test('every generated shape decodes cleanly (no malformed records)', () => {
  let n = 0;
  for (const t of parsed.tags) if (t.code === TAG.DefineShape4) { assert.equal(decodeShape(83, t.body).end, t.body.length); n++; }
  assert.ok(n > 500);
});

test('expression sets carry the exact frame names, misspelling included', () => {
  const names = (key) => spriteFrames(byName[key].characterId).map(f => f[0].name);
  assert.deepEqual(names('Left_eye_0'), EYE_FRAMES);
  assert.deepEqual(names('Mouth_0'), MOUTH_FRAMES);
  assert.equal(names('Mouth_0').length, 30);
  assert.deepEqual(names('Nose_0'), NOSE_FRAMES);
  assert.equal(names('Nose_0')[5], 'Raise_Right_Shrik_Nose_Flank');
  assert.equal(names('Left_hand_0').length, 11);
  assert.equal(names('Left_brow_0').length, 18);
});

test('an open eye frame is a named wrapper with Image, a clip Mask and Pupil', () => {
  const wrapper = spriteFrames(byName.Left_eye_0.characterId)[0][0];
  const kids = spriteFrames(wrapper.characterId)[0];
  assert.deepEqual(kids.map(k => k.name), ['Image', 'Mask', 'Pupil']);
  const mask = kids.find(k => k.name === 'Mask'), pupil = kids.find(k => k.name === 'Pupil');
  assert.equal(mask.clipDepth, 8);
  assert.ok(pupil.depth > mask.depth && pupil.depth <= mask.clipDepth, 'pupil sits inside the clip range');
  assert.equal(spriteFrames(pupil.characterId)[0].length, 1); // pupil sprite wraps one shape
});

test('an expected part the layout has no position for gets a ~2% opaque 8px dot (never an empty slot)', () => {
  const data = JSON.parse(JSON.stringify(rig.data));
  delete data.slots.Left_ear_315; delete data.pivots.left_ear_315_pivot;
  const out = compileFromRig(createCharacter(), new Rig(data), { views: ['315'] });
  assert.deepEqual(out.report.dots, ['Left_ear_315']);
  const sw = readSwf(out.swf), defs2 = new Map();
  for (const t of sw.tags) if ([83, 39].includes(t.code)) defs2.set(t.body.readUInt16LE(0), t);
  const pl = sw.tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body)).find(p => p.name === 'Left_ear_315');
  const kid = parsePlaceObject2(parseDefineSprite(defs2.get(pl.characterId).body).tags.find(t => t.code === 26).body);
  const sh = decodeShape(83, defs2.get(kid.characterId).body);
  assert.equal(sh.fills[0].color[3], 5); // 0.02 * 255
  const w = (sh.bounds.xMax - sh.bounds.xMin) / 20;
  assert.ok(w >= 5 && w <= 10, `dot width ${w}`);
  assert.ok(sw.tags.some(t => t.code === TAG.PlaceObject2 && parsePlaceObject2(t.body).name === 'left_ear_315_pivot'), 'dot slot still has its pivot');
});

test('placeholders and pivots sit exactly where the rig says; the output re-reads as a template', () => {
  const t = new TemplateSwf(swf);
  for (const key of ['Left_arm_0', 'Right_foot_270', 'Face_180', 'Upper_torso_top']) {
    const [x, y] = t.position(key), [rx, ry] = rig.position(key);
    assert.ok(Math.abs(x - rx) < 0.06 && Math.abs(y - ry) < 0.06, key);
  }
  const [px, py] = t.position('left_arm_0_pivot'), [qx, qy] = rig.pivots.left_arm_0_pivot;
  assert.ok(Math.abs(px - qx) < 0.06 && Math.abs(py - qy) < 0.06);
});

test('drawing 315/270/225 automatically mirrors into 45/90/135 (flipped, at the reflected position)', () => {
  let ch = createCharacter();
  const path = { d: 'M1000,500L1040,500L1040,560L1000,560Z', fill: '#cc2222' };
  ch = setArt(ch, 'Right_arm', '315', { origin: rig.position('Right_arm_315'), paths: [path] });
  const out = compileFromRig(ch, rig, { views: 'all' });
  assert.deepEqual(out.report.drawn, ['Right_arm_315']);
  assert.deepEqual(out.report.mirrored, ['Left_arm_45']);
  const pl = Object.fromEntries(readSwf(out.swf).tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body)).map(p => [p.name, p]));
  assert.equal(pl.Right_arm_315.matrix.scaleX, 1);
  assert.equal(pl.Left_arm_45.matrix.scaleX, -1);
  assert.equal(pl.Left_arm_45.characterId, pl.Right_arm_315.characterId);
  // the pivot of a drawn slot stays on the rig's pivot (art was placed at the rig origin)
  const t = new TemplateSwf(out.swf), [px] = t.position('right_arm_315_pivot');
  assert.ok(Math.abs(px - rig.pivots.right_arm_315_pivot[0]) < 0.06);
});

test('seven-view export omits 45/90/135', () => {
  const out = compileFromRig(createCharacter(), rig, { views: DRAWN_VIEWS });
  const names = readSwf(out.swf).tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body).name);
  assert.ok(!names.some(n => /_(45|90|135)(_pivot)?$/.test(n)));
  assert.equal(names.filter(n => /^[A-Z]/.test(n)).length, 26 + 26 + 23 + 17 + 17 + 17 + 17); // 0, 315, 270, 225, 180, top, bottom
});

import { resolveViews } from '../src/model/compile-rig.js';

test('default export covers only the views you drew (front always included); CTA replicates the rest', () => {
  assert.deepEqual(resolveViews(createCharacter()), ['0']);
  let ch = createCharacter();
  const art = { origin: rig.position('Right_arm_0'), paths: [{ d: 'M0,0L5,0L5,5Z', fill: '#f00' }] };
  ch = setArt(ch, 'Right_arm', '0', art);
  ch = setArt(ch, 'Right_foot', '270', { origin: rig.position('Right_foot_270'), paths: art.paths });
  assert.deepEqual(resolveViews(ch), ['0', '270']);
  const out = compileFromRig(ch, rig);
  assert.deepEqual(out.report.views, ['0', '270']);
  const names = readSwf(out.swf).tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body).name);
  assert.ok(names.every(n => /_(0|270)(_pivot)?$/.test(n)), 'nothing exported for undrawn views');
  assert.equal(names.filter(n => /^[A-Z]/.test(n)).length, 26 + 17 + 6 * 0 + 6); // front 26; 270 expects 23
  assert.deepEqual(resolveViews({ ...ch, options: { exportViews: 'all' } }), VIEWS);
  assert.deepEqual(resolveViews({ ...ch, options: { exportViews: ['180', '0'] } }), ['0', '180']);
  assert.deepEqual(resolveViews(ch, 'seven'), DRAWN_VIEWS);
});

test('an explicit cross-view mirror pulls both views into the export', () => {
  let ch = createCharacter();
  ch = setArt(ch, 'Right_arm', '315', { origin: rig.position('Right_arm_315'), paths: [{ d: 'M0,0L5,0L5,5Z', fill: '#f00' }] });
  ch = setArt(ch, 'Left_arm', '45', { mirrorOf: 'Right_arm_315' });
  assert.deepEqual(resolveViews(ch), ['0', '45', '315']);
  const out = compileFromRig(ch, rig);
  assert.deepEqual(out.report.mirrored, ['Left_arm_45']);
});
