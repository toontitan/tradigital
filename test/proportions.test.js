import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Rig } from '../src/rig/rig.js';
import { applyProportions, boneFactor } from '../src/rig/proportions.js';
import { limbGeometry } from '../src/model/placeholders.js';
import { VIEWS, instanceName } from '../src/model/rig.js';
import { parsePath } from '../src/svg/path.js';

const base = JSON.parse(fs.readFileSync(new URL('../src/rig/rigs/mojo.json', import.meta.url)));
const rig = new Rig(base);
const inv = (m) => { const det = m.scaleX * m.scaleY - m.skew0 * m.skew1; return { a: m.scaleY / det, b: -m.skew0 / det, c: -m.skew1 / det, d: m.scaleX / det }; };
const local = (r, parent, view, child) => { // child origin in the parent's own space
  const m = inv(r.matrix(instanceName(parent, view))), [px, py] = r.position(instanceName(parent, view)), [cx, cy] = r.position(instanceName(child, view));
  const dx = cx - px, dy = cy - py; return [m.a * dx + m.c * dy, m.b * dx + m.d * dy];
};
const len = ([x, y]) => Math.hypot(x, y);

test('no skeleton changes nothing', () => {
  const out = applyProportions(base, {});
  assert.deepEqual(out.slots, base.slots);
  assert.deepEqual(out.pivots, base.pivots);
});

test('a bone factor scales that bone in the parent space, in every view (foreshortening kept)', () => {
  const eff = new Rig(applyProportions(base, { bones: { forearm: 1.5 } }));
  for (const side of ['Left_', 'Right_']) for (const view of VIEWS) {
    const k = instanceName(`${side}hand`, view); if (!rig.has(k)) continue;
    const a = local(rig, `${side}forearm`, view, `${side}hand`), b = local(eff, `${side}forearm`, view, `${side}hand`);
    assert.ok(Math.abs(len(b) - 1.5 * len(a)) < 0.2, `${side}hand@${view}`);
    assert.ok(Math.abs(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])) < 0.01, 'direction kept');
  }
});

test('lengthening an upper bone carries everything below it, with the lower bones unchanged', () => {
  const eff = new Rig(applyProportions(base, { bones: { upper_arm: 2 } }));
  const view = '0';
  const elbow0 = rig.position('Left_forearm_0'), elbow1 = eff.position('Left_forearm_0'), hand0 = rig.position('Left_hand_0'), hand1 = eff.position('Left_hand_0');
  const moved = [elbow1[0] - elbow0[0], elbow1[1] - elbow0[1]];
  assert.ok(len(moved) > 100); // the upper arm doubled, so the elbow moved by one upper-arm length
  assert.ok(Math.abs(hand1[0] - hand0[0] - moved[0]) < 0.1 && Math.abs(hand1[1] - hand0[1] - moved[1]) < 0.1, 'hand moves with the elbow');
  const f0 = local(rig, 'Left_forearm', view, 'Left_hand'), f1 = local(eff, 'Left_forearm', view, 'Left_hand');
  assert.ok(Math.abs(len(f0) - len(f1)) < 0.2, 'forearm length unchanged');
});

test('pivots and nudge markers follow their part', () => {
  const eff = applyProportions(base, { bones: { torso: 1.4 } });
  const dFace = [eff.slots.Face_0.origin[0] - base.slots.Face_0.origin[0], eff.slots.Face_0.origin[1] - base.slots.Face_0.origin[1]];
  assert.ok(Math.abs(dFace[1]) > 50);
  for (const n of ['face_0_pivot', 'head_nud_0_pivot', 'left_eye_0_pivot', 'mouth_0_pivot']) {
    assert.ok(Math.abs(eff.pivots[n][0] - base.pivots[n][0] - dFace[0]) < 0.1 && Math.abs(eff.pivots[n][1] - base.pivots[n][1] - dFace[1]) < 0.1, n);
  }
  // face features keep their place relative to the face
  const rel = (d, k) => [d.slots[k].origin[0] - d.slots.Face_0.origin[0], d.slots[k].origin[1] - d.slots.Face_0.origin[1]];
  assert.deepEqual(rel(eff, 'Left_eye_0'), rel(base, 'Left_eye_0'));
});

test('generic keys are symmetric; side-specific keys override one side only', () => {
  assert.equal(boneFactor('Left_hand', { forearm: 2 }), 2);
  assert.equal(boneFactor('Right_hand', { forearm: 2 }), 2);
  assert.equal(boneFactor('Left_hand', { forearm: 2, Left_forearm: 3 }), 3);
  assert.equal(boneFactor('Right_hand', { forearm: 2, Left_forearm: 3 }), 2);
  assert.equal(boneFactor('Face', { neck: 1.3 }), 1.3);
  assert.equal(boneFactor('Mouth', { neck: 1.3 }), 1);
  const eff = new Rig(applyProportions(base, { bones: { shank: 1.2, Left_shank: 1.6 } }));
  const L = len(local(eff, 'Left_shank', '0', 'Left_foot')) / len(local(rig, 'Left_shank', '0', 'Left_foot'));
  const R = len(local(eff, 'Right_shank', '0', 'Right_foot')) / len(local(rig, 'Right_shank', '0', 'Right_foot'));
  assert.ok(Math.abs(L - 1.6) < 0.01 && Math.abs(R - 1.2) < 0.01, `${L} ${R}`);
});

test('shared joint circles stay exact after any proportions, in every view', () => {
  const eff = new Rig(applyProportions(base, { bones: { upper_arm: 1.7, forearm: 0.7, thigh: 1.3, shank: 0.8, shoulders: 1.2 }, joints: { elbow: 11, knee: 14 } }));
  const stageOf = (r, key, [x, y]) => { const m = r.matrix(key), [ox, oy] = r.position(key); return [ox + m.scaleX * x + m.skew1 * y, oy + m.skew0 * x + m.scaleY * y]; };
  for (const side of ['Left_', 'Right_']) for (const view of VIEWS) for (const [a, b] of [['arm', 'forearm'], ['thigh', 'shank'], ['shank', 'foot']]) {
    const A = side + a, B = side + b, ga = limbGeometry(eff, A, view), gb = limbGeometry(eff, B, view);
    const joint = stageOf(eff, instanceName(A, view), ga.c1), origin = eff.position(instanceName(B, view));
    assert.ok(Math.hypot(joint[0] - origin[0], joint[1] - origin[1]) < 1e-6, `${A}->${B}@${view}`);
    assert.ok(Math.abs(ga.r1 - gb.r0) < 1e-9, `${A}->${B}@${view} radius`);
  }
  assert.equal(limbGeometry(eff, 'Left_arm', '0').r1, 11);   // elbow override reaches both sprites
  assert.equal(limbGeometry(eff, 'Left_forearm', '0').r0, 11);
  assert.equal(limbGeometry(eff, 'Right_thigh', '0').r1, 14);
  assert.equal(limbGeometry(eff, 'Right_shank', '0').r0, 14);
});

test('box segments stretch with their bone (torso box follows torso length)', () => {
  const eff = applyProportions(base, { bones: { torso: 1.5 } });
  const b = base.slots.Upper_torso_0.local, e = eff.slots.Upper_torso_0.local;
  assert.ok(Math.abs(e.yMin - b.yMin * 1.5) < 0.02 && Math.abs(e.yMax - b.yMax * 1.5) < 0.02);
  assert.equal(e.xMin, b.xMin);
});

import { placeholderFor, bodyJointRadius } from '../src/model/placeholders.js';
import { compileFromRig, anchorArt } from '../src/model/compile-rig.js';
import { createCharacter, setArt } from '../src/model/character.js';
import { readSwf, TAG, parsePlaceObject2 } from '../src/swf/reader.js';
import { TemplateSwf } from '../src/swf/template.js';

test('torso, hips, waist and neck share one circle with their neighbours', () => {
  const stage = (r, key, c) => { const m = r.matrix(key), [ox, oy] = r.position(key); return [ox + m.scaleX * c[0] + m.skew1 * c[1], oy + m.skew0 * c[0] + m.scaleY * c[1]]; };
  const eff = new Rig(applyProportions(base, { bones: { torso: 1.2, neck: 1.5 }, joints: { waist: 30, neck_top: 12 } }));
  for (const view of ['0', '315', '270', '180']) {
    const find = (part, joint) => placeholderFor(eff, part, view).joints.find(j => j.joint === joint);
    // waist: same centre (the upper torso's origin) and radius on both sprites
    const wu = find('Upper_torso', 'waist'), wl = find('Lower_torso', 'waist');
    const cu = stage(eff, instanceName('Upper_torso', view), wu.c), cl = stage(eff, instanceName('Lower_torso', view), wl.c);
    assert.ok(Math.hypot(cu[0] - cl[0], cu[1] - cl[1]) < 1e-6 && wu.r === wl.r && wu.r === 30, `waist@${view}`);
    // neck top: neck and face agree, centred on the face's pivot
    const nt = find('Neck', 'neck_top'), ft = find('Face', 'neck_top');
    const cn = stage(eff, instanceName('Neck', view), nt.c), cf = stage(eff, instanceName('Face', view), ft.c), piv = eff.pivotFor('Face', view);
    assert.ok(Math.hypot(cn[0] - cf[0], cn[1] - cf[1]) < 1e-6 && Math.hypot(cn[0] - piv[0], cn[1] - piv[1]) < 1e-6 && nt.r === 12 && ft.r === 12, `neck top@${view}`);
    // shoulders and hips: the torso circle matches the limb's own proximal circle
    for (const side of ['Left_', 'Right_']) {
      const sh = find('Upper_torso', `${side}shoulder`), arm = limbGeometry(eff, `${side}arm`, view);
      assert.ok(sh.r === arm.r0, `${side}shoulder radius@${view}`);
      const cs = stage(eff, instanceName('Upper_torso', view), sh.c), co = eff.position(instanceName(`${side}arm`, view));
      assert.ok(Math.hypot(cs[0] - co[0], cs[1] - co[1]) < 1e-6, `${side}shoulder centre@${view}`);
      const hp = find('Lower_torso', `${side}hip`), th = limbGeometry(eff, `${side}thigh`, view);
      assert.ok(hp.r === th.r0, `${side}hip radius@${view}`);
    }
  }
  assert.ok(bodyJointRadius(rig, 'waist') > 5);
});

test('drawn art follows its joint when bones change', () => {
  const art = { origin: rig.position('Left_forearm_0'), paths: [{ d: 'M0,0L10,0L10,10Z', fill: '#f00' }] };
  const eff = new Rig(applyProportions(base, { bones: { upper_arm: 1.6 } }));
  const moved = anchorArt(art, eff, 'Left_forearm_0');
  const [nx, ny] = eff.position('Left_forearm_0'), dx = nx - art.origin[0], dy = ny - art.origin[1];
  assert.ok(Math.hypot(dx, dy) > 50, 'the elbow really moved');
  assert.deepEqual(moved.origin, [nx, ny]);
  const first = parsePath(moved.paths[0].d)[0].start;
  assert.ok(Math.abs(first[0] - dx) < 0.01 && Math.abs(first[1] - dy) < 0.01, 'art translated by the same amount');
  assert.equal(anchorArt(art, rig, 'Left_forearm_0'), art); // unchanged layout: untouched
});

test('export uses the skeleton: moved joints land in the SWF, pivots included', () => {
  let ch = createCharacter();
  ch = { ...ch, skeleton: { bones: { forearm: 1.5 }, joints: { wrist: 9 } } };
  const out = compileFromRig(ch, rig);
  const t = new TemplateSwf(out.swf);
  const eff = new Rig(applyProportions(base, ch.skeleton));
  for (const k of ['Left_hand_0', 'left_hand_0_pivot', 'Right_hand_0']) assert.ok(Math.abs(t.position(k)[1] - eff.position(k)[1]) < 0.06, k);
  assert.ok(Math.abs(t.position('Left_hand_0')[1] - rig.position('Left_hand_0')[1]) > 20, 'the hand really moved');
});
