import { renderLineMask } from "./shapes/line.js";

/* =========================================================
   show.js
   - boot pro SHOW (index.html)
   - Madrix-like: Channel A / Channel B + Crossfade
   ========================================================= */

(function bootShow(){

  document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action='setup'], #btnSetup, #btnOpenSetup");
  if (!el) return;

  ev.preventDefault();
  goToSetup();
});

  // --- LiveView init ---
  const canvas = document.getElementById("liveView");
  const live = new TM.LiveView(canvas);

  function resizeLiveCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
    live.render();
  }
  window.addEventListener("resize", resizeLiveCanvas);
  resizeLiveCanvas();

  // --- load mapping profile (from setup) ---
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

  // --- presets ---
  TM.state.show.presets = TM.loadPresets();
  if (TM.state.show.presets.length === 0) {
    TM.state.show.presets.push({
      id: TM.newPresetId(),
      name: "Blank",
      color: { r:255, g:255, b:255 },
      shapes: []
    });
    TM.savePresets(TM.state.show.presets);
  }

  // --- UI ---
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
    const to2 = n => ("0"+Math.max(0,Math.min(255,n|0)).toString(16)).slice(-2);
    return "#" + to2(c.r) + to2(c.g) + to2(c.b);
  }
  function hexToRgb(hex){
    const h = (hex || "#ffffff").replace("#","");
    const v = parseInt(h,16);
    return { r:(v>>16)&255, g:(v>>8)&255, b:v&255 };
  }

  function rebuildPresetSelects(){
    const presets = TM.state.show.presets;
    function fill(sel){
      if (!sel) return;
      sel.innerHTML = "";
      presets.forEach(p=>{
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.name;
        sel.appendChild(o);
      });
    }
    fill(selA); fill(selB);

    TM.state.show.channelA.presetId ||= presets[0].id;
    TM.state.show.channelB.presetId ||= presets[Math.min(1,presets.length-1)].id;

    if (selA) selA.value = TM.state.show.channelA.presetId;
    if (selB) selB.value = TM.state.show.channelB.presetId;
  }

  function getPreset(id){
    return TM.state.show.presets.find(p=>p.id===id) || null;
  }

  function loadPresetIntoChannel(key,id){
    const p = getPreset(id);
    if (!p) return;
    const ch = key==="A" ? TM.state.show.channelA : TM.state.show.channelB;
    ch.presetId = p.id;
    ch.color = { ...p.color };
    ch.shapes = JSON.parse(JSON.stringify(p.shapes||[]));
    if (key==="A" && colorA) colorA.value = rgbToHex(ch.color);
    if (key==="B" && colorB) colorB.value = rgbToHex(ch.color);
    renderOutput();
  }

  function saveChannelAsPreset(key){
    const ch = key==="A" ? TM.state.show.channelA : TM.state.show.channelB;
    const name = prompt("Název presetu:", "New Preset");
    if (!name) return;
    TM.state.show.presets.push({
      id: TM.newPresetId(),
      name,
      color:{...ch.color},
      shapes: JSON.parse(JSON.stringify(ch.shapes||[]))
    });
    TM.savePresets(TM.state.show.presets);
    rebuildPresetSelects();
  }

  if (btnLoadA) btnLoadA.onclick = ()=>loadPresetIntoChannel("A", selA.value);
  if (btnLoadB) btnLoadB.onclick = ()=>loadPresetIntoChannel("B", selB.value);
  if (btnSaveA) btnSaveA.onclick = ()=>saveChannelAsPreset("A");
  if (btnSaveB) btnSaveB.onclick = ()=>saveChannelAsPreset("B");

  if (colorA) colorA.oninput = ()=>{
    TM.state.show.channelA.color = hexToRgb(colorA.value);
    renderOutput();
  };
  if (colorB) colorB.oninput = ()=>{
    TM.state.show.channelB.color = hexToRgb(colorB.value);
    renderOutput();
  };

  if (xfade) xfade.oninput = ()=>{
    const v = parseFloat(xfade.value);
    TM.state.show.crossfade = (v+100)/200;
    if (xfadeValue) xfadeValue.textContent = String(v);
    renderOutput();
  };

  rebuildPresetSelects();
  loadPresetIntoChannel("A", TM.state.show.channelA.presetId);
  loadPresetIntoChannel("B", TM.state.show.channelB.presetId);
  TM.state.show.crossfade = 0;

  // =========================
  // OUTPUT PIPELINE (V1)
  // =========================
  function renderOutput(){
    const profile = TM.state.profile;
    if (!profile) return;

    const d = TM.deriveFromProfile(profile);
    const W = d.N;
    const H = d.H || profile.height || 60;

    const maskA = renderLineMask(W,H,{
      angle:0,
      thickness:0.08,
      length:1.0
    });

    const maskB = renderLineMask(W,H,{
      angle:Math.PI/2,
      thickness:0.08,
      length:1.0
    });

    const t = TM.state.show.crossfade;
    const mask = new Float32Array(W*H);
    for(let i=0;i<mask.length;i++){
      mask[i] = maskA[i]*(1-t) + maskB[i]*t;
    }

    live.drawMask = mask;
    live.render();
  }

  renderOutput();

  // ===============================
  // SHOW → SETUP
  // ===============================
  function stopShowHard(){
    if (TM.state.show) TM.state.show.running = false;
    if (TM.showRafId){ cancelAnimationFrame(TM.showRafId); TM.showRafId=null; }
    if (TM.showIntervalId){ clearInterval(TM.showIntervalId); TM.showIntervalId=null; }
  }

  function goToSetup(){
    stopShowHard();
    window.location.href = "setup.html";
  }

})();