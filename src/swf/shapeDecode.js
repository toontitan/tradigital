// DefineShape(1-4) body decoder -> edges grouped by style (for fallback display and tests).
import { BitReader, parseRect, parseMatrix } from './reader.js';

function readFillStyle(br, v, buf) {
  br.align();
  const type = buf[br.pos++];
  const f = { type };
  if (type === 0) {
    const n = v >= 3 ? 4 : 3; f.color = [...buf.subarray(br.pos, br.pos + n)]; br.pos += n; if (n === 3) f.color.push(255);
  } else if (type === 0x10 || type === 0x12 || type === 0x13) {
    parseMatrix(br); br.align();
    const count = buf[br.pos++] & 15, per = v >= 3 ? 4 : 3;
    br.pos += count * (1 + per) + (type === 0x13 ? 2 : 0);
    f.gradient = true;
  } else if (type >= 0x40 && type <= 0x43) {
    br.pos += 2; parseMatrix(br); br.align(); f.bitmap = true;
  } else throw new Error(`unknown fill style 0x${type.toString(16)}`);
  return f;
}

function readLineStyle(br, v, buf) {
  br.align();
  const width = buf.readUInt16LE(br.pos); br.pos += 2;
  if (v < 4) { const n = v >= 3 ? 4 : 3; const color = [...buf.subarray(br.pos, br.pos + n)]; br.pos += n; return { width, color }; }
  const b0 = buf[br.pos], b1 = buf[br.pos + 1]; br.pos += 2;
  const join = (b0 >> 4) & 3, hasFill = (b0 >> 3) & 1;
  if (join === 2) br.pos += 2;
  if (hasFill) { const fs = readFillStyle(br, v, buf); return { width, fill: fs, color: fs.color }; }
  const color = [...buf.subarray(br.pos, br.pos + 4)]; br.pos += 4;
  return { width, color, noClose: !!((b1 >> 2) & 1) };
}

function readStyles(br, v, buf) {
  br.align();
  let nf = buf[br.pos++]; if (nf === 255 && v >= 2) { nf = buf.readUInt16LE(br.pos); br.pos += 2; }
  const fills = []; for (let i = 0; i < nf; i++) fills.push(readFillStyle(br, v, buf));
  let nl = buf[br.pos++]; if (nl === 255 && v >= 2) { nl = buf.readUInt16LE(br.pos); br.pos += 2; }
  const lines = []; for (let i = 0; i < nl; i++) lines.push(readLineStyle(br, v, buf));
  return { fills, lines };
}

/** @returns {{id,bounds,fills,lines,edges,end:number}} edges: {x0,y0,cx?,cy?,x1,y1,f0,f1,line} in twips */
export function decodeShape(code, buf) {
  const v = { 2: 1, 22: 2, 32: 3, 83: 4 }[code];
  const id = buf.readUInt16LE(0);
  const br = new BitReader(buf, 2);
  const bounds = parseRect(br);
  if (v === 4) { parseRect(br); br.pos++; }
  let { fills, lines } = readStyles(br, v, buf);
  let fb = br.ub(4), lb = br.ub(4);
  const edges = [];
  let x = 0, y = 0, f0 = 0, f1 = 0, ln = 0;
  for (;;) {
    if (br.ub(1)) {
      const straight = br.ub(1), nb = br.ub(4) + 2;
      if (straight) {
        let dx = 0, dy = 0;
        if (br.ub(1)) { dx = br.sb(nb); dy = br.sb(nb); } else if (br.ub(1)) dy = br.sb(nb); else dx = br.sb(nb);
        edges.push({ x0: x, y0: y, x1: x + dx, y1: y + dy, f0, f1, line: ln }); x += dx; y += dy;
      } else {
        const cx = x + br.sb(nb), cy = y + br.sb(nb), ax = cx + br.sb(nb), ay = cy + br.sb(nb);
        edges.push({ x0: x, y0: y, cx, cy, x1: ax, y1: ay, f0, f1, line: ln }); x = ax; y = ay;
      }
    } else {
      const ns = br.ub(1), sl = br.ub(1), s1 = br.ub(1), s0 = br.ub(1), mv = br.ub(1);
      if (!(ns || sl || s1 || s0 || mv)) break;
      if (mv) { const n = br.ub(5); x = br.sb(n); y = br.sb(n); }
      if (s0) f0 = br.ub(fb); if (s1) f1 = br.ub(fb); if (sl) ln = br.ub(lb);
      if (ns) { const s = readStyles(br, v, buf); fills = s.fills; lines = s.lines; fb = br.ub(4); lb = br.ub(4); f0 = f1 = ln = 0; }
    }
  }
  br.align();
  return { id, bounds, fills, lines, edges, end: br.pos };
}

const seg = (e) => (e.cx === undefined ? `L${e.x1} ${e.y1}` : `Q${e.cx} ${e.cy} ${e.x1} ${e.y1}`);
const rev = (e) => (e.cx === undefined ? { x0: e.x1, y0: e.y1, x1: e.x0, y1: e.y0 } : { x0: e.x1, y0: e.y1, cx: e.cx, cy: e.cy, x1: e.x0, y1: e.y0 });

/** Stitch edges into closed outlines per fill style. Returns [{fill, d}] with coordinates in pixels. */
export function shapeToSvg(shape, scale = 20) {
  const out = [];
  shape.fills.forEach((fs, i) => {
    const todo = [];
    for (const e of shape.edges) { if (e.f1 === i + 1) todo.push(e); if (e.f0 === i + 1) todo.push(rev(e)); }
    const key = (x, y) => `${x},${y}`, byStart = new Map();
    todo.forEach((e, k) => { const s = key(e.x0, e.y0); if (!byStart.has(s)) byStart.set(s, []); byStart.get(s).push(k); });
    const used = new Set(); let d = '';
    for (let k = 0; k < todo.length; k++) {
      if (used.has(k)) continue;
      let e = todo[k]; used.add(k);
      d += `M${e.x0} ${e.y0}${seg(e)}`;
      for (;;) {
        const nexts = byStart.get(key(e.x1, e.y1)); const n = nexts && nexts.find(j => !used.has(j));
        if (n === undefined) break;
        used.add(n); e = todo[n]; d += seg(e);
      }
      d += 'Z';
    }
    if (d) out.push({ fill: fs.color, d: d.replace(/(-?\d+) (-?\d+)/g, (_, a, b) => `${a / scale} ${b / scale}`) });
  });
  return out;
}
