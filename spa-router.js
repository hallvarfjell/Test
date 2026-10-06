// spa-router.js
// INTZ v10.1 – SPA-router med:
// - navigasjonssperre under aktiv økt
// - dynamisk oppdatering av øktlisten
// - behandling av forvalg fra øktbyggeren

(function () {
  const VIEWS = [
    "dashboard",
    "builder",
    "log",
    "results",
    "settings",
    "help"
  ];

  let revertingHash = false;

  function activeUser() {
    return (
      localStorage.getItem(
        "active_user"
      ) || "default"
    );
  }

  function nsKey(key) {
    return (
      "u:" +
      activeUser() +
      ":" +
      key
    );
  }

  function getNS(key, fallback) {
    try {
      const namespaced =
        localStorage.getItem(
          nsKey(key)
        );

      if (namespaced != null) {
        return JSON.parse(
          namespaced
        );
      }

      const legacy =
        localStorage.getItem(key);

      return legacy != null
        ? JSON.parse(legacy)
        : fallback;
    } catch (error) {
      console.warn(
        "[INTZ Router] Kunne ikke lese lokal lagring:",
        key,
        error
      );

      return fallback;
    }
  }

  function delNS(key) {
    localStorage.removeItem(
      nsKey(key)
    );
  }

  function parseHash() {
    const raw =
      (
        location.hash ||
        "#dashboard"
      ).slice(1);

    if (!raw) {
      return {
        view: "dashboard",
        arg: null
      };
    }

    const parts =
      raw.split(":");

    const requestedView =
      parts[0] || "dashboard";

    const view =
      VIEWS.includes(
        requestedView
      )
        ? requestedView
        : "dashboard";

    const arg =
      parts.length > 1
        ? parts
            .slice(1)
            .join(":")
        : null;

    return {
      view,
      arg
    };
  }

  function navigationAllowed(
    targetView
  ) {
    const guard =
      window.INTZWorkoutNavigation;

    if (
      !guard ||
      typeof guard.canNavigate !==
        "function"
    ) {
      return true;
    }

    return guard.canNavigate(
      targetView
    );
  }

  function show(view) {
    document
      .querySelectorAll(
        "section[data-view]"
      )
      .forEach(section => {
        section.classList.toggle(
          "hidden",
          section.dataset.view !==
            view
        );
      });
  }

  function loadWorkouts() {
    const workouts =
      getNS(
        "custom_workouts_v2",
        []
      );

    if (
      !Array.isArray(workouts)
    ) {
      return [];
    }

    return workouts.filter(
      workout =>
        workout &&
        !workout._deleted_at
    );
  }

  function populateWorkoutSelect() {
    const select =
      document.getElementById(
        "workout-select"
      );

    if (!select) {
      return;
    }

    const workouts =
      loadWorkouts();

    const previousValue =
      select.value;

    select.innerHTML = "";

    if (!workouts.length) {
      const option =
        document.createElement(
          "option"
        );

      option.value = "";

      option.textContent =
        "Ingen lagrede økter";

      select.appendChild(option);
      select.disabled = true;

      const duration =
        document.getElementById(
          "sel-dur"
        );

      if (duration) {
        duration.textContent =
          "--:--";
      }

      return;
    }

    select.disabled = false;

    workouts.forEach(
      (workout, index) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          "c:" + index;

        option.textContent =
          workout.name ||
          "Mal " + (index + 1);

        select.appendChild(
          option
        );
      }
    );

    const previousExists =
      Array.from(
        select.options
      ).some(
        option =>
          option.value ===
          previousValue
      );

    select.value =
      previousExists
        ? previousValue
        : "c:0";
  }

  function applyPreselection() {
    const select =
      document.getElementById(
        "workout-select"
      );

    if (
      !select ||
      select.disabled
    ) {
      return;
    }

    const preselect =
      getNS(
        "preselect",
        null
      );

    if (
      preselect &&
      preselect.type ===
        "custom"
    ) {
      const requestedValue =
        "c:" +
        Number(preselect.index);

      const exists =
        Array.from(
          select.options
        ).some(
          option =>
            option.value ===
            requestedValue
        );

      if (exists) {
        select.value =
          requestedValue;
      }

      delNS("preselect");
    }

    select.dispatchEvent(
      new Event(
        "change",
        {
          bubbles: true
        }
      )
    );
  }

  function refreshDashboard() {
    window.setTimeout(
      () => {
        populateWorkoutSelect();
        applyPreselection();

        window.dispatchEvent(
          new CustomEvent(
            "intz:workoutsrefreshed",
            {
              detail: {
                count:
                  loadWorkouts()
                    .length
              }
            }
          )
        );
      },
      0
    );
  }

  function publishRoute(route) {
    window.INTZRoute =
      route;

    show(route.view);

    window.dispatchEvent(
      new CustomEvent(
        "intz:viewchange",
        {
          detail: route
        }
      )
    );

    if (
      route.view ===
      "dashboard"
    ) {
      refreshDashboard();
    }
  }

  function restoreDashboardHash() {
    if (
      location.hash ===
      "#dashboard"
    ) {
      publishRoute({
        view: "dashboard",
        arg: null
      });

      return;
    }

    revertingHash = true;

    history.replaceState(
      null,
      "",
      "#dashboard"
    );

    publishRoute({
      view: "dashboard",
      arg: null
    });

    revertingHash = false;
  }

  function applyRoute() {
    if (revertingHash) {
      return;
    }

    const route =
      parseHash();

    if (
      !navigationAllowed(
        route.view
      )
    ) {
      restoreDashboardHash();
      return;
    }

    publishRoute(route);
  }

  function go(
    view,
    arg = null
  ) {
    const requestedView =
      VIEWS.includes(view)
        ? view
        : "dashboard";

    if (
      !navigationAllowed(
        requestedView
      )
    ) {
      return false;
    }

    const newHash =
      arg != null
        ? (
            requestedView +
            ":" +
            arg
          )
        : requestedView;

    if (
      location.hash ===
      "#" + newHash
    ) {
      applyRoute();
    } else {
      location.hash =
        newHash;
    }

    return true;
  }

  function wireNavigation() {
    document
      .querySelectorAll(
        "[data-nav]"
      )
      .forEach(link => {
        link.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const view =
              link.dataset.nav;

            if (view) {
              go(view);
            }
          }
        );
      });
  }

  window.INTZRouter = {
    go,
    parseHash,
    refreshDashboard,
    navigationAllowed
  };

  window.addEventListener(
    "hashchange",
    applyRoute
  );

  window.addEventListener(
    "intz:datachange",
    () => {
      if (
        parseHash().view ===
        "dashboard"
      ) {
        refreshDashboard();
      }
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      wireNavigation();
      applyRoute();
    }
  );
})();