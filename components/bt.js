// Web Bluetooth: HR og (eksperimentelt) FTMS
const BT = {
  async connectHR(onBPM){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth støttes ikke i denne nettleseren. Bruk Chrome/Edge på Android/desktop.');
    const device = await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    const char = await service.getCharacteristic('heart_rate_measurement');
    await char.startNotifications();
    char.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value; // parse HRM
      let bpm = dv.getUint8(1); // simple parser, ok for most straps
      if((dv.getUint8(0) & 0x01) === 0) bpm = dv.getUint8(1); else bpm = dv.getUint16(1,true);
      onBPM(bpm);
    });
  },
  async connectFTMS(onData){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth mangler.');
    const device = await navigator.bluetooth.requestDevice({
      filters:[{services:[0x1826]}] // Fitness Machine Service
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(0x1826);
    // Treadmill Data characteristic 0x2ACD (indikerer speed, incline m.m.)
    const tread = await service.getCharacteristic(0x2ACD);
    await tread.startNotifications();
    tread.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value;
      // Parsing av Treadmill Data (forenklet): Instantaneous Speed (m/s * 100), Inclination (0.1%)
      // OBS: Dette varierer etter maskin; vi forsøker standard FTMS layout.
      let idx=0; const flags = dv.getUint16(idx,true); idx+=2;
      let speed = 0, incline = 0;
      if(flags & 0x0001){ speed = dv.getUint16(idx,true)/100; idx+=2; } // m/s
      if(flags & 0x0002){ incline = dv.getInt16(idx,true)/10; idx+=2; }
      const kmh = Math.round(speed*3.6*10)/10;
      onData(kmh, Math.round(incline));
    });
  }
};
