export function renderRingMask(w, h, p = {}) {
  const {
    x = 0, y = 0,
    radius = 0.45,
    width = 0.08,
    softness = 1
  } = p;

  const cx = (w - 1) * (0.5 + x);
  const cy = (h - 1) * (0.5 + y);
  const r1 = (radius - width * 0.5) * Math.min(w, h);
  const r2 = (radius + width * 0.5) * Math.min(w, h);
  const soft = Math.max(0.0001, softness);

  const out = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;
      const d = Math.sqrt(dx*dx + dy*dy);

      let v = Math.min(
        1 - (d - r2) / soft,
        1 - (r1 - d) / soft
      );

      if (v > 0) out[j*w+i] = Math.min(1, v);
    }
  }
  return out;
}