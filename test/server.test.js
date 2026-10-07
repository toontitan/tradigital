import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { readSwf } from '../src/swf/reader.js';

const TPL = process.env.BILLY_SWF;
test('server: template info and export', { skip: !TPL }, async () => {
  const server = createApp(TPL).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const info = await (await fetch(`${base}/api/template`)).json();
    assert.equal(Object.keys(info.slots).length, 254);
    assert.ok(info.reflections['45>315'].K > 3000);
    const ch = { name: 't', art: { Right_arm_0: { origin: [269.6, 355.4], paths: [{ d: 'M0,0L10,0L10,10Z', fill: '#f00' }] }, Left_arm_0: { mirrorOf: 'Right_arm_0' } }, options: { fallback: false } };
    const r = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ch) });
    assert.equal(r.status, 200);
    assert.equal(readSwf(Buffer.from(await r.arrayBuffer())).version, 15);
    const bad = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ art: { Left_arm_0: { mirrorOf: 'Right_arm_0' } } }) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});
