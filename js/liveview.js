/* =========================================================
   liveview.js
   - kreslí Live Stage View na canvasu
   - NEGENERUJE SHAPES
   - pouze zobrazuje drawMask (pokud existuje)
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
  const colStep = LV.tubeW + LV.tubeGap;
  const stagePxW = derived.N * colStep - LV.tubeGap;
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
  this.deviceRects = [];
  this.drawMask = null;

  this.isSetup = false;
  this.dragging = false;
  this.dragDeviceId = null;
  this.dragStartX = 0;
  this.dragStartDeviceX = 0;

  canvas.addEventListener("pointerdown", ev => this.onPointerDown(ev));
  canvas.addEventListener("pointermove", ev => this.onPointerMove(ev));
  canvas.addEventListener("pointerup", ev => this.onPointerUp(ev));
  canvas.addEventListener("pointercancel", ev => this.onPointerUp(ev));
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

    const left = getPadX(this.canvas, this.derived) + u0 * colStep - 4;
    const right = getPadX(this.canvas, this.derived) + (u1 + 1) * colStep - LV.tubeGap + 4;
    const top = LV.padY - LV.labelH - 6;
    const bottom = LV.padY + LV.tubeH + 8;

    this.deviceRects.push({ id: d.id, left, right, top, bottom, u0, u1 });
  }
};

TM.LiveView.prototype.render = function() {
  this.draw();
};

TM.LiveView.prototype.draw = function() {
  const ctx = this.ctx;
  const Wc = this.canvas.width;
  const Hc = this.canvas.height;

  ctx.clearRect(0, 0, Wc, Hc);
  ctx.fillStyle = "#070810";
  ctx.fillRect(0, 0, Wc, Hc);

  if (!this.profile || !this.derived) return;

  const { N, xMin, centerU } = this.derived;
  const colStep = LV.tubeW + LV.tubeGap;
  const Hpx = this.derived.H || 60;
  const rowH = LV.tubeH / Hpx;

  // --- tubes ---
  for (let u = 0; u < N; u++) {
    const x = getPadX(this.canvas, this.derived) + u * colStep;
    ctx.fillStyle = "#0f1119";
    ctx.fillRect(x, LV.padY, LV.tubeW, LV.tubeH);
  }

  // --- SHAPE MASK PREVIEW ---
  if (this.drawMask) {
    for (let u = 0; u < N; u++) {
      const x = getPadX(this.canvas, this.derived) + u * colStep + 1;
      for (let y = 0; y < Hpx; y++) {
        const v = this.drawMask[y * N + u];
        if (v > 0) {
          ctx.fillStyle = `rgba(255,255,255,${v})`;
          ctx.fillRect(x, LV.padY + y * rowH, LV.tubeW - 2, rowH);
        }
      }
    }
  }

  // --- device outlines ---
  for (const r of this.deviceRects) {
    const sel = TM.state.ui.selectedDeviceId === r.id;
    ctx.strokeStyle = sel ? "#4aa3ff" : "#2a2e3f";
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    ctx.fillStyle = "#9aa0ad";
    ctx.font = "12px system-ui";
    ctx.fillText(r.id, r.left + 6, r.top + 14);
  }

  // --- center line ---
  const cx = getPadX(this.canvas, this.derived) + centerU * colStep - (LV.tubeGap / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, LV.padY - 22);
  ctx.lineTo(cx, LV.padY + LV.tubeH + 10);
  ctx.stroke();
};