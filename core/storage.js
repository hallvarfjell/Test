// ============================================================================
// INTZ v11 – storage.js
// Felles lagrings-API for activeUser, namespaced keys og global backup/import.
// ============================================================================

/**
 * Henter aktiv bruker (profil).
 */
export function activeUser() {
  return localStorage.getItem("active_user") ?? "default";
}

/**
 * Genererer nøkkel med brukernamespace.
 * Format: u:<user>:<key>
 */
export function nsKey(k) {
  return `u:${activeUser()}:${k}`;
}

/**
 * Leser fra localStorage (brukerspesifikt). Fallback til global key.
 */
export function getNS(key, def) {
  try {
    const v = localStorage.getItem(nsKey(key));
    if (v != null) return JSON.parse(v);

    const global = localStorage.getItem(key);
    return global != null ? JSON.parse(global) : def;
  } catch (e) {
    console.error("getNS error:", e);
    return def;
  }
}

/**
 * Skriver userspacet verdi.
 */
export function setNS(key, value) {
  localStorage.setItem(nsKey(key), JSON.stringify(value));
}

/**
 * Sletter userspacet verdi.
 */
export function delNS(key) {
  localStorage.removeItem(nsKey(key));
}

/**
 * Returnerer HELE localStorage som objekt (for backup).
 */
export function dumpAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return out;
}

/**
 * Erstatter localStorage med gitt objekt.
 * Brukes ved import.
 */
export function loadAll(obj) {
  localStorage.clear();
  for (const k of Object.keys(obj)) {
    localStorage.setItem(k, obj[k]);
  }
}

/**
 * Lister alle brukere.
 */
export function listUsers() {
  try {
    const arr = JSON.parse(localStorage.getItem("users_list"));
    return Array.isArray(arr) ? arr : ["default"];
  } catch {
    return ["default"];
  }
}

/**
 * Lagre liste av brukere.
 */
export function saveUsers(arr) {
  localStorage.setItem("users_list", JSON.stringify(arr));
}

/**
 * Setter aktiv bruker.
 */
export function setActiveUser(u) {
  localStorage.setItem("active_user", u);
}
