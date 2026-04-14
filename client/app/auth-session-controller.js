let authSessionDeps = {
  state: null,
  dom: {
    authDisplayNameInput: null,
    authEmailInput: null,
    authPasswordInput: null,
    authSignupOnlyFields: [],
    authErrorMessage: null
  },
  api: {
    request: async () => ({}),
    ensureGuestSession: async () => ({})
  },
  actions: {
    loadGame: async () => {},
    refreshCollections: async () => {},
    renderGuestProfile: () => {},
    renderSessionUi: () => {},
    renderView: () => {},
    setApiHealth: () => {},
    setBusy: () => {},
    setCoachMessage: () => {},
    setPersistence: () => {},
    setRecordView: () => {},
    syncActionButtons: () => {}
  }
};

export const configureAuthSessionDependencies = (deps = {}) => {
  authSessionDeps = {
    ...authSessionDeps,
    ...deps,
    dom: {
      ...authSessionDeps.dom,
      ...(deps.dom || {})
    },
    api: {
      ...authSessionDeps.api,
      ...(deps.api || {})
    },
    actions: {
      ...authSessionDeps.actions,
      ...(deps.actions || {})
    }
  };
};

export const focusAuthField = (input) => {
  input?.focus();
  input?.select?.();
};

export const createFallbackGuest = (storedGuest) => {
  const guestId =
    storedGuest?.guestId ||
    `guest_${window.crypto?.randomUUID?.() || Date.now().toString(36)}`;
  const suffix = guestId.replace("guest_", "").slice(-4).toUpperCase();

  return {
    guestId,
    displayName: storedGuest?.displayName || `Guest-${suffix}`
  };
};

export const isAuthenticated = () =>
  Boolean(authSessionDeps.state?.session?.authenticated && authSessionDeps.state?.session?.user?.id);

export const getSessionDisplayName = () =>
  authSessionDeps.state?.session?.user?.displayName ||
  authSessionDeps.state?.session?.user?.email ||
  "Arcane Player";

export const getLocalPlayerDisplayName = () =>
  isAuthenticated()
    ? getSessionDisplayName()
    : authSessionDeps.state?.guest?.displayName || "Guest";

export const getGuestHeaders = () =>
  authSessionDeps.state?.guest?.guestId ? { "X-Guest-Id": authSessionDeps.state.guest.guestId } : {};

export const setSessionState = (session = {}) => {
  const { state } = authSessionDeps;
  const { renderGuestProfile, renderSessionUi, syncActionButtons } = authSessionDeps.actions;

  if (!state) {
    return;
  }

  state.session = {
    authenticated: Boolean(session.authenticated && session.user),
    user: session.user || null
  };

  renderGuestProfile();
  renderSessionUi();
  syncActionButtons();
};

export const renderAuthMode = () => {
  const { state } = authSessionDeps;
  const { authSignupOnlyFields } = authSessionDeps.dom;
  const signupMode = state?.authMode === "signup";

  authSignupOnlyFields.forEach((field) => {
    field.classList.toggle("hidden", !signupMode);
  });
};

export const clearAuthInputs = ({ keepEmail = false } = {}) => {
  const { authEmailInput, authPasswordInput, authDisplayNameInput } = authSessionDeps.dom;

  if (authEmailInput && !keepEmail) {
    authEmailInput.value = "";
  }

  if (authPasswordInput) {
    authPasswordInput.value = "";
  }

  if (authDisplayNameInput) {
    authDisplayNameInput.value = "";
  }
};

const showAuthError = (message) => {
  const el = authSessionDeps.dom.authErrorMessage ||
    document.getElementById("auth-error-message");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
};

const clearAuthError = () => {
  showAuthError("");
};

export const getAuthTransferMessage = (transferred = {}) => {
  const totalTransferred =
    (transferred.savedGamesTransferred || 0) +
    (transferred.historyGamesTransferred || 0);

  if (!totalTransferred) {
    return "Account sync is ready. New saves and completed games now belong to your account.";
  }

  const noun = totalTransferred === 1 ? "game" : "games";
  return `${totalTransferred} archived ${noun} moved from this browser guest profile into your account.`;
};

export const registerAccount = async () => {
  const { authEmailInput, authPasswordInput, authDisplayNameInput } = authSessionDeps.dom;
  const { request } = authSessionDeps.api;
  const {
    loadGame,
    refreshCollections,
    renderView,
    setApiHealth,
    setBusy,
    setCoachMessage,
    setPersistence,
    setRecordView
  } = authSessionDeps.actions;
  const { state } = authSessionDeps;

  clearAuthError();
  setBusy(true, "Creating your Arcane Chess account...");

  try {
    const payload = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: authEmailInput?.value?.trim() || "",
        password: authPasswordInput?.value || "",
        displayName: authDisplayNameInput?.value?.trim() || ""
      })
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    setSessionState(payload);
    clearAuthInputs({
      keepEmail: true
    });
    state.view = "hall";
    renderView();
    await Promise.all([loadGame(), refreshCollections()]);
    setRecordView("saves");
    setCoachMessage(
      "Account created.",
      getAuthTransferMessage(payload.transferred)
    );
    return true;
  } catch (error) {
    setApiHealth(false);
    showAuthError(error.message || "Could not create account. Please try again.");
    setCoachMessage(error.message);
    return false;
  } finally {
    setBusy(false);
  }
};

export const loginAccount = async () => {
  const { authEmailInput, authPasswordInput } = authSessionDeps.dom;
  const {
    loadGame,
    refreshCollections,
    renderView,
    setApiHealth,
    setBusy,
    setCoachMessage,
    setPersistence,
    setRecordView
  } = authSessionDeps.actions;
  const { state } = authSessionDeps;

  console.log("loginAccount: start");
  clearAuthError();
  setBusy(true, "Signing you in...");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        ...getGuestHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: authEmailInput?.value?.trim() || "",
        password: authPasswordInput?.value || ""
      })
    });
    console.log("loginAccount: response status", response.status);

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    console.log("loginAccount: payload", payload);

    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }

    setApiHealth(true);
    setPersistence(payload.persistence);
    setSessionState(payload);
    clearAuthInputs({
      keepEmail: true
    });
    console.log("Login success -> switching to hall");
    state.view = "hall";
    renderView();
    await Promise.all([loadGame(), refreshCollections()]);
    setRecordView("saves");
    setCoachMessage("Signed in.", getAuthTransferMessage(payload.transferred));
    console.log("loginAccount: success returning true");
    return true;
  } catch (error) {
    console.log("loginAccount: failed", error?.message || error);
    setApiHealth(false);
    showAuthError(error.message || "Incorrect email or password.");
    setCoachMessage(error.message);
    return false;
  } finally {
    setBusy(false);
  }
};

export const logoutAccount = async () => {
  const { request } = authSessionDeps.api;
  const {
    loadGame,
    refreshCollections,
    renderView,
    setApiHealth,
    setBusy,
    setCoachMessage,
    setPersistence,
    setRecordView
  } = authSessionDeps.actions;
  const { state } = authSessionDeps;

  setBusy(true, "Returning to guest mode...");

  try {
    const payload = await request("/api/auth/logout", {
      method: "POST"
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    setSessionState(payload);
    clearAuthInputs();
    await Promise.all([loadGame(), refreshCollections()]);
    setRecordView("moves");
    state.view = "auth";
    renderView();
    setCoachMessage(
      "Signed out.",
      "You are back in guest mode on this browser. Account archives remain available the next time you sign in."
    );
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

export const showSignupMode = () => {
  const { state } = authSessionDeps;

  state.authMode = "signup";
  renderAuthMode();
};