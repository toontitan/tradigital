// PlaceObject2 / RemoveObject2 bodies, including names, matrices and clip depths.
import { BitWriter, writeMatrix } from './bits.js';

export function placeBody({ depth, characterId, matrix, name, clipDepth, move = false }) {
  const bw = new BitWriter();
  bw.u8((clipDepth !== undefined ? 0x40 : 0) | (name !== undefined ? 0x20 : 0) | (matrix ? 4 : 0) | (characterId !== undefined ? 2 : 0) | (move ? 1 : 0));
  bw.u16(depth);
  if (characterId !== undefined) bw.u16(characterId);
  if (matrix) writeMatrix(bw, matrix);
  if (name !== undefined) { bw.raw(Buffer.from(name, 'utf8')); bw.u8(0); }
  if (clipDepth !== undefined) bw.u16(clipDepth);
  return bw.toBuffer();
}

export function removeBody(depth) { const b = Buffer.alloc(2); b.writeUInt16LE(depth); return b; }
