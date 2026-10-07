// Assemble a G2 SWF by editing a template SWF: replace the art behind named part instances,
// reposition them and their pivot markers, and re-emit. Everything not touched is copied byte-for-byte.
import { readSwf, TAG, parsePlaceObject2, parseDefineSprite, parseShapeHeader } from './reader.js';
import { BitWriter, tag, u16, writeMatrix, swfFile } from './bits.js';
import { encodeShape4 } from './shape.js';

const DEFINE_CODES = new Set([TAG.DefineShape, TAG.DefineShape2, TAG.DefineShape3, TAG.DefineShape4, TAG.DefineSprite]);
const PX = 20; // twips per pixel

function placeBody(p) {
  const bw = new BitWriter();
  bw.u8((p.ratio !== undefined ? 0x10 : 0) | (p.name !== undefined ? 0x20 : 0) | (p.matrix ? 4 : 0) | (p.characterId !== undefined ? 2 : 0) | (p.move ? 1 : 0));
  bw.u16(p.depth);
  if (p.characterId !== undefined) bw.u16(p.characterId);
  if (p.matrix) writeMatrix(bw, p.matrix);
  if (p.ratio !== undefined) bw.u16(p.ratio);
  if (p.name !== undefined) { bw.raw(Buffer.from(p.name, 'utf8')); bw.u8(0); }
  return bw.toBuffer();
}

export class TemplateSwf {
  constructor(file) {
    this.swf = readSwf(file);
    this.tags = this.swf.tags.map(t => ({ code: t.code, body: t.body, parsed: t.code === TAG.PlaceObject2 ? parsePlaceObject2(t.body) : null }));
    this.byName = new Map();
    this.nextId = 1;
    this.chars = new Map();
    this.tags.forEach((t, i) => {
      if (DEFINE_CODES.has(t.code)) { const id = t.body.readUInt16LE(0); this.nextId = Math.max(this.nextId, id + 1); this.chars.set(id, i); }
      if (t.parsed && t.parsed.name !== undefined) this.byName.set(t.parsed.name, i);
    });
    this.newDefs = [];
  }

  has(name) { return this.byName.has(name); }
  placement(name) { const i = this.byName.get(name); if (i === undefined) throw new Error(`no instance named ${name}`); return this.tags[i]; }
  position(name) { const m = this.placement(name).parsed.matrix; return [m.tx / PX, m.ty / PX]; }

  /** Create a new sprite (one shape per path) drawn around `origin` (stage px). Returns the sprite id. */
  defineArt(paths, origin, opts) {
    const kids = [];
    paths.forEach((path, k) => {
      const id = this.nextId++;
      this.newDefs.push(tag(TAG.DefineShape4, encodeShape4(id, path, origin, opts).body));
      kids.push(tag(TAG.PlaceObject2, placeBody({ depth: k + 1, characterId: id, matrix: {} })));
    });
    const id = this.nextId++;
    this.newDefs.push(tag(TAG.DefineSprite, Buffer.concat([u16(id), u16(1), ...kids, tag(TAG.ShowFrame), tag(TAG.End)])));
    return id;
  }

  /**
   * Point instance `name` at sprite `spriteId`, positioned at `origin` (stage px).
   * Scale/skew sign of the template placement (mirroring) is kept unless `scaleX` is given. The matching pivot marker
   * (`<name lowercased>_pivot`) is shifted by the same delta unless `pivot` ([x,y] px) is given.
   */
  place(name, spriteId, origin, { pivot, scaleX } = {}) {
    const t = this.placement(name);
    if (t.body[0] & 8 || t.parsed.hasClipDepth || t.parsed.hasClipActions) throw new Error(`${name}: unsupported placement flags`);
    const old = t.parsed.matrix;
    const nx = Math.round(origin[0] * PX), ny = Math.round(origin[1] * PX);
    const dx = nx - old.tx, dy = ny - old.ty;
    t.parsed = { ...t.parsed, characterId: spriteId, matrix: { ...old, ...(scaleX !== undefined && { scaleX }), tx: nx, ty: ny } };
    t.body = placeBody(t.parsed);
    const pn = `${name.toLowerCase()}_pivot`;
    if (this.has(pn)) {
      const pt = this.placement(pn), pm = pt.parsed.matrix;
      const mx = pivot ? Math.round(pivot[0] * PX) : pm.tx + dx, my = pivot ? Math.round(pivot[1] * PX) : pm.ty + dy;
      pt.parsed = { ...pt.parsed, matrix: { ...pm, tx: mx, ty: my } };
      pt.body = placeBody(pt.parsed);
    }
  }

  /** Local bounds (px) of the symbol an instance shows: union of every variant/frame, children transformed. */
  instanceBounds(name) { return this.symbolBounds(this.placement(name).parsed.characterId); }

  symbolBounds(id, depth = 0) {
    const i = this.chars.get(id);
    if (i === undefined || depth > 8) return null;
    const t = this.tags[i];
    if (t.code === TAG.DefineSprite) {
      let b = null;
      for (const k of parseDefineSprite(t.body).tags) {
        if (k.code !== TAG.PlaceObject2) continue;
        const c = parsePlaceObject2(k.body);
        if (c.characterId === undefined) continue;
        const cb = this.symbolBounds(c.characterId, depth + 1);
        if (!cb) continue;
        const m = { scaleX: 1, scaleY: 1, skew0: 0, skew1: 0, tx: 0, ty: 0, ...(c.matrix || {}) };
        const pts = [[cb.xMin, cb.yMin], [cb.xMax, cb.yMin], [cb.xMin, cb.yMax], [cb.xMax, cb.yMax]]
          .map(([x, y]) => [m.scaleX * x + m.skew1 * y + m.tx / PX, m.skew0 * x + m.scaleY * y + m.ty / PX]);
        const tb = { xMin: Math.min(...pts.map(p => p[0])), xMax: Math.max(...pts.map(p => p[0])), yMin: Math.min(...pts.map(p => p[1])), yMax: Math.max(...pts.map(p => p[1])) };
        b = b ? { xMin: Math.min(b.xMin, tb.xMin), xMax: Math.max(b.xMax, tb.xMax), yMin: Math.min(b.yMin, tb.yMin), yMax: Math.max(b.yMax, tb.yMax) } : tb;
      }
      return b;
    }
    const h = parseShapeHeader(t.code, t.body).bounds;
    return { xMin: h.xMin / PX, xMax: h.xMax / PX, yMin: h.yMin / PX, yMax: h.yMax / PX };
  }

  /** True when the template draws this instance mirrored horizontally. */
  isMirrored(name) { return this.placement(name).parsed.matrix.scaleX < 0; }

  build({ compress = true } = {}) {
    const firstPlace = this.tags.findIndex(t => t.code === TAG.PlaceObject2);
    const out = [];
    this.tags.forEach((t, i) => {
      if (i === firstPlace) out.push(...this.newDefs);
      out.push(tag(t.code, t.body));
    });
    return swfFile({ version: this.swf.version, frameSize: this.swf.frameSize, frameRate: this.swf.frameRate, frameCount: this.swf.frameCount, tags: out, compress });
  }
}
