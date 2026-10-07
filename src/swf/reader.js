// Minimal SWF reader: header, tag framing, and the handful of tags that
// matter for G2 templates (shapes, sprites, PlaceObject2, SymbolClass).
import zlib from 'node:zlib';

export const TAG = {
  End: 0, ShowFrame: 1, DefineShape: 2, PlaceObject: 4, RemoveObject: 5,
  DefineShape2: 22, PlaceObject2: 26, RemoveObject2: 28, DefineShape3: 32,
  DefineSprite: 39, FrameLabel: 43, DefineShape4: 83, FileAttributes: 69,
  Metadata: 77, DoABC: 82, SymbolClass: 76, DefineSceneAndFrameLabelData: 86,
  SetBackgroundColor: 9, EnableDebugger2: 64,
};

export class BitReader {
  constructor(buf, pos = 0) { this.buf = buf; this.pos = pos; this.bit = 0; }
  align() { if (this.bit) { this.bit = 0; this.pos++; } }
  ub(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = v * 2 + ((this.buf[this.pos] >> (7 - this.bit)) & 1);
      if (++this.bit === 8) { this.bit = 0; this.pos++; }
    }
    return v;
  }
  sb(n) {
    if (n === 0) return 0;
    const v = this.ub(n);
    return v >= 2 ** (n - 1) ? v - 2 ** n : v;
  }
  fb(n) { return this.sb(n) / 65536; }
}

export function parseRect(br) {
  const n = br.ub(5);
  const r = { xMin: br.sb(n), xMax: br.sb(n), yMin: br.sb(n), yMax: br.sb(n) };
  br.align();
  return r;
}

export function parseMatrix(br) {
  const m = { scaleX: 1, scaleY: 1, skew0: 0, skew1: 0, tx: 0, ty: 0 };
  if (br.ub(1)) { const n = br.ub(5); m.scaleX = br.fb(n); m.scaleY = br.fb(n); }
  if (br.ub(1)) { const n = br.ub(5); m.skew0 = br.fb(n); m.skew1 = br.fb(n); }
  const n = br.ub(5);
  m.tx = br.sb(n); m.ty = br.sb(n);
  br.align();
  return m;
}

export function readSwf(file) {
  const sig = file.toString('latin1', 0, 3);
  const version = file[3];
  const length = file.readUInt32LE(4);
  let body;
  if (sig === 'FWS') body = file.subarray(8);
  else if (sig === 'CWS') body = zlib.inflateSync(file.subarray(8));
  else throw new Error(`Unsupported SWF signature ${sig}`);
  const br = new BitReader(body);
  const frameSize = parseRect(br);
  const frameRate = body.readUInt16LE(br.pos) / 256;
  const frameCount = body.readUInt16LE(br.pos + 2);
  const tags = readTags(body, br.pos + 4);
  return { signature: sig, version, length, frameSize, frameRate, frameCount, tags };
}

export function readTags(buf, pos = 0, end = buf.length) {
  const tags = [];
  while (pos < end) {
    const h = buf.readUInt16LE(pos); pos += 2;
    const code = h >> 6;
    let len = h & 63;
    if (len === 63) { len = buf.readUInt32LE(pos); pos += 4; }
    tags.push({ code, body: buf.subarray(pos, pos + len) });
    pos += len;
    if (code === TAG.End) break;
  }
  return tags;
}

export function cstring(buf, pos) {
  const e = buf.indexOf(0, pos);
  return { str: buf.toString('utf8', pos, e), next: e + 1 };
}

export function parsePlaceObject2(body) {
  const flags = body[0];
  const p = { hasClipActions: !!(flags & 128), hasClipDepth: !!(flags & 64), move: !!(flags & 1) };
  p.depth = body.readUInt16LE(1);
  let pos = 3;
  if (flags & 2) { p.characterId = body.readUInt16LE(pos); pos += 2; }
  if (flags & 4) { const br = new BitReader(body, pos); p.matrix = parseMatrix(br); pos = br.pos; }
  if (flags & 8) { // CXFORM (with alpha)
    const br = new BitReader(body, pos);
    const hasAdd = br.ub(1), hasMul = br.ub(1), n = br.ub(4);
    if (hasMul) for (let i = 0; i < 4; i++) br.sb(n);
    if (hasAdd) for (let i = 0; i < 4; i++) br.sb(n);
    br.align(); pos = br.pos;
  }
  if (flags & 16) { p.ratio = body.readUInt16LE(pos); pos += 2; }
  if (flags & 32) { const s = cstring(body, pos); p.name = s.str; pos = s.next; }
  if (flags & 64) { p.clipDepth = body.readUInt16LE(pos); pos += 2; }
  return p;
}

export function parseDefineSprite(body) {
  return { id: body.readUInt16LE(0), frameCount: body.readUInt16LE(2), tags: readTags(body, 4) };
}

export function parseShapeHeader(code, body) {
  const id = body.readUInt16LE(0);
  const br = new BitReader(body, 2);
  const bounds = parseRect(br);
  const out = { id, bounds, version: { 2: 1, 22: 2, 32: 3, 83: 4 }[code] };
  if (code === TAG.DefineShape4) { // edge bounds + flags
    out.edgeBounds = parseRect(br);
    out.flags = body[br.pos];
  }
  return out;
}

export function parseSymbolClass(body) {
  const n = body.readUInt16LE(0);
  const out = [];
  let pos = 2;
  for (let i = 0; i < n; i++) {
    const id = body.readUInt16LE(pos);
    const s = cstring(body, pos + 2);
    out.push({ id, name: s.str });
    pos = s.next;
  }
  return out;
}
