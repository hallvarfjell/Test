const BT = {
  async connectHR(onBPM){ if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet. Bruk Chrome/Edge.'); const device = await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']} ]}); const server = await device.gatt.connect(); const svc = await server.getPrimaryService('heart_rate'); const ch = await svc.getCharacteristic('heart_rate_measurement'); await ch.startNotifications(); ch.addEventListener('characteristicvaluechanged', ev=>{ const dv = ev.target.value; const flags = dv.getUint8(0); let bpm; if(flags & 0x01) bpm = dv.getUint16(1,true); else bpm = dv.getUint8(1); onBPM(bpm); }); },
  async connectFTMS(onData){ if(!navigator.bluetooth) throw new Error('Web Bluetooth ikke støttet.'); const device = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:[0x1826,0x180A,0x2ACD,0x2ACC] }); const server = await device.gatt.connect(); device.addEventListener('gattserverdisconnected', ()=>{ console.warn('FTMS frakoblet'); }); let svc; try{ svc = await server.getPrimaryService(0x1826); } catch(e){ const services = await server.getPrimaryServices(); const m = services.find(s=> s.uuid.endsWith('1826')); if(m) svc=m; else { if(!device.gatt.connected){ await device.gatt.connect(); svc = await device.gatt.getPrimaryService(0x1826);} else throw e; } } const tread = await svc.getCharacteristic(0x2ACD); await tread.startNotifications(); tread.addEventListener('characteristicvaluechanged', ev=>{ const dv = ev.target.value; let idx=0; const flags = dv.getUint16(idx,true); idx+=2; // FTMS: Instantaneous Speed is MANDATORY (0.01 km/h)
      const speedKmh = dv.getUint16(idx,true) / 100; idx+=2; // no flag check
      // Inclination + Ramp Angle present if bit3 set
      let inclinePct = null;
      if (flags & (1<<3)) { const inc = dv.getInt16(idx,true)/10; idx+=2; /* rampAngle*/ idx+=2; inclinePct = Math.round(inc); }
      onData(speedKmh, inclinePct);
    }); }
};
