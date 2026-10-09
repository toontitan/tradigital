import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { readSwf, TAG, parsePlaceObject2 } from '../src/swf/reader.js';

test('server: rig info and export work with no template file', async () => {
  const server = createApp({}).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const info = await (await fetch(`${base}/api/template`)).json();
    assert.equal(info.rig, 'mojo');
    assert.equal(Object.keys(info.slots).length, 209); // only the parts Cartoon Animator expects per view
    assert.ok(info.reflections['45>315'].K > 1000);
    const ch = { name: 't', art: { Right_arm_0: { origin: info.slots.Right_arm_0.origin, paths: [{ d: 'M0,0L10,0L10,10Z', fill: '#f00', stroke: '#000', strokeWidth: 3 }] }, Left_arm_0: { mirrorOf: 'Right_arm_0' } } };
    const r = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ch) });
    assert.equal(r.status, 200);
    const report = JSON.parse(decodeURIComponent(r.headers.get('X-Report')));
    assert.deepEqual(report.views, ['0']);
    assert.equal(report.drawn, 1); assert.equal(report.mirrored, 1);
    const swf = readSwf(Buffer.from(await r.arrayBuffer()));
    const names = swf.tags.filter(t => t.code === TAG.PlaceObject2).map(t => parsePlaceObject2(t.body).name);
    assert.equal(names.filter(n => /^[A-Z]/.test(n)).length, 26);
    const bad = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ art: { Left_arm_0: { mirrorOf: 'Right_arm_0' } } }) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});
