/* ============================================================
   INTZ v11 — ghosts.js
   STRICT + FLAT ARCHITECTURE
   In-memory LRU ghost cache
   Parse ghost TCX from Supabase Storage (signed URL)
   ============================================================ */

import { supabase } from "./supabase-init.js";

/* ------------------------------------------------------------
   INTERNAL STORE (LRU CACHE)
------------------------------------------------------------ */
const store = {
  max: 3,                 // default ghost slots
  map: new Map()          // clientId → { ts, points[], meta }
};

/* Configure max ghosts */
export function configure(opts = {}) {
  if (Number.isFinite(opts.max)) {
    store.max = Math.max(1, Math.min(8, opts.max));
  }
}

/* LRU move-to-end */
function touch(id) {
  const v = store.map.get(id);
  if (!v) return;
  v.ts = Date.now();
  store.map.delete(id);
  store.map.set(id, v);
}

/* LRU eviction */
function evict() {
  while (store.map.size > store.max) {
    let oldest = null;
    let oldestTs = Infinity;
    for (const [id, data] of store.map) {
      if (data.ts < oldestTs) {
        oldestTs = data.ts;
        oldest = id;
      }
    }
    if (oldest) store.map.delete(oldest);
  }
}

/* ------------------------------------------------------------
   TCX PARSER FOR GHOSTS
   (Independent from results/tcx.js, tuned for ghosts)
------------------------------------------------------------ */
function parseGhostTCX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const tps = doc.getElementsByTagName("Trackpoint");

  const pts = [];
  for (const tp of tps) {
    const tStr = tp.getElementsByTagName("Time")[0]?.textContent ?? "";
    const dStr = tp.getElementsByTagName("DistanceMeters")[0]?.textContent ?? "0";

    const hrNode =
      tp.getElementsByTagName("HeartRateBpm")[0]
        ?.getElementsByTagName("Value")[0];

    const wNode =
      tp.getElementsByTagName("Watts")[0] ||
      tp.getElementsByTagName("ns3:Watts")[0];

    pts.push({
      ts: new Date(tStr).getTime(),
      iso: tStr,
      dist_m: parseFloat(dStr) || 0,
      hr: Math.round(parseFloat(hrNode?.textContent ?? "0")) || 0,
      watt: Math.round(parseFloat(wNode?.textContent ?? "0")) || 0
    });
  }

  return pts;
}

/* ------------------------------------------------------------
   DOWNLOAD GHOST TCX FILE FROM SUPABASE STORAGE
------------------------------------------------------------ */
async function fetchGhostTCX(clientId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Ikke innlogget");

  const user_id = session.user.id;
  const path = `${user_id}/${clientId}.tcx`;

  const { data, error } = await supabase
    .storage
    .from("sessions")
    .createSignedUrl(path, 60);

  if (error) throw error;

  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error("Ghost‑TCX kunne ikke hentes");

  return await res.text();
}

/* ------------------------------------------------------------
   PUBLIC API — GET GHOST
------------------------------------------------------------ */
export async function getGhost(clientId) {
  // In cache?
  if (store.map.has(clientId)) {
    touch(clientId);
    return store.map.get(clientId).points;
  }

  // Fetch from storage
  const xml = await fetchGhostTCX(clientId);
  const points = parseGhostTCX(xml);

  // Store in LRU
  store.map.set(clientId, {
    ts: Date.now(),
    points,
    meta: {
      startedAt: points[0]?.iso ?? new Date().toISOString(),
      endedAt: points.at(-1)?.iso ?? new Date().toISOString()
    }
  });

  evict();
  return points;
}

/* ------------------------------------------------------------
   OPTIONAL GLOBAL FOR DEBUGGING
------------------------------------------------------------ */
window.ghosts = { configure, getGhost };
