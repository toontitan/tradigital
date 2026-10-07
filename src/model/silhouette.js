// Neutral placeholder outline for a part, in stage px. `b` = local bounds, (ox, oy) = placement origin.
export function roundedRectPath({ xMin, xMax, yMin, yMax }, ox, oy) {
  const x0 = xMin + ox, x1 = xMax + ox, y0 = yMin + oy, y1 = yMax + oy;
  const r = Math.max(0.5, Math.min(x1 - x0, y1 - y0) * 0.35);
  return `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}`
    + `H${x0 + r}A${r},${r} 0 0 1 ${x0},${y1 - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`;
}
