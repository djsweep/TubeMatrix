/* =========================================================
   ddp_client.js
   - TubeMatrix UI -> DDP bridge (WebSocket)
   - posíláme data vždy "per device" jako RGB stream
   ========================================================= */

TM.DDP = {
  ws: null,
  wsUrl: null,
  connected: false
};

TM.DDP.connect = function(wsUrl) {
  TM.DDP.wsUrl = wsUrl;

  try {
    TM.DDP.ws = new WebSocket(wsUrl);
    TM.DDP.ws.onopen = () => { TM.DDP.connected = true; };
    TM.DDP.ws.onclose = () => { TM.DDP.connected = false; };
    TM.DDP.ws.onerror = () => { TM.DDP.connected = false; };
  } catch (e) {
    TM.DDP.connected = false;
  }
};

// --- helper: Uint8Array -> base64 (rychle a jednoduše) ---
TM.DDP.u8ToBase64 = function(u8) {
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
};

// --- pošli RGB stream na konkrétní device ---
TM.DDP.sendToDevice = function(ip, rgbU8) {
  if (!TM.DDP.ws || !TM.DDP.connected) return;

  const payload = {
    ip,
    rgbBase64: TM.DDP.u8ToBase64(rgbU8),
    offsetPixels: 0
  };

  TM.DDP.ws.send(JSON.stringify(payload));
};
