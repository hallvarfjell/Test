
// Web Bluetooth helpers – HR + FTMS (treadmill)
const BT = {
  async connectHR(onBPM){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet. Bruk Chrome/Edge.');
    const dev = await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService('heart_rate');
    const ch = await svc.getCharacteristic('heart_rate_measurement');
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value; const flags = dv.getUint8(0);
      const bpm = (flags & 0x01) ? dv.getUint16(1,true) : dv.getUint8(1);
      try{ onBPM && onBPM(bpm); }catch(e){}
    });
  },
  async connectFTMS(onData){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.');
    const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[0x1826,0x180A,0x2ACD,0x2ACC] });
    const server = await dev.gatt.connect();
    let svc;
    try { svc = await server.getPrimaryService(0x1826); }
    catch(e){ const svcs = await server.getPrimaryServices(); const s = svcs.find(x=>x.uuid.endsWith('1826')); if(!s) throw e; svc = s; }
    const tread = await svc.getCharacteristic(0x2ACD); // Treadmill Data
    await tread.startNotifications();
    tread.addEventListener('characteristicvaluechanged', ev=>{
      const dv = ev.target.value; let i=0; const flags = dv.getUint16(i,true); i+=2;
      // Instantaneous Speed (mandatory): 0.01 km/h units
      const spdKmh = dv.getUint16(i,true)/100; i+=2;
      let incPct = null;
      // Inclination (optional): bit3
      if(flags & (1<<3)){ const inc = dv.getInt16(i,true)/10; i+=2; i+=2; incPct = Math.round(inc); }
      try{ onData && onData(spdKmh, incPct); }catch(e){}
    });
  }
};
