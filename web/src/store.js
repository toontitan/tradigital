import { create } from 'zustand';
import { createCharacter } from '../../src/model/character.js';
import { instanceName, PARTS } from '../../src/model/rig.js';
import { resolveSlot, partnerKey } from './scene.js';

const KEY = 'tradigital.character.v1';
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.art) return s; } catch { /* no saved doc */ } return createCharacter(); };
const save = (ch) => { try { localStorage.setItem(KEY, JSON.stringify(ch)); } catch { /* storage unavailable */ } };

export const useStore = create((set, get) => ({
  template: null, error: null, character: load(),
  view: '0', part: 'Right_arm', tool: 'pen', selIdx: null,
  style: { fill: '#e03030', stroke: '#000000', strokeWidth: 4, filled: true, stroked: true },
  undo: [], redo: [],

  async loadTemplate() {
    try {
      const r = await fetch('/api/template');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      set({ template: j, error: null });
    } catch (e) { set({ error: e.message }); }
  },

  setView: (view) => set({ view, selIdx: null }),
  setPart: (part) => set({ part, selIdx: null }),
  setTool: (tool) => set({ tool }),
  setStyle: (patch) => set(s => ({ style: { ...s.style, ...patch } })),
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
    const cur = character.art[key] ?? { origin: template.slots[key].origin, paths: [] };
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

  newCharacter() { const ch = createCharacter(); save(ch); set({ character: ch, undo: [], redo: [], selIdx: null }); },
  importCharacter(ch) { if (!ch?.art) throw new Error('not a character file'); save(ch); set({ character: ch, undo: [], redo: [], selIdx: null }); },
  setName(name) { const ch = { ...get().character, name }; save(ch); set({ character: ch }); },
}));

export const PART_GROUPS = ['head', 'body', 'arms', 'legs'].map(g => ({ group: g, parts: PARTS.filter(p => p.group === g) }));
