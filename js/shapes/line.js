// js/shapes/line.js
// LINE mask 0..1

export function renderLineMask(w, h, params = {}) {
  const {
    x = 0,            // -0.5 .. +0.5
    y = 0,            // -0.5 .. +0.5
    angle = 0,        // radians
    thickness = 0.08, // 0..1
    length = 1.0,     // 0..1
    softness = 1.0    // px
  } = params;

  const cx = (w - 1) * (0.5 + x);
  const cy = (h - 1) * (0.5 + y);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const minDim = Math.min(w, h);
  const halfThickness = Math.max(0.5, thickness * minDim * 0.5);

  const halfLen = Math.max(1, length * Math.max(w, h) * 0.5);

  const soft = Math.max(0.0001, softness);

  const mask = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;

      const rx =  dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;

      const d = Math.abs(ry);

      let v = 1.0 - (d - halfThickness) / soft;
      if (v <= 0) continue;

      const adx = Math.abs(rx);
      let lv = 1.0 - (adx - halfLen) / soft;
      if (lv <= 0) continue;

      mask[j * w + i] = Math.max(0, Math.min(1, v * lv));
    }
  }

  return mask;
}