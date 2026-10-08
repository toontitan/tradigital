import { useEffect, useRef, useState } from 'react';
import Stage from './Stage.jsx';
import { useStore, PART_GROUPS } from './store.js';
import { VIEWS, instanceName, getPart } from '../../src/model/rig.js';
import { viewScene, viewBounds, slotStatus, partnerKey, screenSide } from './scene.js';
import { validate } from '../../src/model/character.js';

const VIEW_LABEL = { 0: 'Front 0°', 45: '45°', 90: 'Side 90°', 135: '135°', 180: 'Back 180°', 225: '225°', 270: 'Side 270°', 315: '315°', top: 'Top', bottom: 'Bottom' };
const TOOLS = [['select', 'Select / Anchor', 'V'], ['pen', 'Pen', 'P'], ['brush', 'Brush', 'B'], ['eraser', 'Eraser', 'E'], ['fill', 'Fill', 'G']];

function ViewThumb({ view }) {
  const tpl = useStore(s => s.template), art = useStore(s => s.character.art);
  const cur = useStore(s => s.view), setView = useStore(s => s.setView);
  const b = viewBounds(tpl, view, 8), items = viewScene(art, tpl, view);
  const drawn = items.filter(i => i.drawn).length;
  return (
    <button className={`thumb ${cur === view ? 'on' : ''}`} onClick={() => setView(view)} title={VIEW_LABEL[view]} data-view={view}>
      <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet">
        {items.map(it => it.drawn
          ? it.resolved.paths.map((p, i) => <path key={it.key + i} d={p.d} fill={p.fill === 'none' ? 'none' : p.fill} stroke={p.stroke === 'none' ? 'none' : p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)
          : <path key={it.key} d={it.silhouette} fill="#e7e7e7" stroke="#c8c8c8" strokeWidth="1" />)}
      </svg>
      <span>{VIEW_LABEL[view]}{drawn ? <b> · {drawn}</b> : null}</span>
    </button>
  );
}

function Parts() {
  const art = useStore(s => s.character.art), view = useStore(s => s.view), part = useStore(s => s.part), setPart = useStore(s => s.setPart);
  return (
    <div className="parts">
      {PART_GROUPS.map(g => (
        <div key={g.group}>
          <h4>{g.group}</h4>
          {g.parts.map(p => {
            const st = slotStatus(art, instanceName(p.id, view));
            return (
              <button key={p.id} className={`part ${part === p.id ? 'on' : ''} ${st}`} onClick={() => setPart(p.id)} data-part={p.id}>
                <i className="dot" />{p.id.replaceAll('_', ' ')}{p.kind === 'expression' ? <em title={`template keeps its ${p.frames}-frame set until you draw`}>set</em> : null}
                <small>{st === 'mirrored' ? 'mirrored' : st === 'drawn' ? 'drawn' : ''}</small>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Inspector() {
  const s = useStore();
  const key = instanceName(s.part, s.view), art = s.character.art[key], pk = partnerKey(s.part, s.view);
  const pArt = pk ? s.character.art[pk] : null;
  const linked = pArt?.mirrorOf === key, pHasOwn = pArt && !pArt.mirrorOf;
  const paths = art && !art.mirrorOf ? art.paths : [];
  const st = s.style;
  return (
    <div className="inspector">
      <h3>{s.part.replaceAll('_', ' ')} <small>@ {VIEW_LABEL[s.view]}</small></h3>
      {screenSide(s.template, s.part, s.view) && <p className="side">his {s.part.startsWith('Left_') ? 'left' : 'right'} · appears on the <b>screen {screenSide(s.template, s.part, s.view)}</b> in this view</p>}
      <div className="tools">
        {TOOLS.map(([id, label, k]) => <button key={id} className={s.tool === id ? 'on' : ''} onClick={() => s.setTool(id)} title={`${label} (${k})`} data-tool={id}>{label}<kbd>{k}</kbd></button>)}
      </div>
      {art?.mirrorOf && <div className="note">Mirrored from <b>{art.mirrorOf}</b>. <button onClick={s.unlinkSelected}>Edit separately</button></div>}
      <label className="row">Fill <input type="color" value={st.fill} onChange={e => s.setStyle({ fill: e.target.value })} />
        <input type="checkbox" checked={st.filled} onChange={e => s.setStyle({ filled: e.target.checked })} title="fill closed shapes" /></label>
      <label className="row">Stroke <input type="color" value={st.stroke} onChange={e => s.setStyle({ stroke: e.target.value })} />
        <input type="checkbox" checked={st.stroked} onChange={e => s.setStyle({ stroked: e.target.checked })} title="outline" /></label>
      <label className="row">Width <input type="range" min="0.5" max="20" step="0.5" value={st.strokeWidth} onChange={e => s.setStyle({ strokeWidth: +e.target.value })} /><span>{st.strokeWidth}</span></label>
      {pk && s.template.slots[pk] && !art?.mirrorOf && (
        <div className="mirror">
          <b>Mirror → {pk}</b>
          {linked ? <button onClick={() => s.setMirrorLink(false)} data-act="unlink">Unlink (keep copy)</button>
            : <button disabled={!paths.length} onClick={() => { if (!pHasOwn || confirm(`${pk} already has its own art. Replace it with a mirror of this?`)) s.setMirrorLink(true); }} data-act="link">Link mirror</button>}
          <small>{linked ? 'partner updates live as you draw' : pHasOwn ? 'partner has its own drawing' : paths.length ? 'partner is empty' : 'draw something first'}</small>
        </div>
      )}
      <h4>Paths ({paths.length})</h4>
      <ol className="paths">
        {paths.map((p, i) => (
          <li key={i} className={s.selIdx === i ? 'on' : ''} onClick={() => { s.setTool('select'); s.setSel(i); }}>
            <span className="sw" style={{ background: p.fill === 'none' ? 'transparent' : p.fill, borderColor: p.stroke === 'none' ? '#bbb' : p.stroke }} />
            {p.fill === 'none' ? 'stroke' : 'shape'} {i + 1}
            <span className="acts">
              <button onClick={(e) => { e.stopPropagation(); s.movePath(i, -1); }} title="send back">↓</button>
              <button onClick={(e) => { e.stopPropagation(); s.movePath(i, 1); }} title="bring forward">↑</button>
              <button onClick={(e) => { e.stopPropagation(); s.removePath(i); }} title="delete">✕</button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function App() {
  const s = useStore();
  const file = useRef(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { s.loadTemplate(); }, []);

  const exportSwf = async () => {
    const { errors } = validate(s.character, null);
    if (errors.length) return setMsg({ bad: true, text: errors.join('; ') });
    setMsg({ text: 'Exporting…' });
    const r = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s.character) });
    if (!r.ok) return setMsg({ bad: true, text: (await r.json()).error });
    const rep = JSON.parse(decodeURIComponent(r.headers.get('X-Report') ?? '{}'));
    const url = URL.createObjectURL(await r.blob());
    Object.assign(document.createElement('a'), { href: url, download: `${s.character.name}.swf` }).click();
    setMsg({ text: `Exported ${s.character.name}.swf — ${rep.drawn} drawn, ${rep.mirrored} mirrored, ${rep.fallback} grey fallback` });
  };
  const saveJson = () => Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(s.character, null, 1)], { type: 'application/json' })), download: `${s.character.name}.json` }).click();
  const loadJson = async (e) => { try { s.importCharacter(JSON.parse(await e.target.files[0].text())); setMsg({ text: 'Loaded' }); } catch (x) { setMsg({ bad: true, text: x.message }); } e.target.value = ''; };

  if (s.error) return <div className="fatal"><h2>Can't load the template</h2><p>{s.error}</p><p>Put your template SWF at <code>examples/template.swf</code> or set <code>TEMPLATE_SWF</code>, then restart the server.</p></div>;
  if (!s.template) return <div className="fatal">Loading template…</div>;
  const drawnCount = Object.keys(s.character.art).length;
  return (
    <div className="app">
      <header>
        <b>Tradigital G2</b>
        <input className="name" value={s.character.name} onChange={e => s.setName(e.target.value.replace(/[^\w-]/g, '_'))} />
        <button onClick={s.undoStep} disabled={!s.undo.length}>Undo</button>
        <button onClick={s.redoStep} disabled={!s.redo.length}>Redo</button>
        <span className="sp" />
        {msg && <span className={`msg ${msg.bad ? 'bad' : ''}`}>{msg.text}</span>}
        <span className="count">{drawnCount} slot{drawnCount === 1 ? '' : 's'}</span>
        <button onClick={() => { if (confirm('Start a new character? Unsaved work is lost.')) s.newCharacter(); }}>New</button>
        <button onClick={saveJson}>Save</button>
        <button onClick={() => file.current.click()}>Open</button>
        <input ref={file} type="file" accept=".json" hidden onChange={loadJson} />
        <button className="primary" onClick={exportSwf} data-act="export">Export SWF</button>
      </header>
      <aside className="left">
        <div className="thumbs">{VIEWS.map(v => <ViewThumb key={v} view={v} />)}</div>
        <Parts />
      </aside>
      <main><Stage /><div className="hint">wheel = zoom · space/middle-drag = pan · Enter finishes a pen path · Del removes · Ctrl+Z undo</div></main>
      <aside className="right"><Inspector /></aside>
    </div>
  );
}
