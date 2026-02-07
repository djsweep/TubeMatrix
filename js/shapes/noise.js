export function renderNoiseMask(w, h, p = {}) {
  const {
    scale = 0.2,
    threshold = 0.5
  } = p;

  const out = new Float32Array(w * h);

  for (let i = 0; i < out.length; i++) {
    const v = Math.random();
    out[i] = v > threshold ? (v - threshold) / (1 - threshold) : 0;
  }
  return out;
}