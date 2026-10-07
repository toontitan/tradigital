import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeShape } from '../src/swf/shapeDecode.js';
import { encodeShape4 } from '../src/swf/shape.js';
import { readSwf, TAG } from '../src/swf/reader.js';

test('encoded shape decodes back with same extent and consumes whole body', () => {
  const { body } = encodeShape4(7, { d: 'M10,10 C30,0 50,20 40,50 L10,50 Z', fill: '#ffcc00', stroke: '#000', strokeWidth: 2 }, [10, 10]);
  const s = decodeShape(TAG.DefineShape4, body);
  assert.equal(s.id, 7);
  assert.equal(s.end, body.length);
  assert.deepEqual(s.fills[0].color, [255, 204, 0, 255]);
  assert.equal(s.lines[0].width, 40);
  assert.ok(s.edges.length >= 3);
  const last = s.edges[s.edges.length - 1];
  assert.deepEqual([last.x1, last.y1], [0, 0]); // closed back to origin
});

const BILLY = process.env.BILLY_SWF;
test('decodes every shape in the Billy template', { skip: !BILLY }, () => {
  const swf = readSwf(fs.readFileSync(BILLY));
  let n = 0;
  for (const t of swf.tags) if ([2, 22, 32, 83].includes(t.code)) { const s = decodeShape(t.code, t.body); assert.equal(s.end, t.body.length, `shape ${s.id}`); n++; }
  assert.ok(n > 300);
});
