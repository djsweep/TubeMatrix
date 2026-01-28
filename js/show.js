import { renderLineMask } from "./shapes/line.js";

(function bootShow(){
  // --- LiveView init ---
  const canvas = document.getElementById("liveView");
  const live = new TM.LiveView(canvas);

  // --- DDP bridge WS ---
TM.DDP.connect("ws://localhost:8787");

  function resizeLiveCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    live.render();
  }
  window.addEventListener("resize", resizeLiveCanvas);
  resizeLiveCanvas();

  // --- Load profile from storage ---
  const savedProfile = TM.loadProfile();
  if (savedProfile) TM.state.profile = savedProfile;

  if (!TM.state.profile) {
    TM.state.profile = {
      version: 1,
      name: "Demo Stage",
      height: 60,
      devices: [
        { id:"TL1", ip:"192.168.4.10", w:1, x:0, flipY:false, reverseX:false },
        { id:"TL2", ip:"192.168.4.11", w:1, x:1, flipY:false, reverseX:false },
        { id:"TL3", ip:"192.168.4.12", w:1, x:2, flipY:false, reverseX:false },
        { id:"TL4", ip:"192.168.4.13", w:1, x:3, flipY:false, reverseX:false }
      ]
    };
  }
  live.setProfile(TM.state.profile);

  // --- Helpers ---
  const degToRad = d => d * Math.PI / 180;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function hexToRgb(hex){
  const h = (hex || "#ffffff").replace("#","").padEnd(6, "f");
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);

  return {
    r: Number.isNaN(r) ? 255 : r,
    g: Number.isNaN(g) ? 255 : g,
    b: Number.isNaN(b) ? 255 : b
  };
}

  // --- UI: Crossfade ---
  const xfade = document.getElementById("xfade");
  const xfadeValue = document.getElementById("xfadeValue");
  if (xfade) xfade.oninput = ()=>{
    const v = parseFloat(xfade.value);
    TM.state.show.crossfade = (v + 100) / 200;
    if (xfadeValue) xfadeValue.textContent = String(v);
    renderOutput();
  };



function bindColorInput(id, channel){
  const el = document.getElementById(id);
  if (!el) {
    console.warn("Missing color input:", id);
    return;
  }
  const apply = () => {
    channel.color = hexToRgb(el.value);
    renderOutput();
  };
  el.addEventListener("input", apply);
  apply(); // důležité: nastaví barvu hned při startu
}

bindColorInput("colorA", TM.state.show.channelA);
bindColorInput("colorB", TM.state.show.channelB);

  // --- UI: LINE params (A/B) ---
  function bindLineUI(ch, angleId, thickId, lenId, labA, labT, labL){
    const angleEl = document.getElementById(angleId);
    const thickEl = document.getElementById(thickId);
    const lenEl   = document.getElementById(lenId);

    const lAngle = document.getElementById(labA);
    const lThick = document.getElementById(labT);
    const lLen   = document.getElementById(labL);

    if (angleEl) angleEl.oninput = ()=>{
      ch.line.angle = degToRad(+angleEl.value);
      if (lAngle) lAngle.textContent = angleEl.value + "°";
      renderOutput();
    };

    if (thickEl) thickEl.oninput = ()=>{
      ch.line.thickness = clamp01((+thickEl.value)/100);
      if (lThick) lThick.textContent = thickEl.value + "%";
      renderOutput();
    };

    if (lenEl) lenEl.oninput = ()=>{
      ch.line.length = clamp01((+lenEl.value)/100);
      if (lLen) lLen.textContent = lenEl.value + "%";
      renderOutput();
    };
  }

  bindLineUI(TM.state.show.channelA, "aAngle", "aThick", "aLen", "aAngleLabel", "aThickLabel", "aLenLabel");
  bindLineUI(TM.state.show.channelB, "bAngle", "bThick", "bLen", "bAngleLabel", "bThickLabel", "bLenLabel");

  // =========================
  // OUTPUT PIPELINE
  // =========================
  function renderOutput(){
    const profile = TM.state.profile;
    if (!profile) return;

    const d = TM.deriveFromProfile(profile);
    const W = d.N;
    const H = d.H || profile.height || 60;

    // ✅ Jediná “mix” proměnná, definovaná hned nahoře
    const mix = clamp01(TM.state.show.crossfade || 0);

    const LA = TM.state.show.channelA.line;
    const LB = TM.state.show.channelB.line;

    const maskA = renderLineMask(W, H, {
      angle: LA.angle,
      thickness: LA.thickness,
      length: LA.length
    });

    const maskB = renderLineMask(W, H, {
      angle: LB.angle,
      thickness: LB.thickness,
      length: LB.length
    });

    const out = new Float32Array(W * H);
    for (let i = 0; i < out.length; i++) {
      out[i] = maskA[i] * (1 - mix) + maskB[i] * mix;
    }

    // mix color A/B
    const CA = TM.state.show.channelA.color || {r:255,g:255,b:255};
    const CB = TM.state.show.channelB.color || {r:255,g:255,b:255};
    const mixedColor = {
      r: Math.round(CA.r * (1 - mix) + CB.r * mix),
      g: Math.round(CA.g * (1 - mix) + CB.g * mix),
      b: Math.round(CA.b * (1 - mix) + CB.b * mix)
    };

    live.drawMask = out;
    live.drawColor = mixedColor; // liveview.js musí použít drawColor
    live.render();
        // =========================
    // SEND TO TL via DDP bridge (per device)
    // =========================
    if (TM.DDP && TM.DDP.connected && profile && profile.devices && profile.devices.length) {
      const xMin = d.xMin;          // z derived (centered coords -> u index)
      const Hpx = H;

      for (const dev of profile.devices) {
        const wCols = dev.w || 1;

        // u0 = start column (0..W-1) v globálním frame
        const u0 = (dev.x - xMin);

        // ochrana proti out-of-range
        if (u0 >= W || (u0 + wCols) <= 0) continue;

        // pošleme RGB pro device jako pořadí:
        // (sloupec 0..w-1) × (y 0..H-1) → RGBRGB...
        const rgb = new Uint8Array(wCols * Hpx * 3);

        // reverseX = otočí pořadí sloupců uvnitř zařízení
        for (let cx = 0; cx < wCols; cx++) {
          const srcCol = dev.reverseX ? (wCols - 1 - cx) : cx;
          const u = u0 + srcCol;
          if (u < 0 || u >= W) continue;

          for (let y = 0; y < Hpx; y++) {
            const yy = dev.flipY ? (Hpx - 1 - y) : y;

            const v = out[yy * W + u]; // 0..1 maska
            const r = Math.round(mixedColor.r * v);
            const g = Math.round(mixedColor.g * v);
            const b = Math.round(mixedColor.b * v);

            const p = (cx * Hpx + y) * 3;
            rgb[p + 0] = r;
            rgb[p + 1] = g;
            rgb[p + 2] = b;
          }
        }

        TM.DDP.sendToDevice(dev.ip, rgb);
      }
    }
  }

  renderOutput();

})();