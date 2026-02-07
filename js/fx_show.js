import { renderLineMask } from "./shapes/line.js";
import { renderRectMask } from "./shapes/rect.js";
import { renderCircleMask } from "./shapes/circle.js";

/* =========================================================
   FX SHOW – registry driven, single-scope version
   ========================================================= */

(async function bootFx() {

  /* =========================
     SHAPE REGISTRY (fallback)
     ========================= */

  let Shapes = {
    list: [
      {
        id: "line",
        label: "Line",
        renderer: renderLineMask,
        ui: {
          lenLabel: "Length",
          thickLabel: "Stroke",
          uses: { len: true, thick: true, rot: true, fill: false }
        }
      },
      {
        id: "rect",
        label: "Rect",
        renderer: renderRectMask,
        ui: {
          lenLabel: "Width",
          thickLabel: "Height / Stroke",
          uses: { len: true, thick: true, rot: true, fill: true }
        }
      },
      {
        id: "circle",
        label: "Circle",
        renderer: renderCircleMask,
        ui: {
          lenLabel: "Radius",
          thickLabel: "Stroke",
          uses: { len: true, thick: true, rot: false, fill: true }
        }
      }
    ],
    get(id) {
      return this.list.find(s => s.id === id) || this.list[0];
    }
  };

  /* =========================
     DOM
     ========================= */

  const canvas = document.getElementById("fxPreview");
  const elShape = document.getElementById("fxShapeType");
  const elLen = document.getElementById("fxLen");
  const elThick = document.getElementById("fxThick");
  const elRot = document.getElementById("fxRot");
  const elFill = document.getElementById("fxFill");
  const elSendTL = document.getElementById("fxSendTL");

  const elLenLabel = document.getElementById("fxLenLabel");
  const elThickLabel = document.getElementById("fxThickLabel");

  const live = new TM.LiveView(canvas);

  // =========================
// Load profile from storage (same as Setup)
// =========================
const savedProfile = TM.loadProfile();
if (savedProfile) {
  TM.state.profile = savedProfile;
}
  /* =========================
     PRESET STATE
     ========================= */

  let preset = {
    shape: "line",
    params: {
      x: 0,
      y: 0,
      angle: 0,
      length: 1.0,
      strokePx: 1,
      fill: 100
    }
  };

  /* =========================
     UI BUILD
     ========================= */

  function rebuildShapeSelect() {
    elShape.innerHTML = "";
    Shapes.list.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      elShape.appendChild(o);
    });
  }

  function updateFxUiForShape(shapeId) {
    const sh = Shapes.get(shapeId);
    if (!sh) return;

    elLenLabel.textContent = sh.ui.lenLabel;
    elThickLabel.textContent = sh.ui.thickLabel;

    elLen.parentElement.style.display = sh.ui.uses.len ? "" : "none";
    elThick.parentElement.style.display = sh.ui.uses.thick ? "" : "none";
    elRot.parentElement.style.display = sh.ui.uses.rot ? "" : "none";
    elFill.parentElement.style.display = sh.ui.uses.fill ? "" : "none";
  }

  /* =========================
     UI → PRESET
     ========================= */

  function uiToPreset() {
    preset.shape = elShape.value;

    const sh = Shapes.get(preset.shape);
    if (!sh) return;

    const p = preset.params;

    if (sh.ui.uses.len) p.length = (+elLen.value || 50) / 100;
    if (sh.ui.uses.thick) p.strokePx = 1 + Math.round((+elThick.value || 0) / 100 * 9);
    if (sh.ui.uses.rot) p.angle = (+elRot.value || 0) * Math.PI / 180;
    if (sh.ui.uses.fill) p.fill = elFill.checked ? 100 : 0;
  }

  function applyToUI() {
    const sh = Shapes.get(preset.shape);
    if (!sh) return;

    elShape.value = preset.shape;

    if (sh.ui.uses.len) elLen.value = Math.round((preset.params.length || 0.5) * 100);
    if (sh.ui.uses.thick) elThick.value = Math.round((preset.params.strokePx - 1) / 9 * 100);
    if (sh.ui.uses.rot) elRot.value = Math.round((preset.params.angle || 0) * 180 / Math.PI);
    if (sh.ui.uses.fill) elFill.checked = preset.params.fill > 0;

    updateFxUiForShape(preset.shape);
  }

  /* =========================
     RENDER LOOP
     ========================= */

  function render() {
    const profile = TM.state.profile;
let W = 60, H = 4; // fallback (4 trubice × 60px)

if (profile) {
  const d = TM.deriveFromProfile(profile);
  if (d && d.N && d.H) {
    W = d.N;
    H = d.H;
  }
}

    const sh = Shapes.get(preset.shape);
    if (!sh) return;

    const mask = sh.renderer(W, H, preset.params);

    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0; i < mask.length; i++) {
      const v = Math.max(0, Math.min(1, mask[i]));
      rgb[i * 3 + 0] = 255 * v;
      rgb[i * 3 + 1] = 255 * v;
      rgb[i * 3 + 2] = 255 * v;
    }

    live.drawMask = mask;
    live.drawRGB = rgb;
    live.render();

    if (elSendTL?.checked && TM.DDP?.connected) {
      TM.DDP.sendFrame(profile, rgb, W, H);
    }

    requestAnimationFrame(render);
  }

  /* =========================
     EVENTS
     ========================= */

  rebuildShapeSelect();
  applyToUI();

  [elShape, elLen, elThick, elRot, elFill].forEach(el => {
    el && el.addEventListener("input", () => {
      uiToPreset();
      applyToUI();
    });
  });

  elShape.addEventListener("change", () => {
    preset.shape = elShape.value;
    applyToUI();
  });

  /* =========================
     START
     ========================= */

  requestAnimationFrame(render);

})();