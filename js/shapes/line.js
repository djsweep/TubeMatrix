// js/shapes/line.js
// Robust LINE shape – univerzální pro malé i velké gridy
// Vrací Float32Array masku 0..1

export function renderLineMask(w, h, params = {}) {
  const {
    x = 0,          // -0.5 .. +0.5 (střed = 0)
    y = 0,          // -0.5 .. +0.5
    angle = 0,      // radians
    thickness = 0.08, // relativní (0..1)
    length = 1.0,   // 0..1 (1 = přes celý grid)
    softness = 1.0  // px – měkkost hrany
  } = params;

  // --- střed v pixelech ---
  const cx = (w - 1) * (0.5 + x);
  const cy = (h - 1) * (0.5 + y);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // --- tloušťka v px (MIN 1 px, jinak na malém gridu mizí) ---
  const minDim = Math.min(w, h);
  const halfThickness = Math.max(0.5, thickness * minDim * 0.5);

  // --- délka úsečky ---
  const halfLen = Math.max(
    1,
    length * Math.max(w, h) * 0.5
  );

  // --- soft edge v px ---
  const soft = Math.max(0.0001, softness);

  const mask = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = i - cx;
      const dy = j - cy;

      // rotace do lokální osy čáry
      const rx =  dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;

      // vzdálenost od osy
      const d = Math.abs(ry);

      // --- tloušťka (soft falloff) ---
      let v = 1.0 - (d - halfThickness) / soft;
      if (v <= 0) continue;

      // --- délka úsečky (soft okraje) ---
      const adx = Math.abs(rx);
      let lv = 1.0 - (adx - halfLen) / soft;
      if (lv <= 0) continue;

      // finální hodnota
      const idx = j * w + i;
      mask[idx] = Math.max(0, Math.min(1, v * lv));
    }
  }

  return mask;
}