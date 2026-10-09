import test from 'node:test';
import assert from 'node:assert/strict';
import { SwfBuilder } from '../src/swf/builder.js';
import { readSwf, TAG, parsePlaceObject2, parseDefineSprite } from '../src/swf/reader.js';
import { decodeShape } from '../src/swf/shapeDecode.js';

test('builds a valid SWF from nothing: header, tags, named placements', () => {
  const b = new SwfBuilder({ width: 1000, height: 800 });
  const art = b.art([{ d: 'M0,0L40,0L40,40L0,40Z', fill: '#ff0000' }], [20, 20]);
  b.place({ id: art, depth: 1, name: 'Thing_0', matrix: { tx: 400, ty: 600 } });
  const swf = readSwf(b.build());
  assert.equal(swf.version, 20);
  assert.deepEqual(swf.frameSize, { xMin: 0, xMax: 20000, yMin: 0, yMax: 16000 });
  assert.equal(swf.tags[0].code, TAG.FileAttributes);
  assert.equal(swf.tags.at(-1).code, TAG.End);
  const placed = swf.tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body));
  assert.equal(placed.length, 1);
  assert.equal(placed[0].name, 'Thing_0');
  assert.equal(placed[0].matrix.tx, 400);
});

test('multi-frame sprites remove the previous frame and keep named wrapper children + clip masks', () => {
  const b = new SwfBuilder();
  const s1 = b.shape({ d: 'M0,0L10,0L10,10Z', fill: '#000' }), s2 = b.shape({ d: 'M0,0L20,0L20,20Z', fill: '#fff' });
  const spr = b.sprite([
    [{ id: s1, depth: 1, name: 'Image' }, { id: s2, depth: 3, name: 'Mask', clipDepth: 8 }],
    [{ id: s2, depth: 1, name: 'Second' }],
  ]);
  const swf = readSwf(b.build());
  const sprite = parseDefineSprite(swf.tags.find(t => t.code === TAG.DefineSprite && t.body.readUInt16LE(0) === spr).body);
  assert.equal(sprite.frameCount, 2);
  const codes = sprite.tags.map(t => t.code);
  assert.deepEqual(codes, [26, 26, 1, 28, 28, 26, 1, 0]); // frame 1 places 2, frame 2 removes both depths then places 1
  const mask = sprite.tags.filter(t => t.code === 26).map(t => parsePlaceObject2(t.body)).find(p => p.name === 'Mask');
  assert.equal(mask.clipDepth, 8);
  assert.equal(decodeShape(83, swf.tags.find(t => t.code === 83 && t.body.readUInt16LE(0) === s1).body).fills.length, 1);
});
