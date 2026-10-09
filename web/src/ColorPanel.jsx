import { useEffect, useRef } from 'react';
import { useStore } from './store.js';
import {
  BANDING_PRESETS, computeColors, midTones, hexToHsl, parseValidHex, wheelPick, hueToCanvasAngle,
  wheelValuesAt, sectorHueRange, sectorCanvasRange, averagedCell, canvasAngleToHue, hslToHex, hslToRgb, DEFAULT_SHADER,
} from './toonTitan.js';

const SIZE = 180;

function drawWheel(cv, depth, bandIdx, baseHex) {
  const ctx = cv.getContext('2d'), c = SIZE / 2, R = c - 2, p = BANDING_PRESETS[bandIdx];
  ctx.clearRect(0, 0, SIZE, SIZE);
  if (p.hueSegments) {
    const w = 360 / p.hueSegments;
    for (let ring = p.rings - 1; ring >= 0; ring--) for (let seg = 0; seg < p.hueSegments; seg++) {
      const [h0, h1] = sectorHueRange(seg, p.hueSegments), [a0, a1] = sectorCanvasRange(seg, p.hueSegments);
      const [r, g, b] = averagedCell(h0, h1, ring / p.rings, (ring + 1) / p.rings, depth);
      ctx.beginPath(); ctx.moveTo(c, c);
      ctx.arc(c, c, ((ring + 1) / p.rings) * R, (a0 / 360) * 2 * Math.PI - Math.PI / 2, ((a1 + w * 0.02) / 360) * 2 * Math.PI - Math.PI / 2);
      ctx.closePath(); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
    }
  } else {
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const dx = x - c + 0.5, dy = y - c + 0.5, d = Math.hypot(dx, dy);
      if (d > R + 0.5) continue;
      let a = Math.atan2(dy, dx) * 180 / Math.PI + 90; if (a < 0) a += 360;
      const { lightness, saturation } = wheelValuesAt(Math.min(1, d / R), depth);
      const [r, g, b] = hslToRgb(canvasAngleToHue(a), saturation, lightness), i = (y * SIZE + x) * 4;
      img.data.set([r, g, b, 255], i);
    }
    ctx.putImageData(img, 0, 0);
  }
  const hsl = hexToHsl(baseHex), t = 0.5 + (hsl.l - depth) / 60;
  if (t >= 0 && t <= 1) {
    const ang = hueToCanvasAngle(hsl.h) * Math.PI / 180 - Math.PI / 2;
    ctx.beginPath(); ctx.arc(c + t * R * Math.cos(ang), c + t * R * Math.sin(ang), 5, 0, 7);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

/** Toon Titan cel shader: pick an Initial Color and the Base/Shade/Highlight/Outline become one-click drawing colors. */
export default function ColorPanel() {
  const s = useStore(), sh = s.shader, cols = computeColors(sh), mids = midTones(cols);
  const cv = useRef(null), depth = useRef(Math.round(hexToHsl(sh.baseColor).l)), band = useRef(4), drag = useRef(false);
  const [, force] = [0, () => useStore.setState({})];
  const redraw = () => cv.current && drawWheel(cv.current, depth.current, band.current, sh.baseColor);
  useEffect(redraw);

  const pick = (e) => {
    const r = cv.current.getBoundingClientRect(), x = (e.clientX - r.left) * SIZE / r.width - SIZE / 2, y = (e.clientY - r.top) * SIZE / r.height - SIZE / 2;
    const d = Math.hypot(x, y), R = SIZE / 2 - 2; if (d > R) return;
    let a = Math.atan2(y, x) * 180 / Math.PI + 90; if (a < 0) a += 360;
    s.setShader({ baseColor: wheelPick(a, d / R, depth.current, band.current) });
  };
  const load = (hex, e) => { depth.current = Math.round(hexToHsl(hex).l); s.setShader({ baseColor: hex }); };
  const use = (hex) => (e) => (e.ctrlKey || e.metaKey) ? load(hex) : s.useColor(hex, e.shiftKey);
  const sw = (hex, label, big) => <button key={label + hex} className={'ccell' + (big ? ' big' : '')} style={{ background: hex }} title={`${label} ${hex.toUpperCase()} — click: ${s.colorTarget}, Shift: ${s.colorTarget === 'fill' ? 'stroke' : 'fill'}, Ctrl: load as Initial Color`} onClick={use(hex)} data-color={hex} />;
  const slider = (k, label, min, max) => <label className="row"><span className="lbl">{label}</span><input type="range" min={min} max={max} value={sh[k]} onChange={e => s.setShader({ [k]: +e.target.value })} data-shader={k} /><output>{sh[k]}</output></label>;
  const snap = { ...sh };

  return (
    <details className="props color" open>
      <summary>Color <em>Toon Titan</em></summary>
      <div className="seg">
        <span>Click sets</span>
        {['fill', 'stroke'].map(t => <button key={t} className={s.colorTarget === t ? 'on' : ''} onClick={() => s.setColorTarget(t)} data-target={t}>{t}</button>)}
        <span className="active"><i style={{ background: s.style.fill }} title="active fill" /><i style={{ background: s.style.stroke }} title="active stroke" /></span>
      </div>
      <svg className="ball" viewBox="0 0 220 220" data-ball>
        <g className="zone" onClick={use(cols.outline)} data-zone="outline"><title>Outline {cols.outline.toUpperCase()}</title>
          <circle cx="110" cy="110" r="100" fill={cols.outline} /><circle cx="181" cy="181" r="12" fill={cols.outline} /></g>
        <circle className="zone" cx="110" cy="110" r="94" fill={cols.base} onClick={use(cols.base)} data-zone="base"><title>Base {cols.base.toUpperCase()}</title></circle>
        <path className="zone" d="M 176 43 A 94 94 0 0 1 110 204 A 94 94 0 0 1 43 176 Q 120 160 176 43 Z" fill={cols.shade} onClick={use(cols.shade)} data-zone="shade"><title>Shade {cols.shade.toUpperCase()}</title></path>
        <circle className="zone" cx="72" cy="72" r="24" fill={cols.highlight} onClick={use(cols.highlight)} data-zone="highlight"><title>Highlight {cols.highlight.toUpperCase()}</title></circle>
      </svg>
      <p className="hint2">Click a zone to make it your active {s.colorTarget} color (Shift: the other one, Ctrl: load as Initial Color).</p>
      <h5>Color wheel <small>generates new Initial Colors</small></h5>
      <canvas ref={cv} width={SIZE} height={SIZE} className="wheel" data-wheel
        onPointerDown={e => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={e => drag.current && pick(e)} onPointerUp={() => { drag.current = false; }}
        onWheel={e => { depth.current = Math.max(0, Math.min(100, depth.current + (e.deltaY < 0 ? -4 : 4))); redraw(); }} />
      <div className="seg">
        <span>Depth</span><button onClick={() => { depth.current = Math.max(0, depth.current - 4); redraw(); }}>−</button><button onClick={() => { depth.current = Math.min(100, depth.current + 4); redraw(); }}>+</button>
        <span>Bands</span>
        {['12', '24', '48', '96', '∞'].map((l, i) => <button key={l} className={band.current === i ? 'on' : ''} onClick={() => { band.current = i; force(); }}>{l}</button>)}
      </div>
      <label className="row"><span className="lbl">Initial</span>
        <input type="color" value={sh.baseColor} onChange={e => load(e.target.value)} />
        <input className="hex" defaultValue={sh.baseColor.toUpperCase()} key={sh.baseColor} onBlur={e => { const v = parseValidHex(e.target.value); v ? load(v) : (e.target.value = sh.baseColor.toUpperCase()); }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
        <button onClick={() => s.setShader({ ...DEFAULT_SHADER, baseColor: sh.baseColor })} title="reset sliders">⟲</button></label>
      {slider('shade', 'Shade', 0, 40)}{slider('highlight', 'Highlight', 0, 40)}{slider('outline', 'Outline', -50, 50)}{slider('hue', 'Hue shift', -30, 30)}{slider('chroma', 'Chroma', -100, 100)}
      <h5>Mid-tones</h5><div className="bar">{mids.map((h, i) => sw(h, 'Mid-tone', false))}</div>
      <h5>Palette <small>click empty = save · click = load · Alt+click = clear</small></h5>
      <div className="pal">{s.palette.map((p, i) => <button key={i} className={'ccell' + (p ? '' : ' empty')} style={p ? { background: computeColors(p).base } : undefined} title={p ? 'Load style (Alt: clear)' : 'Save current style'}
        onClick={e => p ? (e.altKey ? s.setPalette(i, null) : (depth.current = Math.round(hexToHsl(p.baseColor).l), s.setShader(p))) : s.setPalette(i, snap)} />)}</div>
    </details>
  );
}
