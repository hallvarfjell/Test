// Enkel PI-stubb: kan senere byttes ut med avansert simulator
const PI = {
  compute(currentOkt, recent){
    // Placeholder: returner gj.snitt fart/HR ratio skalert *100
    if(!currentOkt || !recent || recent.length===0) return 0;
    const last = recent.slice(-3);
    const avg = last.reduce((a,b)=>a+(b.pi||0),0)/last.length || 0;
    return Math.round(avg);
  }
};
