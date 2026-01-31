// js/shapes/rect.js
// RECT mask 0..1

export function renderRectMask(w, h, params = {}) {
  const {
    x = 0,             // -0.5..+0.5 (posun středu)
    y = 0,             // -0.5..+0.5
    width = 0.6,       // 0..1 (relativně k w)
    height = 0.6,      // 0..1 (relativně k h)
    angle = 0,         // radians
    fill = 1.0,        // 0=outline, 1=fill (plynule)
    thickness = 0.08,  // outline tloušťka 0..1 (relativně k min(w,h))
    softness = 1.0     // px (měkký okraj)
  } = params;

  const cx = (w - 1) * (0.5 + x);
  const cy = (h - 1) * (0.5 + y);

  const hw = Math.max(1, width * w * 0.5);
  const hh = Math.max(1, height * h * 0.5);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const minDim = Math.min(w, h);
  const t = Math.max(0.5, thickness * minDim); // px
  const soft = Math.max(0.0001, softness);

  const mask = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;

      // rotate into rect space
      const rx =  dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;

      const ax = Math.abs(rx);
      const ay = Math.abs(ry);

      // outside check with soft edge
      const ox = ax - hw;
      const oy = ay - hh;

      const outside = Math.max(ox, oy); // >0 outside
      let insideV = 1.0 - outside / soft; // 1 inside, fades outside
      if (insideV <= 0) continue;
      insideV = Math.max(0, Math.min(1, insideV));

      // outline distance to border (only relevant if fill < 1)
      const distToEdge = Math.min(hw - ax, hh - ay); // >=0 inside
      let outlineV = 1.0 - (distToEdge - t) / soft;  // 1 near border, fades inward
      outlineV = Math.max(0, Math.min(1, outlineV));

      // mix fill/outline (fill=1 => insideV, fill=0 => outline only)
      const v = (fill * insideV) + ((1 - fill) * outlineV);
      if (v > 0) mask[j * w + i] = v;
    }
  }

  return mask;
}