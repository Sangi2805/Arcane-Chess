const GUEST_STORAGE_KEY = "arcane-chess-guest-profile";
const RECORD_VIEW_STORAGE_KEY = "arcane-chess-record-view";
const BOARD_VIEW_STORAGE_KEY = "arcane-chess-board-view";

const PIECES = {
  white: {
    p: "\u2659",
    r: "\u2656",
    n: "\u2658",
    b: "\u2657",
    q: "\u2655",
    k: "\u2654"
  },
  black: {
    p: "\u265F",
    r: "\u265C",
    n: "\u265E",
    b: "\u265D",
    q: "\u265B",
    k: "\u265A"
  }
};

const difficultySelect = document.getElementById("difficulty-select");
const newGameButton = document.getElementById("new-game-button");
const saveGameButton = document.getElementById("save-game-button");
const offerDrawButton = document.getElementById("offer-draw-button");
const resignButton = document.getElementById("resign-button");
const shellElement = document.querySelector(".shell");
const boardShell = document.querySelector(".board-shell");
const board3dElement = document.getElementById("board-3d");
const boardElement = document.getElementById("board");
const boardViewButtons = document.querySelectorAll("[data-board-view]");
const immersiveHud = document.getElementById("immersive-hud");
const immersiveExitButton = document.getElementById("immersive-exit-button");
const immersiveNewGameButton = document.getElementById("immersive-new-game-button");
const immersiveOfferDrawButton = document.getElementById("immersive-offer-draw-button");
const immersiveResignButton = document.getElementById("immersive-resign-button");
const immersiveStatusHeading = document.getElementById("immersive-status-heading");
const immersiveStatusMeta = document.getElementById("immersive-status-meta");
const gameOverBanner = document.getElementById("game-over-banner");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverMessage = document.getElementById("game-over-message");
const moveListElement = document.getElementById("move-list");
const statusText = document.getElementById("status-text");
const coachPanel = document.getElementById("coach-panel");
const coachFooter = coachPanel?.querySelector(".coach-footer");
const coachBubbleCopy = coachPanel?.querySelector(".coach-bubble-copy");
const feedbackText = document.getElementById("feedback-text");
const feedbackBadge = document.getElementById("feedback-classification");
const feedbackExplanation = document.getElementById("feedback-explanation");
const feedbackSuggestion = document.getElementById("feedback-suggestion");
const feedbackThinking = document.getElementById("feedback-thinking");
const playerSide = document.getElementById("player-side");
const engineSide = document.getElementById("engine-side");
const turnIndicator = document.getElementById("turn-indicator");
const lastMoveText = document.getElementById("last-move-text");
const apiHealth = document.getElementById("api-health");
const promotionPanel = document.getElementById("promotion-panel");
const colorInputs = document.querySelectorAll('input[name="player-color"]');
const guestSubtitle = document.getElementById("guest-subtitle");
const guestName = document.getElementById("guest-name");
const guestMeta = document.getElementById("guest-meta");
const recordTabs = document.querySelectorAll("[data-record-view]");
const recordViews = document.querySelectorAll("[data-view-panel]");
const savedGamesList = document.getElementById("saved-games-list");
const historyList = document.getElementById("history-list");
const savedGamesCount = document.getElementById("saved-games-count");
const historyCount = document.getElementById("history-count");
const historyModal = document.getElementById("history-modal");
const historyModalCard = historyModal?.querySelector(".modal-card");
const closeHistoryButton = document.getElementById("close-history-button");
const historyDetailResult = document.getElementById("history-detail-result");
const historyDetailDifficulty = document.getElementById("history-detail-difficulty");
const historyDetailPlayer = document.getElementById("history-detail-player");
const historyDetailCompleted = document.getElementById("history-detail-completed");
const historyDetailStatus = document.getElementById("history-detail-status");
const historyDetailPgn = document.getElementById("history-detail-pgn");
const historyDetailMoves = document.getElementById("history-detail-moves");

const DEFAULT_COACH_EXPLANATION =
  "I review each completed move against Stockfish.";
const THINKING_COACH_EXPLANATION =
  "Your move is down. The reply is forming now.";
const GAME_OVER_BANNER_DURATION_MS = 4200;
const DRAW_OUTCOME_LABELS = {
  stalemate: "Stalemate",
  "draw-repetition": "Draw by repetition",
  "draw-insufficient-material": "Draw by insufficient material",
  "draw-fifty-move": "Draw by fifty-move rule",
  "draw-agreed": "Draw agreed",
  draw: "Draw"
};
const COACH_STAGE_PLAYER_FEEDBACK = 2;
const COACH_STAGE_ENGINE_FEEDBACK = 3;
const COACH_STAGE_GAME_OVER = 4;
const isGameplayDebugEnabled = () => window.__ARCANE_DEBUG_SYNC !== false;
const debugGameplaySync = (event, payload = {}) => {
  if (!isGameplayDebugEnabled()) {
    return;
  }

  console.debug(`[ArcaneSync] ${event}`, payload);
};

const state = {
  guest: null,
  game: null,
  boardViewMode:
    window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY) === "3d" ? "3d" : "2d",
  board3DAvailable: Boolean(window.Arcane3D?.available),
  board3D: null,
  selectedSquare: null,
  pendingPromotion: null,
  pendingNewGame: false,
  busy: false,
  savedGames: [],
  history: [],
  persistence: {
    available: false,
    status: "disconnected"
  },
  historyDetailLoading: false,
  historyModalOpen: false,
  activeHistoryRequestId: 0,
  activeMoveCycleId: 0,
  activeCoachStageRank: 0,
  coach: {
    classification: null,
    tone: "neutral",
    message: "Preparing the board.",
    explanation: DEFAULT_COACH_EXPLANATION,
    bestMove: null,
    animate: false
  },
  activeRecordView:
    window.localStorage.getItem(RECORD_VIEW_STORAGE_KEY) || "moves"
};

let lastRenderedCoachSignature = "";
let coachMessageAnimationTimeoutId = null;
let coachMotionAnimationTimeoutId = null;
let coachSpeakingAnimationTimeoutId = null;
let coachMotionSequence = 0;
let lastRenderedCoachMotionPulseId = null;
let gameOverBannerTimeoutId = null;
let activeGameOverBannerKey = "";
let dismissedGameOverBannerKey = "";
let finishedGameResetTimeoutId = null;
let activeFinishedGameResetKey = "";

const VALID_RECORD_VIEWS = new Set(["moves", "saves", "history"]);
const VALID_BOARD_VIEWS = new Set(["2d", "3d"]);

const syncBoardViewUi = () => {
  const is3D = state.boardViewMode === "3d";

  document.body.dataset.boardViewMode = state.boardViewMode;
  document.body.classList.toggle("board-mode-3d", is3D);

  if (shellElement) {
    shellElement.dataset.boardViewMode = state.boardViewMode;
  }

  if (boardShell) {
    boardShell.dataset.viewMode = state.boardViewMode;
  }

  if (board3dElement) {
    board3dElement.classList.toggle("hidden", !is3D);
    board3dElement.setAttribute("aria-hidden", is3D ? "false" : "true");
  }

  if (immersiveHud) {
    immersiveHud.setAttribute("aria-hidden", is3D ? "false" : "true");
  }

  boardViewButtons.forEach((button) => {
    const isActive = button.dataset.boardView === state.boardViewMode;
    const is3DButton = button.dataset.boardView === "3d";
    button.classList.toggle("active", isActive);
    button.disabled = is3DButton && !state.board3DAvailable;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  renderImmersiveHud();
};

const ensureBoard3D = () => {
  if (state.board3D || !state.board3DAvailable || !board3dElement) {
    return state.board3D;
  }

  try {
    state.board3D = window.Arcane3D?.createBoard3D({
      mountElement: board3dElement,
      onSquareSelect: (square) => handleSquareClick(square)
    }) || null;
  } catch (error) {
    console.error("Unable to initialize 3D board.", error);
    state.board3DAvailable = false;
    state.boardViewMode = "2d";
    syncBoardViewUi();
  }

  return state.board3D;
};

const syncBoard3D = () => {
  syncBoardViewUi();

  if (!state.board3DAvailable || !board3dElement) {
    return;
  }

  const board3D = ensureBoard3D();

  if (!board3D) {
    return;
  }

  board3D.sync({
    gameState: state.game,
    selectedSquare: state.selectedSquare,
    legalTargets: getLegalTargets(),
    viewMode: state.boardViewMode,
    interactionLocked:
      state.busy || Boolean(state.pendingPromotion?.moveChoices?.length)
  });
};

const setBoardViewMode = (viewMode, { persist = true } = {}) => {
  const normalizedView = VALID_BOARD_VIEWS.has(viewMode) ? viewMode : "2d";
  const nextView =
    normalizedView === "3d" && !state.board3DAvailable ? "2d" : normalizedView;

  state.boardViewMode = nextView;

  if (persist) {
    window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, nextView);
  }

  syncBoard3D();
  if (nextView === "3d") {
    window.requestAnimationFrame(() => {
      state.board3D?.scheduleResize?.({
        immediate: true
      });
      renderBoardOverlays();
    });
  }
  renderBoardOverlays();
};

const handleArcane3DReady = () => {
  state.board3DAvailable = Boolean(window.Arcane3D?.available);

  if (!state.board3DAvailable && state.boardViewMode === "3d") {
    state.boardViewMode = "2d";
  }

  syncBoard3D();
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatColor = (color) =>
  color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : "-";

const trimTerminalPeriod = (value) =>
  typeof value === "string" ? value.replace(/\.$/, "") : "";

const getOutcomeLabel = (value = {}) => {
  if (value.resultLabel) {
    return value.resultLabel;
  }

  if (value.status?.outcomeLabel) {
    return value.status.outcomeLabel;
  }

  const statusCode = value.status?.code || value.statusCode;

  if (statusCode && DRAW_OUTCOME_LABELS[statusCode]) {
    return DRAW_OUTCOME_LABELS[statusCode];
  }

  if (value.result === "draw") {
    return trimTerminalPeriod(value.status?.message || value.statusMessage) || "Draw";
  }

  return null;
};

const formatResult = (result, playerColor, context = {}) => {
  switch (result) {
    case "white-win":
      return playerColor ? (playerColor === "white" ? "Won" : "Lost") : "White won";
    case "black-win":
      return playerColor ? (playerColor === "black" ? "Won" : "Lost") : "Black won";
    case "draw":
      return getOutcomeLabel({
        ...context,
        result
      }) || "Draw";
    case "not-started":
      return "Not started";
    default:
      return "In Progress";
  }
};

const formatHistoryHeadline = (record = {}) => {
  const result = formatResult(record.result, record.playerColor, record);

  if (
    !record.playerColor ||
    result === "In Progress" ||
    result === "Not started"
  ) {
    return result;
  }

  return `${result} as ${formatColor(record.playerColor)}`;
};

const getWinnerFromResult = (result) => {
  if (result === "white-win") {
    return "White";
  }

  if (result === "black-win") {
    return "Black";
  }

  return null;
};

const getGameOverCopy = (gameState) => {
  if (!gameState?.isGameOver) {
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

const createCoachState = (overrides = {}) => ({
  source: "system",
  classification: null,
  tone: "neutral",
  message: "Preparing the board.",
  explanation: DEFAULT_COACH_EXPLANATION,
  bestMove: null,
  motionState: "idle",
  motionSettleTo: null,
  motionDurationMs: 0,
  motionPulseId: null,
  outcome: "neutral",
  animate: false,
  ...overrides
});

const getNextCoachMotionPulseId = () => {
  coachMotionSequence += 1;
  return coachMotionSequence;
};

const createTransientCoachMotion = (
  motionState,
  motionSettleTo = "idle",
  motionDurationMs = 1600,
  overrides = {}
) => ({
  motionState,
  motionSettleTo,
  motionDurationMs,
  motionPulseId: getNextCoachMotionPulseId(),
  outcome: "neutral",
  ...overrides
});

const createPersistentCoachMotion = (motionState, overrides = {}) => ({
  motionState,
  motionSettleTo: null,
  motionDurationMs: 0,
  motionPulseId: null,
  outcome: "neutral",
  ...overrides
});

const beginMoveCycle = () => {
  state.activeMoveCycleId += 1;
  state.activeCoachStageRank = 0;
  return state.activeMoveCycleId;
};

const isMoveCycleActive = (cycleId) => cycleId === state.activeMoveCycleId;

const canApplyCoachStage = (cycleId, stageRank) =>
  isMoveCycleActive(cycleId) && stageRank >= state.activeCoachStageRank;

const setCoachStageRank = (stageRank) => {
  state.activeCoachStageRank = stageRank;
};

const cloneValue = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const getIdleCoachState = () =>
  createCoachState({
    message: "Welcome back. The board awaits.",
    explanation: "Start a duel and I will read each move as it lands.",
    ...createPersistentCoachMotion("idle")
  });

const getWelcomeCoachState = (context = "new-game") => {
  if (context === "resume") {
    return createCoachState({
      message: "The duel resumes. Read the tension carefully.",
      explanation: "The board remembers every threat. Move with intent.",
      animate: true,
      ...createTransientCoachMotion("welcome", "idle", 1850)
    });
  }

  if (context === "load-active") {
    return createCoachState({
      message: "Your opponent is ready. Let us begin.",
      explanation: "Make your first move. I will read the position.",
      ...createTransientCoachMotion("welcome", "idle", 1700)
    });
  }

  return createCoachState({
    message: "A new duel begins. Choose wisely.",
    explanation: "I will speak when the balance shifts.",
    animate: true,
    ...createTransientCoachMotion("welcome", "idle", 1900)
  });
};

const getThinkingCoachState = (message = "Reading the position...") =>
  createCoachState({
    source: "system",
    classification: null,
    tone: "thinking",
    message,
    explanation: THINKING_COACH_EXPLANATION,
    bestMove: null,
    animate: false,
    ...createPersistentCoachMotion("thinking")
  });

const getDrawCoachState = (gameState, outcome) => {
  switch (gameState.status.code) {
    case "stalemate":
      return createCoachState({
        source: "system",
        message: "The board is locked. Stalemate.",
        explanation: "No legal move remained, yet no king stood in check.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-repetition":
      return createCoachState({
        source: "system",
        message: "The pattern repeated until the duel cooled.",
        explanation: "Draw by repetition. A fresh plan was needed to break the loop.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-insufficient-material":
      return createCoachState({
        source: "system",
        message: "Neither side held enough force to finish.",
        explanation: "Draw by insufficient material. Mate was no longer possible.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-fifty-move":
      return createCoachState({
        source: "system",
        message: "The struggle faded without a break.",
        explanation: "Draw by fifty-move rule. No pawn break or capture came in time.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-agreed":
      return createCoachState({
        source: "system",
        message: "Both sides set the blades down. Draw agreed.",
        explanation: "The duel ends by mutual consent. Begin another when ready.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    default:
      return createCoachState({
        source: "system",
        message: "A measured draw. Neither side broke the balance.",
        explanation: "Study the pattern and begin again when you wish.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
  }
};

const getGameOverCoachState = (gameState) => {
  const playerWon =
    (gameState.result === "white-win" && gameState.settings.playerColor === "white") ||
    (gameState.result === "black-win" && gameState.settings.playerColor === "black");
  const outcome = playerWon ? "win" : gameState.result === "draw" ? "draw" : "loss";

  if (gameState.status.code === "resignation") {
    return createCoachState({
      message: playerWon ? "The enemy yields. The duel is yours." : "The duel ends in resignation.",
      explanation: playerWon
        ? "A clean finish. Begin another when ready."
        : "Reset your line and return when ready.",
      ...createPersistentCoachMotion("game-over", {
        outcome
      })
    });
  }

  if (gameState.result === "draw") {
    return getDrawCoachState(gameState, outcome);
  }

  if (playerWon) {
    return createCoachState({
      message: "Victory. Your final attack held.",
      explanation: "The board is yours. Begin another duel when ready.",
      ...createPersistentCoachMotion("game-over", {
        outcome
      })
    });
  }

  return createCoachState({
    message: "Defeat this time. The lesson remains.",
    explanation: "Study the final pattern, then set the pieces again.",
    ...createPersistentCoachMotion("game-over", {
      outcome
    })
  });
};

const getCoachLead = (classification) => {
  switch (classification) {
    case "Good Move":
      return "That keeps your plan intact.";
    case "Inaccuracy":
      return "A little drift from the cleanest line.";
    case "Blunder":
      return "That is a major slip.";
    case "Engine Reply":
      return "The engine found a precise continuation.";
    case "Engine Pressure":
      return "Watch carefully - that move improves its position.";
    case "Engine Threat":
      return "The reply is strong. You may need to defend.";
    default:
      return "Arcane Coach is watching the board.";
  }
};

const getCoachTone = (classification) => {
  if (classification === "Engine Threat") {
    return "engine-danger";
  }

  if (classification === "Engine Pressure") {
    return "engine-warning";
  }

  if (classification === "Engine Reply") {
    return "engine";
  }

  if (classification === "Blunder") {
    return "blunder";
  }

  if (classification === "Inaccuracy") {
    return "inaccuracy";
  }

  if (classification === "Good Move") {
    return "good";
  }

  return "neutral";
};

const getReactionMotionState = (coachFeedback = {}) => {
  if (coachFeedback.motionState) {
    return coachFeedback.motionState;
  }

  if (coachFeedback.classification === "Good Move") {
    return "good";
  }

  if (coachFeedback.classification === "Inaccuracy") {
    return "inaccuracy";
  }

  if (coachFeedback.classification === "Blunder") {
    return "blunder";
  }

  if (coachFeedback.classification === "Engine Reply") {
    return "engine-strong";
  }

  if (coachFeedback.classification === "Engine Pressure") {
    return "engine-warning";
  }

  if (coachFeedback.classification === "Engine Threat") {
    return "engine-danger";
  }

  return "idle";
};

const buildCoachFeedbackState = (coachFeedback = {}) => {
  const motionState = getReactionMotionState(coachFeedback);
  const motionDurationMs =
    coachFeedback.motionDurationMs ||
    (motionState.startsWith("engine-") ? 1800 : 1650);

  return createCoachState({
    source: coachFeedback.source || "system",
    classification: coachFeedback.classification || null,
    tone: coachFeedback.tone || getCoachTone(coachFeedback.classification),
    message: coachFeedback.message || getCoachLead(coachFeedback.classification),
    explanation: coachFeedback.explanation || DEFAULT_COACH_EXPLANATION,
    bestMove: coachFeedback.bestMove || null,
    animate: coachFeedback.animate !== false,
    ...(motionState === "idle"
      ? createPersistentCoachMotion("idle")
      : createTransientCoachMotion(motionState, "idle", motionDurationMs))
  });
};

const getDefaultCoachState = (gameState, context = "default") => {
  if (!gameState?.hasStarted) {
    return getIdleCoachState();
  }

  if (gameState.isGameOver) {
    return getGameOverCoachState(gameState);
  }

  if (context === "new-game" || context === "resume" || context === "load-active") {
    return getWelcomeCoachState(context);
  }

  return createCoachState({
    message: "Your opponent is ready. Let us begin.",
    explanation: "Play a move and I will answer with a short reading.",
    ...createPersistentCoachMotion("idle")
  });
};

const formatTimestamp = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const normalizeHistoryRecord = (record = {}) => ({
  result: record.result || "in-progress",
  resultLabel: record.resultLabel || null,
  drawReason: record.drawReason || null,
  difficulty: record.difficulty || record.level || "-",
  playerColor: record.playerColor || record.playerSide || "-",
  engineColor: record.engineColor || "-",
  completedAt: record.completedAt || record.updatedAt || record.createdAt || null,
  statusCode: record.statusCode || record.status?.code || null,
  statusMessage:
    record.statusMessage || record.status?.message || record.statusCode || "-",
  pgn: record.pgn || record.gamePgn || "",
  moveList: Array.isArray(record.moveList)
    ? record.moveList
    : Array.isArray(record.moves)
      ? record.moves
      : []
});

const readStoredGuest = () => {
  try {
    const storedValue = window.localStorage.getItem(GUEST_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedGuest = JSON.parse(storedValue);

    return parsedGuest?.guestId ? parsedGuest : null;
  } catch (error) {
    return null;
  }
};

const persistGuest = (guest) => {
  if (!guest?.guestId) {
    return;
  }

  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
};

const createFallbackGuest = (storedGuest) => {
  const guestId =
    storedGuest?.guestId ||
    `guest_${window.crypto?.randomUUID?.() || Date.now().toString(36)}`;
  const suffix = guestId.replace("guest_", "").slice(-4).toUpperCase();

  return {
    guestId,
    displayName: storedGuest?.displayName || `Guest-${suffix}`
  };
};

const getChosenColor = () =>
  document.querySelector('input[name="player-color"]:checked')?.value || "white";

const getGuestHeaders = () =>
  state.guest?.guestId ? { "X-Guest-Id": state.guest.guestId } : {};

const renderGuestProfile = () => {
  guestName.textContent = "Playing as Guest";

  if (!state.persistence.available) {
    guestSubtitle.textContent = "Guest mode is local until MongoDB returns.";
    guestMeta.textContent =
      "Saved games and history stay on this browser when persistence is available.";
    return;
  }

  guestSubtitle.textContent = "Guest mode is active on this browser.";
  guestMeta.textContent =
    "Save and resume untimed games here without creating an account.";
};

const syncActionButtons = () => {
  const inProgress =
    Boolean(state.game?.hasStarted) && Boolean(state.game) && !state.game.isGameOver;
  const saveDisabled =
    state.busy ||
    !state.game ||
    !state.game.hasStarted ||
    !state.persistence.available ||
    state.game.isGameOver;

  newGameButton.disabled = state.busy;
  saveGameButton.disabled = saveDisabled;
  offerDrawButton.disabled = state.busy || !inProgress;
  resignButton.disabled = state.busy || !inProgress;
  difficultySelect.disabled = state.busy;

  if (immersiveNewGameButton) {
    immersiveNewGameButton.disabled = newGameButton.disabled;
  }

  if (immersiveOfferDrawButton) {
    immersiveOfferDrawButton.disabled = offerDrawButton.disabled;
  }

  if (immersiveResignButton) {
    immersiveResignButton.disabled = resignButton.disabled;
  }

  if (immersiveExitButton) {
    immersiveExitButton.disabled = false;
  }

  colorInputs.forEach((input) => {
    input.disabled = state.busy;
  });
};

const setPersistence = (persistence = {}) => {
  state.persistence = {
    available: Boolean(persistence.available),
    status: persistence.status || "disconnected"
  };

  renderGuestProfile();
  syncActionButtons();
};

const animateCoachMessage = () => {
  if (!coachBubbleCopy) {
    return;
  }

  if (coachMessageAnimationTimeoutId) {
    window.clearTimeout(coachMessageAnimationTimeoutId);
  }

  coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  void coachBubbleCopy.offsetWidth;
  coachBubbleCopy.classList.add("coach-bubble-copy-update");

  if (coachPanel) {
    if (coachSpeakingAnimationTimeoutId) {
      window.clearTimeout(coachSpeakingAnimationTimeoutId);
    }

    coachPanel.classList.remove("coach-panel-speaking");
    void coachPanel.offsetWidth;
    coachPanel.classList.add("coach-panel-speaking");

    coachSpeakingAnimationTimeoutId = window.setTimeout(() => {
      coachPanel.classList.remove("coach-panel-speaking");
    }, 360);
  }

  coachMessageAnimationTimeoutId = window.setTimeout(() => {
    coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  }, 180);
};

const scheduleCoachMotionReset = (coachState) => {
  if (coachMotionAnimationTimeoutId) {
    window.clearTimeout(coachMotionAnimationTimeoutId);
    coachMotionAnimationTimeoutId = null;
  }

  if (!coachState.motionPulseId || !coachState.motionDurationMs) {
    lastRenderedCoachMotionPulseId = coachState.motionPulseId || null;
    return;
  }

  const motionPulseId = coachState.motionPulseId;
  const settleTo = coachState.motionSettleTo || "idle";
  const nextOutcome = settleTo === "game-over" ? coachState.outcome : "neutral";

  coachMotionAnimationTimeoutId = window.setTimeout(() => {
    if (state.coach.motionPulseId !== motionPulseId) {
      return;
    }

    state.coach = createCoachState({
      ...state.coach,
      ...createPersistentCoachMotion(settleTo, {
        outcome: nextOutcome
      })
    });
    renderCoachPanel();
  }, coachState.motionDurationMs);

  lastRenderedCoachMotionPulseId = motionPulseId;
};

const renderCoachPanel = () => {
  if (!coachPanel) {
    return;
  }

  const coachState = state.coach || createCoachState();
  const coachSignature = JSON.stringify({
    motionState: coachState.motionState,
    tone: coachState.tone,
    classification: coachState.classification,
    message: coachState.message,
    explanation: coachState.explanation,
    bestMove: coachState.bestMove
  });
  const motionPulseChanged = coachState.motionPulseId !== lastRenderedCoachMotionPulseId;

  coachPanel.dataset.tone = coachState.tone || "neutral";
  coachPanel.dataset.motionState = coachState.motionState || "idle";
  coachPanel.dataset.outcome = coachState.outcome || "neutral";

  feedbackText.textContent = coachState.message;
  feedbackText.title = coachState.message || "";
  feedbackExplanation.textContent =
    coachState.explanation || DEFAULT_COACH_EXPLANATION;
  feedbackExplanation.title = coachState.explanation || DEFAULT_COACH_EXPLANATION;

  if (coachState.classification) {
    feedbackBadge.textContent = coachState.classification;
    feedbackBadge.className = `feedback-badge feedback-badge-${coachState.tone}`;
  } else {
    feedbackBadge.textContent = "";
    feedbackBadge.className = "feedback-badge hidden";
  }

  if (coachState.bestMove) {
    feedbackSuggestion.textContent = `Better move: ${coachState.bestMove}`;
    feedbackSuggestion.title = `Better move: ${coachState.bestMove}`;
    feedbackSuggestion.classList.remove("hidden");
  } else {
    feedbackSuggestion.textContent = "";
    feedbackSuggestion.title = "";
    feedbackSuggestion.classList.add("hidden");
  }

  feedbackThinking?.classList.toggle(
    "hidden",
    coachState.motionState !== "thinking"
  );

  coachFooter?.classList.toggle(
    "coach-footer-empty",
    !coachState.classification && !coachState.bestMove
  );

  if (
    coachState.animate &&
    coachState.motionState !== "thinking" &&
    coachSignature !== lastRenderedCoachSignature
  ) {
    animateCoachMessage();
  }

  if (motionPulseChanged || coachState.motionPulseId === null) {
    scheduleCoachMotionReset(coachState);
  }

  lastRenderedCoachSignature = coachSignature;
  state.coach.animate = false;
};

const setCoachMessage = (message, explanation = DEFAULT_COACH_EXPLANATION) => {
  state.coach = createCoachState({
    ...state.coach,
    classification: null,
    tone: "neutral",
    message,
    explanation,
    bestMove: null,
    animate: false,
    ...createPersistentCoachMotion("idle")
  });
  renderCoachPanel();
};

const setBusy = (busy, message) => {
  state.busy = busy;
  syncActionButtons();
  syncBoard3D();

  if (message) {
    setCoachMessage(message);
  }
};

const setApiHealth = (healthy) => {
  apiHealth.textContent = healthy ? "API Ready" : "API Error";
  apiHealth.className = healthy ? "pill pill-ok" : "pill pill-error";
};

const request = async (url, options = {}) => {
  const headers = {
    ...getGuestHeaders(),
    ...options.headers
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
};

const setRecordView = (view) => {
  const normalizedView = VALID_RECORD_VIEWS.has(view) ? view : "moves";
  state.activeRecordView = normalizedView;
  window.localStorage.setItem(RECORD_VIEW_STORAGE_KEY, normalizedView);

  recordTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.recordView === normalizedView);
  });

  recordViews.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== normalizedView);
  });
};

const getSquareColorClass = (square) => {
  const file = square.charCodeAt(0) - 96;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0 ? "square-dark" : "square-light";
};

const getOrderedSquares = () => {
  const boardSquares = state.game?.board || [];
  const lookup = new Map(boardSquares.map((entry) => [entry.square, entry]));

  const files =
    state.game?.settings.playerColor === "black"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks =
    state.game?.settings.playerColor === "black"
      ? ["1", "2", "3", "4", "5", "6", "7", "8"]
      : ["8", "7", "6", "5", "4", "3", "2", "1"];

  const orderedSquares = [];

  ranks.forEach((rank) => {
    files.forEach((file) => {
      const square = `${file}${rank}`;
      orderedSquares.push(lookup.get(square));
    });
  });

  return orderedSquares;
};

const getLegalTargets = () => {
  if (!state.selectedSquare || !state.game) {
    return [];
  }

  const legalTargets = state.game.legalMoves[state.selectedSquare] || [];
  debugGameplaySync("selection:legal-targets", {
    selectedSquare: state.selectedSquare,
    legalTargets
  });
  return legalTargets;
};

const appendMoveToList = (moveList = [], san, color) => {
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

const moveBoardPiece = (board = [], move, movingColor) => {
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

const buildOptimisticGameState = (gameState, move) => {
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

const clearPromotionPrompt = () => {
  state.pendingPromotion = null;
  promotionPanel.classList.add("hidden");
  promotionPanel.style.left = "";
  promotionPanel.style.top = "";
  promotionPanel.style.visibility = "";
};

const openPromotionPrompt = (moveChoices, anchorSquare) => {
  state.pendingPromotion = {
    moveChoices,
    anchorSquare
  };
  setCoachMessage(
    "Choose a promotion piece.",
    "Select how the pawn should transform before the move is sent."
  );
};

const setSelectedSquare = (square) => {
  state.selectedSquare = square;
  clearPromotionPrompt();
  debugGameplaySync("selection:set", {
    selectedSquare: square,
    legalMoves: state.game?.legalMoves?.[square] || []
  });
};

const clearSelectedSquare = () => {
  if (state.selectedSquare) {
    debugGameplaySync("selection:clear", {
      selectedSquare: state.selectedSquare
    });
  }
  state.selectedSquare = null;
  clearPromotionPrompt();
};

const clearGameOverBannerTimer = () => {
  if (!gameOverBannerTimeoutId) {
    return;
  }

  window.clearTimeout(gameOverBannerTimeoutId);
  gameOverBannerTimeoutId = null;
};

const clearFinishedGameResetTimer = () => {
  if (!finishedGameResetTimeoutId) {
    return;
  }

  window.clearTimeout(finishedGameResetTimeoutId);
  finishedGameResetTimeoutId = null;
};

const resetFinishedGameResetLifecycle = () => {
  clearFinishedGameResetTimer();
  activeFinishedGameResetKey = "";
};

const resetGameOverBannerLifecycle = () => {
  clearGameOverBannerTimer();
  activeGameOverBannerKey = "";
  dismissedGameOverBannerKey = "";
};

const getGameOverBannerKey = (gameState) => {
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

const clearCompletedLiveBoard = async (gameOverKey) => {
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
    if (activeFinishedGameResetKey === gameOverKey && state.game?.isGameOver) {
      activeFinishedGameResetKey = "";
    }
  }
};

const scheduleFinishedGameReset = (gameState) => {
  const gameOverKey = getGameOverBannerKey(gameState);

  if (!gameOverKey || state.pendingNewGame) {
    resetFinishedGameResetLifecycle();
    return;
  }

  if (activeFinishedGameResetKey === gameOverKey) {
    return;
  }

  clearFinishedGameResetTimer();
  activeFinishedGameResetKey = gameOverKey;
  finishedGameResetTimeoutId = window.setTimeout(() => {
    finishedGameResetTimeoutId = null;
    void clearCompletedLiveBoard(gameOverKey);
  }, GAME_OVER_BANNER_DURATION_MS + 80);
};

const scheduleGameOverBannerDismissal = (bannerKey) => {
  clearGameOverBannerTimer();
  gameOverBannerTimeoutId = window.setTimeout(() => {
    if (activeGameOverBannerKey !== bannerKey) {
      return;
    }

    dismissedGameOverBannerKey = bannerKey;
    activeGameOverBannerKey = "";
    hideGameOverBanner({
      resetCopy: true
    });
  }, GAME_OVER_BANNER_DURATION_MS);
};

const hideGameOverBanner = ({ resetCopy = false } = {}) => {
  gameOverBanner.classList.add("hidden");
  gameOverBanner.setAttribute("aria-hidden", "true");

  if (resetCopy) {
    gameOverTitle.textContent = "Game Over";
    gameOverMessage.textContent = "Result pending.";
  }
};

const renderGameOverBanner = () => {
  const gameOverCopy = getGameOverCopy(state.game);

  if (!gameOverCopy) {
    resetGameOverBannerLifecycle();
    hideGameOverBanner({
      resetCopy: true
    });
    return;
  }

  if (state.pendingNewGame || state.boardViewMode === "3d") {
    hideGameOverBanner({
      resetCopy: true
    });
    return;
  }

  const bannerKey = getGameOverBannerKey(state.game);

  if (dismissedGameOverBannerKey === bannerKey) {
    hideGameOverBanner({
      resetCopy: true
    });
    return;
  }

  gameOverTitle.textContent = gameOverCopy.title;
  gameOverMessage.textContent = gameOverCopy.message;
  gameOverBanner.classList.remove("hidden");
  gameOverBanner.setAttribute("aria-hidden", "false");

  if (activeGameOverBannerKey !== bannerKey) {
    activeGameOverBannerKey = bannerKey;
    scheduleGameOverBannerDismissal(bannerKey);
  }
};

const renderPromotionPrompt = () => {
  if (!state.pendingPromotion?.moveChoices?.length || !boardShell) {
    clearPromotionPrompt();
    return;
  }

  const boardRect = boardShell.getBoundingClientRect();
  let anchorRect = null;

  if (state.boardViewMode === "3d" && state.board3D?.projectSquare) {
    const projected = state.board3D.projectSquare(state.pendingPromotion.anchorSquare);

    if (
      projected &&
      Number.isFinite(projected.x) &&
      Number.isFinite(projected.y)
    ) {
      anchorRect = {
        left: projected.x,
        right: projected.x,
        top: projected.y,
        bottom: projected.y,
        width: 0,
        height: 0
      };
    }
  }

  if (!anchorRect) {
    const anchorSquare = boardElement.querySelector(
      `[data-square="${state.pendingPromotion.anchorSquare}"]`
    );

    if (!anchorSquare) {
      clearPromotionPrompt();
      return;
    }

    anchorRect = anchorSquare.getBoundingClientRect();
  }

  promotionPanel.classList.remove("hidden");
  promotionPanel.style.visibility = "hidden";

  const panelWidth = promotionPanel.offsetWidth || 196;
  const panelHeight = promotionPanel.offsetHeight || 148;
  const margin = 12;
  const preferredLeft =
    anchorRect.left - boardRect.left + anchorRect.width / 2 - panelWidth / 2;
  const maxLeft = Math.max(margin, boardRect.width - panelWidth - margin);
  const left = Math.min(Math.max(preferredLeft, margin), maxLeft);
  const anchorIsNearTop = anchorRect.top - boardRect.top < boardRect.height / 2;
  const preferredTop = anchorIsNearTop
    ? anchorRect.bottom - boardRect.top + margin
    : anchorRect.top - boardRect.top - panelHeight - margin;
  const maxTop = Math.max(margin, boardRect.height - panelHeight - margin);
  const top = Math.min(Math.max(preferredTop, margin), maxTop);

  promotionPanel.style.left = `${Math.round(left)}px`;
  promotionPanel.style.top = `${Math.round(top)}px`;
  promotionPanel.style.visibility = "";
};

const renderBoardOverlays = () => {
  renderGameOverBanner();

  if (state.pendingPromotion?.moveChoices?.length) {
    renderPromotionPrompt();
    return;
  }

  promotionPanel.classList.add("hidden");
};

const renderMoveRows = (moveList = [], emptyMessage = "No moves recorded yet.") => {
  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  return moveList
    .map(
      (move) => `
        <div class="move-row">
          <strong>${escapeHtml(`${move.turn}.`)}</strong>
          <span>${escapeHtml(move.white || "-")}</span>
          <span>${escapeHtml(move.black || "-")}</span>
        </div>
      `
    )
    .join("");
};

const renderMoveList = () => {
  moveListElement.innerHTML = renderMoveRows(
    state.game?.moveList || [],
    "No moves have been recorded yet."
  );
};

const renderSavedGames = () => {
  savedGamesCount.textContent = `${state.savedGames.length} saved`;

  if (!state.persistence.available) {
    savedGamesList.innerHTML = `
      <div class="empty-state">
        <strong>MongoDB is unavailable.</strong>
        <span>Start MongoDB to enable save and resume support.</span>
      </div>
    `;
    return;
  }

  if (!state.savedGames.length) {
    savedGamesList.innerHTML = `
      <div class="empty-state">
        <strong>No saved games yet.</strong>
        <span>Use Save Game on any in-progress duel to archive it for later.</span>
      </div>
    `;
    return;
  }

  savedGamesList.innerHTML = state.savedGames
    .map(
      (game) => `
        <article class="record-card">
          <div class="record-card-copy">
            <strong>${escapeHtml(formatColor(game.playerColor))} vs ${escapeHtml(
              formatColor(game.engineColor)
            )}</strong>
            <span>${escapeHtml(game.status.message)}</span>
            <span>${escapeHtml(game.difficulty)} difficulty - ${escapeHtml(
              `${game.moveCount} moves`
            )}</span>
            <span>Saved ${escapeHtml(formatTimestamp(game.updatedAt))}</span>
          </div>
          <button
            type="button"
            class="button-secondary button-small"
            data-resume-game="${escapeHtml(game.gameId)}"
            ${state.busy ? "disabled" : ""}
          >
            Resume
          </button>
        </article>
      `
    )
    .join("");
};
const renderHistory = () => {
  historyCount.textContent = `${state.history.length} recorded`;

  if (!state.persistence.available) {
    historyList.innerHTML = `
      <div class="empty-state">
        <strong>History is offline.</strong>
        <span>Completed games will appear here when MongoDB is available.</span>
      </div>
    `;
    return;
  }

  if (!state.history.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <strong>No completed games yet.</strong>
        <span>Finish a duel to store its summary and move record here.</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = state.history
    .map(
      (record) => `
        <article class="record-card">
          <div class="record-card-copy">
            <strong>${escapeHtml(formatHistoryHeadline(record))}</strong>
            <span>${escapeHtml(record.statusMessage)}</span>
            <span>${escapeHtml(formatColor(record.playerColor))} vs ${escapeHtml(
              formatColor(record.engineColor)
            )}</span>
            <span>${escapeHtml(record.difficulty)} difficulty - ${escapeHtml(
              `${record.moveCount} moves`
            )}</span>
            <span>Completed ${escapeHtml(formatTimestamp(record.completedAt))}</span>
          </div>
          <button
            type="button"
            class="button-secondary button-small"
            data-history-game="${escapeHtml(record.gameId)}"
            ${state.busy ? "disabled" : ""}
          >
            View
          </button>
        </article>
      `
    )
    .join("");
};

const resetHistoryDetail = () => {
  historyDetailResult.textContent = "-";
  historyDetailDifficulty.textContent = "-";
  historyDetailPlayer.textContent = "-";
  historyDetailCompleted.textContent = "-";
  historyDetailStatus.textContent = "-";
  historyDetailPgn.textContent = "-";
  historyDetailMoves.innerHTML = renderMoveRows(
    [],
    "No moves were recorded for this game."
  );
};

const renderBoard = () => {
  const legalTargets = getLegalTargets();
  const targetSquares = new Map(legalTargets.map((move) => [move.to, move]));
  const orderedSquares = getOrderedSquares();

  boardElement.innerHTML = orderedSquares
    .map((entry, index) => {
      const moveTarget = targetSquares.get(entry.square);
      const colorClass = getSquareColorClass(entry.square);
      const targetClass = moveTarget
        ? moveTarget.captured
          ? "square-capture"
          : "square-target"
        : "";
      const fileLabel =
        index >= 56
          ? `<span class="square-label square-file">${entry.file}</span>`
          : "";
      const rankLabel =
        index % 8 === 0
          ? `<span class="square-label square-rank">${entry.rank}</span>`
          : "";

      return `
        <button
          type="button"
          class="square ${colorClass} ${targetClass}"
          data-square="${entry.square}"
          aria-label="${entry.square}"
        >
          ${rankLabel}
          ${fileLabel}
          ${
            entry.piece
              ? `<span class="piece piece-${entry.piece.color}">${PIECES[entry.piece.color][entry.piece.type]}</span>`
              : ""
          }
        </button>
      `;
    })
    .join("");
};

const updateSummary = () => {
  if (!state.game) {
    renderImmersiveHud();
    return;
  }

  statusText.textContent = state.game.status.message;
  playerSide.textContent =
    state.game.settings.playerColor === "white" ? "White" : "Black";
  engineSide.textContent =
    state.game.settings.engineColor === "white" ? "White" : "Black";
  turnIndicator.textContent = state.game.turn ? formatColor(state.game.turn) : "-";
  lastMoveText.textContent = state.game.lastMove?.san || "None";
  renderImmersiveHud();
};

const renderImmersiveHud = () => {
  if (!immersiveStatusHeading || !immersiveStatusMeta) {
    return;
  }

  if (!state.game) {
    immersiveStatusHeading.textContent = "Preparing immersive board...";
    immersiveStatusMeta.textContent = "The duel summary will appear here.";
    return;
  }

  const playerColor = formatColor(state.game.settings?.playerColor);
  const engineColor = formatColor(state.game.settings?.engineColor);
  const turnLabel = state.game.turn ? formatColor(state.game.turn) : "-";
  const lastMoveLabel = state.game.lastMove?.san || "None";
  const statusMessage = trimTerminalPeriod(state.game.status?.message) || "Awaiting duel";
  const gameOverCopy = getGameOverCopy(state.game);

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
    immersiveStatusMeta.textContent = `${playerColor} vs ${engineColor} • Last move ${lastMoveLabel}`;
    return;
  }

  immersiveStatusHeading.textContent = statusMessage;
  immersiveStatusMeta.textContent = `${playerColor} vs ${engineColor} • Turn ${turnLabel} • Last move ${lastMoveLabel}`;
};

const renderBoardSurface = () => {
  renderBoard();
  syncBoard3D();
  renderBoardOverlays();
};

const render = () => {
  renderGuestProfile();
  renderBoardSurface();
  renderMoveList();
  renderSavedGames();
  renderHistory();
  renderCoachPanel();
  updateSummary();
  setRecordView(state.activeRecordView);
  syncActionButtons();
};

const syncControls = () => {
  if (!state.game) {
    return;
  }

  difficultySelect.value = state.game.settings.difficulty;
  document
    .querySelectorAll('input[name="player-color"]')
    .forEach((input) => (input.checked = input.value === state.game.settings.playerColor));
};

const setCoachStateForGame = (gameState, options = {}) => {
  const gameOverCopy = getGameOverCopy(gameState);

  if (options.preserveCoach) {
    return;
  }

  if (options.coachState) {
    state.coach = createCoachState(options.coachState);
    return;
  }

  if (gameState.coachFeedback) {
    state.coach = buildCoachFeedbackState(gameState.coachFeedback);
    return;
  }

  if (gameOverCopy) {
    state.coach = getGameOverCoachState(gameState);
    return;
  }

  if (options.feedbackMessage) {
    state.coach = createCoachState({
      message: options.feedbackMessage,
      explanation:
        options.feedbackExplanation ||
        "Arcane Coach will resume move grading after your next completed move."
    });
    return;
  }

  state.coach = getDefaultCoachState(gameState, options.coachContext);
};

const applyGameState = (gameState, options = {}) => {
  state.pendingNewGame = false;
  state.game = gameState;
  if (gameState?.isGameOver) {
    scheduleFinishedGameReset(gameState);
  } else {
    resetGameOverBannerLifecycle();
    resetFinishedGameResetLifecycle();
  }
  clearSelectedSquare();
  hideGameOverBanner({
    resetCopy: true
  });
  syncControls();
  setPersistence(gameState.persistence);
  setCoachStateForGame(gameState, options);
  render();
};

const loadGame = async () => {
  beginMoveCycle();
  const gameState = await request("/api/game");
  applyGameState(gameState, {
    coachContext: gameState.hasStarted ? "load-active" : "idle"
  });
};

const loadSavedGames = async () => {
  const payload = await request("/api/saves");
  state.savedGames = payload.items || [];
  setPersistence(payload.persistence);
  renderSavedGames();
};

const loadHistory = async () => {
  const payload = await request("/api/history");
  state.history = payload.items || [];
  setPersistence(payload.persistence);
  renderHistory();
};

const refreshCollections = async () => {
  await Promise.all([loadSavedGames(), loadHistory()]);
};

const ensureGuestSession = async () => {
  const storedGuest = readStoredGuest();

  try {
    const payload = await request("/api/guest/session", {
      method: "POST",
      body: JSON.stringify(storedGuest || {})
    });

    state.guest = payload.guest;
    persistGuest(payload.guest);
    setPersistence(payload.persistence);
  } catch (error) {
    const fallbackGuest = createFallbackGuest(storedGuest);
    state.guest = fallbackGuest;
    persistGuest(fallbackGuest);
    setPersistence({
      available: false,
      status: "guest-offline"
    });
    setCoachMessage(
      `${error.message} Guest mode has fallen back to local storage only.`,
      "Move feedback still works, but saved games and history depend on MongoDB."
    );
  }
};

const startNewGame = async () => {
  state.pendingNewGame = true;
  beginMoveCycle();
  resetFinishedGameResetLifecycle();
  resetGameOverBannerLifecycle();
  clearSelectedSquare();
  hideGameOverBanner({
    resetCopy: true
  });
  renderBoardSurface();
  setBusy(true, "Forging a new duel...");

  try {
    const gameState = await request("/api/game/new", {
      method: "POST",
      body: JSON.stringify({
        difficulty: difficultySelect.value,
        playerColor: getChosenColor()
      })
    });

    setApiHealth(true);
    applyGameState(gameState, {
      coachContext: "new-game"
    });
    void refreshCollections();
  } catch (error) {
    state.pendingNewGame = false;
    renderBoardSurface();
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const saveCurrentGame = async () => {
  setBusy(true, "Inscribing the current duel into your archive...");

  try {
    const payload = await request("/api/saves", {
      method: "POST"
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    applyGameState(payload.game, {
      feedbackMessage: "Game saved to your guest archive."
    });
    void refreshCollections();
    setRecordView("saves");
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const resumeSavedGame = async (gameId) => {
  beginMoveCycle();
  setBusy(true, "Restoring a saved duel...");

  try {
    const payload = await request(`/api/saves/${gameId}/resume`, {
      method: "POST"
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    applyGameState(payload.game, {
      coachContext: "resume"
    });
    void refreshCollections();
    setRecordView("moves");
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const resignCurrentGame = async () => {
  if (!window.confirm("Resign the current game?")) {
    return;
  }

  beginMoveCycle();
  setBusy(true, "Ending the match by resignation...");

  try {
    const gameState = await request("/api/game/resign", {
      method: "POST"
    });

    setApiHealth(true);
    applyGameState(gameState);
    void refreshCollections();
    setRecordView("history");
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const offerDraw = async () => {
  beginMoveCycle();
  setBusy(true, "Offering a draw...");

  try {
    const payload = await request("/api/game/draw", {
      method: "POST"
    });

    setApiHealth(true);
    applyGameState(payload.game, {
      feedbackMessage: payload.message
    });

    if (payload.accepted) {
      void refreshCollections();
      setRecordView("history");
    }
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const populateHistoryDetail = (record) => {
  const normalizedRecord = normalizeHistoryRecord(record);

  historyDetailResult.textContent = formatResult(
    normalizedRecord.result,
    normalizedRecord.playerColor,
    normalizedRecord
  );
  historyDetailDifficulty.textContent = normalizedRecord.difficulty;
  historyDetailPlayer.textContent = formatColor(normalizedRecord.playerColor);
  historyDetailCompleted.textContent = formatTimestamp(normalizedRecord.completedAt);
  historyDetailStatus.textContent = normalizedRecord.statusMessage;
  historyDetailPgn.textContent = normalizedRecord.pgn || "No PGN available.";
  historyDetailMoves.innerHTML = renderMoveRows(
    normalizedRecord.moveList,
    "No moves were recorded for this game."
  );
};

const showHistoryModal = () => {
  state.historyModalOpen = true;
  historyModal.classList.remove("hidden");
  historyModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  closeHistoryButton.focus();
};

const closeHistoryDetail = () => {
  state.historyModalOpen = false;
  state.historyDetailLoading = false;
  state.activeHistoryRequestId += 1;
  historyModal.classList.add("hidden");
  historyModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const openHistoryDetail = async (gameId) => {
  const requestId = state.activeHistoryRequestId + 1;
  state.activeHistoryRequestId = requestId;
  state.historyDetailLoading = true;
  setCoachMessage(
    "Opening completed game summary...",
    "The active board remains unchanged while the history archive loads."
  );
  resetHistoryDetail();
  showHistoryModal();

  try {
    const payload = await request(`/api/history/${gameId}`);

    if (requestId !== state.activeHistoryRequestId || !state.historyModalOpen) {
      return;
    }

    setApiHealth(true);
    setPersistence(payload.persistence);
    populateHistoryDetail(payload.record);
  } catch (error) {
    if (requestId !== state.activeHistoryRequestId) {
      return;
    }

    setApiHealth(false);
    closeHistoryDetail();
    setCoachMessage(error.message);
  } finally {
    if (requestId === state.activeHistoryRequestId) {
      state.historyDetailLoading = false;
    }
  }
};

const loadCoachFeedback = async ({ cycleId, moveToken }) => {
  try {
    const payload = await request("/api/game/coach", {
      method: "POST",
      body: JSON.stringify({ moveToken })
    });

    if (!isMoveCycleActive(cycleId) || payload.stale || !payload.coachFeedback) {
      return;
    }

    if (!canApplyCoachStage(cycleId, COACH_STAGE_PLAYER_FEEDBACK)) {
      return;
    }

    setApiHealth(true);
    setCoachStageRank(COACH_STAGE_PLAYER_FEEDBACK);
    state.coach = buildCoachFeedbackState(payload.coachFeedback);
    renderCoachPanel();
  } catch (error) {
    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    setApiHealth(false);
    setCoachMessage(error.message);
  }
};

const loadEngineReply = async ({ cycleId, moveToken }) => {
  try {
    const payload = await request("/api/game/engine", {
      method: "POST",
      body: JSON.stringify({ moveToken })
    });

    if (!isMoveCycleActive(cycleId) || payload.stale) {
      return;
    }

    setApiHealth(true);

    if (payload.game.isGameOver) {
      setCoachStageRank(COACH_STAGE_GAME_OVER);
      applyGameState(payload.game);
    } else if (
      payload.game.coachFeedback &&
      canApplyCoachStage(cycleId, COACH_STAGE_ENGINE_FEEDBACK)
    ) {
      setCoachStageRank(COACH_STAGE_ENGINE_FEEDBACK);
      applyGameState(payload.game);
    } else {
      applyGameState(payload.game, {
        preserveCoach: true
      });
    }

    setBusy(false);

    if (payload.game.isGameOver) {
      void refreshCollections();
      return;
    }
  } catch (error) {
    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    setApiHealth(false);
    setBusy(false);
    setCoachMessage(error.message);
  }
};

const submitMove = async ({ from, to, promotion, previewMove }) => {
  const cycleId = beginMoveCycle();
  const previousGame = cloneValue(state.game);
  const optimisticGame = buildOptimisticGameState(state.game, {
    ...previewMove,
    from,
    to,
    promotion: promotion || previewMove?.promotion || null
  });

  state.busy = true;
  setCoachStageRank(1);
  clearSelectedSquare();
  debugGameplaySync("move:submit", {
    from,
    to,
    promotion: promotion || null,
    previewMove
  });
  syncActionButtons();
  applyGameState(optimisticGame, {
    coachState: getThinkingCoachState()
  });

  try {
    const payload = await request("/api/game/move", {
      method: "POST",
      body: JSON.stringify({ from, to, promotion })
    });

    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    setApiHealth(true);
    applyGameState(payload.game, {
      coachState:
        payload.pending?.coach || payload.pending?.engine
          ? getThinkingCoachState()
          : null
    });

    if (payload.pending?.coach) {
      void loadCoachFeedback({
        cycleId,
        moveToken: payload.moveToken
      });
    }

    if (payload.pending?.engine) {
      void loadEngineReply({
        cycleId,
        moveToken: payload.moveToken
      });
      return;
    }

    setBusy(false);

    if (payload.game.isGameOver) {
      void refreshCollections();
    }
  } catch (error) {
    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    state.game = previousGame;
    clearSelectedSquare();
    syncControls();
    setApiHealth(false);
    render();
    setCoachMessage(error.message);
    setBusy(false);
  }
};

const handleSquareClick = (square) => {
  if (!state.game || state.busy) {
    return;
  }

  if (!state.game.hasStarted) {
    setCoachMessage(
      "Start a new game or resume a saved one.",
      "Arcane Coach appears as soon as an active match is underway."
    );
    return;
  }

  if (state.game.isGameOver) {
    setCoachMessage(
      "The game is over. Start a new one or review it in history.",
      "This position is already sealed."
    );
    return;
  }

  if (state.game.turn !== state.game.settings.playerColor) {
    setCoachMessage(
      "Wait for Stockfish to move.",
      "Your coach will grade your next move once the engine replies."
    );
    return;
  }

  const squareData = state.game.board.find((entry) => entry.square === square);
  const ownPiece =
    squareData?.piece && squareData.piece.color === state.game.settings.playerColor;
  debugGameplaySync("input:click", {
    clickedSquare: square,
    selectedSquare: state.selectedSquare,
    ownPiece: squareData?.piece || null,
    turn: state.game.turn,
    boardViewMode: state.boardViewMode
  });

  if (!state.selectedSquare) {
    if (ownPiece && state.game.legalMoves[square]?.length) {
      setSelectedSquare(square);
      setCoachMessage(
        `Selected ${square}. Choose a legal destination.`,
        "Highlighted targets show every legal landing square for that piece."
      );
      renderBoardSurface();
    } else {
      setCoachMessage(
        "Select one of your pieces with a legal move.",
        "Only your active pieces with legal targets can be moved right now."
      );
    }

    return;
  }

  if (state.selectedSquare === square) {
    setSelectedSquare(square);
    setCoachMessage(
      `Selected ${square}.`,
      "Choose one of the highlighted targets to complete the move."
    );
    renderBoardSurface();
    return;
  }

  if (ownPiece && state.game.legalMoves[square]?.length) {
    setSelectedSquare(square);
    setCoachMessage(
      `Selected ${square}.`,
      "Choose one of the highlighted targets to complete the move."
    );
    renderBoardSurface();
    return;
  }

  const matchingMoves = getLegalTargets().filter((move) => move.to === square);
  debugGameplaySync("move:attempt", {
    from: state.selectedSquare,
    to: square,
    matchingMoves
  });

  if (!matchingMoves.length) {
    setCoachMessage(
      "Illegal move. Choose a highlighted destination.",
      "Only highlighted squares are legal from the current position."
    );
    return;
  }

  if (matchingMoves.length > 1) {
    openPromotionPrompt(matchingMoves, square);
    renderBoardSurface();
    return;
  }

  submitMove({
    from: state.selectedSquare,
    to: square,
    promotion: matchingMoves[0].promotion || undefined,
    previewMove: matchingMoves[0]
  });
};

const initialize = async () => {
  renderGuestProfile();
  setRecordView(state.activeRecordView);
  syncBoardViewUi();

  try {
    await ensureGuestSession();
    await Promise.all([loadGame(), refreshCollections()]);
    setApiHealth(true);
  } catch (error) {
    setApiHealth(false);
    statusText.textContent = "Unable to load the game.";
    setCoachMessage(error.message);
  } finally {
    syncActionButtons();
  }
};

boardElement.addEventListener("click", (event) => {
  const squareButton = event.target.closest("[data-square]");

  if (!squareButton) {
    return;
  }

  handleSquareClick(squareButton.dataset.square);
});

promotionPanel.addEventListener("click", (event) => {
  const action = event.target.closest("[data-promotion]");

  if (!action || !state.pendingPromotion?.moveChoices?.length || !state.selectedSquare) {
    return;
  }

  const chosenMove = state.pendingPromotion.moveChoices.find(
    (move) => move.promotion === action.dataset.promotion
  );

  if (!chosenMove) {
    return;
  }

  submitMove({
    from: state.selectedSquare,
    to: chosenMove.to,
    promotion: chosenMove.promotion,
    previewMove: chosenMove
  });
});

boardViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setBoardViewMode(button.dataset.boardView);
  });
});

immersiveExitButton?.addEventListener("click", () => {
  setBoardViewMode("2d");
});

immersiveNewGameButton?.addEventListener("click", startNewGame);
immersiveOfferDrawButton?.addEventListener("click", offerDraw);
immersiveResignButton?.addEventListener("click", resignCurrentGame);

recordTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setRecordView(tab.dataset.recordView);
  });
});

savedGamesList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-resume-game]");

  if (!action) {
    return;
  }

  resumeSavedGame(action.dataset.resumeGame);
});

historyList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-history-game]");

  if (!action) {
    return;
  }

  openHistoryDetail(action.dataset.historyGame);
});

historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal || event.target.closest("[data-close-history]")) {
    closeHistoryDetail();
  }
});

historyModalCard?.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.pendingPromotion?.moveChoices?.length) {
    event.preventDefault();
    clearPromotionPrompt();
    renderBoardSurface();
    return;
  }

  if (event.key === "Escape" && state.historyModalOpen) {
    event.preventDefault();
    closeHistoryDetail();
  }
});

window.addEventListener("resize", () => {
  state.board3D?.scheduleResize?.({
    immediate: true
  });

  if (state.pendingPromotion?.moveChoices?.length || state.game?.isGameOver) {
    renderBoardOverlays();
  }
});

window.addEventListener("arcane-3d-ready", handleArcane3DReady);

closeHistoryButton.addEventListener("click", (event) => {
  event.preventDefault();
  closeHistoryDetail();
});
newGameButton.addEventListener("click", startNewGame);
saveGameButton.addEventListener("click", saveCurrentGame);
offerDrawButton.addEventListener("click", offerDraw);
resignButton.addEventListener("click", resignCurrentGame);

handleArcane3DReady();
initialize();
