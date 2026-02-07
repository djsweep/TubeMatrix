import { renderLineMask } from "./line.js";
import { renderRectMask } from "./rect.js";
import { renderCircleMask } from "./circle.js";
import { renderWaveMask } from "./wave.js";

export const ShapeRegistry = {
  line: {
    label: "Line",
    renderer: renderLineMask,
    params: {
      length:  { type: "range", min: 0.05, max: 2, step: 0.01, ui: "len" },
      strokePx:{ type: "range", min: 1, max: 10, step: 1, ui: "thick" },
      angle:   { type: "angle", ui: "rot" },
      x:       { type: "pos", ui: "x" },
      y:       { type: "pos", ui: "y" }
    }
  },

  rect: {
    label: "Rect",
    renderer: renderRectMask,
    params: {
      width:   { type: "range", min: 0.05, max: 1, step: 0.01, ui: "len" },
      height:  { type: "range", min: 0.05, max: 1, step: 0.01, ui: "thick" },
      fill:    { type: "bool", ui: "fill" },
      strokePx:{ type: "range", min: 1, max: 10, step: 1, ui: "thick" }
    }
  },

  circle: {
    label: "Circle",
    renderer: renderCircleMask,
    params: {
      radius:  { type: "range", min: 0.05, max: 0.5, step: 0.01, ui: "len" },
      fill:    { type: "bool", ui: "fill" },
      strokePx:{ type: "range", min: 1, max: 10, step: 1, ui: "thick" }
    }
  }
};