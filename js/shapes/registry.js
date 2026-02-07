// js/shapes/registry.js
// Loads shapes from manifest.json (like playlists index).
// Add a new shape by:
// 1) dropping new module into js/shapes/
// 2) adding one entry into manifest.json
//
// No bundler required. Works in browser via dynamic import().

const MANIFEST_URL = new URL("./manifest.json", import.meta.url);

export async function loadShapeRegistry() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error("shapes manifest not found: " + res.status);
  const manifest = await res.json();

  const list = Array.isArray(manifest.shapes) ? manifest.shapes : [];
  const byId = {};

  for (const it of list) {
    if (!it || !it.id || !it.module || !it.export) continue;

    const modUrl = new URL(it.module, import.meta.url);
    const mod = await import(modUrl);
    const fn = mod[it.export];
    if (typeof fn !== "function") {
      console.warn("Shape missing export:", it.id, it.export);
      continue;
    }

    byId[it.id] = {
      id: it.id,
      label: it.label || it.id,
      renderer: fn,
      // optional UI metadata (FX can use this)
      ui: it.ui || {},
      defaults: it.defaults || {},
    };
  }

  return {
    list: Object.values(byId),
    get: (id) => byId[id] || null,
  };
}
