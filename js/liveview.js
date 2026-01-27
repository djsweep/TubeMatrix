/* =========================================================
   liveview.js
   - kreslí Live Stage View na canvasu
   - podporuje:
     - device outlines + labels
     - center line
     - kliknutí na zařízení -> select
   ========================================================= */

/* =========================
   LIVEVIEW CONSTANTS
   (tady ladíš vzhled)
   ========================= */
const LV = {
  padX: 24,
  padY: 28,
  tubeW: 18,
  tubeGap: 6,
  tubeH: 420,            // výška tuby v px (na iPadu čitelné)
  labelH: 16
};
function getPadX(canvas, derived) {
  if (!canvas || !derived) return LV.padX;

  const N = derived.N;
  const colStep = LV.tubeW + LV.tubeGap;
  const stagePxW = N * colStep - LV.tubeGap;

  return Math.floor((canvas.width - stagePxW) / 2);
}
TM.getCanvasXY = function(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (canvas.width / r.width),
    y: (ev.clientY - r.top) * (canvas.height / r.height)
  };
};

TM.LiveView = function(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext("2d");
  this.profile = null;
  this.derived = null;
  this.onProfileChanged = null; // setup.js si sem dá funkci

  // předpočítané obdélníky zařízení pro klikání
  this.deviceRects = []; // {id,left,top,right,bottom,u0,u1}

// =========================
// DRAG STATE (jen pro setup)
// =========================
this.isSetup = false;      // nastaví setup.js
this.dragging = false;
this.dragDeviceId = null;
this.dragStartX = 0;
this.dragStartDeviceX = 0;

  // bind klik
  canvas.addEventListener("pointerdown", (ev) => this.onPointerDown(ev));
  canvas.addEventListener("pointermove", (ev) => this.onPointerMove(ev));
  canvas.addEventListener("pointerup", (ev) => this.onPointerUp(ev));   
  canvas.addEventListener("pointercancel", (ev) => this.onPointerUp(ev));
};

TM.LiveView.prototype.setProfile = function(profile) {
  this.profile = profile;
  this.derived = TM.deriveFromProfile(profile);
  this.rebuildHitRects();
  this.draw();
};

TM.LiveView.prototype.rebuildHitRects = function() {
  this.deviceRects = [];
  if (!this.profile || !this.derived) return;

  const { xMin, H } = this.derived;
  const colStep = (LV.tubeW + LV.tubeGap);

  for (const d of this.profile.devices) {
    const u0 = d.x - xMin;
    const u1 = u0 + d.w - 1;

    const left = getPadX(this.canvas, this.derived) + u0 * colStep - 4;
    const right = getPadX(this.canvas, this.derived) + (u1 + 1) * colStep - LV.tubeGap + 4;
    const top = LV.padY - LV.labelH - 6;
    const bottom = LV.padY + LV.tubeH + 8;

    this.deviceRects.push({ id: d.id, left, right, top, bottom, u0, u1 });
  }
};

TM.LiveView.prototype.onPointerDown = function(ev) {
  if (!this.profile || !this.derived) return;

  const { x, y } = TM.getCanvasXY(this.canvas, ev);

  // 1) hit test zařízení
  for (const r of this.deviceRects) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      TM.state.ui.selectedDeviceId = r.id;

      // SET CENTER MODE: klik na zařízení NE, to řešíme klikem na sloupec níž
      // DRAG MODE: začni tahat celé zařízení
      if (this.isSetup && TM.state.ui.dragMode) {
        this.dragging = true;
        this.dragDeviceId = r.id;
        this.dragStartX = x;

        const dev = this.profile.devices.find(d => d.id === r.id);
        this.dragStartDeviceX = dev.x;

        this.canvas.setPointerCapture(ev.pointerId);
      }

      this.draw();

      // === PROFILE CHANGED (set center) ===
        if (typeof this.onProfileChanged === "function") {
            this.onProfileChanged();
            }
      return;
    }
  }

  // 2) klik mimo zařízení – pokud je Set Center ON, nastav center podle sloupce
  if (this.isSetup && TM.state.ui.setCenterMode) {
    const colStep = (LV.tubeW + LV.tubeGap);
    const uClicked = Math.floor((x - getPadX(this.canvas, this.derived)) / colStep);

    if (uClicked >= 0 && uClicked < this.derived.N) {
      const xClicked = uClicked + this.derived.xMin; // center-0 souřadnice
      // posuň všechny device.x tak, aby xClicked bylo 0
      for (const d of this.profile.devices) d.x = d.x - xClicked;

      // přepočti derived + hit rects
      this.derived = TM.deriveFromProfile(this.profile);
      this.rebuildHitRects();
      this.draw();
    }
  }
};

TM.LiveView.prototype.draw = function() {
  const ctx = this.ctx;
  const W = this.canvas.width;
  const Hc = this.canvas.height;

  // 1) background
  ctx.clearRect(0, 0, W, Hc);
  ctx.fillStyle = "#070810";
  ctx.fillRect(0, 0, W, Hc);

  if (!this.profile || !this.derived) {
    ctx.fillStyle = "#9aa0ad";
    ctx.font = "14px system-ui";
    ctx.fillText("No profile loaded.", 20, 30);
    return;
  }

  const { N, xMin, centerU } = this.derived;
  const colStep = (LV.tubeW + LV.tubeGap);
  const rowH = LV.tubeH / (this.derived.H || 60);

  // 2) device outlines + labels
  for (const r of this.deviceRects) {
    const isSel = (TM.state.ui.selectedDeviceId === r.id);
    const showSel = isSel && TM.state.ui.highlightSelected;

    ctx.strokeStyle = showSel ? "#4aa3ff" : "#2a2e3f";
    ctx.lineWidth = showSel ? 2 : 1;
    ctx.strokeRect(r.left, r.top, (r.right - r.left), (r.bottom - r.top));

    ctx.fillStyle = showSel ? "#e8e8ef" : "#9aa0ad";
    ctx.font = "12px system-ui";
    ctx.fillText(r.id, r.left + 6, r.top + 14);
  }

  // 3) tubes (sloupce)
  for (let u = 0; u < N; u++) {
    const x = getPadX(this.canvas, this.derived) + u * colStep;
    const y = LV.padY;

    // obrys tuby
    ctx.fillStyle = "#0f1119";
    ctx.fillRect(x, y, LV.tubeW, LV.tubeH);

    // jemné segmenty po 5 px (jen orientačně)
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    const Hpx = (this.derived.H || 60);
    for (let yy = 0; yy < Hpx; yy += 5) {
      ctx.fillRect(x, y + yy * rowH, LV.tubeW, 1);
    }
  }



// 3b) VERIFY overlay (mapping check)
// - top cap: white
// - bottom cap: unique color per column
// - activeU body: white
const verify = (TM.state.ui && TM.state.ui.verify) ? TM.state.ui.verify : null;
if (verify && verify.on) {
  const Hpx = (this.derived.H || 60);
  const cap = 5;
  const palette = [
    [255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],
    [255,0,255],[255,128,0],[128,0,255],[128,255,0],[255,0,128]
  ];

  for (let u = 0; u < N; u++) {
    const x = getPadX(this.canvas, this.derived) + u * colStep;
    const y0 = LV.padY;

    for (let y = 0; y < Hpx; y++) {
      let rgb;
      if (y < cap) rgb = [255,255,255];
      else if (y >= Hpx - cap) rgb = palette[u % palette.length];
      else if (u === verify.activeU) rgb = [255,255,255];
      else rgb = [0,0,0];

      if (rgb[0] || rgb[1] || rgb[2]) {
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(x+1, y0 + y * rowH, LV.tubeW-2, rowH);
      }
    }
  }
}

  // 4) center line (0)
  const cx = getPadX(this.canvas, this.derived) + centerU * colStep - (LV.tubeGap / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, LV.padY - 22);
  ctx.lineTo(cx, LV.padY + LV.tubeH + 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px system-ui";
  ctx.fillText("0", cx + 4, LV.padY - 8);

  // 5) axis labels (volitelné – teď jen kolem středu)
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "11px system-ui";
  for (let u = 0; u < N; u++) {
    const xVal = u + xMin;
    if (Math.abs(xVal) <= 3) {
      const x = getPadX(this.canvas, this.derived) + u * colStep;
      ctx.fillText(String(xVal), x + 2, LV.padY + LV.tubeH + 22);
    }
  }
};

TM.LiveView.prototype.onPointerMove = function(ev) {
  if (!this.dragging) return;
  if (!this.profile || !this.derived) return;

  const { x } = TM.getCanvasXY(this.canvas, ev);
  const colStep = (LV.tubeW + LV.tubeGap);

  // kolik sloupců jsme přetáhli (snap na celé sloupce)
  const dxPx = x - this.dragStartX;
  const dxCols = Math.round(dxPx / colStep);

  const dev = this.profile.devices.find(d => d.id === this.dragDeviceId);
  if (!dev) return;

  dev.x = this.dragStartDeviceX + dxCols;

  // update derived + hit rects (rychlé)
  this.derived = TM.deriveFromProfile(this.profile);
  this.rebuildHitRects();
  this.draw();
  // === PROFILE CHANGED (drag) ===
if (typeof this.onProfileChanged === "function") {
  this.onProfileChanged();
}
};

TM.LiveView.prototype.onPointerUp = function(ev) {
  if (!this.dragging) return;
  this.dragging = false;
  this.dragDeviceId = null;
};