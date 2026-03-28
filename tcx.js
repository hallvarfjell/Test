/* ============================================================
   INTZ v11 — tcx.js
   STRICT + FLAT ARCHITECTURE
   Genererer TCX fra session-data og eksporterer den trygt.
   ============================================================ */

/* ------------------------------------------------------------
   ESCAPE XML
------------------------------------------------------------ */
function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

/* ------------------------------------------------------------
   MAIN: session → TCX XML STRING
------------------------------------------------------------ */
export function sessionToTCX(session) {
  if (!session || !session.points) {
    console.warn("[tcx] session mangler punkter");
    return minimalTCX();
  }

  const points = session.points;
  const tStart = session.startedAt || new Date().toISOString();
  const tEnd = session.endedAt || tStart;

  const totalSec = Math.max(
    1,
    Math.round((new Date(tEnd).getTime() - new Date(tStart).getTime()) / 1000)
  );

  const distM = Number(points.at(-1)?.dist_m || 0).toFixed(1);

  /* ----------------------------------------------------------
     HEADER
  ---------------------------------------------------------- */
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${esc(tStart)}</Id>
      <Lap StartTime="${esc(tStart)}">
        <TotalTimeSeconds>${totalSec}</TotalTimeSeconds>
        <DistanceMeters>${distM}</DistanceMeters>
        <Intensity>Active</Intensity>
        <Track>`;

  /* ----------------------------------------------------------
     TRACKPOINTS
  ---------------------------------------------------------- */
  for (const p of points) {
    const iso = p.iso || new Date(p.ts || Date.now()).toISOString();
    const dist = Number(p.dist_m || 0).toFixed(1);
    const hr = Math.max(0, Math.round(p.hr || 0));

    xml += `
          <Trackpoint>
            <Time>${esc(iso)}</Time>
            <DistanceMeters>${dist}</DistanceMeters>
            <HeartRateBpm><Value>${hr}</Value></HeartRateBpm>
          </Trackpoint>`;
  }

  /* ----------------------------------------------------------
     FOOTER
  ---------------------------------------------------------- */
  xml += `
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

  return xml;
}

/* ------------------------------------------------------------
   MINIMAL FALLBACK (ved ufullstendig session)
------------------------------------------------------------ */
function minimalTCX() {
  const now = new Date().toISOString();
  return `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${now}</Id>
      <Lap StartTime="${now}">
        <TotalTimeSeconds>1</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Intensity>Active</Intensity>
        <Track></Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}
