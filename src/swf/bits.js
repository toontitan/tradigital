// Bit-level writer and SWF primitive encoders (RECT, MATRIX, tag framing).
import zlib from 'node:zlib';

export function sbits(v) {
  if (v === 0) return 0;
  let n = 1;
  while (!(v >= -(2 ** (n - 1)) && v < 2 ** (n - 1))) n++;
  return n;
}

export class BitWriter {
  constructor() { this.out = []; this.cur = 0; this.n = 0; }
  ub(v, n) {
    for (let i = n - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | (Math.floor(v / 2 ** i) % 2);
      if (++this.n === 8) { this.out.push(this.cur); this.cur = 0; this.n = 0; }
    }
  }
  sb(v, n) { if (n) this.ub(v < 0 ? v + 2 ** n : v, n); }
  fb(v, n) { this.sb(Math.round(v * 65536), n); }
  align() { if (this.n) { this.out.push((this.cur << (8 - this.n)) & 255); this.cur = 0; this.n = 0; } }
  u8(v) { this.align(); this.out.push(v & 255); }
  u16(v) { this.u8(v); this.out.push((v >> 8) & 255); }
  raw(buf) { this.align(); for (const b of buf) this.out.push(b); }
  toBuffer() { this.align(); return Buffer.from(this.out); }
}

export function rectBytes({ xMin, xMax, yMin, yMax }) {
  const bw = new BitWriter();
  const n = Math.max(sbits(xMin), sbits(xMax), sbits(yMin), sbits(yMax));
  bw.ub(n, 5);
  for (const v of [xMin, xMax, yMin, yMax]) bw.sb(v, n);
  return bw.toBuffer();
}

export function writeMatrix(bw, m = {}) {
  const { scaleX = 1, scaleY = 1, skew0 = 0, skew1 = 0, tx = 0, ty = 0 } = m;
  if (scaleX !== 1 || scaleY !== 1) {
    const fx = Math.round(scaleX * 65536), fy = Math.round(scaleY * 65536);
    const n = Math.max(sbits(fx), sbits(fy));
    bw.ub(1, 1); bw.ub(n, 5); bw.sb(fx, n); bw.sb(fy, n);
  } else bw.ub(0, 1);
  if (skew0 !== 0 || skew1 !== 0) {
    const f0 = Math.round(skew0 * 65536), f1 = Math.round(skew1 * 65536);
    const n = Math.max(sbits(f0), sbits(f1));
    bw.ub(1, 1); bw.ub(n, 5); bw.sb(f0, n); bw.sb(f1, n);
  } else bw.ub(0, 1);
  const n = Math.max(sbits(tx), sbits(ty));
  bw.ub(n, 5); bw.sb(tx, n); bw.sb(ty, n);
}

export function matrixBytes(m) { const bw = new BitWriter(); writeMatrix(bw, m); return bw.toBuffer(); }

export function tag(code, body = Buffer.alloc(0)) {
  if (body.length < 63) {
    const h = Buffer.alloc(2); h.writeUInt16LE((code << 6) | body.length); return Buffer.concat([h, body]);
  }
  const h = Buffer.alloc(6); h.writeUInt16LE((code << 6) | 63); h.writeUInt32LE(body.length, 2);
  return Buffer.concat([h, body]);
}

export function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }

export function swfFile({ version, frameSize, frameRate, frameCount, tags, compress = true }) {
  const head = Buffer.concat([rectBytes(frameSize), Buffer.from([0, frameRate]), u16(frameCount)]);
  const body = Buffer.concat([head, ...tags]);
  const hdr = Buffer.alloc(8);
  hdr.write(compress ? 'CWS' : 'FWS', 0, 'latin1'); hdr[3] = version; hdr.writeUInt32LE(body.length + 8, 4);
  return Buffer.concat([hdr, compress ? zlib.deflateSync(body, { level: 9 }) : body]);
}
