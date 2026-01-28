import { renderLineMask } from "./shapes/line.js";
/* =========================================================
   show.js
   - boot pro SHOW (index.html)
   - Madrix-like: Channel A / Channel B + Crossfade
   ========================================================= */

(function bootShow(){
  // --- navigation ---
  const btnSetup = document.getElementById("btnOpenSetup") || document.getElementById("btnSetup");
  if (btnSetup) btnSetup.addEventListener("click", goToSetup);

  // --- LiveView init ---
  const canvas = document.getElementById("liveView");
  const live = new TM.LiveView(canvas);

  // Ensure canvas has proper internal resolution
  function resizeLiveCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    live.draw();
  }
  window.addEventListener("resize", resizeLiveCanvas);
  resizeLiveCanvas();


  // --- load mapping profile (from setup) ---
  const savedProfile = TM.loadProfile();
  if (savedProfile) TM.state.profile = savedProfile;

  // fallback demo if nothing exists
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

  // --- presets (shared) ---
  TM.state.show.presets = TM.loadPresets();

  // Ensure at least 1 preset exists (so UI isn't empty)
  if (TM.state.show.presets.length === 0) {
    TM.state.show.presets.push({
      id: TM.newPresetId(),
      name: "Blank",
      color: { r:255, g:255, b:255 },
      shapes: []
    });
    TM.savePresets(TM.state.show.presets);
  }

  // --- UI elements ---
  const selA = document.getElementById("presetSelectA");
  const selB = document.getElementById("presetSelectB");
  const btnLoadA = document.getElementById("btnLoadPresetA");
  const btnLoadB = document.getElementById("btnLoadPresetB");
  const btnSaveA = document.getElementById("btnSavePresetA");
  const btnSaveB = document.getElementById("btnSavePresetB");

  const colorA = document.getElementById("colorA");
  const colorB = document.getElementById("colorB");

  const xfade = document.getElementById("xfade");
  const xfadeValue = document.getElementById("xfadeValue");
  function rgbToHex(c){
    const to2 = (n)=>("0"+Math.max(0,Math.min(255,n|0)).toString(16)).slice(-2);
    return "#" + to2(c.r) + to2(c.g) + to2(c.b);
  }
  function hexToRgb(hex){
    const h = (hex || "#ffffff").replace("#","");
    const v = parseInt(h,16);
    return { r:(v>>16)&255, g:(v>>8)&255, b:v&255 };
  }

  function rebuildPresetSelects(){
    const presets = TM.state.show.presets;

    function fillSelect(sel){
      if (!sel) return;
      sel.innerHTML = "";
      presets.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
    }

    fillSelect(selA);
    fillSelect(selB);

    // keep current selection if possible
    const aId = TM.state.show.channelA.presetId || presets[0].id;
    const bId = TM.state.show.channelB.presetId || presets[Math.min(1,presets.length-1)].id;

    if (selA) selA.value = aId;
    if (selB) selB.value = bId;

    TM.state.show.channelA.presetId = aId;
    TM.state.show.channelB.presetId = bId;
  }

  function getPresetById(id){
    return TM.state.show.presets.find(p => p.id === id) || null;
  }

  function loadPresetIntoChannel(channelKey, presetId){
    const p = getPresetById(presetId);
    if (!p) return;

    const ch = (channelKey === "A") ? TM.state.show.channelA : TM.state.show.channelB;
    ch.presetId = p.id;
    ch.color = { ...p.color };
    ch.shapes = JSON.parse(JSON.stringify(p.shapes || []));

    if (channelKey === "A" && colorA) colorA.value = rgbToHex(ch.color);
    if (channelKey === "B" && colorB) colorB.value = rgbToHex(ch.color);

    renderOutput(); // preview/output refresh
  }

  function saveChannelAsPreset(channelKey){
    const ch = (channelKey === "A") ? TM.state.show.channelA : TM.state.show.channelB;

    const name = prompt("Název presetu:", "New Preset");
    if (!name) return;

    const preset = {
      id: TM.newPresetId(),
      name,
      color: { ...ch.color },
      shapes: JSON.parse(JSON.stringify(ch.shapes || []))
    };

    TM.state.show.presets.push(preset);
    TM.savePresets(TM.state.show.presets);
    rebuildPresetSelects();
  }

  // Hook UI events
  if (btnLoadA) btnLoadA.addEventListener("click", () => loadPresetIntoChannel("A", selA.value));
  if (btnLoadB) btnLoadB.addEventListener("click", () => loadPresetIntoChannel("B", selB.value));
  if (btnSaveA) btnSaveA.addEventListener("click", () => saveChannelAsPreset("A"));
  if (btnSaveB) btnSaveB.addEventListener("click", () => saveChannelAsPreset("B"));

  if (colorA) colorA.addEventListener("input", () => {
    TM.state.show.channelA.color = hexToRgb(colorA.value);
    renderOutput();
  });
  if (colorB) colorB.addEventListener("input", () => {
    TM.state.show.channelB.color = hexToRgb(colorB.value);
    renderOutput();
  });

  if (xfade) xfade.addEventListener("input", () => {
    const v = parseFloat(xfade.value);
    TM.state.show.crossfade = (v + 100) / 200; // 0..1
    if (xfadeValue) xfadeValue.textContent = String(v);
  });

// --- initial UI state ---
  rebuildPresetSelects();
  // load initial preset into both channels
  loadPresetIntoChannel("A", TM.state.show.channelA.presetId);
  loadPresetIntoChannel("B", TM.state.show.channelB.presetId);

  if (xfade) xfade.value = "0";
  TM.state.show.crossfade = 0.0;
  if (xfadeLabel) // --- Output rendering (V0) ---
  // V0: ještě nemáme shapes engine, takže renderujeme jen "solid" barvu podle crossfade.
  // Později: frame = mask * color, mix(A,B,crossfade)
  function renderOutput(){
  const profile = TM.state.profile;
  if (!profile) return;

  const derived = TM.deriveFromProfile(profile);
  const W = derived.N;
  const H = derived.H || profile.height || 60;

  // --- Channel A LINE (zatím natvrdo, UI přijde hned potom) ---
  const maskA = renderLineMask(W, H, {
    x: 0,
    y: 0,
    angle: 0,
    thickness: 0.08,
    length: 1.0
  });

  // --- Channel B LINE (pro test jiný úhel) ---
  const maskB = renderLineMask(W, H, {
    x: 0,
    y: 0,
    angle: Math.PI / 2,
    thickness: 0.08,
    length: 1.0
  });

  const t = TM.state.show.crossfade;

  // --- smíchaná maska ---
  const mask = new Float32Array(W * H);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = maskA[i] * (1 - t) + maskB[i] * t;
  }

  // --- PREVIEW DO LIVEVIEW ---
  live.drawMask = mask;     // uložíme masku
  live.draw();              // liveview si ji vezme
}

  // Patch LiveView helpers if not present (non-breaking)
  if (typeof live.setBackgroundColor !== "function") {
    live.setBackgroundColor = function(rgb){
      this._bg = rgb;
    };
  }
  if (typeof live.render !== "function") {
    live.render = function(){
      const ctx = this.ctx;
      const w = this.canvas.width = this.canvas.clientWidth;
      const h = this.canvas.height = this.canvas.clientHeight;
      const bg = this._bg || {r:0,g:0,b:0};
      ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
      ctx.fillRect(0,0,w,h);
      // draw mapping overlay if method exists
      if (typeof this.draw === "function") this.draw();
      else if (typeof this.drawOverlay === "function") this.drawOverlay();
    };
  }

  renderOutput();

  // ===============================
// SHOW → SETUP (single window)
// ===============================

function stopShowHard() {
  // zastaví běh show (bezpečně)
  if (window.TM && TM.state && TM.state.show) {
    TM.state.show.running = false;
  }

  // zruší requestAnimationFrame, pokud existuje
  if (window.TM && TM.showRafId) {
    cancelAnimationFrame(TM.showRafId);
    TM.showRafId = null;
  }

  // zruší intervaly, pokud existují
  if (window.TM && TM.showIntervalId) {
    clearInterval(TM.showIntervalId);
    TM.showIntervalId = null;
  }

  // tady zatím NIC víc – jen stop
}

function goToSetup() {
  stopShowHard();
  window.location.href = "setup.html";
}

})();
