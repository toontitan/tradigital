// Usage: node tools/complete-rigs.mjs [rig ...]   Fills missing parts/views of built-in rigs in place (see src/rig/complete.js). Idempotent.
import fs from 'node:fs';
import { completeRig } from '../src/rig/complete.js';

const dir = new URL('../src/rig/rigs/', import.meta.url);
const read = (n) => JSON.parse(fs.readFileSync(new URL(`${n}.json`, dir), 'utf8'));
const names = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const DONORS = ['mojo', 'kevin'];
for (const name of process.argv.length > 2 ? process.argv.slice(2) : names) {
  const { data, filled } = completeRig(read(name), DONORS.filter(d => d !== name).map(read));
  if (!filled.length && JSON.stringify(data) === JSON.stringify(read(name))) { console.log(`${name}: complete`); continue; }
  fs.writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(data));
  console.log(`${name}: filled ${filled.length} slots (${Object.values(data.filled ?? {}).filter(v => v.startsWith('mirror')).length} mirrored)`);
}
