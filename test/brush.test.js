import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brushOutline, makePressure } from '../web/src/brush.js';

const line = (p = 1, n = 40) => Array.from({ length: n }, (_, i) => ({ x: i * 3, y: 0, p }));
const bbox = (pts) => ({ w: Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)), h: Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y)) });
const heightNear = (pts, x) => { const near = pts.filter(p => Math.abs(p.x - x) < 3); return Math.max(...near.map(p => p.y)) - Math.min(...near.map(p => p.y)); };

test('full pressure, no taper gives a stroke as thick as the brush size with round ends', () => {
  const o = brushOutline(line(), { size: 20, taperStart: 0, taperEnd: 0, smoothing: 0 });
  assert.ok(Math.abs(bbox(o).h - 20) < 1.5);
  assert.ok(bbox(o).w > 117 + 15); // line length plus both round caps
});
test('taper narrows the ends', () => {
  const o = brushOutline(line(), { size: 20, taperStart: 50, taperEnd: 50, smoothing: 0 });
  assert.ok(heightNear(o, 60) > 17);
  assert.ok(heightNear(o, 6) < 10);
  assert.ok(heightNear(o, 114) < 10);
});
test('pressure thins the stroke; fixed mode ignores it', () => {
  const thin = brushOutline(line(0.2), { size: 20, thinning: 100, taperStart: 0, taperEnd: 0, smoothing: 0 });
  assert.ok(bbox(thin).h < 8);
  const fixed = brushOutline(line(0.2), { size: 20, mode: 'fixed', taperStart: 0, taperEnd: 0, smoothing: 0 });
  assert.ok(Math.abs(bbox(fixed).h - 20) < 1.5);
});
test('a single tap makes a dot and empty input makes nothing', () => {
  const dot = brushOutline([{ x: 5, y: 5, p: 1 }], { size: 16 });
  assert.ok(dot.length > 8 && Math.abs(bbox(dot).w - 16) < 1);
  assert.deepEqual(brushOutline([]), []);
});
test('speed mode: fast strokes are thinner than slow ones', () => {
  const slow = makePressure('speed'), fast = makePressure('speed');
  let ps = 0, pf = 0;
  for (let i = 0; i < 10; i++) { ps = slow({ x: i, y: 0, t: i * 16, pointerType: 'mouse' }); pf = fast({ x: i * 40, y: 0, t: i * 16, pointerType: 'mouse' }); }
  assert.ok(ps > pf + 0.3);
});
