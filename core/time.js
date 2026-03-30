// ============================================================================
// INTZ v11 – time.js
// Felles tid- og matematikhjelpere brukt på tvers av moduler.
// Inneholder: fmtMMSS, parseMMSS (valgfritt), gjennomsnitt, smoothing, etc.
// ============================================================================

/**
 * Formaterer sekunder til MM:SS.
 * Eksempel: 93 -> "1:33"
 */
export function fmtMMSS(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Parser MM:SS eller M:SS til heltall sekunder.
 * Eksempel: "1:30" → 90
 */
export function parseMMSS(str) {
  if (!str || typeof str !== "string") return 0;
  const parts = str.split(":").map(x => Number(x));
  if (parts.length === 1) return Number(parts[0]) || 0;
  const [m, s] = parts;
  return (Number(m) || 0) * 60 + (Number(s) || 0);
}

/**
 * Gjennomsnitt av en array med tall.
 */
export function avg(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : 0;
}

/**
 * Glattingsfilter for små datasett (f.eks HR over tid).
 * Simple moving average.
 */
export function smooth(arr, window = 5) {
  if (!arr.length || window <= 1) return arr.slice();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    out.push(avg(slice));
  }
  return out;
}

/**
 * Returnerer et tall som ligger mellom min og max.
 */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Runder tall til gitt antall desimaler.
 */
export function round(n, decimals = 0) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Konverter km/t → m/s
 */
export function kmhToMs(kmh) {
  return (Number(kmh) || 0) / 3.6;
}

/**
 * Konverter m/s → km/t
 */
export function msToKmh(ms) {
  return (Number(ms) || 0) * 3.6;
}
