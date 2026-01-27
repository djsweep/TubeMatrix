/* =========================================================
   setup.js
   - start pro SETUP stránku
   ========================================================= */

(function bootSetup(){
  const canvas = document.getElementById("liveView");
  const live = new TM.LiveView(canvas);

  function loadDemo() {
  const demoProfile = {
    version: 1,
    name: "Demo Stage 14",
    height: 60,
    devices: [
      { id:"TL_L1", ip:"192.168.4.10", w:1, x:-7, flipY:false, reverseX:false },
      { id:"TL_L2", ip:"192.168.4.12", w:1, x:-6, flipY:false, reverseX:false },
      { id:"STAGE_A", ip:"192.168.4.20", w:5, x:-2, flipY:false, reverseX:true },
      { id:"STAGE_B", ip:"192.168.4.21", w:5, x: 3, flipY:false, reverseX:false },
      { id:"TL_R1", ip:"192.168.4.11", w:1, x: 9, flipY:true, reverseX:false },
      { id:"TL_R2", ip:"192.168.4.13", w:1, x:10, flipY:false, reverseX:false }
    ]
  };

  TM.state.profile = demoProfile;
  live.setProfile(TM.state.profile);

  const t = document.getElementById("activeProfileText");
  if (t) t.textContent = "ACTIVE: " + demoProfile.name + " (local demo)";
}
function ensureProfile() {
  if (TM.state.profile) return;

  const saved = TM.loadProfile();
  TM.state.profile = saved || {
    version: 1,
    name: "My Profile",
    height: 60,
    devices: []
  };

  live.setProfile(TM.state.profile);

  const t = document.getElementById("activeProfileText");
  if (t) t.textContent = "ACTIVE: " + (TM.state.profile.name || "My Profile") + (saved ? " (saved)" : " (new)");
}

  document.getElementById("btnLoadDemo").addEventListener("click", loadDemo);

  document.getElementById("btnToggleSelect").addEventListener("click", () => {
    TM.state.ui.highlightSelected = !TM.state.ui.highlightSelected;
    live.draw();
  });

 // auto-load saved profile (nebo vytvoř prázdný)
ensureProfile();

  // =========================
// SETUP MODES (Drag / SetCenter)
// =========================
TM.state.ui.dragMode = false;
TM.state.ui.setCenterMode = false;

const btnDrag = document.getElementById("btnDragMode");
btnDrag.addEventListener("click", () => {
  TM.state.ui.dragMode = !TM.state.ui.dragMode;
  TM.state.ui.setCenterMode = false;
  btnDrag.textContent = "Drag mode: " + (TM.state.ui.dragMode ? "ON" : "OFF");
  document.getElementById("btnSetCenterMode").textContent = "Set center: OFF";
});

const btnCenter = document.getElementById("btnSetCenterMode");
btnCenter.addEventListener("click", () => {
  TM.state.ui.setCenterMode = !TM.state.ui.setCenterMode;
  TM.state.ui.dragMode = false;
  btnCenter.textContent = "Set center: " + (TM.state.ui.setCenterMode ? "ON" : "OFF");
  document.getElementById("btnDragMode").textContent = "Drag mode: OFF";
});

document.getElementById("btnSaveProfile").addEventListener("click", () => {
  if (!TM.state.profile) return;
  TM.saveProfile(TM.state.profile);
  const t = document.getElementById("activeProfileText");
  if (t) t.textContent = "ACTIVE: " + TM.state.profile.name + " (saved)";
});

// =========================
// ADD / REMOVE DEVICE (form)
// =========================
document.getElementById("btnAddDevice").addEventListener("click", () => {
  ensureProfile();

  const id = document.getElementById("inId").value.trim();
  const ip = document.getElementById("inIp").value.trim();
  const w  = parseInt(document.getElementById("inW").value.trim(), 10);
  const x  = parseInt(document.getElementById("inX").value.trim(), 10);
  if (!id || !ip || !Number.isFinite(w) || !Number.isFinite(x)) {
    alert("Vyplň ID, IP, W, X");
    return;
  }

  if (TM.state.profile.devices.some(d => d.id === id)) {
    alert("ID už existuje");
    return;
  }

  TM.state.profile.devices.push({
    id, ip, w, x,
    flipY: false,
    reverseX: false
  });

  live.setProfile(TM.state.profile);
  TM.saveProfile(TM.state.profile);

  document.getElementById("inId").value = "";
  document.getElementById("inIp").value = "";
  document.getElementById("inW").value = "";
  document.getElementById("inX").value = "";
});

document.getElementById("btnRemoveSelected").addEventListener("click", () => {
  ensureProfile();

  const sel = TM.state.ui.selectedDeviceId;
  if (!sel) return;

  TM.state.profile.devices = TM.state.profile.devices.filter(d => d.id !== sel);
  TM.state.ui.selectedDeviceId = null;

  live.setProfile(TM.state.profile);
  TM.saveProfile(TM.state.profile);
});
// řekneme liveview, že je v setup režimu
live.isSetup = true;

// =========================
// Auto-save hook (když se layout mění)
// =========================
live.onProfileChanged = () => {
  TM.saveProfile(TM.state.profile);
};
// =========================
// DDP bridge connect
// =========================
document.getElementById("btnWsConnect").addEventListener("click", () => {
  const wsUrl = document.getElementById("inWs").value.trim();
  if (!wsUrl) return;
  TM.DDP.connect(wsUrl);
});

// =========================
// VERIFY WALK (DDP)
// - běží bílej sloupec přes celý virtuální layout
// - pro každé zařízení vygeneruje jeho RGB stream a pošle do WLED
// =========================
let walkOn = false;
let walkTimer = null;
let walkU = 0;

const VERIFY = {
  cap: 5,
  stepMs: 300,
  palette: [
    [255,0,0],    // red
    [0,255,0],    // green
    [0,0,255],    // blue
    [255,255,0],  // yellow
    [0,255,255],  // cyan
    [255,0,255],  // magenta
    [255,128,0],  // orange
    [128,0,255],  // purple
    [128,255,0],  // lime
    [255,0,128]   // pink
  ]
};

function verifyColorFor(u, y, H, activeU) {
  // top cap = white
  if (y < VERIFY.cap) return [255,255,255];

  // bottom cap = unique color per global column u
  if (y >= H - VERIFY.cap) return VERIFY.palette[(u % VERIFY.palette.length + VERIFY.palette.length) % VERIFY.palette.length];

  // chase highlight: active column body = white
  if (u === activeU) return [255,255,255];

  // otherwise off
  return [0,0,0];
}

function buildDeviceRgbFromWalk(profile, derived, device, activeU) {
  const H = derived.H || 60;
  const pixelCount = device.w * H;
  const out = new Uint8Array(pixelCount * 3);

  for (let lx = 0; lx < device.w; lx++) {
    // global column index u (0..N-1)
    const u = (device.x - derived.xMin) + lx;

    // apply reverseX for stream order if requested
    const lxOut = device.reverseX ? (device.w - 1 - lx) : lx;

    for (let y = 0; y < H; y++) {
      const [r,g,b] = verifyColorFor(u, y, H, activeU);

      // apply flipY for stream order if requested
      const yOut = device.flipY ? (H - 1 - y) : y;

      const idx = (lxOut * H + yOut) * 3;
      out[idx + 0] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
    }
  }

  return out;
}

function walkTick() {
  if (!TM.state.profile) return;
  const profile = TM.state.profile;
  const derived = TM.deriveFromProfile(profile);
  if (!derived) return;

  // posun sloupec
  walkU = (walkU + 1) % derived.N;

  // pošli per device
  for (const dev of profile.devices) {
    const rgb = buildDeviceRgbFromWalk(profile, derived, dev, walkU);
    TM.DDP.sendToDevice(dev.ip, rgb);
  }

  // vizuální update v LiveView (aby to sedělo 1:1 s trubicemi)
  TM.state.ui.verify = { on: true, activeU: walkU }; 
  live.draw();
}

document.getElementById("btnWalk").addEventListener("click", () => {
  walkOn = !walkOn;
  document.getElementById("btnWalk").textContent = "VERIFY WALK: " + (walkOn ? "ON" : "OFF");

  if (walkOn) {
    walkU = 0;
    if (walkTimer) clearInterval(walkTimer);
    walkTimer = setInterval(walkTick, VERIFY.stepMs);
  } else {
    if (walkTimer) clearInterval(walkTimer);
    walkTimer = null;
    TM.state.ui.verify = { on: false, activeU: 0 };
    live.draw();
  }
});


// =========================
// TABS (LOAD / ADD / EDIT / VERIFY / DDP)
// =========================
const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
const tabPanes = Array.from(document.querySelectorAll(".tabpane"));
function setActiveTab(key){
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
  tabPanes.forEach(p => p.classList.toggle("active", p.id === ("tab-" + key)));
  TM.state.ui.activeTab = key;
}
// default
setActiveTab("edit");
tabButtons.forEach(b => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));

// =========================
// DEVICE TABLE + EDIT PANEL
// =========================
const deviceTableEl = document.getElementById("deviceTable");
const editPanelEl = document.getElementById("editPanel");
const editHintEl = document.getElementById("editHint");
const edIdText = document.getElementById("edIdText");
const edIp = document.getElementById("edIp");
const edW  = document.getElementById("edW");
const edX  = document.getElementById("edX");
const edPixel0Bottom = document.getElementById("edPixel0Bottom");
const edReverseX = document.getElementById("edReverseX");

function getSelectedDevice(){
  const sel = TM.state.ui.selectedDeviceId;
  if (!sel || !TM.state.profile) return null;
  return TM.state.profile.devices.find(d => d.id === sel) || null;
}

function renderDeviceTable(){
  ensureProfile();
  const devices = TM.state.profile.devices.slice().sort((a,b) => (a.x - b.x));
  const sel = TM.state.ui.selectedDeviceId;

  let html = '<table><thead><tr>' +
    '<th>ID</th><th>IP</th><th>X</th><th>W</th><th>0↓</th><th>RX</th>' +
    '</tr></thead><tbody>';

  for (const d of devices){
    const active = (d.id === sel) ? ' class="active"' : '';
    html += `<tr data-id="${d.id}"${active}>` +
      `<td>${d.id}</td>` +
      `<td>${d.ip}</td>` +
      `<td>${d.x}</td>` +
      `<td>${d.w}</td>` +
      `<td>${d.flipY ? 'ON' : ''}</td>` +
      `<td>${d.reverseX ? 'ON' : ''}</td>` +
    '</tr>';
  }
  html += '</tbody></table>';
  deviceTableEl.innerHTML = html;

  // row click => select
  deviceTableEl.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => {
      TM.state.ui.selectedDeviceId = tr.dataset.id;
      syncEditPanel();
      live.draw();
      renderDeviceTable();
    });
  });
}

function syncEditPanel(){
  const d = getSelectedDevice();
  if (!d){
    editPanelEl.style.display = "none";
    editHintEl.style.display = "block";
    edIdText.textContent = "(none)";
    return;
  }
  editPanelEl.style.display = "block";
  editHintEl.style.display = "none";
  edIdText.textContent = d.id;
  edIp.value = d.ip || "";
  edW.value  = String(d.w ?? "");
  edX.value  = String(d.x ?? "");
  edPixel0Bottom.checked = !!d.flipY;
  edReverseX.checked = !!d.reverseX;
}

// Update selected
document.getElementById("btnUpdateSelected").addEventListener("click", () => {
  ensureProfile();
  const d = getSelectedDevice();
  if (!d) return;

  const ip = edIp.value.trim();
  const w  = parseInt(edW.value.trim(), 10);
  const x  = parseInt(edX.value.trim(), 10);

  if (!ip || !Number.isFinite(w) || !Number.isFinite(x)) {
    alert("Vyplň IP, W, X");
    return;
  }

  d.ip = ip;
  d.w = w;
  d.x = x;
  d.flipY = !!edPixel0Bottom.checked;
  d.reverseX = !!edReverseX.checked;

  live.setProfile(TM.state.profile);
  TM.saveProfile(TM.state.profile);

  renderDeviceTable();
  syncEditPanel();
});

// Add device: after add, go to EDIT + select it
const _origAdd = document.getElementById("btnAddDevice").onclick;
// can't rely on onclick, hook after existing listener by adding a second listener
document.getElementById("btnAddDevice").addEventListener("click", () => {
  // if add succeeded, last device has new unique id and should be selected
  if (!TM.state.profile || !TM.state.profile.devices.length) return;
  const last = TM.state.profile.devices[TM.state.profile.devices.length - 1];
  if (last && last.id){
    TM.state.ui.selectedDeviceId = last.id;
    setActiveTab("edit");
    renderDeviceTable();
    syncEditPanel();
    live.draw();
  }
});

// Keep UI in sync when selection changes via canvas
let _lastSel = null;
setInterval(() => {
  const sel = TM.state.ui.selectedDeviceId || null;
  if (sel !== _lastSel){
    _lastSel = sel;
    renderDeviceTable();
    syncEditPanel();
  }
}, 150);

// Initial UI
renderDeviceTable();
syncEditPanel();
})();