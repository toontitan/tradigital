// Character document + rig -> SWF, from scratch (no template file).
// Per view and part: the user's drawing, a mirror of another slot, a generated expression set, a joint-aware
// placeholder, or - for parts the layout hides in that view - a near-invisible dot (Cartoon Animator errors on missing parts).
import { SwfBuilder } from '../swf/builder.js';
import { PARTS, VIEWS, instanceName, pivotName, mirrorOf, parseInstanceName } from './rig.js';
import { deriveReflections, reflectPoint } from './reflect.js';
import { validate } from './character.js';
import { placeholderFor } from './placeholders.js';
import { expandStrokes } from './strokes.js';
import { buildExpressionSet } from '../rig/expressions.js';
import { SET_OF_PART } from '../rig/expression-sets.js';
import { transformPath } from '../svg/path.js';

export const DOT = { diameter: 8, fill: '#888888', opacity: 0.02 }; // 5-10px, ~2% opaque: effectively invisible, deletable in CTA
export const DRAWN_VIEWS = ['0', '315', '270', '225', '180', 'top', 'bottom']; // the views you draw; 45/90/135 mirror 315/270/225
export const MIRRORED_VIEWS = ['45', '90', '135'];

const hexA = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
const circle = (r) => `M${-r},0A${r},${r} 0 1 1 ${r},0A${r},${r} 0 1 1 ${-r},0Z`;
const IDENTITY = { scaleX: 1, scaleY: 1, skew0: 0, skew1: 0 };

/**
 * @param {object} ch   character document (model/character.js)
 * @param {import('../rig/rig.js').Rig} rig
 * @param {{views?:string[], compress?:boolean, version?:number}} opts  views: which views to export (default: all ten)
 */
export function compileFromRig(ch, rig, opts = {}) {
  const { errors, warnings } = validate(ch, rig);
  if (errors.length) throw new Error(`invalid character:\n  ${errors.join('\n  ')}`);
  const views = opts.views ?? VIEWS;
  const stage = rig.stageSize();
  const b = new SwfBuilder({ width: stage.width, height: stage.height, version: opts.version ?? 20 });
  const refl = deriveReflections(rig);
  const report = { drawn: [], mirrored: [], expression: [], placeholders: [], dots: [], warnings };

  // ---- resolve art: explicit entries, plus automatic mirrors of the drawn half (315/270/225 -> 45/90/135) ----
  const art = { ...ch.art };
  if (ch.options?.autoMirror !== false) {
    for (const [key, a] of Object.entries(ch.art)) {
      if (a.mirrorOf || !a.paths?.length) continue;
      const { part, view } = parseInstanceName(key);
      if (!['315', '270', '225'].includes(view)) continue;
      const m = mirrorOf(part, view), target = m && instanceName(m.part, m.view);
      if (target && rig.has(target) && !art[target]) art[target] = { mirrorOf: key, auto: true };
    }
  }

  const sprites = new Map();   // drawn key -> {id, origin}
  const records = [];          // root placements before depth assignment
  const shift = {};            // key -> [dx, dy] how far a drawn slot moved from the rig origin (pivots follow)
  const dotId = b.art([{ d: circle(DOT.diameter / 2), fill: hexA(DOT.fill, DOT.opacity) }], [0, 0]);
  const pivotId = b.sprite([[
    { id: b.shape({ d: circle(5), fill: '#ff0000' }, [0, 0]), depth: 1 }, { id: b.shape({ d: circle(2), fill: '#ffffff' }, [0, 0]), depth: 2 }]]);
  const nudId = b.sprite([[
    { id: b.shape({ d: circle(5), fill: '#335bad' }, [0, 0]), depth: 1 }, { id: b.shape({ d: circle(2), fill: '#ffffff' }, [0, 0]), depth: 2 }]]);

  for (const [key, a] of Object.entries(art)) {
    if (a.mirrorOf) continue;
    const { view } = parseInstanceName(key);
    if (!views.includes(view)) continue;
    sprites.set(key, { id: b.art(expandStrokes(a.paths, key, warnings), a.origin), origin: a.origin });
  }

  for (const view of views) {
    for (const part of PARTS) {
      const key = instanceName(part.id, view), a = art[key], present = rig.has(key);
      let rec;
      if (a && !a.mirrorOf) { // drawn
        const s = sprites.get(key);
        rec = { key, view, id: s.id, origin: s.origin, matrix: IDENTITY, kind: 'drawn' };
        if (SET_OF_PART[part.id]) warnings.push(`${key}: replaces the generated ${part.frames}-frame set with a single drawing`);
        report.drawn.push(key);
      } else if (a?.mirrorOf) { // mirror of a drawn slot
        const src = sprites.get(a.mirrorOf), sv = parseInstanceName(a.mirrorOf).view;
        const origin = reflectPoint(refl, sv, src.origin);
        rec = { key, view, id: src.id, origin, matrix: { ...IDENTITY, scaleX: -1 }, kind: 'mirrored' };
        report.mirrored.push(key);
      } else if (present) {
        const [ox, oy] = rig.position(key);
        if (SET_OF_PART[part.id]) { // generated expression set, in the slot's local space
          rec = { key, view, id: buildExpressionSet(b, part.id, rig.localBounds(key)), origin: [ox, oy], matrix: rig.matrix(key), kind: 'expression' };
          report.expression.push(key);
        } else {
          const ph = placeholderFor(rig, part.id, view);
          rec = { key, view, id: b.art(ph.paths.map(p => ({ ...p, d: transformPath(p.d, ([x, y]) => [x + ox, y + oy]) })), [ox, oy]), origin: [ox, oy], matrix: rig.matrix(key), kind: 'placeholder' };
          report.placeholders.push(key);
        }
      } else { // hidden in this view: a near-invisible dot so the slot still exists
        rec = { key, view, id: dotId, origin: rig.dotOrigin(view), matrix: IDENTITY, kind: 'dot' };
        report.dots.push(key);
      }
      if (present && rec.kind !== 'placeholder' && rec.kind !== 'expression') { const [ox, oy] = rig.position(key); shift[key] = [rec.origin[0] - ox, rec.origin[1] - oy]; }
      records.push(rec);
    }
  }

  // ---- placements: parts back to front per view (rig depth), then every pivot marker on top ----
  let depth = 1;
  const order = (r) => (rig.has(r.key) ? rig.depth(r.key) : -1);
  for (const view of views) {
    for (const r of records.filter(x => x.view === view).sort((p, q) => order(p) - order(q))) {
      b.place({ id: r.id, depth: depth++, name: r.key, matrix: { ...r.matrix, tx: Math.round(r.origin[0] * 20), ty: Math.round(r.origin[1] * 20) } });
    }
  }
  const putPivot = (name, id, [x, y]) => b.place({ id, depth: depth++, name, matrix: { tx: Math.round(x * 20), ty: Math.round(y * 20) } });
  for (const view of views) {
    for (const part of PARTS) {
      const key = instanceName(part.id, view), pn = pivotName(part.id, view), rec = records.find(r => r.key === key);
      const base = rig.pivotFor(part.id, view);
      const d = shift[key] ?? [0, 0];
      putPivot(pn, pivotId, base ? [base[0] + d[0], base[1] + d[1]] : rec.origin);
    }
    for (const [name, pos] of Object.entries(rig.pivots)) if (new RegExp(`_nud_${view}_pivot$`).test(name)) putPivot(name, nudId, pos);
  }

  return { swf: b.build({ compress: opts.compress }), report };
}
