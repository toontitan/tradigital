import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import { strokeToFill } from '../src/svg/stroke.js';

const area = (d) => Math.abs(new paper.CompoundPath({ pathData: d, insert: false }).area);
const bounds = (d) => new paper.CompoundPath({ pathData: d, insert: false }).bounds;

test('straight stroke becomes a capsule: length*width + round caps', () => {
  const d = strokeToFill('M0,0L100,0', 10);
  const b = bounds(d);
  assert.ok(Math.abs(b.x + 5) < 0.01 && Math.abs(b.width - 110) < 0.01 && Math.abs(b.height - 10) < 0.01, JSON.stringify(b));
  assert.ok(Math.abs(area(d) - (100 * 10 + Math.PI * 25)) < 1.5, `area ${area(d)}`);
});

test('curved stroke follows the curve at the right width', () => {
  const d = strokeToFill('M0,0C0,100 100,100 100,0', 8);
  const b = bounds(d);
  assert.ok(Math.abs(b.height - 83) < 0.5, `height ${b.height}`); // apex y=75, plus 4px half-width above and the 4px cap below the start
  assert.ok(area(d) > 150 * 8 * 0.9 && area(d) < 400 * 8, `area ${area(d)}`);
});

test('closed shape stroke is a ring with a hole', () => {
  const d = strokeToFill('M0,0L100,0L100,100L0,100Z', 10);
  const cp = new paper.CompoundPath({ pathData: d, insert: false });
  assert.equal(cp.children.length, 2);
  assert.ok(Math.abs(area(d) - (110 * 110 - 90 * 90)) < 25, `area ${area(d)}`); // round outer corners remove a little
});

test('zero width and empty paths give null', () => {
  assert.equal(strokeToFill('M0,0L10,0', 0), null);
});
