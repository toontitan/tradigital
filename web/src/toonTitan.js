// Toon Titan cel shader color math (ported from toontitancelshaderv1.1.html).
export const BANDING_PRESETS = [
  { hueSegments: 12, rings: 4 }, { hueSegments: 24, rings: 5 }, { hueSegments: 48, rings: 7 },
  { hueSegments: 96, rings: 9 }, { hueSegments: null, rings: null },
];
export const WHEEL_HUE_ROTATION = 60;
export const MIDTONE_BANDS = 9, MIDTONE_CENTER = 4;
export const MUTE_MAX_MIX = 0.4;
export const DEFAULT_SHADER = { baseColor: '#227093', shade: 12, highlight: 10, outline: -24, hue: 0, chroma: 0 };

export function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
export function rgbToHex(r, g, b) { const x = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); return `#${x(r)}${x(g)}${x(b)}`; }
export function hexToHsl(hex) {
  const [R, G, B] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export function hslToRgb(h, s, l) { return hexToRgb(hslToHex(h, s, l)); }
export function parseValidHex(v) {
  let h = String(v).trim(); if (!h.startsWith('#')) h = '#' + h;
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(h)) return null;
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h.toLowerCase();
}
export function applyChromaBalance(hex, value) {
  if (!value) return hex;
  if (value < 0) {
    const t = (-value / 100) * MUTE_MAX_MIX;
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + ((255 - r) - r) * t, g + ((255 - g) - g) * t, b + ((255 - b) - b) * t);
  }
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s + (100 - hsl.s) * (value / 100), hsl.l);
}
export function lerpRgbHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// Initial Color + slider settings -> {base, shade, highlight, outline}.
export function computeColors(st) {
  const base = applyChromaBalance(st.baseColor, st.chroma);
  const hsl = hexToHsl(base);
  const hue = +st.hue;
  return {
    base,
    shade: hslToHex(hsl.h + hue, hsl.s, Math.max(0, hsl.l - st.shade)),
    highlight: hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + st.highlight)),
    outline: hslToHex(hsl.h + hue * 1.3, hsl.s, Math.max(0, Math.min(100, hsl.l + st.outline))),
  };
}
export function midTones(c) {
  return Array.from({ length: MIDTONE_BANDS }, (_, i) =>
    i === MIDTONE_CENTER ? c.base
      : i < MIDTONE_CENTER ? lerpRgbHex(c.highlight, c.base, i / MIDTONE_CENTER)
        : lerpRgbHex(c.base, c.shade, (i - MIDTONE_CENTER) / (MIDTONE_BANDS - 1 - MIDTONE_CENTER)));
}
export function harmonies(base) {
  const { h, s, l } = hexToHsl(base);
  return [150, 210, 120, 240, -30, 30].map(o => hslToHex(h + o, s, l));
}

// Wheel: hue by angle (sector 0 at 12 o'clock), lightness/saturation by radius around `depth`.
export const canvasAngleToHue = a => (((a + WHEEL_HUE_ROTATION) % 360) + 360) % 360;
export const hueToCanvasAngle = h => (((h - WHEEL_HUE_ROTATION) % 360) + 360) % 360;
export function wheelValuesAt(t, depth) { return { lightness: Math.max(0, Math.min(100, depth + (t - 0.5) * 60)), saturation: Math.min(100, t * 100) }; }
export function sectorCanvasRange(seg, n) { const w = 360 / n, s = seg * w - w / 2; return [s, s + w]; }
export function sectorHueRange(seg, n) { const s = canvasAngleToHue(sectorCanvasRange(seg, n)[0]); return [s, s + 360 / n]; }
export function segIndexOf(angle, n) { const w = 360 / n; return Math.floor((((angle + w / 2) % 360) + 360) % 360 / w) % n; }
export function averagedCell(h0, h1, t0, t1, depth) {
  const N = 4; let r = 0, g = 0, b = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const { lightness, saturation } = wheelValuesAt(t0 + (t1 - t0) * ((j + 0.5) / N), depth);
    const c = hslToRgb(h0 + (h1 - h0) * ((i + 0.5) / N), saturation, lightness);
    r += c[0]; g += c[1]; b += c[2];
  }
  return [Math.round(r / 16), Math.round(g / 16), Math.round(b / 16)];
}
// Color under a point at (angle degrees clockwise from top, radius fraction t).
export function wheelPick(angle, t, depth, bandingIndex) {
  const p = BANDING_PRESETS[bandingIndex];
  if (p.hueSegments) {
    const ring = Math.min(p.rings - 1, Math.floor(t * p.rings));
    const [h0, h1] = sectorHueRange(segIndexOf(angle, p.hueSegments), p.hueSegments);
    return rgbToHex(...averagedCell(h0, h1, ring / p.rings, (ring + 1) / p.rings, depth));
  }
  const { lightness, saturation } = wheelValuesAt(t, depth);
  return hslToHex(canvasAngleToHue(angle), saturation, lightness);
}
