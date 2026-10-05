// settings-view.js
// INTZ v10.1 – Supabase innlogging og synkronisering

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

let cloudWired = false;

function createAuthUi() {
  const cloudStatus =
    document.getElementById(
      "cloud-status"
    );

  if (!cloudStatus) {
    return null;
  }

  const card =
    cloudStatus.closest(".card");

  if (!card) {
    return null;
  }

  let authContainer =
    document.getElementById(
      "cloud-auth"
    );

  if (authContainer) {
    return authContainer;
  }

  authContainer =
    document.createElement("div");

  authContainer.id =
    "cloud-auth";

  authContainer.style.marginBottom =
    "12px";

  authContainer.innerHTML = `
    <label style="display:grid;gap:4px">
      <span>E-post for synkronisering</span>
      <input
        id="cloud-email"
        type="email"
        autocomplete="email"
        placeholder="navn@eksempel.no"
      />
    </label>

    <div
      style="
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:8px
      "
    >
      <button
        class="secondary"
        id="cloud-login"
        type="button"
      >
        Send innloggingslenke
      </button>

      <button
        class="ghost"
        id="cloud-logout"
        type="button"
      >
        Logg ut
      </button>
    </div>

    <div
      class="small"
      id="cloud-user-status"
      style="margin-top:8px"
    >
      Leser innloggingsstatus…
    </div>
  `;

  const firstParagraph =
    card.querySelector("p");

  if (firstParagraph) {
    firstParagraph.insertAdjacentElement(
      "afterend",
      authContainer
    );
  } else {
    card.prepend(authContainer);
  }

  return authContainer;
}

async function updateAuthStatus() {
  const status =
    document.getElementById(
      "cloud-user-status"
    );

  const logout =
    document.getElementById(
      "cloud-logout"
    );

  const checkbox =
    document.getElementById(
      "cloud-enabled"
    );

  if (
    !status ||
    !window.INTZSupabase
  ) {
    return;
  }

  try {
    const user =
      await window.INTZSupabase
        .getAuthUser();

    if (user) {
      status.textContent =
        "Innlogget som " +
        (user.email || user.id);

      if (logout) {
        logout.disabled = false;
      }
    } else {
      status.textContent =
        "Ikke innlogget";

      if (logout) {
        logout.disabled = true;
      }

      if (checkbox) {
        checkbox.checked = false;
      }
    }
  } catch (error) {
    status.textContent =
      "Kunne ikke lese innloggingsstatus: " +
      (error?.message ||
        String(error));
  }
}

function formatSyncResult(result) {
  return [
    `Maler opp: ${
      result.workouts_uploaded || 0
    }`,

    `Maler slettet: ${
      result.workouts_deleted || 0
    }`,

    `Økter opp: ${
      result.sessions_uploaded || 0
    }`,

    `Økter slettet: ${
      result.sessions_deleted || 0
    }`,

    `Nye maler ned: ${
      result.workouts_downloaded || 0
    }`,

    `Oppdaterte maler: ${
      result.workouts_replaced || 0
    }`,

    `Nye økter ned: ${
      result.sessions_downloaded || 0
    }`,

    `Oppdaterte økter: ${
      result.sessions_replaced || 0
    }`
  ].join(" · ");
}

function wireCloud() {
  createAuthUi();

  const checkbox =
    document.getElementById(
      "cloud-enabled"
    );

  const upButton =
    document.getElementById(
      "cloud-sync-up"
    );

  const downButton =
    document.getElementById(
      "cloud-sync-down"
    );

  const status =
    document.getElementById(
      "cloud-status"
    );

  const email =
    document.getElementById(
      "cloud-email"
    );

  const login =
    document.getElementById(
      "cloud-login"
    );

  const logout =
    document.getElementById(
      "cloud-logout"
    );

  if (
    !checkbox ||
    !upButton ||
    !downButton ||
    !status
  ) {
    return;
  }

  checkbox.checked =
    !!getNS(
      "cloudEnabled",
      false
    );

  if (cloudWired) {
    updateAuthStatus();
    return;
  }

  cloudWired = true;

  function setStatus(message) {
    status.textContent = message;
  }

  checkbox.addEventListener(
    "change",
    async () => {
      if (checkbox.checked) {
        try {
          await window.INTZSupabase
            .requireAuthUser();

          setNS(
            "cloudEnabled",
            true
          );

          setStatus(
            "Sky-synk er aktivert."
          );
        } catch (error) {
          checkbox.checked = false;

          setNS(
            "cloudEnabled",
            false
          );

          alert(
            "Du må logge inn før sky-synk kan aktiveres."
          );

          setStatus(
            error?.message ||
            String(error)
          );
        }
      } else {
        setNS(
          "cloudEnabled",
          false
        );

        setStatus(
          "Sky-synk er deaktivert."
        );
      }
    }
  );

  login?.addEventListener(
    "click",
    async () => {
      try {
        setStatus(
          "Sender innloggingslenke…"
        );

        await window.INTZSupabase
          .sendMagicLink(
            email?.value
          );

        setStatus(
          "Innloggingslenke er sendt. Åpne lenken i e-posten på denne enheten."
        );
      } catch (error) {
        console.error(error);

        setStatus(
          "Innlogging feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      }
    }
  );

  logout?.addEventListener(
    "click",
    async () => {
      try {
        await window.INTZSupabase
          .signOut();

        checkbox.checked = false;

        setNS(
          "cloudEnabled",
          false
        );

        setStatus(
          "Du er logget ut."
        );

        await updateAuthStatus();
      } catch (error) {
        setStatus(
          "Utlogging feilet: " +
          (
            error?.message ||
            String(error)
          )
        );
      }
    }
  );

  upButton.textContent =
    "Synkroniser nå";

  upButton.addEventListener(
    "click",
    async () => {
      try {
        if (!checkbox.checked) {
          alert(
            "Aktiver sky-synk først."
          );

          return;
        }

  