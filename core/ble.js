// ============================================================================
// INTZ v11 – ble.js
// Håndterer Web Bluetooth: HR + FTMS (tredemølle).
// Full funksjonalitet fra INTZ v10, men modulær og UI-uavhengig.
//
// Eksporterer:
//   BLE.state           → puls, fart, stigning
//   connectHeartRate()  → kobler til HR-belte
//   connectTreadmill()  → kobler til FTMS-enhet
//   on(event, cb)       → events: "hr", "speed", "grade", "disconnect"
// ============================================================================

// ----------------------------------------------------------------------------
// Internal event system (lightweight)
// ----------------------------------------------------------------------------

const listeners = {
  hr: new Set(),
  speed: new Set(),
  grade: new Set(),
  disconnect: new Set(),
};

function emit(event, data) {
  const set = listeners[event];
  if (!set) return;
  for (const fn of set) fn(data);
}

/**
 * Abonner på BLE-events.
 * event: "hr" | "speed" | "grade" | "disconnect"
 */
export function on(event, callback) {
  if (listeners[event]) listeners[event].add(callback);
}

// ----------------------------------------------------------------------------
// BLE state (persistent as long as SPA is alive)
// ----------------------------------------------------------------------------

export const BLE = {
  hr: null,
  speedKmh: 0,
  gradePct: 0,

  hrDevice: null,
  tmDevice: null,

  hrCharacteristic: null,
  tmCharacteristic: null,
};

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function safeNumber(v, fallback = 0) {
  return Number.isFinite(Number(v)) ? Number(v) : fallback;
}

// ----------------------------------------------------------------------------
// HEART RATE (Heart Rate Service: 0x180D)
// ----------------------------------------------------------------------------

export async function connectHeartRate() {
  try {
    if (!("bluetooth" in navigator)) {
      alert("Nettleseren støtter ikke Web Bluetooth.");
      return;
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
    });

    BLE.hrDevice = device;

    device.addEventListener("gattserverdisconnected", () => {
      BLE.hrDevice = null;
      BLE.hr = null;
      emit("disconnect", { type: "hr" });
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("heart_rate");
    const char = await service.getCharacteristic("heart_rate_measurement");

    BLE.hrCharacteristic = char;

    await char.startNotifications();

    char.addEventListener("characteristicvaluechanged", ev => {
      const dv = ev.target.value;
      const flags = dv.getUint8(0);
      const hr16 = flags & 1;
      let i = 1;

      const bpm = hr16 ? dv.getUint16(i, true) : dv.getUint8(i);

      BLE.hr = bpm;
      emit("hr", bpm);
    });

    return true;
  } catch (e) {
    console.error("HR connect error", e);
    alert("Kunne ikke koble til pulsbelte: " + e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// FTMS (Fitness Machine Service: 0x1826)
// Standard: Instantaneous Speed, Incline, Ramp Angle.
// ----------------------------------------------------------------------------

export async function connectTreadmill() {
  try {
    if (!("bluetooth" in navigator)) {
      alert("Nettleseren støtter ikke Web Bluetooth.");
      return;
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [0x1826] }], // FTMS
    });

    BLE.tmDevice = device;

    device.addEventListener("gattserverdisconnected", () => {
      BLE.tmDevice = null;
      BLE.speedKmh = 0;
      BLE.gradePct = 0;
      emit("disconnect", { type: "treadmill" });
    });

    const server = await device.gatt.connect();
    const ftms = await server.getPrimaryService(0x1826);

    // Treadmill Data Characteristic
    // https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/
    const tdc = await ftms.getCharacteristic(0x2ACD);
    BLE.tmCharacteristic = tdc;

    await tdc.startNotifications();

    tdc.addEventListener("characteristicvaluechanged", ev => {
      const dv = ev.target.value;
      let i = 0;

      const flags = dv.getUint16(i, true);
      i += 2;

      // Instantaneous Speed (mandatory): 0.01 km/h
      const instSpeedKmh = dv.getUint16(i, true) / 100;
      i += 2;

      // Cadence, stride count, etc may follow (skip via flags)
      if (flags & (1 << 1)) i += 2;            // Average Speed
      if (flags & (1 << 2)) i += 3;            // Total Distance
      if (flags & (1 << 3)) {                  // Incline + Ramp angle
        const incline01pct = dv.getInt16(i, true); i += 2;
        const rampAngle01d = dv.getInt16(i, true); i += 2;

        BLE.gradePct = incline01pct / 10;
        emit("grade", BLE.gradePct);

        // rampAngle01d ignored
        void rampAngle01d;
      }

      BLE.speedKmh = safeNumber(instSpeedKmh, 0);
      emit("speed", BLE.speedKmh);
    });

    return true;
  } catch (e) {
    console.error("TM connect error", e);
    alert("Kunne ikke koble til tredemølle: " + e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Optional utility: disconnect all
// ----------------------------------------------------------------------------

export function disconnectAll() {
  try {
    if (BLE.hrDevice?.gatt.connected) BLE.hrDevice.gatt.disconnect();
  } catch {}

  try {
    if (BLE.tmDevice?.gatt.connected) BLE.tmDevice.gatt.disconnect();
  } catch {}
}
