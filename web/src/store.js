import { create } from 'zustand';
import { createCharacter } from '../../src/model/character.js';
import { instanceName, PARTS } from '../../src/model/rig.js';
import { resolveSlot, partnerKey } from './scene.js';
import { Rig } from '../../src/rig/rig.js';
import { applyProportions } from '../../src/rig/proportions.js';
import { describeTemplate } from '../../src/model/templateInfo.js';
import { anchorShift } from './scene.js';
import { DEFAULT_SHADER } from './toonTitan.js';
import { BRUSH_DEFAULTS } from './brush.js';

const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); if (v != null) return v; } catch { /* none */ } return d; };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/** Editor geometry for a rig with the character's proportions applied. */
export const computeTemplate = (rigData, skeleton) => describeTemplate(new Rig(skeleton ? applyProportions(rigData, skeleton) : rigData));

const KEY = 'tradigital.character.v1';
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.art) return s; } catch { /* no saved doc */ } return createCharacter(); };
const save = (ch) => { try { localStorage.setItem(KEY, JSON.stringify(ch)); } catch { /* storage unavailable */ } };

export const useStore = create((set, get) => ({
  template: null, rigData: null, error: null, character: load(),
  view: '0', part: 'Right_arm', tool: 'pen', selIdx: null,
  style: { fill: '#a6a6a6', stroke: '#4d4d4d', strokeWidth: 4, filled: true, stroked: true },
  shader: { ...DEFAULT_SHADER, ...jget('tradigital.shader', {}) }, palette: jget('tradigital.palette', Array(12).fill(null)), colorTarget: 'fill',
  brush: { ...BRUSH_DEFAULTS, ...jget('tradigital.brush', {}) },
  undo: [], redo: [],

  async loadTemplate() {
    try {
      const r = await fetch(`/api/rig?rig=${encodeURIComponent(get().character.rig ?? 'mojo')}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      set({ rigData: j, template: computeTemplate(j, get().character.skeleton), error: null });
    } catch (e) { set({ error: e.message }); }
  },

  /** Change bone lengths / joint radii. patch = {bones?:{}, joints?:{}}; a null value resets that entry. */
  setSkeleton(patch) {
    const { character, rigData } = get();
    const cur = character.skeleton ?? { bones: {}, joints: {} };
    const merge = (a, b) => { const o = { ...a, ...(b ?? {}) }; for (const k of Object.keys(o)) if (o[k] === null) delete o[k]; return o; };
    const skeleton = { bones: merge(cur.bones, patch.bones), joints: merge(cur.joints, patch.joints) };
    const empty = !Object.keys(skeleton.bones).length && !Object.keys(skeleton.joints).length;
    const next = { ...character };
    if (empty) delete next.skeleton; else next.skeleton = skeleton;
    save(next);
    set({ character: next, template: computeTemplate(rigData, next.skeleton) });
  },
  resetSkeleton() { get().setSkeleton({ bones: Object.fromEntries(Object.keys(get().character.skeleton?.bones ?? {}).map(k => [k, null])), joints: Object.fromEntries(Object.keys(get().character.skeleton?.joints ?? {}).map(k => [k, null])) }); },

  setView: (view) => set({ view, selIdx: null }),
  setPart: (part) => set({ part, selIdx: null }),
  setTool: (tool) => set({ tool }),
  setStyle: (patch) => set(s => ({ style: { ...s.style, ...patch } })),
  setShader: (patch) => set(s => { const shader = { ...s.shader, ...patch }; jset('tradigital.shader', shader); return { shader }; }),
  setPalette: (i, v) => set(s => { const palette = s.palette.map((x, j) => (j === i ? v : x)); jset('tradigital.palette', palette); return { palette }; }),
  setBrush: (patch) => set(s => { const brush = { ...s.brush, ...patch }; jset('tradigital.brush', brush); return { brush }; }),
  setColorTarget: (colorTarget) => set({ colorTarget }),
  /** Make a color the active drawing color (fill or stroke; `swap` uses the other one). */
  useColor(hex, swap = false) {
    const target = (get().colorTarget === 'fill') !== swap ? 'fill' : 'stroke';
    set(s => ({ style: { ...s.style, ...(target === 'fill' ? { fill: hex, filled: true } : { stroke: hex, stroked: true }) } }));
  },
  setSel: (selIdx) => set({ selIdx }),
  key: () => instanceName(get().part, get().view),

  /** Replace the art map (history-tracked). */
  commit(art) {
    const { character, undo } = get();
    const next = { ...character, art };
    save(next);
    set({ character: next, undo: [...undo.slice(-99), character.art], redo: [] });
  },
  undoStep() {
    const { undo, character, redo } = get();
    if (!undo.length) return;
    const next = { ...character, art: undo[undo.length - 1] };
    save(next); set({ character: next, undo: undo.slice(0, -1), redo: [...redo, character.art], selIdx: null });
  },
  redoStep() {
    const { redo, character, undo } = get();
    if (!redo.length) return;
    const next = { ...character, art: redo[redo.length - 1] };
    save(next); set({ character: next, redo: redo.slice(0, -1), undo: [...undo, character.art], selIdx: null });
  },

  /** Drawn art of the selected slot (null if empty or mirrored). */
  slotArt() { const a = get().character.art[get().key()]; return a && !a.mirrorOf ? a : null; },
  isMirroredSlot() { return !!get().character.art[get().key()]?.mirrorOf; },

  editPaths(fn) {
    const { template, character } = get(), key = get().key();
    if (character.art[key]?.mirrorOf) return;
    const stored = character.art[key];
    const cur = stored ? anchorShift(stored, template.slots[key]) : { origin: template.slots[key].origin, paths: [] }; // art follows its joint
    const paths = fn(cur.paths ?? []);
    const art = { ...character.art };
    if (paths.length) art[key] = { ...cur, paths };
    else { delete art[key]; for (const [k, a] of Object.entries(art)) if (a.mirrorOf === key) delete art[k]; }
    get().commit(art);
  },
  addPath: (p) => get().editPaths(ps => [...ps, p]),
  updatePath: (i, patch) => get().editPaths(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p))),
  removePath: (i) => { get().editPaths(ps => ps.filter((_, j) => j !== i)); set({ selIdx: null }); },
  movePath(i, dir) {
    get().editPaths((ps) => { const j = i + dir; if (j < 0 || j >= ps.length) return ps; const c = ps.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; });
    set({ selIdx: Math.max(0, i + dir) });
  },

  /** Link/unlink the reflection partner of the selected slot. */
  setMirrorLink(on) {
    const { character, template } = get(), key = get().key(), pk = partnerKey(get().part, get().view);
    if (!pk || !template.slots[pk]) return;
    const art = { ...character.art };
    if (on) { if (!art[key]?.paths?.length) return; art[pk] = { mirrorOf: key }; }
    else if (art[pk]?.mirrorOf === key) { const r = resolveSlot(art, template, pk); art[pk] = { origin: r.origin, paths: r.paths }; }
    get().commit(art);
  },
  /** Turn the selected mirrored slot into independent drawn art. */
  unlinkSelected() {
    const { character, template } = get(), key = get().key(), art = { ...character.art };
    if (!art[key]?.mirrorOf) return;
    const r = resolveSlot(art, template, key);
    art[key] = { origin: r.origin, paths: r.paths };
    get().commit(art);
  },

  newCharacter() { const ch = { ...createCharacter(), rig: get().character.rig }; save(ch); set({ character: ch, undo: [], redo: [], selIdx: null }); },
  /** Switch the base skeleton layout (built-in rig name). Drawn art keeps its stage position. */
  async setRig(rig) { const ch = { ...get().character, rig }; save(ch); set({ character: ch }); await get().loadTemplate(); },
  async importCharacter(ch) { if (!ch?.art) throw new Error('not a character file'); const was = get().character.rig; save(ch); set({ character: ch, undo: [], redo: [], selIdx: null }); if (ch.rig !== was) await get().loadTemplate(); },
  setExportViews(exportViews) { const ch = { ...get().character, options: { ...get().character.options, exportViews } }; save(ch); set({ character: ch }); },
  setName(name) { const ch = { ...get().character, name }; save(ch); set({ character: ch }); },
}));

export const PART_GROUPS = ['head', 'body', 'arms', 'legs'].map(g => ({ group: g, parts: PARTS.filter(p => p.group === g) }));
