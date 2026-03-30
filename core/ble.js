// ble.js
export const BLE = {
  hr: null,
  speedKmh: 0,
  gradePct: 0,
  deviceHR: null,
  deviceTM: null,
};

export async function connectHeartRate() {
  // Flytt inn din HR‑kode fra main.js her
}

export async function connectTreadmill() {
  // Flytt inn FTMS‑kode her
}

export function onDisconnect(fn) {
  // optional: registrer disconnect callbacks
}
