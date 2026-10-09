// Builds a SWF from scratch: no template file. Mirrors what Animate writes: FileAttributes (AS3 flag),
// background colour, scene label, then definitions, root placements, ShowFrame, End.
import { tag, u16, swfFile } from './bits.js';
import { TAG } from './reader.js';
import { encodeShape4 } from './shape.js';
import { placeBody, removeBody } from './place.js';

const TAG_REMOVE2 = 28;

export class SwfBuilder {
  constructor({ width = 2500, height = 2000, fps = 24, version = 20, background = [0x99, 0xcc, 0xff] } = {}) {
    Object.assign(this, { width, height, fps, version, background });
    this.nextId = 1; this.defs = []; this.root = []; this.bytesShapes = 0;
  }

  /** Define one filled shape (see shape.js for path options). Coordinates are stage px; `origin` becomes (0,0). */
  shape(path, origin = [0, 0], opts) {
    const id = this.nextId++;
    this.defs.push(tag(TAG.DefineShape4, encodeShape4(id, path, origin, opts).body));
    return id;
  }

  /**
   * Define a sprite. frames = array of frames; each frame is an array of children
   * {id, depth, name?, matrix?, clipDepth?}. Between frames the previous children are removed.
   */
  sprite(frames) {
    const id = this.nextId++, body = [u16(id), u16(frames.length)];
    let prev = [];
    for (const children of frames) {
      for (const d of prev) body.push(tag(TAG_REMOVE2, removeBody(d)));
      for (const c of children) body.push(tag(TAG.PlaceObject2, placeBody({ matrix: {}, ...c, characterId: c.id })));
      body.push(tag(TAG.ShowFrame));
      prev = children.map(c => c.depth);
    }
    body.push(tag(TAG.End));
    this.defs.push(tag(TAG.DefineSprite, Buffer.concat(body)));
    return id;
  }

  /** Sprite with a single frame of shapes (the common case: a part made of stacked paths). */
  art(paths, origin, opts) {
    const kids = paths.map((p, k) => ({ id: this.shape(p, origin, opts), depth: k + 1 }));
    return this.sprite([kids]);
  }

  /** Place a character on the main timeline. */
  place({ id, depth, name, matrix }) { this.root.push(tag(TAG.PlaceObject2, placeBody({ depth, characterId: id, name, matrix }))); }

  build({ compress = true } = {}) {
    const scene = Buffer.concat([Buffer.from([1, 0]), Buffer.from('Scene 1\0', 'latin1'), Buffer.from([0])]);
    const tags = [
      tag(TAG.FileAttributes, Buffer.from([0x08, 0, 0, 0])),
      tag(TAG.SetBackgroundColor, Buffer.from(this.background)),
      tag(TAG.DefineSceneAndFrameLabelData, scene),
      ...this.defs, ...this.root, tag(TAG.ShowFrame), tag(TAG.End),
    ];
    return swfFile({
      version: this.version, frameSize: { xMin: 0, xMax: this.width * 20, yMin: 0, yMax: this.height * 20 },
      frameRate: this.fps, frameCount: 1, tags, compress,
    });
  }
}
