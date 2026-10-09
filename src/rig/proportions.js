// Proportions: adjust bone lengths and joint sizes of a rig. A bone length is the distance from a joint to the next joint,
// scaled in the PARENT's own space, so every view keeps its foreshortening (a rotated 3/4-view arm stays rotated).
// Everything attached further down the chain moves with it, pivots included.
import { PARTS, VIEWS, instanceName } from '../model/rig.js';

/** The bone each jointed part's origin is the end of. `side: true` = exists per side (Left_/Right_). */
export const BONES = {
  pelvis:    { label: 'Pelvis (waist height)', child: 'Upper_torso', parent: 'Lower_torso' },
  torso:     { label: 'Torso length',          child: 'Neck',        parent: 'Upper_torso' },
  neck:      { label: 'Neck length',           child: 'Face',        parent: 'Neck' },
  shoulders: { label: 'Shoulder spread',       child: 'arm',         parent: 'Upper_torso', side: true },
  upper_arm: { label: 'Upper arm',             child: 'forearm',     parent: 'arm', side: true },
  forearm:   { label: 'Forearm',               child: 'hand',        parent: 'forearm', side: true },
  hips:      { label: 'Hip spread',            child: 'thigh',       parent: 'Lower_torso', side: true },
  thigh:     { label: 'Thigh',                 child: 'shank',       parent: 'thigh', side: true },
  shank:     { label: 'Shank',                 child: 'foot',        parent: 'shank', side: true },
};

export const JOINTS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'waist', 'neck_base', 'neck_top'];

const NUD_OWNER = { head_nud: 'Face', left_hand_nud: 'Left_hand', right_hand_nud: 'Right_hand', left_foot_nud: 'Left_foot', right_foot_nud: 'Right_foot' };

/** Scale factor of the bone that ends at `part` (1 when untouched). Side-specific keys (Left_forearm) beat generic ones (forearm). */
export function boneFactor(part, bones = {}) {
  for (const [name, b] of Object.entries(BONES)) {
    const side = /^(Left_|Right_)/.exec(part)?.[1] ?? '';
    const child = b.side ? `${side}${b.child}` : b.child;
    if (child === part) return bones[`${side}${name}`] ?? bones[name] ?? 1;
  }
  return 1;
}

const inv = (m) => { const det = m.scaleX * m.scaleY - m.skew0 * m.skew1; return { a: m.scaleY / det, b: -m.skew0 / det, c: -m.skew1 / det, d: m.scaleX / det }; };
const toLocal = (m, [dx, dy]) => { const i = inv(m); return [i.a * dx + i.c * dy, i.b * dx + i.d * dy]; };
const toStage = (m, [x, y]) => [m.scaleX * x + m.skew1 * y, m.skew0 * x + m.scaleY * y];
const mat = (s) => ({ scaleX: s.matrix[0], skew0: s.matrix[1], skew1: s.matrix[2], scaleY: s.matrix[3] });
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {object} data rig data (rig/rig.js)
 * @param {{bones?:object, joints?:object}} skeleton  bones: factors keyed by BONES name (or Left_/Right_ + name); joints: radii in px keyed by JOINTS name (or Left_/Right_ + name)
 * @returns new rig data; `data` is not modified
 */
export function applyProportions(data, skeleton = {}) {
  const out = JSON.parse(JSON.stringify(data));
  out.radii = { ...(skeleton.joints ?? {}) };
  const bones = skeleton.bones ?? {};
  const byId = new Map(PARTS.map(p => [p.id, p]));

  for (const view of VIEWS) {
    const delta = {}; // part -> [dx, dy] how far its origin moved
    for (const part of PARTS) {
      const key = instanceName(part.id, view), slot = data.slots[key];
      if (!slot) continue;
      const parent = part.parent, pkey = parent && instanceName(parent, view), pslot = pkey && data.slots[pkey];
      if (!pslot) { delta[part.id] = [0, 0]; continue; }
      const f = boneFactor(part.id, bones), m = mat(pslot);
      const v = toLocal(m, [slot.origin[0] - pslot.origin[0], slot.origin[1] - pslot.origin[1]]);
      const moved = toStage(m, [v[0] * (f - 1), v[1] * (f - 1)]); // extra offset caused by this bone
      const d = [delta[parent][0] + moved[0], delta[parent][1] + moved[1]];
      delta[part.id] = d;
      out.slots[key].origin = [r2(slot.origin[0] + d[0]), r2(slot.origin[1] + d[1])];
    }
    // pivots follow their part
    for (const part of PARTS) {
      const pn = `${part.id.toLowerCase()}_${view}_pivot`;
      if (out.pivots[pn] && delta[part.id]) out.pivots[pn] = [r2(data.pivots[pn][0] + delta[part.id][0]), r2(data.pivots[pn][1] + delta[part.id][1])];
    }
    for (const [name, owner] of Object.entries(NUD_OWNER)) {
      const pn = `${name}_${view}_pivot`;
      if (out.pivots[pn] && delta[owner]) out.pivots[pn] = [r2(data.pivots[pn][0] + delta[owner][0]), r2(data.pivots[pn][1] + delta[owner][1])];
    }
    // segments drawn as a box (torso, pelvis, neck) stretch along their length with their bone
    for (const [segment, child] of [['Lower_torso', 'Upper_torso'], ['Upper_torso', 'Neck'], ['Neck', 'Face']]) {
      const skey = instanceName(segment, view), ckey = instanceName(child, view), s = data.slots[skey], c = data.slots[ckey];
      if (!s || !c) continue;
      const f = boneFactor(child, bones); if (f === 1) continue;
      const v = toLocal(mat(s), [c.origin[0] - s.origin[0], c.origin[1] - s.origin[1]]);
      const axis = Math.abs(v[1]) >= Math.abs(v[0]) ? 'y' : 'x', L = out.slots[skey].local;
      L[`${axis}Min`] = r2(L[`${axis}Min`] * f); L[`${axis}Max`] = r2(L[`${axis}Max`] * f);
    }
  }
  return out;
}
