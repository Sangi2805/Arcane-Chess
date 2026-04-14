import { VALID_LOBBY_MODES } from "./constants.js";

let hallActionsDeps = {
  state: null,
  dom: {},
  realtime: {
    ensureMultiplayerSocket: () => {},
    leaveMultiplayerRoom: () => {}
  },
  actions: {
    applyQueueStatusState: () => {},
    persistLobbyMode: () => {},
    renderMultiplayerLobby: () => {}
  }
};

export const configureHallActionsDependencies = (deps = {}) => {
  hallActionsDeps = {
    ...hallActionsDeps,
    ...deps,
    dom: {
      ...hallActionsDeps.dom,
      ...(deps.dom || {})
    },
    realtime: {
      ...hallActionsDeps.realtime,
      ...(deps.realtime || {})
    },
    actions: {
      ...hallActionsDeps.actions,
      ...(deps.actions || {})
    }
  };
};

export const normalizeLobbyMode = (value) =>
  VALID_LOBBY_MODES.has(value) ? value : "solo";

export const setLobbyMode = (mode = "solo") => {
  const { state } = hallActionsDeps;
  const { ensureMultiplayerSocket, leaveMultiplayerRoom } = hallActionsDeps.realtime;
  const { applyQueueStatusState, persistLobbyMode, renderMultiplayerLobby } = hallActionsDeps.actions;

  if (!state) {
    return;
  }

  const nextMode = normalizeLobbyMode(mode);
  const previousMode = state.lobbyMode;

  if (nextMode === "solo" && previousMode === "multiplayer") {
    if (state.multiplayer.socket && state.multiplayer.queued) {
      state.multiplayer.socket.emit("queue:leave", {}, () => {});
    }

    if (state.multiplayer.roomId) {
      leaveMultiplayerRoom();
    }

    applyQueueStatusState({ queued: false });
    state.multiplayer.roomId = null;
    state.multiplayer.color = null;
    state.multiplayer.phase = "idle";
  }

  state.lobbyMode = nextMode;
  persistLobbyMode(nextMode);

  if (nextMode === "multiplayer") {
    ensureMultiplayerSocket();
  }

  renderMultiplayerLobby();
};

export const leaveCompletedMultiplayerGameIfNeeded = () => {
  const { state } = hallActionsDeps;
  const { leaveMultiplayerRoom } = hallActionsDeps.realtime;
  const { applyQueueStatusState } = hallActionsDeps.actions;

  if (!state) {
    return;
  }

  const hasLiveRoom = Boolean(state.multiplayer.roomId);
  const gameIsOver = Boolean(state.game?.isGameOver);
  const noActiveMoves = !state.game?.hasStarted || gameIsOver;

  if (!hasLiveRoom || !noActiveMoves) {
    return;
  }

  leaveMultiplayerRoom();
  applyQueueStatusState({ queued: false });
};
