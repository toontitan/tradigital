// Fill the blanks of a rig: every part CTA expects in every view gets a slot (and pivot) so the editor and exporter see a complete skeleton.
// Order of preference per missing slot:
//   1. mirror: the counterpart part in the mirrored view of the SAME rig, reflected (x' = K - x, y' = y + dy, flipped matrix);
//   2. donor: the same slot in a complete donor rig, placed relative to its (present or already filled) parent and scaled by the body-height ratio.
// A whole missing view is laid out in a new column to the right of the existing ones. `filled` records where each slot came from.
import { PARTS, VIEWS, MIRROR_VIEW, counterpart, instanceName, pivotName } from '../model/rig.js';
import { EXPECTED_PARTS } from './spec.js';
import { Rig } from './rig.js';
import { deriveReflections } from '../model/reflect.js';

const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
const NUD = { head_nud: 'Face', left_hand_nud: 'Left_hand', right_hand_nud: 'Right_hand', left_foot_nud: 'Left_foot', right_foot_nud: 'Right_foot' };
const nudName = (n, view) => `${n}_${view}_pivot`;
const swapSide = (n) => n.startsWith('left_') ? n.replace('left_', 'right_') : n.startsWith('right_') ? n.replace('right_', 'left_') : n;

/** Height used to scale donor offsets: stage distance from the face to the left foot in the front view. */
const bodyHeight = (d) => Math.abs(d.slots.Left_foot_0.origin[1] - d.slots.Face_0.origin[1]);

/**
 * @param {object} data rig data to complete (not modified)
 * @param {object[]} donors complete rig data objects, tried in order
 * @returns {{data:object, filled:Record<string,string>}}
 */
export function completeRig(data, donors = []) {
  const complete = VIEWS.every(v => EXPECTED_PARTS[v].every(p => data.slots[instanceName(p, v)]));
  if (complete) return { data, filled: [] }; // nothing to add: leave the rig exactly as it is
  const out = JSON.parse(JSON.stringify(data));
  const filled = { ...(out.filled ?? {}) };
  const refl = deriveReflections(new Rig(out));
  const donorInfo = donors.filter(d => d !== data && d.slots.Face_0 && d.slots.Left_foot_0).map(d => ({ d, s: bodyHeight(out) / bodyHeight(d) }));
  const rightEdge = () => Math.max(...Object.values(out.slots).map(s => s.origin[0] + (s.local?.xMax ?? 0) * Math.abs(s.matrix[0])));
  const newColumn = {}; // view -> x shift applied to donor layout for a view this rig lacks entirely

  const mirrorSlot = (part, view) => {
    const w = MIRROR_VIEW[view], q = counterpart(part), src = out.slots[instanceName(q, w)];
    const r = refl.get(`${w}>${view}`);
    if (!src || !r || (q === part && w === view)) return null;
    const [a, b, c, d] = src.matrix;
    return { origin: [r2(r.K - src.origin[0]), r2(src.origin[1] + r.dy)], matrix: [-a, b, -c, d].map(r4), depth: src.depth, local: { ...src.local }, from: `mirror:${instanceName(q, w)}` };
  };
  const donorSlot = (part, view) => {
    for (const { d, s } of donorInfo) {
      const ds = d.slots[instanceName(part, view)]; if (!ds) continue;
      const par = PARTS.find(p => p.id === part).parent;
      let origin;
      if (par && out.slots[instanceName(par, view)] && d.slots[instanceName(par, view)]) {
        const pr = out.slots[instanceName(par, view)].origin, pd = d.slots[instanceName(par, view)].origin;
        origin = [pr[0] + s * (ds.origin[0] - pd[0]), pr[1] + s * (ds.origin[1] - pd[1])];
      } else {
        // root of a view this rig lacks: fresh column to the right, level with the front view's root
        const fr = out.slots[instanceName(part, '0')]; if (!fr) continue;
        if (!newColumn[view]) newColumn[view] = rightEdge() + 150 * s + 100;
        origin = [newColumn[view], fr.origin[1]];
      }
      return { origin: origin.map(r2), matrix: ds.matrix.map(v => r4(v * s)), depth: ds.depth, local: { ...ds.local }, from: `donor:${d.name}`, d, ds, s };
    }
    return null;
  };

  const filledSlots = [];
  const viewHas = (v) => Object.keys(out.slots).some(k => k.endsWith(`_${v}`));
  for (const view of VIEWS) {
    // a view the rig lacks whose mirror view exists: reflect into a fresh column to the right (single row, dy = 0)
    const w = MIRROR_VIEW[view];
    if (w !== view && !viewHas(view) && viewHas(w) && !refl.has(`${w}>${view}`)) {
      const xs = Object.values(out.slots).filter((_, i) => Object.keys(out.slots)[i].endsWith(`_${w}`)).map(sl => sl.origin[0] + (sl.local?.xMax ?? 0) * Math.abs(sl.matrix[0]));
      refl.set(`${w}>${view}`, { K: r2(rightEdge() + 100 + Math.max(...xs)), dy: 0, n: 0, spread: 0 });
    }
    for (const part of PARTS.map(p => p.id)) { // PARTS lists parents before children
      if (!EXPECTED_PARTS[view].includes(part)) continue;
      const key = instanceName(part, view);
      if (out.slots[key]) continue;
      const f = mirrorSlot(part, view) ?? donorSlot(part, view);
      if (!f) continue;
      const { d, ds, s, from, ...slot } = f;
      out.slots[key] = slot; filled[key] = from; filledSlots.push(key);
      // pivot
      const pn = pivotName(part, view);
      if (!out.pivots[pn]) {
        if (from.startsWith('mirror:')) {
          const w = MIRROR_VIEW[view], r = refl.get(`${w}>${view}`), sp = out.pivots[pivotName(counterpart(part), w)];
          if (sp) out.pivots[pn] = [r2(r.K - sp[0]), r2(sp[1] + r.dy)];
        } else if (d.pivots[pn]) out.pivots[pn] = [r2(slot.origin[0] + s * (d.pivots[pn][0] - ds.origin[0])), r2(slot.origin[1] + s * (d.pivots[pn][1] - ds.origin[1]))];
      }
    }
  }
  // nudge markers (head/hand/foot) that exist in the donor or mirrored view but not here
  for (const view of VIEWS) for (const [n, owner] of Object.entries(NUD)) {
    const pn = nudName(n, view);
    if (out.pivots[pn] || !EXPECTED_PARTS[view].includes(owner) || !out.slots[instanceName(owner, view)]) continue;
    const w = MIRROR_VIEW[view], r = refl.get(`${w}>${view}`), sp = out.pivots[nudName(swapSide(n), w)];
    if (sp && r && !(w === view && swapSide(n) === n)) { out.pivots[pn] = [r2(r.K - sp[0]), r2(sp[1] + r.dy)]; filled[pn] = 'mirror'; continue; }
    for (const { d, s } of donorInfo) {
      const dp = d.pivots[pn], dso = d.slots[instanceName(owner, view)];
      if (dp && dso) { const o = out.slots[instanceName(owner, view)].origin; out.pivots[pn] = [r2(o[0] + s * (dp[0] - dso.origin[0])), r2(o[1] + s * (dp[1] - dso.origin[1]))]; filled[pn] = `donor:${d.name}`; break; }
    }
  }
  out.absent = Object.fromEntries(VIEWS.map(v => [v, PARTS.filter(p => !out.slots[instanceName(p.id, v)]).map(p => p.id)]));
  const maxX = Math.max(...Object.values(out.slots).map(s => s.origin[0] + (s.local?.xMax ?? 0) * Math.abs(s.matrix[0]))), maxY = Math.max(...Object.values(out.slots).map(s => s.origin[1] + (s.local?.yMax ?? 0) * Math.abs(s.matrix[3])));
  out.stage = { width: Math.max(out.stage.width, Math.ceil(maxX + 50)), height: Math.max(out.stage.height, Math.ceil(maxY + 50)) };
  if (Object.keys(filled).length) out.filled = filled;
  return { data: out, filled: filledSlots };
}
