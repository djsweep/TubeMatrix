import { renderLineMask } from "./shapes/line.js";
import { renderRectMask } from "./shapes/rect.js";

window.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM ----------
  const canvas = document.getElementById("liveView");
  const live = new TM.LiveView(canvas);

  // ---------- helpers ----------
  const degToRad = (d) => (d * Math.PI) / 180;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function hexToRgb(hex) {
    const h = (hex || "#ffffff").replace("#", "").padEnd(6, "f");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return {
      r: Number.isNaN(r) ? 255 : r,
      g: Number.isNaN(g) ? 255 : g,
      b: Number.isNaN(b) ? 255 : b,
    };
  }

  function resizeLiveCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    live.render();
  }
  window.addEventListener("resize", resizeLiveCanvas);
  resizeLiveCanvas();

  // ---------- DDP bridge ----------
  if (TM.DDP && TM.DDP.connect) TM.DDP.connect("ws://localhost:8787");

  // ---------- profile ----------
  const savedProfile = TM.loadProfile ? TM.loadProfile() : null;
  if (savedProfile) TM.state.profile = savedProfile;

  if (!TM.state.profile) {
    // fallback demo profile
    TM.state.profile = {
      version: 1,
      name: "Demo Stage",
      height: 60,
      devices: [
        { id: "TL1", ip: "192.168.4.10", w: 1, x: 0, flipY: false, reverseX: false },
        { id: "TL2", ip: "192.168.4.11", w: 1, x: 1, flipY: false, reverseX: false },
        { id: "TL3", ip: "192.168.4.12", w: 1, x: 2, flipY: false, reverseX: false },
        { id: "TL4", ip: "192.168.4.13", w: 1, x: 3, flipY: false, reverseX: false },
      ],
    };
  }
  live.setProfile(TM.state.profile);

  // =========================================================
  // UI HELPERS
  // =========================================================
  function updateShapeUI(side, activeShape) {
    const shapes = ["line", "rect", "circle", "wave"];
    for (const s of shapes) {
      const el = document.getElementById(`ui-${s}-${side}`);
      if (!el) continue;
      el.style.display = (s === activeShape) ? "block" : "none";
    }
  }

  function bindColorInput(id, channel) {
    const el = document.getElementById(id);
    if (!el) return;
    const apply = () => {
      channel.color = hexToRgb(el.value);
      renderOutput();
    };
    el.addEventListener("input", apply);
    apply();
  }

  function bindLineUI(ch, angleId, thickId, lenId, offXId, offYId, labA, labT, labL, labX, labY) {
    const angleEl = document.getElementById(angleId);
    const thickEl = document.getElementById(thickId);
    const lenEl = document.getElementById(lenId);
    const offXEl = document.getElementById(offXId);
    const offYEl = document.getElementById(offYId);

    const lAngle = document.getElementById(labA);
    const lThick = document.getElementById(labT);
    const lLen = document.getElementById(labL);
    const lOffX = document.getElementById(labX);
    const lOffY = document.getElementById(labY);

    const apply = () => {
      if (angleEl) {
        ch.line.angleDeg = +angleEl.value;
        if (lAngle) lAngle.textContent = angleEl.value + "°";
      }
      if (thickEl) {
        ch.line.thickness = clamp01(+thickEl.value / 100);
        if (lThick) lThick.textContent = thickEl.value + "%";
      }
      if (lenEl) {
        ch.line.length = clamp01(+lenEl.value / 100);
        if (lLen) lLen.textContent = lenEl.value + "%";
      }
      if (offXEl) {
        ch.line.x = (+offXEl.value) / 100;
        if (lOffX) lOffX.textContent = offXEl.value;
      }
      if (offYEl) {
        ch.line.y = (+offYEl.value) / 100;
        if (lOffY) lOffY.textContent = offYEl.value;
      }
      renderOutput();
    };

    if (angleEl) angleEl.oninput = apply;
    if (thickEl) thickEl.oninput = apply;
    if (lenEl) lenEl.oninput = apply;
    if (offXEl) offXEl.oninput = apply;
    if (offYEl) offYEl.oninput = apply;

    apply();
  }

  function bindRectAngleUI(ch, angleId, labelId) {
    const angleEl = document.getElementById(angleId);
    const labelEl = document.getElementById(labelId);
    if (!angleEl) return;

    const apply = () => {
      ch.rect.angle = +angleEl.value; // degrees in state
      if (labelEl) labelEl.textContent = angleEl.value + "°";
      renderOutput();
    };

    angleEl.oninput = apply;
    apply();
  }

  function bindRectSizeUI(ch, wId, wLab, hId, hLab, fId, fLab) {
    const w = document.getElementById(wId);
    const h = document.getElementById(hId);
    const f = document.getElementById(fId);

    const lw = document.getElementById(wLab);
    const lh = document.getElementById(hLab);
    const lf = document.getElementById(fLab);

    if (!w || !h || !f) return;

    const apply = () => {
      ch.rect.width = +w.value;
      ch.rect.height = +h.value;
      ch.rect.fill = +f.value;

      if (lw) lw.textContent = w.value + "%";
      if (lh) lh.textContent = h.value + "%";
      if (lf) lf.textContent = f.value + "%";

      renderOutput();
    };

    w.oninput = h.oninput = f.oninput = apply;
    apply();
  }

  function bindShapeButtons(prefix, channel) {
    const map = {
      Circle: document.getElementById(`btn${prefix}ShapeCircle`),
      Rect: document.getElementById(`btn${prefix}ShapeRect`),
      Line: document.getElementById(`btn${prefix}ShapeLine`),
      Wave: document.getElementById(`btn${prefix}ShapeWave`)
    };

    function updateShapeButtonUI() {
      const active = (channel.activeShape || "line").toLowerCase();
      for (const [name, el] of Object.entries(map)) {
        if (!el) continue;
        el.classList.toggle("is-active", name.toLowerCase() === active);
      }
    }

    function setActive(name) {
      channel.activeShape = name.toLowerCase();
      updateShapeButtonUI();
      updateShapeUI(prefix.toLowerCase(), channel.activeShape);
      renderOutput();
    }

    for (const [name, el] of Object.entries(map)) {
      if (!el) continue;
      el.addEventListener("click", () => setActive(name));
    }

    if (!channel.activeShape) channel.activeShape = "line";
    updateShapeButtonUI();
    updateShapeUI(prefix.toLowerCase(), channel.activeShape);
  }

  // =========================================================
  // BIND UI
  // =========================================================
  // Crossfade
  const xfade = document.getElementById("xfade");
  const xfadeValue = document.getElementById("xfadeValue");
  if (xfade) {
    xfade.oninput = () => {
      const v = parseFloat(xfade.value);
      TM.state.show.crossfade = (v + 100) / 200; // -100..100 => 0..1
      if (xfadeValue) xfadeValue.textContent = String(v);
      renderOutput();
    };
  }

  // Colors
  bindColorInput("colorA", TM.state.show.channelA);
  bindColorInput("colorB", TM.state.show.channelB);

  // Shape buttons (also toggles panels)
  bindShapeButtons("A", TM.state.show.channelA);
  bindShapeButtons("B", TM.state.show.channelB);

  // Color mode (kept for later; default solid)
  const colorModeEl = document.getElementById("colorMode");
  if (colorModeEl) {
    if (!TM.state.show.colorMode) TM.state.show.colorMode = "solid";
    colorModeEl.value = TM.state.show.colorMode;
    colorModeEl.addEventListener("change", () => {
      TM.state.show.colorMode = colorModeEl.value;
      renderOutput();
    });
  }

  // LINE UI (degrees in UI, radians in render)
  bindLineUI(
    TM.state.show.channelA,
    "aAngle", "aThick", "aLen", "aOffX", "aOffY",
    "aAngleLabel", "aThickLabel", "aLenLabel", "aOffXLabel", "aOffYLabel"
  );
  bindLineUI(
    TM.state.show.channelB,
    "bAngle", "bThick", "bLen", "bOffX", "bOffY",
    "bAngleLabel", "bThickLabel", "bLenLabel", "bOffXLabel", "bOffYLabel"
  );

  // RECT UI
  bindRectAngleUI(TM.state.show.channelA, "aRectAngle", "aRectAngleLabel");
  bindRectAngleUI(TM.state.show.channelB, "bRectAngle", "bRectAngleLabel");

  bindRectSizeUI(
    TM.state.show.channelA,
    "aRectW", "aRectWLabel",
    "aRectH", "aRectHLabel",
    "aRectFill", "aRectFillLabel"
  );
  bindRectSizeUI(
    TM.state.show.channelB,
    "bRectW", "bRectWLabel",
    "bRectH", "bRectHLabel",
    "bRectFill", "bRectFillLabel"
  );

  // =========================================================
  // RENDER PIPELINE
  // =========================================================
  function renderChannelMask(channel, W, H) {
    const shape = (channel.activeShape || "line").toLowerCase();

    if (shape === "rect") {
      const R = channel.rect || {};
      return renderRectMask(W, H, {
        x: (R.x || 0) / 100,
        y: (R.y || 0) / 100,
        width: (R.width || 60) / 100,
        height: (R.height || 60) / 100,
        angle: degToRad(R.angle || 0),
        fill: (R.fill ?? 100) / 100,
        thickness: (R.thickness || 8) / 100
      });
    }

    // default: line
    const L = channel.line || {};
    const angleDeg = (L.angleDeg != null) ? L.angleDeg : 0;
    return renderLineMask(W, H, {
      x: L.x || 0,
      y: L.y || 0,
      angle: degToRad(angleDeg),
      thickness: L.thickness ?? 0.08,
      length: L.length ?? 1.0
    });
  }

  function renderOutput() {
    const profile = TM.state.profile;
    if (!profile) return;

    const d = TM.deriveFromProfile(profile);
    const W = d.N;
    const H = d.H || profile.height || 60;

    const mix = clamp01(TM.state.show.crossfade || 0);

    const maskA = renderChannelMask(TM.state.show.channelA, W, H);
    const maskB = renderChannelMask(TM.state.show.channelB, W, H);

    const outMask = new Float32Array(W * H);
    for (let i = 0; i < outMask.length; i++) {
      outMask[i] = maskA[i] * (1 - mix) + maskB[i] * mix;
    }

    const CA = TM.state.show.channelA.color || { r: 255, g: 255, b: 255 };
    const CB = TM.state.show.channelB.color || { r: 255, g: 255, b: 255 };
    const mixedColor = {
      r: Math.round(CA.r * (1 - mix) + CB.r * mix),
      g: Math.round(CA.g * (1 - mix) + CB.g * mix),
      b: Math.round(CA.b * (1 - mix) + CB.b * mix),
    };

    const frameRGB = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const v = outMask[i];
      const p = i * 3;
      frameRGB[p + 0] = Math.round(mixedColor.r * v);
      frameRGB[p + 1] = Math.round(mixedColor.g * v);
      frameRGB[p + 2] = Math.round(mixedColor.b * v);
    }

    // Live preview
    live.drawMask = outMask;
    live.drawRGB = frameRGB;
    live.render();

    // Send to TLs via DDP bridge
    if (TM.DDP && TM.DDP.connected && profile.devices && profile.devices.length) {
      const xMin = d.xMin;
      const Hpx = H;

      for (const dev of profile.devices) {
        const wCols = dev.w || 1;
        const u0 = dev.x - xMin;
        if (u0 >= W || u0 + wCols <= 0) continue;

        const rgb = new Uint8Array(wCols * Hpx * 3);

        for (let cx = 0; cx < wCols; cx++) {
          const srcCol = dev.reverseX ? (wCols - 1 - cx) : cx;
          const u = u0 + srcCol;
          if (u < 0 || u >= W) continue;

          for (let y = 0; y < Hpx; y++) {
            const yy = dev.flipY ? (Hpx - 1 - y) : y;
            const src = (yy * W + u) * 3;
            const p = (cx * Hpx + y) * 3;

            rgb[p + 0] = frameRGB[src + 0];
            rgb[p + 1] = frameRGB[src + 1];
            rgb[p + 2] = frameRGB[src + 2];
          }
        }

        TM.DDP.sendToDevice(dev.ip, rgb);
      }
    }
  }

  renderOutput();
});