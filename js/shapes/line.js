export function renderLineMask(w, h, params) {
  const {
    x = 0,        // -0.5 .. +0.5 (střed = 0)
    y = 0,        // -0.5 .. +0.5
    angle = 0,    // radians
    thickness = 0.1 // 0..1 (relativně k min(w,h))
  } = params;

  const cx = w * (0.5 + x);
  const cy = h * (0.5 + y);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const t = thickness * Math.min(w, h);

  const mask = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;

      // rotace bodu do lokální osy čáry
      const rx =  dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;

      const dist = Math.abs(ry);
      const v = dist <= t ? 1 : 0;

      mask[j * w + i] = v;
    }
  }
  return mask;
}