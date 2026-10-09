// Usage: node tools/complete-rigs.mjs [rig ...]   Writes completed versions of built-in rigs in place (see src/rig/complete.js). Idempotent.
import fs from 'node:fs';
import { complete, readRaw, rigFile, rigNames } from '../src/rig/library.js';

for (const name of process.argv.length > 2 ? process.argv.slice(2) : rigNames()) {
  const before = readRaw(name), { data, filled } = complete(before);
  if (!filled.length) { console.log(`${name}: complete`); continue; }
  fs.writeFileSync(rigFile(name), JSON.stringify(data));
  console.log(`${name}: filled ${filled.length} slots`);
}
