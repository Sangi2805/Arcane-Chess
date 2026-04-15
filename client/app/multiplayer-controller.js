import { QUICK_PLAY_TIME_CONTROL_ID } from "./constants.js";

let multiplayerDeps = {
  state: null,
  dom: {
    multiplayerRoomIdInput: null
  },
  api: {
    request: async () => ({})
  },
  realtime: {
    emitMultiplayerEvent: async () => ({}),
    ensureMultiplayerSocket: () => {}
  },
  auth: {
    isAuthenticated: () => false,
    getSessionDisplayName: () => "Arcane Player"
  },
  ui: {
    renderMultiplayerLobby: () => {},
    renderView: () => {},
    setApiHealth: () => {},
    setBusy: () => {},
    setCoachMessage: () => {},
    syncActionButtons: () => {}
  },
  game: {
    applyGameState: () => {},
    launchSelectedBoard: async () => {},
    startNewGame: async () => {},
    enterGameView: async () => {}
  }
};

export const configureMultiplayerDependencies = (deps = {}) => {
  multiplayerDeps = {
    ...multiplayerDeps,
    ...deps,
    dom: {
      ...multiplayerDeps.dom,
      ...(deps.dom || {})
    },
    api: {
      ...multiplayerDeps.api,
      ...(deps.api || {})
    },
    realtime: {
      ...multiplayerDeps.realtime,
      ...(deps.realtime || {})
    },
    auth: {
      ...multiplayerDeps.auth,
      ...(deps.auth || {})
    },
    ui: {
      ...multiplayerDeps.ui,
      ...(deps.ui || {})
    },
    game: {
      ...multiplayerDeps.game,
      ...(deps.game || {})
    }
  };
};

export const isRealtimeMultiplayerGame = () =>
  Boolean(multiplayerDeps.state?.multiplayer?.roomId) && multiplayerDeps.state?.game?.actorType === "multiplayer";

export const getMultiplayerDisplayName = () => {
  if (multiplayerDeps.auth.isAuthenticated()) {
    return multiplayerDeps.auth.getSessionDisplayName();
  }

  return multiplayerDeps.state?.guest?.displayName || multiplayerDeps.state?.guest?.name || "Guest";
};

export const getMultiplayerActorPayload = () => {
  if (multiplayerDeps.auth.isAuthenticated()) {
    return {
      actorType: "user",
      userId: multiplayerDeps.state.session.user.id,
      guestId: null,
      displayName: multiplayerDeps.auth.getSessionDisplayName()
    };
  }

  return {
    actorType: "guest",
    userId: null,
    guestId: multiplayerDeps.state?.guest?.guestId || null,
    displayName: multiplayerDeps.state?.guest?.displayName || "Guest"
  };
};

export const getMultiplayerCoachState = (socketState) => {
  if (socketState?.phase === "waiting") {
    return {
      message: `Room ${socketState.roomId} created. Waiting for opponent to join.`,
      explanation: "Share this Room ID with a friend."
    };
  }

  if (socketState?.game?.isGameOver) {
    return {
      message: "Multiplayer game complete.",
      explanation: "Create or join another room to continue."
    };
  }

  return {
    message: "Live multiplayer is active.",
    explanation:
      socketState?.game?.turn === socketState?.youAre
        ? "Your turn. Select a piece and make a move."
        : "Waiting for opponent move."
  };
};

export const applyMultiplayerSocketState = (socketState) => {
  if (!socketState?.game) {
    return;
  }

  const { state } = multiplayerDeps;

  state.multiplayer.roomId = socketState.roomId || state.multiplayer.roomId;
  state.multiplayer.color = socketState.youAre || state.multiplayer.color;
  state.multiplayer.phase = socketState.phase || state.multiplayer.phase;
  if (typeof socketState.opponentName === "string" && socketState.opponentName.trim()) {
    state.multiplayer.opponentDisplayName = socketState.opponentName.trim();
  } else if (socketState.players && socketState.youAre) {
    const opponentColor = socketState.youAre === "white" ? "black" : "white";
    const opponentName = socketState.players[opponentColor]?.name;
    state.multiplayer.opponentDisplayName =
      typeof opponentName === "string" && opponentName.trim() ? opponentName.trim() : null;
  }

  multiplayerDeps.game.applyGameState(
    {
      ...socketState.game,
      persistence: state.persistence
    },
    {
      coachState: getMultiplayerCoachState(socketState)
    }
  );
};

export const applyQueueStatusState = (queueState = {}) => {
  const { state } = multiplayerDeps;

  state.multiplayer.queued = Boolean(queueState.queued);
  state.multiplayer.queuePosition =
    Number.isFinite(queueState.position) && queueState.position > 0
      ? queueState.position
      : null;
  state.multiplayer.queueTimeControlId = state.multiplayer.queued
    ? QUICK_PLAY_TIME_CONTROL_ID
    : null;

  if (state.multiplayer.queued) {
    state.multiplayer.phase = "queued";
  } else if (!state.multiplayer.roomId) {
    state.multiplayer.phase = "idle";
  }

  multiplayerDeps.ui.renderMultiplayerLobby();
  multiplayerDeps.ui.syncActionButtons();
};

export const joinMatchmakingQueue = async () => {
  const { state } = multiplayerDeps;

  if (state.multiplayer.roomId) {
    multiplayerDeps.ui.setCoachMessage(
      "Leave your current room before joining quick play.",
      "Quick play queue is only available when you are not inside a multiplayer room."
    );
    return;
  }

  multiplayerDeps.ui.setBusy(true, "Joining Blitz 5 quick play queue...");

  try {
    const queueState = await multiplayerDeps.realtime.emitMultiplayerEvent("queue:join", {
      actor: getMultiplayerActorPayload(),
      timeControlId: QUICK_PLAY_TIME_CONTROL_ID
    });

    multiplayerDeps.ui.setApiHealth(true);
    applyQueueStatusState(queueState);
    multiplayerDeps.ui.setCoachMessage(
      "Queued for Blitz 5 quick play.",
      "Matchmaking is live. We will drop you into a game as soon as another player queues."
    );
  } catch (error) {
    multiplayerDeps.ui.setApiHealth(false);
    multiplayerDeps.ui.setCoachMessage(error.message);
  } finally {
    multiplayerDeps.ui.setBusy(false);
  }
};

export const leaveMatchmakingQueue = async () => {
  multiplayerDeps.ui.setBusy(true, "Leaving quick play queue...");

  try {
    const queueState = await multiplayerDeps.realtime.emitMultiplayerEvent("queue:leave");

    multiplayerDeps.ui.setApiHealth(true);
    applyQueueStatusState(queueState);
    multiplayerDeps.ui.setCoachMessage(
      "Quick play queue canceled.",
      "You can rejoin Blitz 5 quick play at any time."
    );
  } catch (error) {
    multiplayerDeps.ui.setApiHealth(false);
    multiplayerDeps.ui.setCoachMessage(error.message);
  } finally {
    multiplayerDeps.ui.setBusy(false);
  }
};

export const handleQuickPlayClick = async () => {
  if (multiplayerDeps.state.multiplayer.queued) {
    await leaveMatchmakingQueue();
    return;
  }

  await joinMatchmakingQueue();
};

export const rejoinMultiplayerMatch = async () => {
  const { state } = multiplayerDeps;

  if (!state.multiplayer.roomId) {
    multiplayerDeps.ui.setCoachMessage("No active multiplayer room found.", "Create or join a room to start a live match.");
    return;
  }

  state.view = "game";
  multiplayerDeps.ui.renderView();
  await multiplayerDeps.game.launchSelectedBoard({
    trigger: "Resume Game"
  });
  multiplayerDeps.ui.syncActionButtons();
  multiplayerDeps.ui.setCoachMessage("Rejoined live match.", "You are back in the active multiplayer board.");
};

export const createMultiplayerRoom = async () => {
  const { state } = multiplayerDeps;

  multiplayerDeps.ui.setBusy(true, "Creating multiplayer room...");

  try {
    const socketState = await multiplayerDeps.realtime.emitMultiplayerEvent("multiplayer:create", {
      displayName: getMultiplayerDisplayName()
    });

    multiplayerDeps.ui.setApiHealth(true);
    state.view = "game";
    multiplayerDeps.ui.renderView();
    await multiplayerDeps.game.launchSelectedBoard({
      trigger: "Create Room"
    });
    applyMultiplayerSocketState(socketState);
  } catch (error) {
    multiplayerDeps.ui.setApiHealth(false);
    multiplayerDeps.ui.setCoachMessage(error.message);
  } finally {
    multiplayerDeps.ui.setBusy(false);
  }
};

export const joinMultiplayerRoom = async () => {
  const roomId = multiplayerDeps.dom.multiplayerRoomIdInput?.value?.trim()?.toUpperCase() || "";
  const { state } = multiplayerDeps;

  if (!roomId) {
    multiplayerDeps.ui.setCoachMessage("Enter a Room ID first.", "Use the ID shared by the host player.");
    return;
  }

  multiplayerDeps.ui.setBusy(true, `Joining room ${roomId}...`);

  try {
    const socketState = await multiplayerDeps.realtime.emitMultiplayerEvent("multiplayer:join", {
      roomId,
      displayName: getMultiplayerDisplayName()
    });

    multiplayerDeps.ui.setApiHealth(true);
    state.view = "game";
    multiplayerDeps.ui.renderView();
    await multiplayerDeps.game.launchSelectedBoard({
      trigger: "Join Game"
    });
    applyMultiplayerSocketState(socketState);
  } catch (error) {
    multiplayerDeps.ui.setApiHealth(false);
    multiplayerDeps.ui.setCoachMessage(error.message);
  } finally {
    multiplayerDeps.ui.setBusy(false);
  }
};
