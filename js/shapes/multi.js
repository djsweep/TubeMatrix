export function renderMultiMask(w, h, p = {}) {
  const {
    count = 3,
    spacing = 0.3,
    child
  } = p;

  if (!child || typeof child !== "function") {
    return new Float32Array(w * h);
  }

  const out = new Float32Array(w * h);

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    const mask = child(w, h, { x: offset });

    for (let k = 0; k < out.length; k++) {
      out[k] = Math.max(out[k], mask[k]);
    }
  }
  return out;
}