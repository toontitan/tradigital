// The G2 rig vocabulary: parts, views, naming and mirror topology.
// Derived from the Billy dev kit (see docs/g2-template-spec.md).

export const VIEWS = ['0', '45', '90', '135', '180', '225', '270', '315', 'top', 'bottom'];

/** Geometric reflection of a view: where a view lands when the character is flipped left-right. */
export const MIRROR_VIEW = {
  0: '0', 45: '315', 90: '270', 135: '225', 180: '180', 225: '135', 270: '90', 315: '45', top: 'top', bottom: 'bottom',
};

const P = (id, parent, group, kind = 'single', extra = {}) => ({ id, parent, group, kind, ...extra });

// parent = bone the part hangs from (editor hierarchy; the SWF itself does not store it).
// kind 'expression' = multi-frame set in the template (eyes, brows, nose, mouth, hands).
export const PARTS = [
  P('Lower_torso', null, 'body'),
  P('Upper_torso', 'Lower_torso', 'body'),
  P('Neck', 'Upper_torso', 'head'),
  P('Face', 'Neck', 'head'),
  P('Back_hair', 'Face', 'head'),
  P('Front_hair', 'Face', 'head'),
  P('Left_ear', 'Face', 'head'),
  P('Right_ear', 'Face', 'head'),
  P('Left_eye', 'Face', 'head', 'expression', { frames: 13 }),
  P('Right_eye', 'Face', 'head', 'expression', { frames: 13 }),
  P('Left_brow', 'Face', 'head', 'expression', { frames: 18 }),
  P('Right_brow', 'Face', 'head', 'expression', { frames: 18 }),
  P('Nose', 'Face', 'head', 'expression', { frames: 8 }),
  P('Mouth', 'Face', 'head', 'expression', { frames: 30 }),
  P('Left_arm', 'Upper_torso', 'arms'),
  P('Left_forearm', 'Left_arm', 'arms'),
  P('Left_hand', 'Left_forearm', 'arms', 'expression', { frames: 11 }),
  P('Right_arm', 'Upper_torso', 'arms'),
  P('Right_forearm', 'Right_arm', 'arms'),
  P('Right_hand', 'Right_forearm', 'arms', 'expression', { frames: 11 }),
  P('Left_thigh', 'Lower_torso', 'legs'),
  P('Left_shank', 'Left_thigh', 'legs'),
  P('Left_foot', 'Left_shank', 'legs'),
  P('Right_thigh', 'Lower_torso', 'legs'),
  P('Right_shank', 'Right_thigh', 'legs'),
  P('Right_foot', 'Right_shank', 'legs'),
];

export const PART_IDS = PARTS.map(p => p.id);
const byId = new Map(PARTS.map(p => [p.id, p]));

export const getPart = (id) => byId.get(id);
export const isPart = (id) => byId.has(id);
export const isView = (v) => VIEWS.includes(String(v));

/** Opposite-side part (Left_arm <-> Right_arm); centred parts map to themselves. */
export function counterpart(id) {
  if (id.startsWith('Left_')) return `Right_${id.slice(5)}`;
  if (id.startsWith('Right_')) return `Left_${id.slice(6)}`;
  return id;
}

export const instanceName = (part, view) => `${part}_${view}`;
export const pivotName = (part, view) => `${part.toLowerCase()}_${view}_pivot`;

export function parseInstanceName(name) {
  const m = /^(.+)_(0|45|90|135|180|225|270|315|top|bottom)$/.exec(name);
  return m && isPart(m[1]) ? { part: m[1], view: m[2] } : null;
}

/**
 * Where the left-right reflection of `part` in `view` lives.
 * Returns null when the slot is its own mirror image (e.g. Face in front view) - nothing to derive.
 */
export function mirrorOf(part, view) {
  const t = { part: counterpart(part), view: MIRROR_VIEW[view] };
  return t.part === part && t.view === String(view) ? null : t;
}
