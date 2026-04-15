import {
  COACH_STAGE_ENGINE_FEEDBACK,
  COACH_STAGE_GAME_OVER,
  COACH_STAGE_PLAYER_FEEDBACK
} from "./constants.js";
import { normalizeChronicleWhyLines, formatColor } from "./formatting.js";

let gameLifecycleDeps = {
  state: null,
  runtimeState: null,
  dom: {
    difficultySelect: null,
    statusText: null
  },
  api: {
    request: async () => ({}),
    loadHistory: async () => ({ items: [] }),
    loadSavedGames: async () => ({ items: [] }),
    loadSession: async () => ({}),
    readStoredGuest: () => null,
    getSavedView: () => null
  },
  callbacks: {
    applyHintHighlights: () => {},
    applyMultiplayerSocketState: () => {},
    applyWizardStateFromGameState: () => {},
    buildCoachFeedbackState: () => ({}),
    clearHintState: () => {},
    clearPromotionPrompt: () => {},
    clearSelectedSquare: () => {},
    createCoachState: () => ({}),
    dismissGameEndOverlay: () => {},
    emitMultiplayerEvent: async () => ({}),
    getBoardRenderFailureReason: () => null,
    getDefaultCoachState: () => ({}),
    getDrawClaimState: () => null,
    getGameOverCoachState: () => ({}),
    getGameOverCopy: () => null,
    getSelectedTimeControlId: () => "untimed",
    hideGameOverBanner: () => {},
    isRealtimeMultiplayerGame: () => false,
    leaveMultiplayerRoom: () => {},
    render: () => {},
    renderCoachPanel: () => {},
    renderGuestProfile: () => {},
    renderHintPanel: () => {},
    renderHistory: () => {},
    renderMoveList: () => {},
    renderSavedGames: () => {},
    renderSessionUi: () => {},
    renderView: () => {},
    resetFinishedGameResetLifecycle: () => {},
    resetGameOverBannerLifecycle: () => {},
    scheduleFinishedGameReset: () => {},
    setApiHealth: () => {},
    setCoachMessage: () => {},
    setCoachStageRankExternal: null,
    setPersistence: () => {},
    setRecordView: () => {},
    setSessionState: () => {},
    setWizardIdleState: () => {},
    setWizardThinkingState: () => {},
    startNewGameExternal: null,
    switchTo3D: async () => {},
    syncActionButtons: () => {},
    syncBoardViewUi: () => {},
    syncControls: () => {},
    triggerGameEndCinematic: () => {},
    waitForBoardContainerReady: async () => null,
    getArcaneBoard3D: () => null,
    getChosenColor: () => "white"
  }
};

export const configureGameLifecycleDependencies = (deps = {}) => {
  gameLifecycleDeps = {
    ...gameLifecycleDeps,
    ...deps,
    dom: {
      ...gameLifecycleDeps.dom,
      ...(deps.dom || {})
    },
    api: {
      ...gameLifecycleDeps.api,
      ...(deps.api || {})
    },
    callbacks: {
      ...gameLifecycleDeps.callbacks,
      ...(deps.callbacks || {})
    }
  };
};

export const isHumanBlunderFeedback = (coachFeedback = {}) => {
  const classification = String(coachFeedback.classification || "").trim().toLowerCase();
  const motionState = String(coachFeedback.motionState || "").trim().toLowerCase();
  const advisoryCopy = `${coachFeedback.threatSummary || ""} ${coachFeedback.message || ""}`
    .trim()
    .toLowerCase();

  return (
    coachFeedback.source === "player" &&
    (
      Number(coachFeedback.evalDrop) > 1.5 ||
      ["blunder", "miss"].includes(classification) ||
      motionState === "blunder" ||
      advisoryCopy.includes("hanging")
    )
  );
};

export const beginMoveCycle = () => {
  gameLifecycleDeps.state.activeMoveCycleId += 1;
  gameLifecycleDeps.state.activeCoachStageRank = 0;
  return gameLifecycleDeps.state.activeMoveCycleId;
};

export const isMoveCycleActive = (cycleId) => cycleId === gameLifecycleDeps.state.activeMoveCycleId;

export const canApplyCoachStage = (cycleId, stageRank) =>
  isMoveCycleActive(cycleId) && stageRank >= gameLifecycleDeps.state.activeCoachStageRank;

export const setCoachStageRank = (stageRank) => {
  gameLifecycleDeps.state.activeCoachStageRank = stageRank;
};

export const cloneValue = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

export const PIECE_LABELS = {
  p: "pawn",
  r: "rook",
  n: "knight",
  b: "bishop",
  q: "queen",
  k: "king"
};

export const COACH_CLASSIFICATION_SET = new Set([
  "blunder",
  "miss",
  "mistake",
  "inaccuracy",
  "good",
  "excellent",
  "best",
  "great",
  "brilliant"
]);

export const CHRONICLE_BADGE_SYMBOLS = {
  blunder: "??",
  miss: "?!",
  mistake: "?",
  inaccuracy: "!",
  good: "!",
  excellent: "!!",
  best: "★",
  great: "!!",
  brilliant: "★!"
};

export const getPlyIndexForTurnColor = (turn, color) => {
  const normalizedTurn = Number(turn);

  if (!Number.isFinite(normalizedTurn) || normalizedTurn < 1) {
    return null;
  }

  return (normalizedTurn - 1) * 2 + (color === "black" ? 1 : 0);
};

export const getPlyColor = (plyIndex) => (plyIndex % 2 === 0 ? "white" : "black");

export const isLocalPlayerPly = (plyIndex, gameState = gameLifecycleDeps.state.game) => {
  if (!Number.isInteger(plyIndex) || plyIndex < 0) {
    return false;
  }

  const localPlayerColor = gameState?.settings?.playerColor;

  if (localPlayerColor !== "white" && localPlayerColor !== "black") {
    return false;
  }

  return getPlyColor(plyIndex) === localPlayerColor;
};

export const getLastPlyIndexFromMoveList = (moveList = []) => {
  if (!Array.isArray(moveList) || !moveList.length) {
    return null;
  }

  const lastTurn = moveList.at(-1);

  if (!lastTurn) {
    return null;
  }

  if (lastTurn.black) {
    return getPlyIndexForTurnColor(lastTurn.turn, "black");
  }

  if (lastTurn.white) {
    return getPlyIndexForTurnColor(lastTurn.turn, "white");
  }

  return null;
};

export const resetLiveChronicleState = (gameId = null) => {
  gameLifecycleDeps.state.liveChronicle = {
    gameId,
    ratingsByPly: {},
    expandedWhyPly: null
  };
};

export const ensureLiveChronicleForGame = (gameState = {}) => {
  const nextGameId = gameState?.id || null;

  if (!nextGameId) {
    resetLiveChronicleState();
    return;
  }

  if (gameLifecycleDeps.state.liveChronicle.gameId !== nextGameId) {
    resetLiveChronicleState(nextGameId);
  }
};

export const sanitizeLiveChronicleRatingsForLocalPlayer = (gameState = gameLifecycleDeps.state.game) => {
  const entries = Object.entries(gameLifecycleDeps.state.liveChronicle.ratingsByPly || {});

  entries.forEach(([plyKey]) => {
    const plyIndex = Number.parseInt(plyKey, 10);

    if (!isLocalPlayerPly(plyIndex, gameState)) {
      delete gameLifecycleDeps.state.liveChronicle.ratingsByPly[plyKey];
      if (gameLifecycleDeps.state.liveChronicle.expandedWhyPly === plyIndex) {
        gameLifecycleDeps.state.liveChronicle.expandedWhyPly = null;
      }
    }
  });
};

export const applyChronicleMoveMetadata = (gameState) => {
  if (!gameState) {
    return gameState;
  }

  sanitizeLiveChronicleRatingsForLocalPlayer(gameState);

  const moveList = Array.isArray(gameState.moveList) ? gameState.moveList : [];
  const enrichedMoveList = moveList.map((move) => {
    const nextMove = { ...move };
    const whitePly = getPlyIndexForTurnColor(move.turn, "white");
    const blackPly = getPlyIndexForTurnColor(move.turn, "black");
    const whiteMeta = whitePly !== null ? gameLifecycleDeps.state.liveChronicle.ratingsByPly[whitePly] : null;
    const blackMeta = blackPly !== null ? gameLifecycleDeps.state.liveChronicle.ratingsByPly[blackPly] : null;

    if (whiteMeta && isLocalPlayerPly(whitePly, gameState)) {
      nextMove.whiteRating = whiteMeta.classification;
      nextMove.whiteWhyLines = whiteMeta.whyLines;
      nextMove.whiteWhyFen = whiteMeta.beforeFen || "";
    }

    if (blackMeta && isLocalPlayerPly(blackPly, gameState)) {
      nextMove.blackRating = blackMeta.classification;
      nextMove.blackWhyLines = blackMeta.whyLines;
      nextMove.blackWhyFen = blackMeta.beforeFen || "";
    }

    return nextMove;
  });

  return {
    ...gameState,
    moveList: enrichedMoveList
  };
};

export const upsertLocalMoveChronicleRating = (plyIndex, coachFeedback = {}) => {
  if (!Number.isInteger(plyIndex) || plyIndex < 0 || !gameLifecycleDeps.state.game?.settings?.playerColor) {
    return;
  }

  if (!isLocalPlayerPly(plyIndex, gameLifecycleDeps.state.game)) {
    return;
  }

  const classification = String(coachFeedback.classification || "").toLowerCase();

  if (!COACH_CLASSIFICATION_SET.has(classification)) {
    return;
  }

  const whyLines = normalizeChronicleWhyLines(coachFeedback.whyLines);

  gameLifecycleDeps.state.liveChronicle.ratingsByPly[plyIndex] = {
    classification,
    whyLines,
    beforeFen:
      typeof coachFeedback.beforeFen === "string" ? coachFeedback.beforeFen : ""
  };

  if (!whyLines.length && gameLifecycleDeps.state.liveChronicle.expandedWhyPly === plyIndex) {
    gameLifecycleDeps.state.liveChronicle.expandedWhyPly = null;
  }
};

export const appendMoveToList = (moveList = [], san, color) => {
  const nextMoveList = moveList.map((entry) => ({ ...entry }));

  if (color === "white") {
    nextMoveList.push({
      turn: nextMoveList.length + 1,
      white: san,
      black: null
    });
    return nextMoveList;
  }

  if (nextMoveList.length && !nextMoveList.at(-1).black) {
    nextMoveList[nextMoveList.length - 1] = {
      ...nextMoveList.at(-1),
      black: san
    };
    return nextMoveList;
  }

  nextMoveList.push({
    turn: nextMoveList.length + 1,
    white: null,
    black: san
  });

  return nextMoveList;
};

export const moveBoardPiece = (board = [], move, movingColor) => {
  const nextBoard = board.map((entry) => ({
    ...entry,
    piece: entry.piece ? { ...entry.piece } : null
  }));
  const fromSquare = nextBoard.find((entry) => entry.square === move.from);
  const toSquare = nextBoard.find((entry) => entry.square === move.to);
  const movingPiece = fromSquare?.piece ? { ...fromSquare.piece } : null;

  if (!fromSquare || !toSquare || !movingPiece) {
    return board;
  }

  fromSquare.piece = null;

  if (move.flags?.includes("e")) {
    const capturedRank =
      Number(move.to[1]) + (movingColor === "white" ? -1 : 1);
    const capturedSquare = nextBoard.find(
      (entry) => entry.square === `${move.to[0]}${capturedRank}`
    );

    if (capturedSquare) {
      capturedSquare.piece = null;
    }
  }

  if (move.flags?.includes("k") || move.flags?.includes("q")) {
    const rank = move.from[1];
    const rookFrom = move.flags.includes("k") ? `h${rank}` : `a${rank}`;
    const rookTo = move.flags.includes("k") ? `f${rank}` : `d${rank}`;
    const rookFromSquare = nextBoard.find((entry) => entry.square === rookFrom);
    const rookToSquare = nextBoard.find((entry) => entry.square === rookTo);

    if (rookFromSquare?.piece && rookToSquare) {
      rookToSquare.piece = { ...rookFromSquare.piece };
      rookFromSquare.piece = null;
    }
  }

  toSquare.piece = {
    ...movingPiece,
    type: move.promotion || movingPiece.type
  };

  return nextBoard;
};

export const buildOptimisticGameState = (gameState, move) => {
  const nextState = cloneValue(gameState);
  const playerColor = gameState.turn;

  nextState.board = moveBoardPiece(gameState.board, move, playerColor);
  nextState.moveList = appendMoveToList(gameState.moveList, move.san, playerColor);
  nextState.lastMove = {
    from: move.from,
    to: move.to,
    san: move.san,
    color: playerColor,
    piece: move.piece,
    captured: move.captured || null,
    promotion: move.promotion || null
  };
  nextState.turn = gameState.settings.engineColor;
  nextState.legalMoves = {};
  nextState.status = {
    code: "engine-pending",
    message: `${formatColor(gameState.settings.engineColor)} to move.`
  };
  nextState.isCheck = false;
  nextState.coachFeedback = null;

  return nextState;
};

const isActiveGameState = (gameState) =>
  Boolean(gameState?.id && gameState?.hasStarted && !gameState?.isGameOver);

export const setCoachStateForGame = (gameState, options = {}) => {
  const gameOverCopy = gameLifecycleDeps.callbacks.getGameOverCopy(gameState);

  if (options.preserveCoach) {
    return;
  }

  if (options.coachState) {
    gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.createCoachState(options.coachState);
    return;
  }

  if (gameState.coachFeedback) {
    gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.buildCoachFeedbackState(gameState.coachFeedback);
    return;
  }

  if (gameOverCopy) {
    gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.getGameOverCoachState(gameState);
    return;
  }

  if (options.feedbackMessage) {
    gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.createCoachState({
      message: options.feedbackMessage,
      explanation:
        options.feedbackExplanation ||
        "Arcane Coach will resume move grading after your next completed move."
    });
    return;
  }

  gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.getDefaultCoachState(gameState, options.coachContext);
};

export const applyGameState = (gameState, options = {}) => {
  const { state } = gameLifecycleDeps;

  console.log("Applying Game State:", gameState);
  state.pendingNewGame = false;
  ensureLiveChronicleForGame(gameState);
  state.game = applyChronicleMoveMetadata(gameState);
  if (gameLifecycleDeps.callbacks.isTerminalGameState(gameState)) {
    gameLifecycleDeps.callbacks.scheduleFinishedGameReset(gameState);
  } else {
    gameLifecycleDeps.callbacks.resetGameOverBannerLifecycle();
    gameLifecycleDeps.callbacks.resetFinishedGameResetLifecycle();
  }
  if (!options.preserveSelection) {
    gameLifecycleDeps.callbacks.clearSelectedSquare();
  }
  gameLifecycleDeps.callbacks.hideGameOverBanner({
    resetCopy: true
  });
  gameLifecycleDeps.callbacks.syncControls();
  gameLifecycleDeps.callbacks.setPersistence(gameState.persistence);
  if (!options.preserveHint) {
    gameLifecycleDeps.callbacks.clearHintState();
  }
  setCoachStateForGame(gameState, options);
  gameLifecycleDeps.callbacks.applyWizardStateFromGameState(gameState, {
    source: options.wizardSource
  });
  if (gameLifecycleDeps.callbacks.isTerminalGameState(gameState)) {
    gameLifecycleDeps.callbacks.triggerGameEndCinematic(gameState);
  }
  if (!options.skipRender) {
    gameLifecycleDeps.callbacks.render();
  }
};

export const loadGame = async ({ applyState = true, coachContext = "load-active" } = {}) => {
  beginMoveCycle();
  const gameState = await gameLifecycleDeps.api.request("/api/game");

  if (!applyState) {
    return gameState;
  }

  if (!isActiveGameState(gameState)) {
    return gameState;
  }

  applyGameState(gameState, {
    coachContext: gameState.hasStarted ? coachContext : "idle"
  });

  return gameState;
};

export const enterGameView = async ({ coachContext = "load-active", fallbackView = "hall" } = {}) => {
  const { state } = gameLifecycleDeps;

  console.log("Entering game view -> restoring/initializing game");
  const gameState = await loadGame({ applyState: false, coachContext });
  const activeGameIdOrState = isActiveGameState(gameState)
    ? gameState
    : isActiveGameState(state.game)
      ? state.game
      : null;
  console.log("Active game found:", !!activeGameIdOrState);

  if (!isActiveGameState(gameState)) {
    state.game = null;
    gameLifecycleDeps.callbacks.clearSelectedSquare();
    state.view = fallbackView;
    gameLifecycleDeps.callbacks.renderView();
    return false;
  }

  state.view = "game";
  gameLifecycleDeps.callbacks.renderView();
  await gameLifecycleDeps.callbacks.launchSelectedBoard({
    trigger: coachContext === "resume" ? "Resume Game" : "Enter Game"
  });
  applyGameState(gameState, {
    coachContext
  });

  return true;
};

export const refreshCollections = async () => {
  const { state } = gameLifecycleDeps;
  const [savedGamesPayload, historyPayload] = await Promise.all([
    gameLifecycleDeps.api.loadSavedGames(),
    gameLifecycleDeps.api.loadHistory()
  ]);

  state.savedGames = savedGamesPayload.items || [];
  state.history = historyPayload.items || [];
  gameLifecycleDeps.callbacks.setPersistence(
    historyPayload.persistence || savedGamesPayload.persistence || state.persistence
  );
  gameLifecycleDeps.callbacks.renderSavedGames();
  gameLifecycleDeps.callbacks.renderHistory();
};

export const startNewGame = async () => {
  const { state } = gameLifecycleDeps;

  console.log("Start Duel clicked");

  if (state.pendingNewGame || state.busy) {
    return;
  }

  state.pendingNewGame = true;

  if (gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
    gameLifecycleDeps.callbacks.leaveMultiplayerRoom();
  }

  gameLifecycleDeps.callbacks.dismissGameEndOverlay();
  gameLifecycleDeps.callbacks.getArcaneBoard3D()?.clearGameEndCurtain?.();

  beginMoveCycle();
  gameLifecycleDeps.callbacks.resetFinishedGameResetLifecycle();
  gameLifecycleDeps.callbacks.resetGameOverBannerLifecycle();
  gameLifecycleDeps.callbacks.clearSelectedSquare();
  gameLifecycleDeps.callbacks.hideGameOverBanner({
    resetCopy: true
  });
  console.log("Initializing solo game state");
  gameLifecycleDeps.callbacks.setBusy(true, "Forging a new duel...");

  try {
    const gameState = await gameLifecycleDeps.api.request("/api/game/new", {
      method: "POST",
      body: JSON.stringify({
        difficulty: gameLifecycleDeps.dom.difficultySelect.value,
        playerColor: gameLifecycleDeps.callbacks.getChosenColor(),
        timeControl: gameLifecycleDeps.callbacks.getSelectedTimeControlId()
      })
    });
    const boardStateFailureReason = gameLifecycleDeps.callbacks.getBoardRenderFailureReason(gameState?.board);

    console.log("Board state ready:", !boardStateFailureReason, gameState?.board?.length);

    if (boardStateFailureReason) {
      throw new Error(`Unable to render new duel board: ${boardStateFailureReason}`);
    }

    gameLifecycleDeps.callbacks.setApiHealth(true);
    applyGameState(gameState, {
      coachContext: "new-game",
      skipRender: true
    });
    gameLifecycleDeps.callbacks.setWizardIdleState();
    console.log("Switching to game view");
    state.view = "game";
    gameLifecycleDeps.callbacks.renderView();
    gameLifecycleDeps.callbacks.render();
    const boardContainer = await gameLifecycleDeps.callbacks.waitForBoardContainerReady();
    if (boardContainer && state.boardViewMode === "3d") {
      await gameLifecycleDeps.callbacks.switchTo3D();
    }

    void refreshCollections();
  } catch (error) {
    state.pendingNewGame = false;
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const saveCurrentGame = async () => {
  gameLifecycleDeps.callbacks.setBusy(true, "Inscribing the current duel into your archive...");

  try {
    const payload = await gameLifecycleDeps.api.request("/api/saves", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    gameLifecycleDeps.callbacks.setPersistence(payload.persistence);
    applyGameState(payload.game, {
      feedbackMessage: gameLifecycleDeps.callbacks.isAuthenticated()
        ? "Game saved to your account archive."
        : "Game saved to your guest archive."
    });
    void refreshCollections();
    gameLifecycleDeps.callbacks.setRecordView("saves");
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const resumeSavedGame = async (gameId) => {
  const { state } = gameLifecycleDeps;

  beginMoveCycle();
  gameLifecycleDeps.callbacks.setBusy(true, "Restoring a saved duel...");

  try {
    const payload = await gameLifecycleDeps.api.request(`/api/saves/${gameId}/resume`, {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    gameLifecycleDeps.callbacks.setPersistence(payload.persistence);
    state.view = "game";
    gameLifecycleDeps.callbacks.renderView();
    await gameLifecycleDeps.callbacks.launchSelectedBoard({
      trigger: "Resume Game"
    });
    applyGameState(payload.game, {
      coachContext: "resume"
    });
    void refreshCollections();
    gameLifecycleDeps.callbacks.setRecordView("moves");
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const resignCurrentGame = async () => {
  if (!window.confirm("Resign the current game?")) {
    return;
  }

  beginMoveCycle();
  gameLifecycleDeps.callbacks.setBusy(true, "Ending the match by resignation...");

  try {
    if (gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
      const socketState = await gameLifecycleDeps.callbacks.emitMultiplayerEvent("multiplayer:resign");

      gameLifecycleDeps.callbacks.setApiHealth(true);
      gameLifecycleDeps.callbacks.applyMultiplayerSocketState(socketState);
      gameLifecycleDeps.callbacks.setCoachMessage(
        "Resignation submitted.",
        "The multiplayer game has ended."
      );
      return;
    }

    const gameState = await gameLifecycleDeps.api.request("/api/game/resign", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    applyGameState(gameState);
    void refreshCollections();
    gameLifecycleDeps.callbacks.setRecordView("history");
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const offerDraw = async () => {
  beginMoveCycle();
  gameLifecycleDeps.callbacks.setBusy(true, "Offering a draw...");

  try {
    if (gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
      const socketState = await gameLifecycleDeps.callbacks.emitMultiplayerEvent("multiplayer:draw");

      gameLifecycleDeps.callbacks.setApiHealth(true);
      gameLifecycleDeps.callbacks.applyMultiplayerSocketState(socketState);

      if (socketState?.event === "draw-agreed") {
        gameLifecycleDeps.callbacks.setCoachMessage(
          "Draw agreed.",
          "The multiplayer game has ended as a draw."
        );
      } else {
        gameLifecycleDeps.callbacks.setCoachMessage(
          "Draw offer sent.",
          "Waiting for your opponent to accept, or they can decline by moving."
        );
      }
      return;
    }

    const payload = await gameLifecycleDeps.api.request("/api/game/draw", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    applyGameState(payload.game, {
      feedbackMessage: payload.message
    });

    if (payload.accepted) {
      void refreshCollections();
      gameLifecycleDeps.callbacks.setRecordView("history");
    }
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const claimAvailableDraw = async () => {
  if (gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
    gameLifecycleDeps.callbacks.setCoachMessage(
      "Draw claim via board controls is solo-only right now.",
      "For multiplayer, continue play until checkmate or a draw result occurs naturally."
    );
    return;
  }

  const drawClaim = gameLifecycleDeps.callbacks.getDrawClaimState(gameLifecycleDeps.state.game);

  if (!drawClaim?.available) {
    return;
  }

  beginMoveCycle();
  gameLifecycleDeps.callbacks.setBusy(true, "Claiming the draw...");

  try {
    const gameState = await gameLifecycleDeps.api.request("/api/game/claim-draw", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    applyGameState(gameState);
    void refreshCollections();
    gameLifecycleDeps.callbacks.setRecordView("history");
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const continueAfterDrawClaim = async () => {
  if (gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
    return;
  }

  const drawClaim = gameLifecycleDeps.callbacks.getDrawClaimState(gameLifecycleDeps.state.game);
  const engineTurnPaused =
    drawClaim?.available && gameLifecycleDeps.state.game?.turn === gameLifecycleDeps.state.game?.settings?.engineColor;

  if (!engineTurnPaused) {
    return;
  }

  beginMoveCycle();
  gameLifecycleDeps.callbacks.setBusy(true, "Continuing the duel...");

  try {
    gameLifecycleDeps.callbacks.setWizardThinkingState();
    const payload = await gameLifecycleDeps.api.request("/api/game/engine", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);

    if (gameLifecycleDeps.callbacks.isTerminalGameState(payload.game)) {
      setCoachStageRank(COACH_STAGE_GAME_OVER);
      applyGameState(payload.game, {
        wizardSource: "engine"
      });
      void refreshCollections();
    } else if (payload.game.coachFeedback) {
      setCoachStageRank(COACH_STAGE_ENGINE_FEEDBACK);
      applyGameState(payload.game, {
        wizardSource: "engine"
      });
    } else {
      applyGameState(payload.game, {
        preserveCoach: true,
        wizardSource: "engine"
      });
    }
  } catch (error) {
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const loadCoachFeedback = async ({ cycleId, moveToken, plyIndex = null }) => {
  try {
    const payload = await gameLifecycleDeps.api.request("/api/game/coach", {
      method: "POST",
      body: JSON.stringify({ moveToken })
    });

    if (!isMoveCycleActive(cycleId) || payload.stale || !payload.coachFeedback) {
      return;
    }

    if (!canApplyCoachStage(cycleId, COACH_STAGE_PLAYER_FEEDBACK)) {
      return;
    }

    gameLifecycleDeps.callbacks.setApiHealth(true);
    if (isHumanBlunderFeedback(payload.coachFeedback)) {
      gameLifecycleDeps.callbacks.scheduleWizardReactionState("st-blunder", {
        delayMs: 900,
        holdMs: 3000
      });
    }
    setCoachStageRank(COACH_STAGE_PLAYER_FEEDBACK);
    if (isLocalPlayerPly(plyIndex, gameLifecycleDeps.state.game)) {
      upsertLocalMoveChronicleRating(plyIndex, payload.coachFeedback);
    }
    gameLifecycleDeps.state.game = applyChronicleMoveMetadata(gameLifecycleDeps.state.game);
    gameLifecycleDeps.callbacks.renderMoveList();
    gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.buildCoachFeedbackState(payload.coachFeedback);
    gameLifecycleDeps.callbacks.renderCoachPanel();
  } catch (error) {
    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  }
};

export const loadEngineReply = async ({ cycleId, moveToken }) => {
  try {
    gameLifecycleDeps.callbacks.setWizardThinkingState({
      preserveTimers: true
    });
    const payload = await gameLifecycleDeps.api.request("/api/game/engine", {
      method: "POST",
      body: JSON.stringify({ moveToken })
    });

    if (!isMoveCycleActive(cycleId) || payload.stale) {
      return;
    }

    gameLifecycleDeps.callbacks.setApiHealth(true);

    if (gameLifecycleDeps.callbacks.isTerminalGameState(payload.game)) {
      setCoachStageRank(COACH_STAGE_GAME_OVER);
      applyGameState(payload.game, {
        wizardSource: "engine"
      });
    } else {
      applyGameState(payload.game, {
        preserveCoach: true,
        wizardSource: "engine"
      });

      if (payload.game.coachFeedback && canApplyCoachStage(cycleId, COACH_STAGE_ENGINE_FEEDBACK)) {
        setCoachStageRank(COACH_STAGE_ENGINE_FEEDBACK);
        gameLifecycleDeps.state.coach = gameLifecycleDeps.callbacks.buildCoachFeedbackState(payload.game.coachFeedback);
        gameLifecycleDeps.callbacks.renderCoachPanel();
      }
    }

    gameLifecycleDeps.callbacks.setBusy(false);

    if (gameLifecycleDeps.callbacks.isTerminalGameState(payload.game)) {
      void refreshCollections();
    }
  } catch (error) {
    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setBusy(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  }
};

export const requestHint = async () => {
  if (!gameLifecycleDeps.state.game || gameLifecycleDeps.callbacks.isRealtimeMultiplayerGame()) {
    gameLifecycleDeps.callbacks.setCoachMessage(
      "Hints are unavailable in this mode.",
      "Hints can be requested only during solo games on your turn."
    );
    return;
  }

  gameLifecycleDeps.callbacks.setBusy(true, "Consulting Arcane Coach for the best line...");

  try {
    const payload = await gameLifecycleDeps.api.request("/api/game/hint", {
      method: "POST"
    });

    gameLifecycleDeps.callbacks.setApiHealth(true);
    gameLifecycleDeps.state.hint = {
      bestMove: payload.hint?.bestMove || null,
      continuation: Array.isArray(payload.hint?.continuation)
        ? payload.hint.continuation.slice(0, 6)
        : [],
      fen: typeof payload.hint?.fen === "string" ? payload.hint.fen : "",
      summary: payload.hint?.summary || "This line improves your position.",
      whyExpanded: false,
      freshHint: true,
      requestedThisTurn: true
    };

    const hintMove = gameLifecycleDeps.state.hint.bestMove;
    const hintLabel = hintMove?.san || `${hintMove?.from || ""}${hintMove?.to || ""}`;
    gameLifecycleDeps.callbacks.setCoachMessage(
      hintMove ? `Hint ready: ${hintLabel}` : "Hint ready.",
      gameLifecycleDeps.state.hint.summary
    );
    gameLifecycleDeps.callbacks.renderHintPanel();
    gameLifecycleDeps.callbacks.applyHintHighlights();
  } catch (error) {
    gameLifecycleDeps.callbacks.clearHintState();
    gameLifecycleDeps.callbacks.renderHintPanel();
    gameLifecycleDeps.callbacks.applyHintHighlights();
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.setBusy(false);
  }
};

export const initialize = async () => {
  const { state } = gameLifecycleDeps;

  gameLifecycleDeps.callbacks.setRecordView(state.activeRecordView);
  gameLifecycleDeps.callbacks.syncBoardViewUi();

  try {
    const sessionPayload = await gameLifecycleDeps.api.loadSession();
    const storedGuest = gameLifecycleDeps.api.readStoredGuest();
    const hasGuestProfile = Boolean(storedGuest?.guestId);
    const savedView = gameLifecycleDeps.api.getSavedView();
    state.isGuest = !sessionPayload?.authenticated && hasGuestProfile;
    state.guest = sessionPayload?.authenticated ? null : storedGuest || null;
    gameLifecycleDeps.callbacks.setPersistence(sessionPayload.persistence);
    gameLifecycleDeps.callbacks.setSessionState(sessionPayload);
    const desiredView = sessionPayload?.authenticated
      ? savedView || "hall"
      : hasGuestProfile
        ? savedView || "hall"
        : "auth";

    state.view = desiredView;
    console.log("Session restore:", state.view, "authenticated:", sessionPayload?.authenticated);

    gameLifecycleDeps.callbacks.renderGuestProfile();
    gameLifecycleDeps.callbacks.renderSessionUi();

    if (sessionPayload?.authenticated || hasGuestProfile) {
      if (desiredView === "game") {
        await enterGameView({ coachContext: "load-active" });
      } else {
        gameLifecycleDeps.callbacks.renderView();
        await loadGame();
      }
    } else {
      gameLifecycleDeps.callbacks.renderView();
      state.isGuest = false;
      state.guest = null;
      gameLifecycleDeps.callbacks.setApiHealth(true);
      return;
    }

    await refreshCollections();
    gameLifecycleDeps.callbacks.setApiHealth(true);
  } catch (error) {
    state.view = "auth";
    console.log("Session restore:", state.view);
    gameLifecycleDeps.callbacks.renderView();
    gameLifecycleDeps.callbacks.setApiHealth(false);
    gameLifecycleDeps.dom.statusText.textContent = "Unable to load the game.";
    gameLifecycleDeps.callbacks.setCoachMessage(error.message);
  } finally {
    gameLifecycleDeps.callbacks.syncActionButtons();
  }
};
