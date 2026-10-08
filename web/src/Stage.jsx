import { useEffect, useRef } from 'react';
import paper from 'paper';
import { useStore } from './store.js';
import { resolveSlot, viewBounds, viewScene, placeholderItems, jointCircles } from './scene.js';

const DIM = 0.28;
const S = () => useStore.getState();

function styleItem(it, p) {
  it.fillColor = !p.fill || p.fill === 'none' ? null : p.fill;
  it.strokeColor = !p.stroke || p.stroke === 'none' ? null : p.stroke;
  it.strokeWidth = p.strokeWidth ?? 1;
  it.strokeCap = 'round'; it.strokeJoin = 'round';
  return it;
}

/** Build a paper item from SVG path data; single-subpath compound paths collapse to a plain Path. */
function makeItem(d, layer) {
  const cp = new paper.CompoundPath({ pathData: d, insert: false });
  let it = cp;
  if (cp.children.length === 1) { it = cp.firstChild; it.remove(); }
  layer.addChild(it);
  return it;
}

export default function Stage() {
  const canvas = useRef(null);
  const ctx = useRef({});
  const template = useStore(s => s.template);
  const character = useStore(s => s.character);
  const view = useStore(s => s.view);
  const part = useStore(s => s.part);
  const tool = useStore(s => s.tool);
  const selIdx = useStore(s => s.selIdx);

  // one-time paper setup, tools and input handling
  useEffect(() => {
    const cv = canvas.current;
    paper.setup(cv);
    const L = {
      ctx: new paper.Layer(), ghost: new paper.Layer(), active: new paper.Layer(), ui: new paper.Layer(),
    };
    ctx.current = { L, pen: null };
    const tol = () => 7 / paper.view.zoom;
    const t = new paper.Tool();
    let drag = null, panning = null, space = false, brush = null;
    const blocked = () => S().isMirroredSlot();

    const draftStyle = () => { const { style } = S(); return { stroke: style.stroked || !style.filled ? style.stroke : '#3b82f6', strokeWidth: style.strokeWidth }; };
    const finishPen = (close) => {
      const pen = ctx.current.pen; ctx.current.pen = null;
      if (!pen) return;
      if (pen.segments.length < 2) { pen.remove(); return; }
      if (close) pen.closed = true;
      const { style } = S(), filled = style.filled && pen.closed;
      const d = pen.pathData; pen.remove();
      S().addPath({ d, fill: filled ? style.fill : 'none', stroke: style.stroked || !filled ? style.stroke : 'none', strokeWidth: style.strokeWidth });
    };
    ctx.current.finishPen = finishPen;

    t.onMouseDown = (e) => {
      if (space || e.event.button === 1) { panning = { start: e.event, center: paper.view.center.clone() }; return; }
      const { tool: tl } = S();
      if (blocked()) return;
      L.ui.activate();
      if (tl === 'pen') {
        let pen = ctx.current.pen;
        if (!pen) { pen = ctx.current.pen = new paper.Path({ ...draftStyle(), strokeCap: 'round', strokeJoin: 'round', parent: L.ui }); }
        if (pen.segments.length > 2 && pen.firstSegment.point.getDistance(e.point) < tol() * 1.5) { finishPen(true); return; }
        drag = { seg: pen.add(e.point) };
      } else if (tl === 'brush') {
        brush = new paper.Path({ ...draftStyle(), strokeCap: 'round', strokeJoin: 'round', parent: L.ui });
        brush.add(e.point);
      } else if (tl === 'eraser') {
        drag = { erase: true }; eraseAt(e.point);
      } else if (tl === 'fill') {
        const h = L.active.hitTest(e.point, { fill: true, tolerance: 1 });
        if (h?.item.data.idx !== undefined && h.item.closed !== false) {
          const { style } = S();
          S().updatePath(h.item.data.idx, e.modifiers.alt ? { fill: 'none' } : { fill: style.fill });
        }
      } else if (tl === 'select') {
        const h = L.active.hitTest(e.point, { segments: true, handles: true, stroke: true, fill: true, tolerance: tol() });
        if (!h || h.item.data.idx === undefined) { S().setSel(null); drag = null; return; }
        S().setSel(h.item.data.idx);
        const item = h.item;
        if (h.type === 'segment' && e.modifiers.control) { h.segment.remove(); commitItem(item); drag = null; return; }
        if (h.type === 'stroke' && e.modifiers.shift) { item.divideAt(h.location); commitItem(item); drag = null; return; }
        drag = { item, before: item.pathData, kind: h.type === 'handle-in' || h.type === 'handle-out' || h.type === 'segment' ? h.type : 'move', seg: h.segment };
      }
    };
    const eraseAt = (pt) => {
      const h = L.active.hitTest(pt, { fill: true, stroke: true, tolerance: tol() });
      if (h?.item.data.idx !== undefined) S().removePath(h.item.data.idx);
    };
    const commitItem = (item) => {
      const i = item.data.idx; if (i === undefined) return;
      S().updatePath(i, { d: item.pathData });
    };
    t.onMouseDrag = (e) => {
      if (panning) { const dx = (e.event.clientX - panning.start.clientX) / paper.view.zoom, dy = (e.event.clientY - panning.start.clientY) / paper.view.zoom; paper.view.center = panning.center.subtract(new paper.Point(dx, dy)); return; }
      if (blocked()) return;
      const { tool: tl } = S();
      if (tl === 'pen' && drag?.seg) { const out = e.point.subtract(drag.seg.point); drag.seg.handleOut = out; drag.seg.handleIn = out.multiply(-1); }
      else if (tl === 'brush' && brush) brush.add(e.point);
      else if (tl === 'eraser' && drag?.erase) eraseAt(e.point);
      else if (tl === 'select' && drag?.item) {
        if (drag.kind === 'segment') drag.seg.point = drag.seg.point.add(e.delta);
        else if (drag.kind === 'handle-in') drag.seg.handleIn = drag.seg.handleIn.add(e.delta);
        else if (drag.kind === 'handle-out') drag.seg.handleOut = drag.seg.handleOut.add(e.delta);
        else drag.item.position = drag.item.position.add(e.delta);
      }
    };
    t.onMouseUp = () => {
      if (panning) { panning = null; return; }
      if (brush) {
        const b = brush; brush = null;
        b.simplify(2);
        if (b.length > 2) { const { style } = S(); S().addPath({ d: b.pathData, fill: 'none', stroke: style.stroke, strokeWidth: style.strokeWidth }); }
        b.remove();
      } else if (drag?.item && S().tool === 'select' && drag.item.pathData !== drag.before) commitItem(drag.item);
      drag = null;
    };

    const onKey = (ev) => {
      if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      if (ev.code === 'Space') { space = ev.type === 'keydown'; if (space) ev.preventDefault(); return; }
      if (ev.type !== 'keydown') return;
      const st = S();
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? st.redoStep() : st.undoStep(); return; }
      if (ev.key === 'Enter') finishPen(false);
      else if (ev.key === 'Escape') { ctx.current.pen?.remove(); ctx.current.pen = null; st.setSel(null); }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && st.selIdx !== null && !blocked()) st.removePath(st.selIdx);
      else if (!ev.ctrlKey && !ev.metaKey) {
        const map = { v: 'select', p: 'pen', b: 'brush', e: 'eraser', g: 'fill' };
        if (map[ev.key.toLowerCase()]) st.setTool(map[ev.key.toLowerCase()]);
      }
    };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

    const onWheel = (ev) => {
      ev.preventDefault();
      const rect = cv.getBoundingClientRect(), pt = new paper.Point(ev.clientX - rect.left, ev.clientY - rect.top);
      const before = paper.view.viewToProject(pt);
      paper.view.zoom = Math.min(40, Math.max(0.1, paper.view.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
      paper.view.center = paper.view.center.add(before.subtract(paper.view.viewToProject(pt)));
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('dblclick', () => { if (ctx.current.pen) { const p = ctx.current.pen; if (p.segments.length > 1) p.removeSegment(p.segments.length - 1); finishPen(false); } });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    const ro = new ResizeObserver(() => { const r = cv.parentElement.getBoundingClientRect(); paper.view.viewSize = new paper.Size(r.width, r.height); ctx.current.fit?.(); });
    ro.observe(cv.parentElement);
    window.__tradigital = { paper, store: useStore };
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); cv.removeEventListener('wheel', onWheel); ro.disconnect(); paper.project.remove(); };
  }, []);

  // fit viewport to the current view's cell
  useEffect(() => {
    if (!template) return;
    const fit = () => {
      const b = viewBounds(template, view), vs = paper.view.viewSize;
      if (!vs.width || !vs.height) return;
      paper.view.zoom = Math.min(vs.width / b.w, vs.height / b.h);
      paper.view.center = new paper.Point(b.x + b.w / 2, b.y + b.h / 2);
    };
    ctx.current.fit = fit; fit();
  }, [template, view]);

  // redraw the scene from state
  useEffect(() => {
    if (!template || !ctx.current.L) return;
    const { L } = ctx.current;
    Object.values(L).forEach(l => l.removeChildren());
    const activeKey = `${part}_${view}`, art = character.art;
    L.ctx.activate();
    for (const it of viewScene(art, template, view)) {
      const dim = it.key === activeKey ? 1 : DIM;
      if (it.key === activeKey) continue;
      if (it.drawn) { for (const p of it.resolved.paths) { const i = makeItem(p.d, L.ctx); styleItem(i, p); i.opacity = dim * 1.6 > 1 ? 1 : dim * 1.6; i.locked = true; } }
      else {
        for (const ph of placeholderItems(it.slot)) {
          const i = makeItem(ph.d, L.ctx);
          i.fillColor = ph.filled ? '#e4e4e4' : null; i.strokeColor = ph.filled && it.slot.kind !== 'expression' && !ph.translucent && !/^(Left|Right)_(arm|forearm|thigh|shank|foot)$/i.test(it.slot.part) ? '#bdbdbd' : '#c9c9c9';
          i.strokeWidth = 1; i.opacity = ph.translucent ? 0.4 : 0.55; i.locked = true;
          if (it.slot.kind === 'expression') i.dashArray = [4, 3];
        }
      }
    }
    const slot = template.slots[activeKey];
    if (slot) {
      const res = resolveSlot(art, template, activeKey);
      if (!res || !res.paths.length) {
        for (const ph of placeholderItems(slot)) {
          const sil = makeItem(ph.d, L.ghost);
          sil.strokeColor = '#3b82f6'; sil.strokeWidth = 1.5; sil.dashArray = [5, 4]; sil.fillColor = new paper.Color(0.23, 0.51, 0.96, 0.06); sil.locked = true;
        }
      }
      if (res) {
        const layer = res.derived ? L.ghost : L.active;
        res.paths.forEach((p, i) => { const it = makeItem(p.d, layer); styleItem(it, p); if (!res.derived) it.data.idx = i; else it.locked = true; });
      }
      const [ox, oy] = slot.origin;
      const mark = (pt, col, r) => { const c = new paper.Path.Circle({ center: pt, radius: r, strokeColor: col, strokeWidth: 1.5, fillColor: 'white', parent: L.ui, locked: true }); c.applyMatrix = true; };
      new paper.Path.Line({ from: [ox - 8, oy], to: [ox + 8, oy], strokeColor: '#e11d48', strokeWidth: 1, parent: L.ui, locked: true });
      new paper.Path.Line({ from: [ox, oy - 8], to: [ox, oy + 8], strokeColor: '#e11d48', strokeWidth: 1, parent: L.ui, locked: true });
      for (const j of jointCircles(slot)) new paper.Path.Circle({ center: j.c, radius: j.r, strokeColor: '#f59e0b', strokeWidth: 1.2, dashArray: [3, 3], parent: L.ui, locked: true });
      if (slot.pivot) mark(slot.pivot, '#16a34a', 3.5);
    }
    L.active.activate();
  }, [template, character, view, part]);

  // selection highlight (no rebuild)
  useEffect(() => {
    const { L } = ctx.current; if (!L) return;
    L.active.children.forEach(c => { c.fullySelected = tool === 'select' && c.data.idx === selIdx; });
  }, [selIdx, character, view, part, tool, template]);

  useEffect(() => { ctx.current.finishPen?.(false); canvas.current.style.cursor = { select: 'default', pen: 'crosshair', brush: 'crosshair', eraser: 'cell', fill: 'copy' }[tool]; }, [tool]);

  return <canvas ref={canvas} id="stage" />;
}
