// Built-in rig library: always complete. Any rig that enters the system (extracted, loaded from a template SWF, read from disk) goes through here.
import fs from 'node:fs';
import { completeRig } from './complete.js';

const dir = new URL('./rigs/', import.meta.url);
const DONORS = ['mojo', 'kevin'];
export const rigFile = (name) => new URL(`${name}.json`, dir);
export const rigNames = () => fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
export const readRaw = (name) => JSON.parse(fs.readFileSync(rigFile(name), 'utf8'));

/** @returns {{data:object, filled:string[]}} rig data with every expected part/view present (donors: mojo, kevin) */
export function complete(data) {
  const donors = DONORS.filter(n => n !== data.name && fs.existsSync(rigFile(n))).map(readRaw);
  return completeRig(data, donors);
}
/** Read a built-in rig, completed. */
export const readRig = (name) => complete(readRaw(name)).data;
