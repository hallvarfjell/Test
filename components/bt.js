
// Web Bluetooth helpers focused on FTMS treadmill
const BT = {
  async connectFTMS(onData){
    if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.');
    const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[0x1826,0x180A] });
    const srv = await dev.gatt.connect();
    const ftms = await srv.getPrimaryService(0x1826);
    // Treadmill Data (0x2ACD)
    try{
      const tread = await ftms.getCharacteristic(0x2ACD);
      await tread.startNotifications();
      tread.addEventListener('characteristicvaluechanged', ev=>{
        const dv=ev.target.value; let i=0; const flags=dv.getUint16(i,true); i+=2;
        const spdKmh = dv.getUint16(i,true)/100; i+=2;
        let incPct=null;
        if(flags & (1<<3)){ // Inclination present
          incPct = dv.getInt16(i,true)/10; i+=2; i+=2; // skip ramp angle
        }
        onData(spdKmh, incPct);
      });
    }catch(e){ console.warn('Ingen 0x2ACD (Treadmill Data):', e); }
    // Fitness Machine Status (0x2ADA) – noen møller sender stigning her
    try{
      const stat = await ftms.getCharacteristic(0x2ADA);
      await stat.startNotifications();
      stat.addEventListener('characteristicvaluechanged', ev=>{
        const dv=ev.target.value; let i=0; const opcode = dv.getUint8(i); i+=1;
        // Heuristisk: flere opcodes rapporterer parameterendringer. Vi tolker 2 neste bytes som 0.1% stigning
        // Kjent: noen implementasjoner bruker opcodes 0x07/0x0E/0x0F for target changes.
        if(dv.byteLength>=3){ const val = dv.getInt16(i,true)/10; if(!isNaN(val)) onData(null, val); }
      });
    }catch(e){ console.warn('Ingen 0x2ADA (Status) eller ingen notif:', e); }
  }
};
