// A rig = the skeleton layout of a G2 character: where every part and pivot sits in every view, as plain data.
// Implements the same geometry interface as TemplateSwf (has/position/matrix/localBounds/instanceBounds/depth/stageSize),
// so placeholders, reflections and the editor work without any template SWF.
import { PARTS, VIEWS, instanceName, pivotName } from '../model/rig.js';

export class Rig {
  /** @param {{name:string,stage:{width:number,height:number},slots:object,pivots:object,absent:object}} data */
  constructor(data) {
    this.data = data;
    this.name = data.name;
    this.slots = data.slots;      // key -> {origin:[x,y], matrix:[a,b,c,d], depth, local:{xMin,xMax,yMin,yMax}, pivot:[x,y]|null}
    this.pivots = data.pivots;    // name -> [x,y]  (<part>_<view>_pivot and *_nud_*_pivot)
    this.absent = data.absent;    // view -> [part ids that the source layout leaves out (hidden in that view)]
  }

  has(key) { return key in this.slots || key in this.pivots; }
  position(key) {
    if (key in this.slots) return this.slots[key].origin;
    if (key in this.pivots) return this.pivots[key];
    throw new Error(`rig ${this.name}: no slot ${key}`);
  }
  matrix(key) { const [a, b, c, d] = this.slots[key].matrix; return { scaleX: a, skew0: b, skew1: c, scaleY: d }; }
  localBounds(key) { return this.slots[key].local; }
  depth(key) { return this.slots[key].depth; }
  stageSize() { return this.data.stage; }
  isMirrored(key) { return this.slots[key].matrix[0] < 0; }

  /** Visual bounds relative to the origin, after the slot's own flip/rotation. */
  instanceBounds(key) {
    const b = this.localBounds(key); if (!b) return null;
    const { scaleX: a, skew0: bb, skew1: c, scaleY: d } = this.matrix(key);
    const pts = [[b.xMin, b.yMin], [b.xMax, b.yMin], [b.xMin, b.yMax], [b.xMax, b.yMax]].map(([x, y]) => [a * x + c * y, bb * x + d * y]);
    return { xMin: Math.min(...pts.map(p => p[0])), xMax: Math.max(...pts.map(p => p[0])), yMin: Math.min(...pts.map(p => p[1])), yMax: Math.max(...pts.map(p => p[1])) };
  }

  /** Parts that exist in the layout for a view, and those it leaves out. */
  presentParts(view) { return PARTS.filter(p => instanceName(p.id, view) in this.slots).map(p => p.id); }
  absentParts(view) { return this.absent[view] ?? []; }
  /** Where an absent part's dot goes: the face's origin in that view (falls back to the stage centre). */
  dotOrigin(view) {
    const f = instanceName('Face', view);
    if (f in this.slots) return this.slots[f].origin;
    const s = this.stageSize(); return [s.width / 2, s.height / 2];
  }
  pivotFor(part, view) { return this.pivots[pivotName(part, view)] ?? null; }
}

export { VIEWS };
