/* =========================================================
   liveview.js
   - kreslí Live Stage View na canvasu
   - setup: select + drag + set-center + verify overlay
   - show: preview mask / rgb
   ========================================================= */

const LV = {
  padX: 24,
  padY: 28,
  tubeW: 18,
  tubeGap: 6,
  tubeH: 420,
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

  this.deviceRects = []; // hit rects
  this.onProfileChanged = null;

  // show overlays
  this.drawMask = null;   // Float32Array W*H
  this.drawRGB  = null;   // Uint8Array W*H*3
  this.drawColor = null;  // fallback (if no drawRGB)

  // setup modes
  this.isSetup = false;
  this.dragging = false;
  this.dragDeviceId = null;
  this.dragStartX = 0;
  this.dragStartDeviceX = 0;

  canvas.addEventListener("pointerdown", (ev) => this.onPointerDown(ev));
  canvas.addEventListener("pointermove", (ev) => this.onPointerMove(ev));
  canvas.addEventListener("pointerup", (ev) => this.onPointerUp(ev));
  canvas.addEventListener("pointercancel", (ev) => this.onPointerUp(ev));
};

TM.LiveView.prototype.setProfile = function(profile) {
  this.profile = profile;
  this.derived = TM.deriveFromProfile(profile);
  this.rebuildHitRects();
  this.render();
};

TM.LiveView.prototype.rebuildHitRects = function() {
  this.deviceRects = [];
  if (!this.profile || !this.derived) return;

  const colStep = LV.tubeW + LV.tubeGap;
  for (const d of this.profile.devices) {
    const u0 = d.x - this.derived.xMin;
    const u1 = u0 + d.w - 1;

    const left  = getPadX(this.canvas, this.derived) + u0 * colStep - 4;
    const right = getPadX(this.canvas, this.derived) + (u1 + 1) * colStep - LV.tubeGap + 4;
    const top   = LV.padY - LV.labelH - 6;
    const bottom= LV.padY + LV.tubeH + 8;

    this.deviceRects.push({ id:d.id, left, right, top, bottom, u0, u1 });
  }
};

TM.LiveView.prototype.render = function() { this.draw(); };

TM.LiveView.prototype.onPointerDown = function(ev) {
  if (!this.profile || !this.derived) return;
  const { x, y } = TM.getCanvasXY(this.canvas, ev);

  // hit test device
  for (const r of this.deviceRects) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      TM.state.ui.selectedDeviceId = r.id;

      if (this.isSetup && TM.state.ui.dragMode) {
        this.dragging = true;
        this.dragDeviceId = r.id;
        this.dragStartX = x;
        const dev = this.profile.devices.find(d => d.id === r.id);
        this.dragStartDeviceX = dev ? dev.x : 0;
        this.canvas.setPointerCapture(ev.pointerId);
      }

      this.draw();
      if (typeof this.onProfileChanged === "function") this.onProfileChanged();
      return;
    }
  }

  // set-center click on column
  if (this.isSetup && TM.state.ui.setCenterMode) {
    const colStep = LV.tubeW + LV.tubeGap;
    const uClicked = Math.floor((x - getPadX(this.canvas, this.derived)) / colStep);
    if (uClicked >= 0 && uClicked < this.derived.N) {
      const xClicked = uClicked + this.derived.xMin;
      for (const d of this.profile.devices) d.x = d.x - xClicked;
      this.derived = TM.deriveFromProfile(this.profile);
      this.rebuildHitRects();
      this.draw();
      if (typeof this.onProfileChanged === "function") this.onProfileChanged();
    }
  }
};

TM.LiveView.prototype.onPointerMove = function(ev) {
  if (!this.dragging) return;
  if (!this.profile || !this.derived) return;

  const { x } = TM.getCanvasXY(this.canvas, ev);
  const colStep = LV.tubeW + LV.tubeGap;

  const dxPx = x - this.dragStartX;
  const dxCols = Math.round(dxPx / colStep);

  const dev = this.profile.devices.find(d => d.id === this.dragDeviceId);
  if (!dev) return;

  dev.x = this.dragStartDeviceX + dxCols;

  this.derived = TM.deriveFromProfile(this.profile);
  this.rebuildHitRects();
  this.draw();
  if (typeof this.onProfileChanged === "function") this.onProfileChanged();
};

TM.LiveView.prototype.onPointerUp = function() {
  this.dragging = false;
  this.dragDeviceId = null;
};

TM.LiveView.prototype.draw = function() {
  const ctx = this.ctx;
  const Wc = this.canvas.width;
  const Hc = this.canvas.height;

  ctx.clearRect(0,0,Wc,Hc);
  ctx.fillStyle = "#070810";
  ctx.fillRect(0,0,Wc,Hc);

  if (!this.profile || !this.derived) {
    ctx.fillStyle = "#9aa0ad";
    ctx.font = "14px system-ui";
    ctx.fillText("No profile loaded.", 20, 30);
    return;
  }

  const { N, xMin, centerU } = this.derived;
  const colStep = LV.tubeW + LV.tubeGap;
  const Hpx = this.derived.H || 60;
  const rowH = LV.tubeH / Hpx;

  // tubes background
  for (let u=0; u<N; u++){
    const x = getPadX(this.canvas, this.derived) + u*colStep;
    ctx.fillStyle = "#0f1119";
    ctx.fillRect(x, LV.padY, LV.tubeW, LV.tubeH);

    // subtle ticks
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let yy=0; yy<Hpx; yy+=5){
      ctx.fillRect(x, LV.padY + yy*rowH, LV.tubeW, 1);
    }
  }

  // VERIFY overlay (setup)
  const verify = (TM.state.ui && TM.state.ui.verify) ? TM.state.ui.verify : null;
  if (verify && verify.on) {
    const cap = 5;
    const palette = [
      [255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],
      [255,0,255],[255,128,0],[128,0,255],[128,255,0],[255,0,128]
    ];
    for (let u=0; u<N; u++){
      const x = getPadX(this.canvas, this.derived) + u*colStep;
      for (let y=0; y<Hpx; y++){
        let rgb;
        if (y < cap) rgb = [255,255,255];
        else if (y >= Hpx - cap) rgb = palette[u % palette.length];
        else if (u === verify.activeU) rgb = [255,255,255];
        else rgb = [0,0,0];

        if (rgb[0] || rgb[1] || rgb[2]) {
          ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
          ctx.fillRect(x+1, LV.padY + y*rowH, LV.tubeW-2, rowH);
        }
      }
    }
  }

  // SHAPE PREVIEW (show): prefer drawRGB, fallback drawColor * mask alpha
  if (this.drawMask && this.drawMask.length >= N * Hpx) {
    const hasRGB = (this.drawRGB && this.drawRGB.length >= N * Hpx * 3);

    for (let u=0; u<N; u++){
      const x = getPadX(this.canvas, this.derived) + u*colStep + 1;
      for (let y=0; y<Hpx; y++){
        const v = this.drawMask[y*N + u];
        if (v <= 0) continue;

        if (hasRGB) {
          const p = (y*N + u) * 3;
          const r = this.drawRGB[p+0], g = this.drawRGB[p+1], b = this.drawRGB[p+2];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          const c = this.drawColor || { r:255, g:255, b:255 };
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${v})`;
        }
        ctx.fillRect(x, LV.padY + y*rowH, LV.tubeW-2, rowH);
      }
    }
  }

  // device outlines + labels
  for (const r of this.deviceRects){
    const isSel = (TM.state.ui.selectedDeviceId === r.id);
    const showSel = isSel && TM.state.ui.highlightSelected;

    ctx.strokeStyle = showSel ? "#4aa3ff" : "#2a2e3f";
    ctx.lineWidth = showSel ? 2 : 1;
    ctx.strokeRect(r.left, r.top, (r.right-r.left), (r.bottom-r.top));

    ctx.fillStyle = showSel ? "#e8e8ef" : "#9aa0ad";
    ctx.font = "12px system-ui";
    ctx.fillText(r.id, r.left + 6, r.top + 14);
  }

  // center line
  const cx = getPadX(this.canvas, this.derived) + centerU*colStep - (LV.tubeGap/2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, LV.padY - 22);
  ctx.lineTo(cx, LV.padY + LV.tubeH + 10);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px system-ui";
  ctx.fillText("0", cx + 4, LV.padY - 8);

  // optional axis labels around center
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "11px system-ui";
  for (let u=0; u<N; u++){
    const xVal = u + xMin;
    if (Math.abs(xVal) <= 3){
      const xx = getPadX(this.canvas, this.derived) + u*colStep;
      ctx.fillText(String(xVal), xx+2, LV.padY + LV.tubeH + 22);
    }
  }
};