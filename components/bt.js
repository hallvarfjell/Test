const BT={
  async connectHR(onBPM){ if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.');
    const dev=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
    const srv=await dev.gatt.connect(); const svc=await srv.getPrimaryService('heart_rate');
    const ch=await svc.getCharacteristic('heart_rate_measurement'); await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged',ev=>{ const dv=ev.target.value; const flags=dv.getUint8(0); const bpm=(flags&0x01)?dv.getUint16(1,true):dv.getUint8(1); onBPM&&onBPM(bpm); }); },
  async connectFTMS(onData){ if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.');
    const dev=await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[0x1826] });
    const srv=await dev.gatt.connect(); const svc=await srv.getPrimaryService(0x1826);
    const tread=await svc.getCharacteristic(0x2ACD); await tread.startNotifications();
    tread.addEventListener('characteristicvaluechanged',ev=>{ const dv=ev.target.value; let i=0; const flags=dv.getUint16(i,true); i+=2; const spdKmh=dv.getUint16(i,true)/100; i+=2; let incPct=0; if(flags&(1<<3)){ const inc=dv.getInt16(i,true)/10; i+=2; i+=2; incPct=Math.round(inc); } onData&&onData(spdKmh, incPct); }); }
};
