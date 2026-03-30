// storage.js
export function activeUser() {
  return localStorage.getItem("active_user") ?? "default";
}

export function nsKey(k) {
  return `u:${activeUser()}:${k}`;
}

export function getNS(k, def) {
  try {
    const v = localStorage.getItem(nsKey(k));
    if (v != null) return JSON.parse(v);
    const global = localStorage.getItem(k);
    return global != null ? JSON.parse(global) : def;
  } catch {
    return def;
  }
}

export function setNS(k, v) {
  localStorage.setItem(nsKey(k), JSON.stringify(v));
}

export function delNS(k) {
  localStorage.removeItem(nsKey(k));
}

// For Supabase sync:
export function dumpAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return out;
}

export function loadAll(obj) {
  localStorage.clear();
  for (const k of Object.keys(obj)) {
    localStorage.setItem(k, obj[k]);
  }
}
