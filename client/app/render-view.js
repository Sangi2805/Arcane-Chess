import {
  QUICK_PLAY_TIME_CONTROL_ID,
  VALID_LOBBY_MODES
} from "./constants.js";
import {
  runtimeState,
  state
} from "./state.js";
import {
  escapeHtml,
  formatColor,
  getResolvedTimeControl
} from "./formatting.js";
import {
  persistView
} from "./storage.js";
import * as dom from "./dom.js";

let renderViewDeps = {
  getSessionDisplayName: () => "Arcane Player",
  getSelectedTimeControlId: () => QUICK_PLAY_TIME_CONTROL_ID,
  isAuthenticated: () => false,
  normalizeLobbyMode: (value) => (VALID_LOBBY_MODES.includes(value) ? value : "solo"),
  syncAmbientMusic: () => {},
  syncAmbientTogglePlacement: () => {},
  syncBoardViewUi: () => {},
  updateAmbientToggleLabel: () => {}
};

export const configureRenderViewDependencies = (deps = {}) => {
  renderViewDeps = {
    ...renderViewDeps,
    ...deps
  };
};

export const renderView = () => {
  document.body.classList.toggle("view-auth", state.view === "auth");
  document.body.classList.toggle("view-hall", state.view === "hall");
  document.body.classList.toggle("view-game", state.view === "game");
  document.body.classList.toggle("hall-view", state.view === "hall");
  persistView(state.view);
  void runtimeState.currentWizardState;

  if (dom.authView) {
    dom.authView.style.display = state.view === "auth" ? "flex" : "none";
  }

  if (dom.playArea) {
    dom.playArea.style.display = state.view === "auth" ? "none" : "grid";
  }

  if (dom.lobbyView) {
    dom.lobbyView.style.display = state.view === "hall" ? "block" : "none";
  }

  if (dom.gameView) {
    dom.gameView.style.display = state.view === "game" ? "grid" : "none";
  }

  renderViewDeps.syncBoardViewUi();

  console.log("renderView:", state.view);
  console.log("Hall visible:", dom.lobbyView?.style.display, "Game visible:", dom.gameView?.style.display);

  renderViewDeps.syncAmbientTogglePlacement();
  renderViewDeps.updateAmbientToggleLabel();
  void renderViewDeps.syncAmbientMusic();
};

export const renderGuestProfile = () => {
  if (renderViewDeps.isAuthenticated()) {
    dom.guestName.textContent = renderViewDeps.getSessionDisplayName();
    dom.guestSubtitle.textContent = "Signed in";
    dom.guestMeta.textContent = "Unfinished and completed games belong to your account.";
    return;
  }

  dom.guestName.textContent = state.guest?.displayName || "Playing as Guest";
  dom.guestSubtitle.textContent = "Guest mode active";
  dom.guestMeta.textContent = state.persistence.available
    ? "Save and resume untimed games here without creating an account."
    : "Saved games and history stay on this browser when persistence is available.";
};

export const renderSessionUi = () => {
  if (!dom.authSessionHeading) {
    return;
  }

  const persistenceAvailable = Boolean(state.persistence.available);
  const authenticated = renderViewDeps.isAuthenticated();

  if (authenticated) {
    if (dom.authSessionHeading) {
      dom.authSessionHeading.textContent = "Account connected";
    }
    if (dom.authSessionPill) {
      dom.authSessionPill.textContent = "SIGNED IN";
      dom.authSessionPill.className = "pill pill-ok";
    }
    if (dom.authSessionCopy) {
      dom.authSessionCopy.textContent = persistenceAvailable
        ? "Saved and completed games now follow your account across devices and browsers."
        : "Your session is active, but account sync is paused until MongoDB returns.";
    }
    if (!dom.authUserDisplay) {
      console.log("renderSessionUi: missing #auth-user-display");
    }
    if (dom.authUserDisplay) {
      dom.authUserDisplay.textContent = renderViewDeps.getSessionDisplayName();
    }
    if (dom.authGuestView) {
      dom.authGuestView.classList.add("hidden");
    }
    if (dom.authUserView) {
      dom.authUserView.classList.remove("hidden");
    }
    if (dom.hallLogoutButton) {
      dom.hallLogoutButton.classList.remove("hidden");
    }
  } else {
    if (dom.authSessionHeading) {
      dom.authSessionHeading.textContent = "Sign in or create an account";
    }
    if (dom.authSessionPill) {
      dom.authSessionPill.textContent = persistenceAvailable ? "Guest" : "Offline";
      dom.authSessionPill.className = persistenceAvailable ? "pill" : "pill pill-error";
    }
    if (dom.authSessionCopy) {
      dom.authSessionCopy.textContent = persistenceAvailable
        ? "Accounts sync unfinished and completed games beyond this browser."
        : "MongoDB is offline, so account sign-in and long-term sync are unavailable right now.";
    }
    if (dom.authGuestView) {
      dom.authGuestView.classList.remove("hidden");
    }
    if (dom.authUserView) {
      dom.authUserView.classList.add("hidden");
    }
    if (dom.hallLogoutButton) {
      dom.hallLogoutButton.classList.add("hidden");
    }
  }

  renderMultiplayerLobby();
};

export const renderMultiplayerRealtimeControls = () => {
  if (dom.multiplayerRoomIdLabel) {
    const hasRoom = Boolean(state.multiplayer.roomId);
    dom.multiplayerRoomIdLabel.classList.toggle("hidden", !hasRoom);
    dom.multiplayerRoomIdLabel.textContent = hasRoom
      ? `Room ID: ${state.multiplayer.roomId}`
      : "";
  }

  if (dom.multiplayerConnectionStatus) {
    dom.multiplayerConnectionStatus.classList.toggle("hidden", !state.multiplayer.connected);
    const queueSuffix = state.multiplayer.queued
      ? ` queued for Blitz 5${
          state.multiplayer.queuePosition
            ? ` (position ${state.multiplayer.queuePosition})`
            : ""
        }.`
      : "";
    const phaseLabel =
      state.multiplayer.phase === "active"
        ? "ready"
        : state.multiplayer.phase === "waiting"
          ? "waiting"
          : state.multiplayer.phase === "queued"
            ? "queued"
          : "idle";
    dom.multiplayerConnectionStatus.textContent = state.multiplayer.connected
      ? `Socket connected (${phaseLabel})${queueSuffix}`
      : "";
  }
};

export const renderLobbyTimeControlButtons = () => {
  if (!dom.hallRandomTimeControlLabel) {
    return;
  }

  const activeTimeControl = getResolvedTimeControl(renderViewDeps.getSelectedTimeControlId());
  dom.hallRandomTimeControlLabel.textContent = `Selected: ${activeTimeControl.label}`;
};

export const renderMultiplayerLobby = () => {
  const lobbyMode = renderViewDeps.normalizeLobbyMode(state.lobbyMode);
  const persistenceAvailable = Boolean(state.persistence.available);
  const showGateway = false;
  const showDashboard = lobbyMode === "multiplayer";

  state.lobbyMode = lobbyMode;

  if (dom.controlsPanel) {
    dom.controlsPanel.dataset.lobbyMode = lobbyMode;
  }

  if (dom.soloLobbyButton) {
    const isActive = lobbyMode === "solo";
    dom.soloLobbyButton.classList.toggle("cp-mode-btn-active", isActive);
    dom.soloLobbyButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  if (dom.multiplayerLobbyButton) {
    const isActive = lobbyMode === "multiplayer";
    dom.multiplayerLobbyButton.classList.toggle("cp-mode-btn-active", isActive);
    dom.multiplayerLobbyButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  if (dom.multiplayerGateway) {
    dom.multiplayerGateway.classList.toggle("hidden", !showGateway);
  }

  if (dom.multiplayerDashboard) {
    dom.multiplayerDashboard.classList.toggle("hidden", !showDashboard);
  }

  if (dom.multiplayerPresencePill) {
    if (showDashboard && state.multiplayer.connected && state.multiplayer.roomId) {
      dom.multiplayerPresencePill.textContent = "In Match";
      dom.multiplayerPresencePill.className = "pill pill-ok";
    } else if (showDashboard && state.multiplayer.connected) {
      dom.multiplayerPresencePill.textContent = "Online";
      dom.multiplayerPresencePill.className = "pill pill-ok";
    } else if (!persistenceAvailable) {
      dom.multiplayerPresencePill.textContent = "Offline";
      dom.multiplayerPresencePill.className = "pill pill-error";
    } else if (showDashboard) {
      dom.multiplayerPresencePill.textContent = "Ready";
      dom.multiplayerPresencePill.className = "pill pill-ok";
    } else {
      dom.multiplayerPresencePill.textContent = "Preview";
      dom.multiplayerPresencePill.className = "pill";
    }
  }

  if (dom.multiplayerStatusCopy) {
    if (showDashboard && state.multiplayer.roomId) {
      dom.multiplayerStatusCopy.textContent =
        "Live room active. Share the Room ID so your opponent can join and play in real time.";
    } else if (showDashboard && state.multiplayer.queued) {
      dom.multiplayerStatusCopy.textContent =
        "Searching for a Blitz 5 opponent now. Stay on this page while queued.";
    } else if (showDashboard && state.multiplayer.connected) {
      dom.multiplayerStatusCopy.textContent =
        "Live socket connected. Click Online Quick Play to queue instantly for Blitz 5.";
    } else if (!persistenceAvailable) {
      dom.multiplayerStatusCopy.textContent =
        "MongoDB is offline, so presence, invites, and PvP history stay parked until persistence returns.";
    } else if (showDashboard) {
      dom.multiplayerStatusCopy.textContent =
        "Your account is ready for live duels. Create a room or join by Room ID to start.";
    } else {
      dom.multiplayerStatusCopy.textContent =
        "Sign in to unlock the live roster, incoming invites, and cross-device multiplayer archives.";
    }
  }

  if (dom.multiplayerPlayerList) {
    dom.multiplayerPlayerList.innerHTML = showDashboard
      ? `
        <article class="lobby-roster-card">
          <div class="lobby-roster-copy">
            <strong>${escapeHtml(renderViewDeps.getSessionDisplayName())}</strong>
            <span>${
              state.multiplayer.roomId
                ? `Room ${escapeHtml(state.multiplayer.roomId)} as ${escapeHtml(
                    formatColor(state.multiplayer.color || "white")
                  )}.`
                : "Connected and ready for live room play."
            }</span>
          </div>
          <span class="pill pill-ok">You</span>
        </article>
        <div class="empty-state">
          <strong>The hall is quiet for now.</strong>
          <span>Share a Room ID with a friend to start a live duel.</span>
        </div>
      `
      : "";
  }

  if (dom.multiplayerInviteList) {
    dom.multiplayerInviteList.innerHTML = showDashboard
      ? `
        <div class="empty-state">
          <strong>No pending challenges.</strong>
          <span>Incoming and outgoing invites will collect here when the challenge desk opens.</span>
        </div>
      `
      : "";
  }

  renderMultiplayerRealtimeControls();
  renderLobbyTimeControlButtons();
};