import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, toQuadPaths } from '../src/svg/path.js';

test('absolute cubic keeps all control points', () => {
  const [s] = parsePath('M0,0 C10,0 20,10 30,30 Z');
  assert.deepEqual(s.segs[0], { t: 'C', c1: [10, 0], c2: [20, 10], p: [30, 30] });
  assert.ok(s.closed);
});

test('relative commands and smooth cubic', () => {
  const [s] = parsePath('m10,10 c5,0 10,5 10,10 s5,5 10,10 h5 v-5');
  assert.deepEqual(s.segs[0], { t: 'C', c1: [15, 10], c2: [20, 15], p: [20, 20] });
  assert.deepEqual(s.segs[1].c1, [20, 25]); // reflection of previous c2 about current point
  assert.deepEqual(s.segs[1].p, [30, 30]);
  assert.deepEqual(s.segs[2].p, [35, 30]);
  assert.deepEqual(s.segs[3].p, [35, 25]);
});

test('cubic -> quads stays within tolerance of the curve', () => {
  const [q] = toQuadPaths(parsePath('M0,0 C0,100 100,100 100,0'), 0.1);
  assert.ok(q.segs.length > 1 && q.segs.every(g => g.t === 'Q'));
  assert.deepEqual(q.segs.at(-1).p, [100, 0]);
  // sample the quad chain; the cubic apex is at y=75
  let cur = q.start, apex = 0;
  for (const g of q.segs) {
    for (let i = 0; i <= 50; i++) { const t = i / 50, u = 1 - t; apex = Math.max(apex, u * u * cur[1] + 2 * u * t * g.c[1] + t * t * g.p[1]); }
    cur = g.p;
  }
  assert.ok(Math.abs(apex - 75) < 0.1, `apex ${apex}`);
});

test('arc converts to cubics ending at target', () => {
  const [s] = parsePath('M0,0 A50,50 0 0 1 100,0');
  assert.ok(s.segs.every(g => g.t === 'C'));
  assert.ok(Math.abs(s.segs.at(-1).p[0] - 100) < 1e-9);
});
