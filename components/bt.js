const BT = {
  async connectHR(onBPM){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet. Bruk Chrome/Edge.');
    const device = await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']} ]});
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService('heart_rate');
    const ch = await svc.getCharacteristic('heart_rate_measurement');
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value; const flags = dv.getUint8(0); let bpm;
      if(flags & 0x01) bpm = dv.getUint16(1,true); else bpm = dv.getUint8(1);
      onBPM(bpm);
    });
  },
  async connectFTMS(onData){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.');
    const device = await navigator.bluetooth.requestDevice({ filters:[{services:[0x1826]}] });
    const server = await device.gatt.connect();
    const svc = await server.getPrimaryService(0x1826);
    const tread = await svc.getCharacteristic(0x2ACD); // Treadmill Data
    await tread.startNotifications();
    tread.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value; let idx=0; const flags = dv.getUint16(idx,true); idx+=2;
      let spd=0, inc=0;
      if(flags & 0x0001){ spd = dv.getUint16(idx,true)/100; idx+=2; } // m/s
      if(flags & 0x0002){ inc = dv.getInt16(idx,true)/10; idx+=2; }  // 0.1%
      const kmh = (flags & 0x0001) ? Math.round(spd*3.6*10)/10 : null; // NÅ: null hvis ikke rapportert
      const incOut = (flags & 0x0002) ? Math.round(inc) : null;       // NÅ: null hvis ikke rapportert
      onData(kmh, incOut);
    });
  }
};
