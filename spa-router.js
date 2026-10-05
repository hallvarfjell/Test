// spa-router.js
// INTZ v10.1 – SPA-router med oppdatering av øktvalg.
//
// Ruter:
//   #dashboard
//   #builder
//   #log
//   #settings
//   #help
//   #results:<sessionId>

(function () {
  const VIEWS = [
    "dashboard",
    "builder",
    "log",
    "results",
    "settings",
    "help"
  ];

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
        "[INTZ Router] Kunne ikke lese:",
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

    const oldValue =
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

      select.appendChild(
        option
      );

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

    const hasOldValue =
      Array.from(
        select.options
      ).some(
        option =>
          option.value ===
          oldValue
      );

    if (hasOldValue) {
      select.value =
        oldValue;
    } else {
      select.value = "c:0";
    }
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
      const index =
        Number(
          preselect.index
        );

      const requestedValue =
        "c:" + index;

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
    /*
     * main.js registrerer sin change-handler
     * under DOMContentLoaded. Ved SPA-navigasjon
     * er den allerede registrert, men setTimeout
     * beskytter også første oppstart mot ulik
     * registreringsrekkefølge.
     */
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

  function apply() {
    const route =
      parseHash();

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

  function go(
    view,
    arg = null
  ) {
    if (arg != null) {
      location.hash =
        view + ":" + arg;
    } else {
      location.hash =
        view;
    }
  }

  function wireNav() {
    document
      .querySelectorAll(
        "[data-nav]"
      )
      .forEach(link => {
        link.addEventListener(
          "click",
          event => {
            event.preventDefault();

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
    refreshDashboard
  };

  window.addEventListener(
    "hashchange",
    apply
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
      wireNav();
      apply();
    }
  );
})();