import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { completeRig } from '../src/rig/complete.js';
import { EXPECTED_PARTS } from '../src/rig/spec.js';
import { VIEWS } from '../src/model/rig.js';
import { rigNames, readRaw, readRig } from '../src/rig/library.js';

const rig = (n) => JSON.parse(fs.readFileSync(new URL(`../src/rig/rigs/${n}.json`, import.meta.url), 'utf8'));

test('every built-in rig, as stored AND as loaded, has every part CTA expects in every view, with pivots', () => {
  assert.ok(rigNames().length >= 4);
  for (const n of rigNames()) for (const d of [readRaw(n), readRig(n)]) {
    for (const v of VIEWS) for (const p of EXPECTED_PARTS[v]) {
      assert.ok(d.slots[`${p}_${v}`], `${n} ${p}_${v}`);
      assert.ok(d.pivots[`${p}_${v}`.toLowerCase() + '_pivot'], `${n} pivot ${p}_${v}`);
    }
  }
});

test('completing a complete rig changes nothing', () => {
  const d = rig('kevin');
  const { data, filled } = completeRig(d, [rig('mojo')]);
  assert.equal(filled.length, 0);
  assert.deepEqual(data.slots, d.slots);
});

test('mirrored fills reflect the partner in the mirrored view', () => {
  const d = rig('billy3'), a = d.slots.Left_arm_315, b = d.slots.Right_arm_45;
  assert.equal(d.filled.Right_arm_45.startsWith('mirror:'), true);
  assert.equal(b.matrix[0], -a.matrix[0]);
  assert.deepEqual(b.local, a.local);
  assert.equal(b.origin[1], a.origin[1]);
});
