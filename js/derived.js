/* =========================================================
   derived.js
   - z profilu spočítá odvozené věci:
     xMin, xMax, N, centerU, a device ranges
   ========================================================= */

TM.deriveFromProfile = function(profile) {
  if (!profile || !profile.devices || profile.devices.length === 0) {
    return null;
  }

  const H = profile.height || 60;

  let xMin = Infinity;
  let xMax = -Infinity;

  for (const d of profile.devices) {
    xMin = Math.min(xMin, d.x);
    xMax = Math.max(xMax, d.x + d.w - 1);
  }

  const N = (xMax - xMin + 1);
  const centerU = (0 - xMin);

  return {
    H,
    xMin,
    xMax,
    N,
    centerU
  };
};