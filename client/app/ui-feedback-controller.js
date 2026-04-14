import {
  CLOCK_SYNC_INTERVAL_MS,
  CLOCK_TICK_INTERVAL_MS,
  GAME_OVER_BANNER_DURATION_MS,
  VALID_RECORD_VIEWS
} from "./constants.js";

let uiFeedbackDeps = {
  state: null,
  runtimeState: null,
  dom: {
    apiHealth: null,
    authDisplayNameInput: null,
    authEmailInput: null,
    authPasswordInput: null,
    boardFeedbackBanner: null,
    boardFeedbackMessage: null,
    boardFeedbackTitle: null,
    claimDrawButton: null,
    colorInputs: [],
    continuePlayButton: null,
    dashboardTimeControlButtons: [],
    difficultySelect: null,
    engineSide: null,
    evalBarBlack: null,
    evalBarWhite: null,
    gameOverBanner: null,
    gameOverMessage: null,
    gameOverTitle: null,
    gatewayCreateButton: null,
    gatewayGuestButton: null,
    gatewaySignInButton: null,
    hallLogoutButton: null,
    hallRandomTimeControlButton: null,
    hintButton: null,
    hintWhyButton: null,
    hintWhyText: null,
    immersiveNewGameButton: null,
    immersiveOfferDrawButton: null,
    immersiveResignButton: null,
    immersiveStatusHeading: null,
    immersiveStatusMeta: null,
    loginButton: null,
    logoutButton: null,
    multiplayerCreateGameButton: null,
    multiplayerCreateRoomButton: null,
    multiplayerJoinGameButton: null,
    multiplayerLobbyButton: null,
    multiplayerRejoinGameButton: null,
    multiplayerRoomIdInput: null,
    newGameButton: null,
    offerDrawButton: null,
    playerSide: null,
    recordTabs: [],
    recordViews: [],
    registerButton: null,
    resignButton: null,
    saveGameButton: null,
    soloLobbyButton: null,
    statusText: null,
    timeControlSelect: null,
    turnIndicator: null,
    lastMoveText: null
  },
  helpers: {
    escapeHtml: (value) => String(value ?? ""),
    formatClockMs: (value) => String(value ?? ""),
    formatColor: (value) => String(value ?? ""),
    getOutcomeLabel: () => "",
    trimTerminalPeriod: (value) => String(value ?? "")
  },
  callbacks: {
    applyGameState: () => {},
    clearHintState: () => {},
    clearPromotionPrompt: () => {},
    clearSelectedSquare: () => {},
    getArcaneBoard3D: () => null,
    getChosenColor: () => "white",
    getIs3DMoveAnimating: () => false,
    getLocalPlayerDisplayName: () => "Guest",
    getSelectedTimeControlId: () => "untimed",
    isAuthenticated: () => false,
    isRealtimeMultiplayerGame: () => false,
    leaveCompletedMultiplayerGameIfNeeded: () => {},
    persistRecordView: () => {},
    renderAuthMode: () => {},
    renderBoardOverlays: () => {},
    renderBoardSurface: () => {},
    renderClocks: () => {},
    renderCoachPanel: () => {},
    renderGuestProfile: () => {},
    renderHintPanel: () => {},
    renderHistory: () => {},
    renderMoveList: () => {},
    renderSavedGames: () => {},
    renderSessionUi: () => {},
    renderView: () => {},
    request: async () => ({}),
    resetBoardViewTo2D: () => {},
    setCoachMessage: () => {},
    setPersistence: () => {},
    startNewGame: () => {},
    syncBoard3D: () => {},
  }
};

export const configureUIFeedbackDependencies = (deps = {}) => {
  uiFeedbackDeps = {
    ...uiFeedbackDeps,
    ...deps,
    dom: {
      ...uiFeedbackDeps.dom,
      ...(deps.dom || {})
    },
    helpers: {
      ...uiFeedbackDeps.helpers,
      ...(deps.helpers || {})
    },
    callbacks: {
      ...uiFeedbackDeps.callbacks,
      ...(deps.callbacks || {})
    }
  };
};

export const getWinnerFromResult = (result) => {
  if (result === "white-win") {
    return "White";
  }

  if (result === "black-win") {
    return "Black";
  }

  return null;
};

export const getDrawClaimState = (gameState = uiFeedbackDeps.state?.game) =>
  gameState?.ruleState?.drawClaim?.available ? gameState.ruleState.drawClaim : null;

export const getCheckedKingSquare = (gameState = uiFeedbackDeps.state?.game) => {
  const checkedColor = gameState?.ruleState?.checkedColor;

  if (!checkedColor) {
    return null;
  }

  return (
    gameState.board.find(
      (entry) => entry.piece?.type === "k" && entry.piece.color === checkedColor
    )?.square || null
  );
};

export const getGameOverCopy = (gameState) => {
  const { getOutcomeLabel, trimTerminalPeriod } = uiFeedbackDeps.helpers;

  if (!isTerminalGameState(gameState)) {
    return null;
  }

  if (gameState.status.code === "checkmate") {
    const winner = getWinnerFromResult(gameState.result);

    return {
      title: "Game Over",
      message: winner ? `${winner} wins by checkmate` : "Checkmate"
    };
  }

  if (gameState.status.code === "resignation") {
    return {
      title: "Game Over",
      message: gameState.status.message
    };
  }

  if (gameState.result === "draw") {
    return {
      title: "Game Over",
      message: getOutcomeLabel(gameState) || "Draw"
    };
  }

  return {
    title: "Game Over",
    message: trimTerminalPeriod(gameState.status?.message) || "Draw"
  };
};

export const TERMINAL_STATUS_CODES = new Set([
  "checkmate",
  "resignation",
  "timeout",
  "draw-agreed",
  "draw-repetition",
  "draw-fivefold-repetition",
  "draw-insufficient-material",
  "draw-fifty-move",
  "draw-seventy-five-move",
  "draw-timeout-insufficient-material"
]);

export const isTerminalGameState = (gameState) =>
  Boolean(gameState?.isGameOver) &&
  (TERMINAL_STATUS_CODES.has(gameState?.status?.code) || gameState?.result === "draw");

export const syncActionButtons = () => {
  const { state } = uiFeedbackDeps;
  const {
    authDisplayNameInput,
    authEmailInput,
    authPasswordInput,
    colorInputs,
    dashboardTimeControlButtons,
    difficultySelect,
    gatewayCreateButton,
    gatewayGuestButton,
    gatewaySignInButton,
    hallLogoutButton,
    hallRandomTimeControlButton,
    hintButton,
    hintWhyButton,
    hintWhyText,
    immersiveNewGameButton,
    immersiveOfferDrawButton,
    immersiveResignButton,
    loginButton,
    logoutButton,
    multiplayerCreateGameButton,
    multiplayerCreateRoomButton,
    multiplayerJoinGameButton,
    multiplayerLobbyButton,
    multiplayerRejoinGameButton,
    multiplayerRoomIdInput,
    newGameButton,
    offerDrawButton,
    registerButton,
    resignButton,
    saveGameButton,
    soloLobbyButton,
    timeControlSelect
  } = uiFeedbackDeps.dom;
  const { isAuthenticated, isRealtimeMultiplayerGame } = uiFeedbackDeps.callbacks;

  const realtimeMultiplayer = isRealtimeMultiplayerGame();
  const inProgress =
    Boolean(state.game?.hasStarted) && Boolean(state.game) && !state.game.isGameOver;
  const saveDisabled =
    state.busy ||
    !state.game ||
    !state.game.hasStarted ||
    !state.persistence.available ||
    state.game.isGameOver ||
    realtimeMultiplayer;

  newGameButton.disabled = state.busy;
  saveGameButton.disabled = saveDisabled;
  offerDrawButton.disabled = state.busy || !inProgress;
  resignButton.disabled = state.busy || !inProgress;
  difficultySelect.disabled = state.busy;
  if (timeControlSelect) {
    timeControlSelect.disabled = state.busy;
  }

  if (immersiveNewGameButton) {
    immersiveNewGameButton.disabled = newGameButton.disabled;
  }

  if (immersiveOfferDrawButton) {
    immersiveOfferDrawButton.disabled = offerDrawButton.disabled;
  }

  if (immersiveResignButton) {
    immersiveResignButton.disabled = resignButton.disabled;
  }

  colorInputs.forEach((input) => {
    input.disabled = state.busy;
  });

  const authDisabled = state.busy;

  if (authEmailInput) {
    authEmailInput.disabled = authDisabled;
  }

  if (authPasswordInput) {
    authPasswordInput.disabled = authDisabled;
  }

  if (authDisplayNameInput) {
    authDisplayNameInput.disabled = authDisabled;
  }

  if (loginButton) {
    loginButton.disabled = authDisabled;
  }

  if (registerButton) {
    registerButton.disabled = authDisabled;
  }

  if (logoutButton) {
    logoutButton.disabled = state.busy || !isAuthenticated();
  }

  if (hallLogoutButton) {
    hallLogoutButton.disabled = state.busy || !isAuthenticated();
  }

  if (hallRandomTimeControlButton) {
    hallRandomTimeControlButton.disabled = state.busy;
  }

  if (soloLobbyButton) {
    soloLobbyButton.disabled = state.busy;
  }

  if (multiplayerLobbyButton) {
    multiplayerLobbyButton.disabled = state.busy;
  }

  if (gatewaySignInButton) {
    gatewaySignInButton.disabled = state.busy || !state.persistence.available;
  }

  if (gatewayCreateButton) {
    gatewayCreateButton.disabled = state.busy || !state.persistence.available;
  }

  if (gatewayGuestButton) {
    gatewayGuestButton.disabled = state.busy;
  }

  dashboardTimeControlButtons.forEach((button) => {
    button.disabled = state.busy;
  });

  if (multiplayerCreateGameButton) {
    multiplayerCreateGameButton.disabled =
      state.busy ||
      !state.multiplayer.connected ||
      Boolean(state.multiplayer.roomId);
    multiplayerCreateGameButton.textContent = state.multiplayer.queued
      ? "Cancel Quick Play"
      : "Quick Play · Blitz 5";
  }

  if (multiplayerRejoinGameButton) {
    multiplayerRejoinGameButton.disabled =
      state.busy ||
      !state.multiplayer.connected ||
      !Boolean(state.multiplayer.roomId);
  }

  if (multiplayerCreateRoomButton) {
    multiplayerCreateRoomButton.disabled =
      state.busy ||
      !state.multiplayer.connected ||
      state.multiplayer.queued ||
      Boolean(state.multiplayer.roomId);
  }

  if (multiplayerJoinGameButton) {
    multiplayerJoinGameButton.disabled =
      state.busy ||
      !state.multiplayer.connected ||
      state.multiplayer.queued;
  }

  if (multiplayerRoomIdInput) {
    multiplayerRoomIdInput.disabled =
      state.busy ||
      !state.multiplayer.connected ||
      state.multiplayer.queued;
  }

  const canHint =
    !state.busy &&
    state.view === "game" &&
    Boolean(state.game?.hasStarted) &&
    !state.game?.isGameOver &&
    !realtimeMultiplayer &&
    !state.historyModalOpen &&
    state.game?.turn === state.game?.settings?.playerColor;

  if (hintButton) {
    hintButton.classList.toggle("hidden", realtimeMultiplayer);
    hintButton.disabled = !canHint;
  }

  if (hintWhyButton) {
    hintWhyButton.classList.toggle("hidden", realtimeMultiplayer);
    hintWhyButton.disabled =
      !canHint ||
      !state.hint.bestMove ||
      !Array.isArray(state.hint.continuation) ||
      !state.hint.continuation.length;
  }

  if (hintWhyText && realtimeMultiplayer) {
    hintWhyText.classList.add("hidden");
  }
};

export const setBusy = (busy, message) => {
  const { state } = uiFeedbackDeps;
  const { getIs3DMoveAnimating, setCoachMessage, syncBoard3D, renderBoardOverlays } = uiFeedbackDeps.callbacks;

  state.busy = busy;
  syncActionButtons();
  if (!getIs3DMoveAnimating()) {
    syncBoard3D();
  }
  renderBoardOverlays();

  if (message) {
    setCoachMessage(message);
  }
};

export const setApiHealth = (healthy) => {
  const { apiHealth } = uiFeedbackDeps.dom;

  apiHealth.textContent = healthy ? "Live" : "Offline";
  apiHealth.className = healthy ? "pill pill-ok" : "pill pill-error";
};

export const renderClockCard = ({
  labelElement,
  cardElement,
  sideElement,
  timeElement,
  metaElement,
  roleLabel,
  color,
  clockDisplayState,
  timeControl,
  gameState
}) => {
  const { formatClockMs, formatColor } = uiFeedbackDeps.helpers;
  const { getChosenColor } = uiFeedbackDeps.callbacks;

  if (!labelElement || !cardElement || !sideElement || !timeElement || !metaElement) {
    return;
  }

  const playerColor = gameState?.settings?.playerColor || getChosenColor();
  const isPlayerSide = color === playerColor;
  const rowElement = cardElement.closest(".board-player-row");
  const startingTimeLabel =
    timeControl.id === "untimed" ? "UNTIMED" : formatClockMs(timeControl.baseMs);

  labelElement.textContent = roleLabel;
  sideElement.textContent = `${formatColor(color)} pieces`;
  rowElement?.setAttribute("data-player-side", isPlayerSide ? "self" : "opponent");

  if (!clockDisplayState?.enabled) {
    timeElement.textContent = startingTimeLabel;
    metaElement.textContent = "";
    metaElement.classList.toggle("hidden", !metaElement.textContent);
    cardElement.dataset.active = "false";
    cardElement.dataset.urgent = "false";
    cardElement.dataset.untimed = timeControl.id === "untimed" ? "true" : "false";
    rowElement?.setAttribute("data-active", "false");
    return;
  }

  const remainingMs =
    color === "black" ? clockDisplayState.blackMs : clockDisplayState.whiteMs;
  const isActive =
    clockDisplayState.isRunning && clockDisplayState.activeColor === color && !gameState?.isGameOver;
  const isUrgent = remainingMs <= 30000;
  const flagged =
    gameState?.isGameOver &&
    (gameState?.status?.code === "timeout" ||
      gameState?.status?.code === "draw-timeout-insufficient-material") &&
    clockDisplayState.activeColor === color;

  sideElement.textContent = isActive
    ? `${formatColor(color)} to move`
    : `${formatColor(color)} pieces`;
  timeElement.textContent = formatClockMs(remainingMs);
  metaElement.textContent = flagged
    ? "Flag"
    : gameState?.isGameOver
      ? "Stopped"
      : "";
  metaElement.classList.toggle("hidden", !metaElement.textContent);
  cardElement.dataset.active = isActive ? "true" : "false";
  cardElement.dataset.urgent = isUrgent ? "true" : "false";
  cardElement.dataset.untimed = "false";
  rowElement?.setAttribute("data-active", isActive ? "true" : "false");
};

export const syncTimedGameState = async () => {
  const { state } = uiFeedbackDeps;
  const { applyGameState, request } = uiFeedbackDeps.callbacks;

  if (
    state.clockSyncInFlight ||
    state.busy ||
    !isTimedGameState(state.game) ||
    !state.game?.hasStarted ||
    state.game?.isGameOver
  ) {
    return;
  }

  state.clockSyncInFlight = true;

  try {
    const gameState = await request("/api/game");
    const sameMove =
      gameState?.lastMove?.san === state.game?.lastMove?.san &&
      gameState?.lastMove?.from === state.game?.lastMove?.from &&
      gameState?.lastMove?.to === state.game?.lastMove?.to;
    const preserveSelection =
      sameMove &&
      gameState?.turn === state.game?.turn &&
      !gameState?.isGameOver;

    setApiHealth(true);
    applyGameState(gameState, {
      preserveCoach: !gameState?.isGameOver,
      preserveSelection
    });
  } catch {
    setApiHealth(false);
  } finally {
    state.clockSyncInFlight = false;
  }
};

const isTimedGameState = (gameState = uiFeedbackDeps.state?.game) =>
  Boolean(gameState?.clockState?.enabled && gameState.clockState.timeControlId !== "untimed");

export const updateClockLoops = () => {
  const { runtimeState, state } = uiFeedbackDeps;
  const { renderClocks } = uiFeedbackDeps.callbacks;

  if (runtimeState.clockDisplayIntervalId) {
    window.clearInterval(runtimeState.clockDisplayIntervalId);
    runtimeState.clockDisplayIntervalId = null;
  }

  if (runtimeState.clockSyncIntervalId) {
    window.clearInterval(runtimeState.clockSyncIntervalId);
    runtimeState.clockSyncIntervalId = null;
  }

  renderClocks();

  if (!isTimedGameState(state.game) || !state.game?.hasStarted || state.game?.isGameOver) {
    return;
  }

  runtimeState.clockDisplayIntervalId = window.setInterval(renderClocks, CLOCK_TICK_INTERVAL_MS);
  runtimeState.clockSyncIntervalId = window.setInterval(syncTimedGameState, CLOCK_SYNC_INTERVAL_MS);
};

export const setRecordView = (view) => {
  const { state, dom } = uiFeedbackDeps;
  const { persistRecordView } = uiFeedbackDeps.callbacks;

  const normalizedView = VALID_RECORD_VIEWS.has(view) ? view : "moves";
  state.activeRecordView = normalizedView;
  persistRecordView(normalizedView);

  dom.recordTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.recordView === normalizedView);
  });

  dom.recordViews.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== normalizedView);
  });
};

export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const updateEvalBar = () => {
  const { state } = uiFeedbackDeps;
  const { evalBarBlack, evalBarWhite } = uiFeedbackDeps.dom;

  if (!evalBarBlack || !evalBarWhite) {
    return;
  }
  const board = state.game?.board;
  if (!board) {
    return;
  }

  let white = 0;
  let black = 0;
  board.forEach((sq) => {
    if (!sq.piece) {
      return;
    }
    const value = PIECE_VALUES[sq.piece.type] || 0;
    if (sq.piece.color === "white") {
      white += value;
    } else {
      black += value;
    }
  });

  const diff = Math.max(-10, Math.min(10, white - black));
  const whitePct = Math.round(((diff + 10) / 20) * 100);
  const blackPct = 100 - whitePct;

  evalBarBlack.style.flex = blackPct;
  evalBarWhite.style.flex = whitePct;
};

export const updateSummary = () => {
  const { state } = uiFeedbackDeps;
  const { formatColor } = uiFeedbackDeps.helpers;
  const { engineSide, lastMoveText, playerSide, statusText, turnIndicator } = uiFeedbackDeps.dom;

  if (!state.game) {
    renderImmersiveHud();
    return;
  }

  statusText.textContent =
    getDrawClaimState(state.game)?.message || state.game.status.message;
  if (playerSide && engineSide && turnIndicator && lastMoveText) {
    playerSide.textContent =
      state.game.settings.playerColor === "white" ? "White" : "Black";
    engineSide.textContent =
      state.game.settings.engineColor === "white" ? "White" : "Black";
    turnIndicator.textContent = state.game.turn ? formatColor(state.game.turn) : "-";
    lastMoveText.textContent = state.game.lastMove?.san || "None";
  }
  renderImmersiveHud();
};

export const renderImmersiveHud = () => {
  const { state } = uiFeedbackDeps;
  const { formatColor, trimTerminalPeriod } = uiFeedbackDeps.helpers;
  const { getLocalPlayerDisplayName } = uiFeedbackDeps.callbacks;
  const { immersiveStatusHeading, immersiveStatusMeta } = uiFeedbackDeps.dom;

  if (!immersiveStatusHeading || !immersiveStatusMeta) {
    return;
  }

  if (!state.game) {
    immersiveStatusHeading.textContent = "Preparing immersive board...";
    immersiveStatusMeta.textContent = "The duel summary will appear here.";
    return;
  }

  const playerName = getLocalPlayerDisplayName();
  const turnLabel = state.game.turn ? formatColor(state.game.turn) : "-";
  const lastMoveLabel = state.game.lastMove?.san || "None";
  const gameOverCopy = getGameOverCopy(state.game);
  const _statusMessage = trimTerminalPeriod(state.game.status?.message) || "Awaiting duel";
  void _statusMessage;

  if (state.pendingNewGame) {
    immersiveStatusHeading.textContent = "Forging a new duel...";
    immersiveStatusMeta.textContent = "Clearing the last result and preparing a fresh board.";
    return;
  }

  if (!state.game.hasStarted) {
    immersiveStatusHeading.textContent = "Immersive board is ready.";
    immersiveStatusMeta.textContent =
      "Use Return to 2D whenever you want the full setup and archive dashboard.";
    return;
  }

  if (gameOverCopy) {
    immersiveStatusHeading.textContent = gameOverCopy.message;
    immersiveStatusMeta.textContent = `${playerName} vs Stockfish`;
    return;
  }

  immersiveStatusHeading.textContent = `${turnLabel} to move · Last: ${lastMoveLabel}`;
  immersiveStatusMeta.textContent = `${playerName} vs Stockfish`;
};

export const render = () => {
  const { state } = uiFeedbackDeps;
  const {
    renderAuthMode,
    renderBoardSurface,
    renderClocks,
    renderCoachPanel,
    renderGuestProfile,
    renderHintPanel,
    renderHistory,
    renderMoveList,
    renderSavedGames,
    renderSessionUi,
    renderView
  } = uiFeedbackDeps.callbacks;

  renderGuestProfile();
  renderSessionUi();
  renderView();
  renderAuthMode();
  if (state.view === "game") {
    renderBoardSurface();
  }
  renderClocks();
  renderMoveList();
  renderSavedGames();
  renderHistory();
  renderCoachPanel();
  renderHintPanel();
  updateSummary();
  setRecordView(state.activeRecordView);
  syncActionButtons();
  updateClockLoops();
};

export const syncControls = () => {
  const { state } = uiFeedbackDeps;
  const { difficultySelect, timeControlSelect } = uiFeedbackDeps.dom;
  const { getSelectedTimeControlId } = uiFeedbackDeps.callbacks;

  if (!state.game) {
    if (timeControlSelect) {
      timeControlSelect.value = getSelectedTimeControlId();
    }
    return;
  }

  difficultySelect.value = state.game.settings.difficulty;
  if (timeControlSelect) {
    const gameTimeId = state.game.settings.timeControl?.id;
    if (
      timeControlSelect &&
      gameTimeId &&
      document.activeElement !== timeControlSelect &&
      timeControlSelect.dataset.userChanged !== "true"
    ) {
      timeControlSelect.value = gameTimeId;
    }
  }
  document
    .querySelectorAll('input[name="player-color"]')
    .forEach((input) => (input.checked = input.value === state.game.settings.playerColor));
};

export const clearGameOverBannerTimer = () => {
  const { runtimeState } = uiFeedbackDeps;

  if (!runtimeState.gameOverBannerTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.gameOverBannerTimeoutId);
  runtimeState.gameOverBannerTimeoutId = null;
};

export const resetGameOverBannerLifecycle = () => {
  const { runtimeState } = uiFeedbackDeps;

  clearGameOverBannerTimer();
  runtimeState.activeGameOverBannerKey = "";
  runtimeState.dismissedGameOverBannerKey = "";
};

export const getGameOverBannerKey = (gameState) => {
  const gameOverCopy = getGameOverCopy(gameState);

  if (!gameOverCopy) {
    return "";
  }

  return JSON.stringify({
    gameId: gameState?.id || null,
    result: gameState?.result || null,
    statusCode: gameState?.status?.code || null,
    message: gameOverCopy.message
  });
};

export const scheduleGameOverBannerDismissal = (bannerKey) => {
  const { runtimeState } = uiFeedbackDeps;

  clearGameOverBannerTimer();
  runtimeState.gameOverBannerTimeoutId = window.setTimeout(() => {
    if (runtimeState.activeGameOverBannerKey !== bannerKey) {
      return;
    }

    runtimeState.dismissedGameOverBannerKey = bannerKey;
    runtimeState.activeGameOverBannerKey = "";
    hideGameOverBanner({
      resetCopy: true
    });
  }, GAME_OVER_BANNER_DURATION_MS);
};

export const hideGameOverBanner = ({ resetCopy = false } = {}) => {
  const { gameOverBanner, gameOverMessage, gameOverTitle } = uiFeedbackDeps.dom;

  gameOverBanner.classList.add("hidden");
  gameOverBanner.setAttribute("aria-hidden", "true");

  if (resetCopy) {
    gameOverTitle.textContent = "Game Over";
    gameOverMessage.textContent = "Result pending.";
  }
};

export const clearFinishedGameResetTimer = () => {
  const { runtimeState } = uiFeedbackDeps;

  if (!runtimeState.finishedGameResetTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.finishedGameResetTimeoutId);
  runtimeState.finishedGameResetTimeoutId = null;
};

export const clearBoardFeedbackTimer = () => {
  const { runtimeState } = uiFeedbackDeps;

  if (!runtimeState.boardFeedbackTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.boardFeedbackTimeoutId);
  runtimeState.boardFeedbackTimeoutId = null;
};

export const scheduleBoardFeedbackDismissal = (feedbackKey, durationMs = 1000) => {
  const { runtimeState } = uiFeedbackDeps;

  clearBoardFeedbackTimer();
  runtimeState.boardFeedbackTimeoutId = window.setTimeout(() => {
    if (runtimeState.activeBoardFeedbackKey !== feedbackKey) {
      return;
    }

    runtimeState.dismissedBoardFeedbackKey = feedbackKey;
    runtimeState.activeBoardFeedbackKey = "";
    hideBoardFeedback();
  }, durationMs);
};

export const resetFinishedGameResetLifecycle = () => {
  const { runtimeState } = uiFeedbackDeps;

  clearFinishedGameResetTimer();
  runtimeState.activeFinishedGameResetKey = "";
};

export const clearCompletedLiveBoard = async (gameOverKey) => {
  const { state, runtimeState } = uiFeedbackDeps;
  const { applyGameState, request, setCoachMessage } = uiFeedbackDeps.callbacks;

  if (
    state.pendingNewGame ||
    !state.game?.isGameOver ||
    getGameOverBannerKey(state.game) !== gameOverKey
  ) {
    return;
  }

  try {
    const gameState = await request("/api/game/reset", {
      method: "POST"
    });

    if (
      state.pendingNewGame ||
      !state.game?.isGameOver ||
      getGameOverBannerKey(state.game) !== gameOverKey
    ) {
      return;
    }

    applyGameState(gameState, {
      coachContext: "idle"
    });
  } catch (error) {
    if (
      state.pendingNewGame ||
      !state.game?.isGameOver ||
      getGameOverBannerKey(state.game) !== gameOverKey
    ) {
      return;
    }

    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    if (runtimeState.activeFinishedGameResetKey === gameOverKey && state.game?.isGameOver) {
      runtimeState.activeFinishedGameResetKey = "";
    }
  }
};

export const scheduleFinishedGameReset = (gameState) => {
  const { state, runtimeState } = uiFeedbackDeps;
  const gameOverKey = getGameOverBannerKey(gameState);

  if (!gameOverKey || state.pendingNewGame) {
    resetFinishedGameResetLifecycle();
    return;
  }

  if (runtimeState.activeFinishedGameResetKey === gameOverKey) {
    return;
  }

  clearFinishedGameResetTimer();
  runtimeState.activeFinishedGameResetKey = gameOverKey;
  runtimeState.finishedGameResetTimeoutId = window.setTimeout(() => {
    runtimeState.finishedGameResetTimeoutId = null;
    void clearCompletedLiveBoard(gameOverKey);
  }, GAME_OVER_BANNER_DURATION_MS + 80);
};

export const hideBoardFeedback = () => {
  const {
    boardFeedbackBanner,
    claimDrawButton,
    continuePlayButton
  } = uiFeedbackDeps.dom;

  if (!boardFeedbackBanner) {
    return;
  }

  boardFeedbackBanner.classList.add("hidden");
  boardFeedbackBanner.setAttribute("aria-hidden", "true");
  boardFeedbackBanner.dataset.tone = "neutral";
  claimDrawButton?.classList.add("hidden");
  continuePlayButton?.classList.add("hidden");
};

export const renderBoardFeedback = () => {
  const { state, runtimeState } = uiFeedbackDeps;
  const {
    boardFeedbackBanner,
    boardFeedbackMessage,
    boardFeedbackTitle,
    claimDrawButton,
    continuePlayButton
  } = uiFeedbackDeps.dom;
  const { trimTerminalPeriod } = uiFeedbackDeps.helpers;

  if (!boardFeedbackBanner) {
    return;
  }

  const drawClaim = getDrawClaimState(state.game);
  const isClaimBlockingEngine =
    Boolean(drawClaim?.available) &&
    state.game?.turn === state.game?.settings?.engineColor;

  if (
    state.boardViewMode !== "2d" ||
    !state.game?.hasStarted ||
    state.game?.isGameOver ||
    state.pendingPromotion?.moveChoices?.length
  ) {
    clearBoardFeedbackTimer();
    runtimeState.activeBoardFeedbackKey = "";
    hideBoardFeedback();
    return;
  }

  if (drawClaim?.available) {
    clearBoardFeedbackTimer();
    runtimeState.activeBoardFeedbackKey = "";
    boardFeedbackBanner.classList.remove("hidden");
    boardFeedbackBanner.setAttribute("aria-hidden", "false");
    boardFeedbackBanner.dataset.tone = "draw";
    boardFeedbackTitle.textContent = "Draw Claim Available";
    boardFeedbackMessage.textContent = drawClaim.message;
    claimDrawButton?.classList.remove("hidden");
    continuePlayButton?.classList.toggle("hidden", !isClaimBlockingEngine);
    claimDrawButton.disabled = state.busy;
    continuePlayButton.disabled = state.busy;
    return;
  }

  if (state.game?.status?.code === "check") {
    const checkFeedbackKey = `check:${state.game?.fen || ""}`;

    if (runtimeState.dismissedBoardFeedbackKey === checkFeedbackKey) {
      hideBoardFeedback();
      return;
    }

    boardFeedbackBanner.classList.remove("hidden");
    boardFeedbackBanner.setAttribute("aria-hidden", "false");
    boardFeedbackBanner.dataset.tone = "warning";
    boardFeedbackTitle.textContent = "Check";
    boardFeedbackMessage.textContent =
      trimTerminalPeriod(state.game.status.message) || "The king is under attack.";
    claimDrawButton?.classList.add("hidden");
    continuePlayButton?.classList.add("hidden");

    if (runtimeState.activeBoardFeedbackKey !== checkFeedbackKey) {
      runtimeState.activeBoardFeedbackKey = checkFeedbackKey;
      scheduleBoardFeedbackDismissal(checkFeedbackKey, 1000);
    }

    return;
  }

  clearBoardFeedbackTimer();
  runtimeState.activeBoardFeedbackKey = "";

  hideBoardFeedback();
};

export const getCinematicResultLabel = (gameState) => {
  const code = gameState?.status?.code;
  if (code === "checkmate") {
    return "CHECKMATE";
  }
  if (code === "resignation") {
    return "RESIGNED";
  }
  if (code === "timeout") {
    return "TIMEOUT";
  }
  if (code === "stalemate") {
    return "STALEMATE";
  }
  if (gameState?.result === "draw") {
    return "DRAW";
  }
  return "GAME OVER";
};

export const getCinematicSubtitle = (gameState) => {
  if (gameState?.result === "draw") {
    return "The duel ends in a draw";
  }
  const winner = getWinnerFromResult(gameState?.result);
  return winner ? `${winner} wins the duel` : "";
};

export const dismissGameEndOverlay = () => {
  const { runtimeState } = uiFeedbackDeps;

  const overlay = document.getElementById("game-end-overlay");
  if (!overlay) {
    return;
  }
  overlay.classList.remove("gec-visible");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  setTimeout(() => {
    overlay.innerHTML = "";
  }, 500);
  runtimeState.gameEndCinematicShownForKey = "";
};

export const showGameEndOverlay = (gameState) => {
  const { state } = uiFeedbackDeps;
  const { escapeHtml } = uiFeedbackDeps.helpers;
  const {
    clearHintState,
    clearPromotionPrompt,
    clearSelectedSquare,
    getArcaneBoard3D,
    leaveCompletedMultiplayerGameIfNeeded,
    renderView,
    resetBoardViewTo2D,
    startNewGame
  } = uiFeedbackDeps.callbacks;

  const overlay = document.getElementById("game-end-overlay");
  if (!overlay) {
    return;
  }

  overlay.innerHTML = "";

  const resultLabel = getCinematicResultLabel(gameState);
  const subtitle = getCinematicSubtitle(gameState);

  let particlesHtml = "";
  for (let i = 0; i < 24; i++) {
    const leftPct = (8 + Math.random() * 84).toFixed(1);
    const tx = ((Math.random() * 200) - 100).toFixed(1);
    const ty = (70 + Math.random() * 150).toFixed(1);
    const delay = (Math.random() * 0.9).toFixed(2);
    const duration = (1.4 + Math.random() * 0.9).toFixed(2);
    particlesHtml += `<div class="gec-particle" style="left:${leftPct}%;--tx:${tx}px;--ty:${ty}px;animation-delay:${delay}s;animation-duration:${duration}s"></div>`;
  }

  overlay.innerHTML = `
    <div class="gec-particles" aria-hidden="true">${particlesHtml}</div>
    <div class="gec-seal" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="68" height="68" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,4 61,35 95,35 67,57 77,88 50,68 23,88 33,57 5,35 39,35"
                 fill="none" stroke="#c9a84c" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="50" cy="50" r="21" fill="none" stroke="#c9a84c" stroke-width="1.2" opacity="0.45"/>
      </svg>
    </div>
    <div class="gec-result">${escapeHtml(resultLabel)}</div>
    ${subtitle ? `<div class="gec-subtitle">${escapeHtml(subtitle)}</div>` : ""}
    <div class="gec-actions">
      <button type="button" class="gec-btn gec-btn-primary"  id="gec-rematch-btn">Rematch</button>
      <button type="button" class="gec-btn gec-btn-secondary" id="gec-hall-btn">Back to Hall</button>
    </div>
  `;

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.offsetHeight;
  overlay.classList.add("gec-visible");

  const rematchBtn = overlay.querySelector("#gec-rematch-btn");
  const hallBtn = overlay.querySelector("#gec-hall-btn");

  rematchBtn?.addEventListener("click", () => {
    dismissGameEndOverlay();
    getArcaneBoard3D()?.clearGameEndCurtain?.();
    startNewGame();
  });

  hallBtn?.addEventListener("click", () => {
    dismissGameEndOverlay();
    getArcaneBoard3D()?.clearGameEndCurtain?.();
    leaveCompletedMultiplayerGameIfNeeded();
    clearSelectedSquare();
    clearHintState();
    clearPromotionPrompt();
    hideBoardFeedback();
    resetBoardViewTo2D();
    state.view = "hall";
    renderView();
  });
};

export const triggerGameEndCinematic = (gameState) => {
  const { state, runtimeState } = uiFeedbackDeps;
  const { getArcaneBoard3D } = uiFeedbackDeps.callbacks;

  const key = getGameOverBannerKey(gameState);
  if (!key || runtimeState.gameEndCinematicShownForKey === key) {
    return;
  }
  runtimeState.gameEndCinematicShownForKey = key;

  const board3D = getArcaneBoard3D();
  if (state.boardViewMode === "3d" && board3D?.showGameEndCurtain) {
    board3D.showGameEndCurtain(() => showGameEndOverlay(gameState));
  } else {
    setTimeout(() => showGameEndOverlay(gameState), 120);
  }
};