export function renderCircleMask(w, h, p = {}) {
  const {
    x = 0, y = 0,
    radius = 0.4,
    fill = 1,
    strokePx = 1,
    softness = 1
  } = p;

  const cx = (w - 1) * (0.5 + x);
  const cy = (h - 1) * (0.5 + y);
  const r = radius * Math.min(w, h);
  const soft = Math.max(0.0001, softness);

  const out = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let v;

      if (fill) {
        v = 1 - (d - r) / soft;
      } else {
        v = 1 - (Math.abs(d - r) - strokePx) / soft;
      }

      if (v > 0) out[j*w+i] = Math.min(1, v);
    }
  }
  return out;
}