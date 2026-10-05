// log-view.js
// INTZ v10.1 – Loggvisning med synkroniserbar sletting.

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

    if (current != null) {
      return JSON.parse(current);
    }

    const legacy =
      localStorage.getItem(key);

    return legacy != null
      ? JSON.parse(legacy)
      : fallback;
  } catch {
    return fallback;
  }
}

function setNS(key, value) {
  localStorage.setItem(
    nsKey(key),
    JSON.stringify(value)
  );
}

function visibleSessions() {
  const sessions =
    getNS("sessions", []);

  if (!Array.isArray(sessions)) {
    return [];
  }

  if (window.INTZCloud) {
    return window.INTZCloud
      .visible(sessions);
  }

  return sessions.filter(
    session =>
      !session?._deleted_at
  );
}

function syncStatusLabel(session) {
  if (
    session?._sync_status ===
    "synced"
  ) {
    return "✓ Sky";
  }

  if (
    session?._sync_status ===
    "error"
  ) {
    return "! Synkfeil";
  }

  return "Lokal";
}

async function deleteSession(session) {
  const allSessions =
    getNS("sessions", []);

  const index =
    allSessions.findIndex(item => {
      if (
        item?._local_id &&
        session?._local_id
      ) {
        return (
          item._local_id ===
          session._local_id
        );
      }

      return item?.id === session?.id;
    });

  if (index < 0) {
    return;
  }

  if (window.INTZCloud) {
    allSessions[index] =
      window.INTZCloud.softDelete(
        allSessions[index],
        "session"
      );
  } else {
    allSessions.splice(index, 1);
  }

  setNS(
    "sessions",
    allSessions
  );

  renderLog();

  const cloudEnabled =
    !!getNS(
      "cloudEnabled",
      false
    );

  if (
    cloudEnabled &&
    window.INTZCloud
  ) {
    try {
      await window.INTZCloud
        .syncUp();

      renderLog();
    } catch (error) {
      console.warn(
        "[INTZ] Slettingen er lagret lokalt, men synkronisering feilet:",
        error
      );
    }
  }
}

function renderLog() {
  const list =
    document.getElementById(
      "log-list"
    );

  if (!list) {
    return;
  }

  list.innerHTML = "";

  const sessions =
    visibleSessions();

  if (!sessions.length) {
    list.innerHTML =
      '<p class="small">Ingen økter enda.</p>';

    return;
  }

  const container =
    document.createElement("div");

  container.style.display =
    "grid";

  container.style.gap =
    "8px";

  sessions
    .slice()
    .reverse()
    .forEach(session => {
      const row =
        document.createElement("div");

      row.className =
        "menu-item";

      row.style.display =
        "flex";

      row.style.justifyContent =
        "space-between";

      row.style.alignItems =
        "center";

      const started =
        new Date(
          session.startedAt ||
          Date.now()
        ).toLocaleString();

      const points =
        Array.isArray(
          session.points
        )
          ? session.points
          : [];

      const lastPoint =
        points.length
          ? points[
              points.length - 1
            ]
          : null;

      const distance =
        lastPoint &&
        Number.isFinite(
          Number(lastPoint.dist_m)
        )
          ? (
              Number(
                lastPoint.dist_m
              ) / 1000
            ).toFixed(2) + " km"
          : "";

      const left =
        document.createElement("a");

      left.href =
        "#results:" +
        session.id;

      left.textContent =
        `${
          session.name || "Økt"
        } — ${started}`;

      left.style.flex = "1";
      left.style.textDecoration =
        "none";

      const right =
        document.createElement("div");

      right.style.display =
        "flex";

      right.style.gap =
        "8px";

      right.style.alignItems =
        "center";

      const status =
        document.createElement("span");

      status.className = "small";
      status.textContent =
        syncStatusLabel(session);

      const distanceText =
        document.createElement("span");

      distanceText.textContent =
        distance;

      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.className =
        "ghost";

      deleteButton.title =
        "Slett";

      deleteButton.innerHTML =
        '<i class="ph-trash"></i>';

      deleteButton.onclick =
        async () => {
          if (
            !confirm(
              "Slette denne økta?"
            )
          ) {
            return;
          }

          await deleteSession(
            session
          );
        };

      right.appendChild(status);
      right.appendChild(
        distanceText
      );
      right.appendChild(
        deleteButton
      );

      row.appendChild(left);
      row.appendChild(right);

      container.appendChild(row);
    });

  list.appendChild(container);
}

window.addEventListener(
  "intz:viewchange",
  event => {
    if (
      event.detail?.view === "log"
    ) {
      renderLog();
    }
  }
);

window.addEventListener(
  "intz:datachange",
  renderLog
);

document.addEventListener(
  "DOMContentLoaded",
  renderLog
);
``