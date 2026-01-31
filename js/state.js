/* =========================================================
   state.js
   - sem dáváme “stav aplikace”
   - laicky: jedna velká proměnná, co popisuje profil + UI
   ========================================================= */

/* =========================
   HELPERS START
   ========================= */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
/* =========================
   HELPERS END
   ========================= */

const TM = {}; // globální namespace, ať se v tom vyznáš

TM.state = {
  // ---- Aktivní profil (pro teď jen v paměti) ----
  profile: null,

  // ---- UI stav ----
  ui: {
    selectedDeviceId: null,
    highlightSelected: true,
    verify: { on:false, activeU:0 }
  },

  // ---- SHOW stav (Madrix-like A/B + crossfade) ----
  show: {
    crossfade: 0.0, // 0=A, 1=B
    colorMode: "solid",
    channelA: {
      presetId: null,
      activeShape: "line",
      color: {r:255,g:255,b:255},
      shapes: [],
      // LINE params (normalized)
      line: { x:0, y:0, angle:0, thickness:0.08, length:1.0 },
      rect: { x:0, y:0, width:60, height:60, angle:0, fill:100, thickness:8 },
    },

    channelB: {
      presetId: null,
      activeShape: "line",
      color: {r:255,g:255,b:255},
      shapes: [],
      // default B = 90°
      line: { x:0, y:0, angle: Math.PI/2, thickness:0.08, length:1.0 },
      rect: { x:0, y:0, width:60, height:60, angle:0, fill:100, thickness:8 },
    },

        palette: {
      enabled: false,         // zapne se, když zvolíš colorMode=palette
      list: [],               // seznam z colors/index.json
      activeId: null,         // id palety (např. "soft_pastel")
      active: null,           // samotná načtená paleta (JSON)
      speed: 0.15             // rychlost změny barev
    },

    presets: [] // shared presets list
  }
};

/* =========================================================
   STORAGE HELPERS
   - ukládání profilu do localStorage
   ========================================================= */

TM.storageKey = "TM_ACTIVE_PROFILE_V1";

TM.saveProfile = function(profile) {
  try {
    localStorage.setItem(TM.storageKey, JSON.stringify(profile));
    return true;
  } catch (e) {
    console.error("TM.saveProfile failed", e);
    return false;
  }
};

TM.loadProfile = function() {
  try {
    const s = localStorage.getItem(TM.storageKey);
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    console.error("TM.loadProfile failed", e);
    return null;
  }
};

/* ===============================
   PRESETS STORAGE (SHOW)
   =============================== */
TM.PRESETS_KEY = "TM_PRESETS_V1";

TM.loadPresets = function(){
  try{
    const raw = localStorage.getItem(TM.PRESETS_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    console.warn("TM.loadPresets failed", e);
    return [];
  }
};

TM.savePresets = function(presets){
  try{
    localStorage.setItem(TM.PRESETS_KEY, JSON.stringify(presets || []));
  }catch(e){
    console.warn("TM.savePresets failed", e);
  }
};

TM.newPresetId = function(){
  return "p_" + Math.random().toString(16).slice(2,10);
};