// results.js
// INTZ v10.1 – Enkel resultatvisning for SPA.

let SESSION = null;

function activeUser() {
  return (
    localStorage.getItem(
      "active_user"
    ) || "default"
  );
}

function nsKey(key) {
  return `u:${activeUser()}:${key}`;
}

function getNS(key, fallback) {
  try {
    const current =
      localStorage.getItem(
        nsKey(key)
      );

    return current != null
      ? JSON.parse(current)
      : fallback;
  } catch {
    return fallback;
  }
}

function currentRoute() {
  return (
    window.INTZRoute ||
    (
      window.INTZRouter &&
      window.INTZRouter.parseHash &&
      window.INTZRouter.parseHash()
    ) ||
    {
      view: "dashboard",
      arg: null
    }
  );
}

function getVisibleSessions() {
  const sessions =
    getNS("sessions", []);

  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions.filter(
    session =>
      !session?._deleted_at
  );
}

function pickSession() {
  const route = currentRoute();

  const id =
    route.view === "results" &&
    route.arg
      ? route.arg
      : (
          location.hash &&
          location.hash.startsWith(
            "#results:"
          )
            ? location.hash.slice(9)
            : null
        );

  const sessions =
    getVisibleSessions();

  if (!sessions.length) {
    return null;
  }

  if (id) {
    return (
      sessions.find(
        session =>
          session.id === id ||
          session._local_id === id
      ) || null
    );
  }

  return sessions[
    sessions.length - 1
  ];
}

function formatMMSS(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const minutes =
    Math.floor(total / 60);

  const remainder =
    total % 60;

  return (
    minutes +
    ":" +
    String(remainder)
      .padStart(2, "0")
  );
}

function calculateSummary(session) {
  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  const duration =
    session.startedAt &&
    session.endedAt
      ? Math.max(
          0,
          (
            new Date(
              session.endedAt
            ) -
            new Date(
              session.startedAt
            )
          ) / 1000
        )
      : (
          points.length > 1
            ? Math.max(
                0,
                (
                  Number(
                    points[
                      points.length - 1
                    ].ts
                  ) -
                  Number(points[0].ts)
                ) / 1000
              )
            : 0
        );

  const heartRates =
    points
      .map(point =>
        Number(point.hr)
      )
      .filter(value =>
        Number.isFinite(value) &&
        value > 0
      );

  const watts =
    points
      .map(point =>
        Number(point.watt)
      )
      .filter(value =>
        Number.isFinite(value)
      );

  const lastPoint =
    points.length
      ? points[
          points.length - 1
        ]
      : null;

  const distanceKm =
    lastPoint &&
    Number.isFinite(
      Number(lastPoint.dist_m)
    )
      ? Number(lastPoint.dist_m) /
        1000
      : 0;

  const average = values =>
    values.length
      ? values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      : null;

  return {
    points,
    duration,
    distanceKm,

    averageHr:
      average(heartRates),

    maxHr:
      heartRates.length
        ? Math.max(
            ...heartRates
          )
        : null,

    averageWatt:
      average(watts)
  };
}

function renderSummary(session) {
  const target =
    document.getElementById(
      "summary"
    );

  if (!target) {
    return;
  }

  const summary =
    calculateSummary(session);

  const syncStatus =
    session._sync_status ===
      "synced"
      ? "Synkronisert"
      : session._sync_status ===
          "error"
        ? "Synkroniseringsfeil"
        : "Lagret lokalt";

  target.innerHTML = `
    <div>
      <strong>
        ${session.name || "Økt"}
      </strong>
    </div>

    <div>
      Varighet:
      ${formatMMSS(
        summary.duration
      )}
    </div>

    <div>
      Distanse:
      ${summary.distanceKm.toFixed(2)}
      km
    </div>

    <div>
      Snittpuls:
      ${
        summary.averageHr != null
          ? Math.round(
              summary.averageHr
            ) + " bpm"
          : "–"
      }
    </div>

    <div>
      Makspuls:
      ${
        summary.maxHr != null
          ? Math.round(
              summary.maxHr
            ) + " bpm"
          : "–"
      }
    </div>

    <div>
      Snittwatt:
      ${
        summary.averageWatt != null
          ? Math.round(
              summary.averageWatt
            ) + " W"
          : "–"
      }
    </div>

    <div>
      Datapunkter:
      ${summary.points.length}
    </div>

    <div>
      Skylagring:
      ${syncStatus}
    </div>
  `;
}

function resizeCanvas(canvas) {
  const rectangle =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.max(
      1,
      Math.floor(
        rectangle.width * ratio
      )
    );

  canvas.height =
    Math.max(
      1,
      Math.floor(
        rectangle.height * ratio
      )
    );

  return ratio;
}

function renderChart(session) {
  const canvas =
    document.getElementById(
      "r-chart"
    );

  if (!canvas) {
    return;
  }

  const context =
    canvas.getContext("2d");

  const ratio =
    resizeCanvas(canvas);

  const width =
    canvas.width;

  const height =
    canvas.height;

  context.clearRect(
    0,
    0,
    width,
    height
  );

  const points =
    Array.isArray(session.points)
      ? session.points
      : [];

  const valid =
    points.filter(point =>
      Number.isFinite(
        Number(point.hr)
      ) &&
      Number(point.hr) > 0
    );

  if (valid.length < 2) {
    context.fillStyle =
      "#64748b";

    context.font =
      `${14 * ratio}px system-ui`;

    context.fillText(
      "Ikke nok pulsdata til graf.",
      20 * ratio,
      30 * ratio
    );

    return;
  }

  const values =
    valid.map(point =>
      Number(point.hr)
    );

  let minimum =
    Math.min(...values);

  let maximum =
    Math.max(...values);

  minimum -= 5;
  maximum += 5;

  if (maximum <= minimum) {
    maximum = minimum + 1;
  }

  const paddingLeft =
    48 * ratio;

  const paddingRight =
    16 * ratio;

  const paddingTop =
    18 * ratio;

  const paddingBottom =
    26 * ratio;

  const plotWidth =
    width -
    paddingLeft -
    paddingRight;

  const plotHeight =
    height -
    paddingTop -
    paddingBottom;

  context.strokeStyle =
    "#e2e8f0";

  context.lineWidth =
    ratio;

  context.strokeRect(
    paddingLeft,
    paddingTop,
    plotWidth,
    plotHeight
  );

  const firstTimestamp =
    Number(valid[0].ts) || 0;

  const lastTimestamp =
    Number(
      valid[
        valid.length - 1
      ].ts
    ) || firstTimestamp + 1;

  const duration =
    Math.max(
      1,
      lastTimestamp -
      firstTimestamp
    );

  const xFor = point =>
    paddingLeft +
    (
      (
        Number(point.ts) -
        firstTimestamp
      ) / duration
    ) *
    plotWidth;

  const yFor = point =>
    paddingTop +
    (
      1 -
      (
        Number(point.hr) -
        minimum
      ) /
      (
        maximum -
        minimum
      )
    ) *
    plotHeight;

  context.beginPath();

  valid.forEach(
    (point, index) => {
      const x = xFor(point);
      const y = yFor(point);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
  );

  context.strokeStyle =
    "#ef4444";

  context.lineWidth =
    2 * ratio;

  context.stroke();

  context.fillStyle =
    "#64748b";

  context.font =
    `${11 * ratio}px system-ui`;

  context.fillText(
    `${Math.round(maximum)} bpm`,
    4 * ratio,
    paddingTop + 8 * ratio
  );

  context.fillText(
    `${Math.round(minimum)} bpm`,
    4 * ratio,
    paddingTop +
      plotHeight
  );
}

function renderAll(session) {
  const noSession =
    document.getElementById(
      "no-session"
    );

  if (
    !session ||
    !Array.isArray(
      session.points
    ) ||
    !session.points.length
  ) {
    noSession?.classList.remove(
      "hidden"
    );

    return;
  }

  noSession?.classList.add(
    "hidden"
  );

  renderSummary(session);
  renderChart(session);
}

function initResults() {
  SESSION = pickSession();
  renderAll(SESSION);
}

document.addEventListener(
  "DOMContentLoaded",
  initResults
);

window.addEventListener(
  "intz:viewchange",
  event => {
    if (
      event.detail?.view ===
      "results"
    ) {
      initResults();
    }
  }
);

window.addEventListener(
  "resize",
  () => {
    if (SESSION) {
      renderChart(SESSION);
    }
  }
);

window.addEventListener(
  "intz:datachange",
  () => {
    if (
      currentRoute().view ===
      "results"
    ) {
      initResults();
    }
  }
);