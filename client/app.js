const GUEST_STORAGE_KEY = "arcane-chess-guest-profile";
const RECORD_VIEW_STORAGE_KEY = "arcane-chess-record-view";

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
const boardFeedbackBanner = document.getElementById("board-feedback-banner");
const boardFeedbackTitle = document.getElementById("board-feedback-title");
const boardFeedbackMessage = document.getElementById("board-feedback-message");
const claimDrawButton = document.getElementById("claim-draw-button");
const continuePlayButton = document.getElementById("continue-play-button");
const immersiveHud = document.getElementById("immersive-hud");
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
const authSessionHeading = document.getElementById("auth-session-heading");
const authSessionPill = document.getElementById("auth-session-pill");
const authSessionCopy = document.getElementById("auth-session-copy");
const authGuestView = document.getElementById("auth-guest-view");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authDisplayNameInput = document.getElementById("auth-display-name");
const loginButton = document.getElementById("login-button");
const registerButton = document.getElementById("register-button");
const authUserView = document.getElementById("auth-user-view");
const authUserDisplay = document.getElementById("auth-user-display");
const authUserEmail = document.getElementById("auth-user-email");
const logoutButton = document.getElementById("logout-button");
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
const replayBoard = document.getElementById("replay-board");
const replayBack = document.getElementById("replay-back");
const replayForward = document.getElementById("replay-forward");
const replayStepLabel = document.getElementById("replay-step-label");
const timeControlSelect = document.getElementById("time-control-select");
const topClockLabel = document.getElementById("top-clock-label");
const topClockCard = document.getElementById("top-clock-card");
const topClockSide = document.getElementById("top-clock-side");
const topClockTime = document.getElementById("top-clock-time");
const topClockMeta = document.getElementById("top-clock-meta");
const bottomClockLabel = document.getElementById("bottom-clock-label");
const bottomClockCard = document.getElementById("bottom-clock-card");
const bottomClockSide = document.getElementById("bottom-clock-side");
const bottomClockTime = document.getElementById("bottom-clock-time");
const bottomClockMeta = document.getElementById("bottom-clock-meta");

const DEFAULT_COACH_EXPLANATION =
  "I review each completed move against Stockfish.";
const THINKING_COACH_EXPLANATION =
  "Your move is down. The reply is forming now.";
const GAME_OVER_BANNER_DURATION_MS = 4200;
const CLOCK_TICK_INTERVAL_MS = 250;
const CLOCK_SYNC_INTERVAL_MS = 1000;
const TIME_CONTROL_PRESETS = {
  untimed: {
    label: "Untimed",
    enabled: false,
    baseMs: 0,
    incrementMs: 0
  },
  "bullet-1": {
    label: "1 min",
    enabled: true,
    baseMs: 60_000,
    incrementMs: 0
  },
  "blitz-3": {
    label: "3 min",
    enabled: true,
    baseMs: 180_000,
    incrementMs: 0
  },
  "blitz-5": {
    label: "5 min",
    enabled: true,
    baseMs: 300_000,
    incrementMs: 0
  },
  "rapid-10": {
    label: "10 min",
    enabled: true,
    baseMs: 600_000,
    incrementMs: 0
  },
  "rapid-15-10": {
    label: "15 | 10",
    enabled: true,
    baseMs: 900_000,
    incrementMs: 10_000
  }
};
const DRAW_OUTCOME_LABELS = {
  stalemate: "Stalemate",
  "draw-repetition": "Draw by repetition",
  "draw-fivefold-repetition": "Draw by fivefold repetition",
  "draw-insufficient-material": "Draw by insufficient material",
  "draw-fifty-move": "Draw by fifty-move rule",
  "draw-seventy-five-move": "Draw by seventy-five-move rule",
  "draw-timeout-insufficient-material": "Draw by timeout vs insufficient material",
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
  session: {
    authenticated: false,
    user: null
  },
  game: null,
  boardViewMode: "2d",
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
  clockSyncInFlight: false,
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
let clockDisplayIntervalId = null;
let clockSyncIntervalId = null;

// ── Replay state ─────────────────────────────────────────────────────────
let replayFenSteps = [];
let replayMoveHistory = [];
let replayMoveList = [];
let replayIndex = 0;
let replayPlayerColor = "white";

const VALID_RECORD_VIEWS = new Set(["moves", "saves", "history"]);
const syncBoardViewUi = () => {
  state.boardViewMode = "2d";
  const is3D = false;

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

  renderImmersiveHud();
};

const syncBoard3D = () => {
  syncBoardViewUi();
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

const getDrawClaimState = (gameState = state.game) =>
  gameState?.ruleState?.drawClaim?.available ? gameState.ruleState.drawClaim : null;

const getCheckedKingSquare = (gameState = state.game) => {
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
    case "draw-fivefold-repetition":
      return createCoachState({
        source: "system",
        message: "The same pattern echoed until the duel was forced still.",
        explanation: "Draw by fivefold repetition. The position repeated beyond recovery.",
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
    case "draw-seventy-five-move":
      return createCoachState({
        source: "system",
        message: "The duel exhausted itself beyond recall.",
        explanation: "Draw by seventy-five-move rule. The board reached a forced dead calm.",
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
    case "draw-timeout-insufficient-material":
      return createCoachState({
        source: "system",
        message: "The flag fell, but no mating force remained.",
        explanation:
          "Draw by timeout versus insufficient material. The finish could no longer be forced.",
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
const PIECE_LABELS = {
  p: "pawn",
  r: "rook",
  n: "knight",
  b: "bishop",
  q: "queen",
  k: "king"
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

  if (gameState.status.code === "timeout") {
    return createCoachState({
      message: playerWon ? "Their flag fell. The duel is yours." : "Your clock fell before the finish.",
      explanation: playerWon
        ? "Time pressure finished the battle. Begin another when ready."
        : "The position may have held, but the clock did not. Reset and return sharper.",
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

  const drawClaim = getDrawClaimState(gameState);

  if (drawClaim?.available) {
    return createCoachState({
      message: drawClaim.message,
      explanation:
        gameState.turn === gameState.settings.engineColor
          ? "Claim the draw now, or continue play to allow the engine reply."
          : "You may claim the draw before choosing a different continuation.",
      ...createPersistentCoachMotion("draw-special", {
        outcome: "draw"
      })
    });
  }

  if (gameState.status?.code === "check") {
    return createCoachState({
      message: "Check. The king must be secured immediately.",
      explanation: "Only moves that answer the threat are legal from this position.",
      ...createPersistentCoachMotion("thinking")
    });
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

const formatTimeControl = (timeControl = null) =>
  getResolvedTimeControl(timeControl).label;

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

const getSelectedTimeControlId = () => timeControlSelect?.value || "untimed";

const getResolvedTimeControl = (timeControl = null) => {
  const id =
    typeof timeControl === "string"
      ? timeControl
      : typeof timeControl?.id === "string"
        ? timeControl.id
        : "untimed";
  const preset = TIME_CONTROL_PRESETS[id] || TIME_CONTROL_PRESETS.untimed;

  return {
    id,
    label: timeControl?.label || preset.label,
    enabled: Boolean(
      typeof timeControl?.enabled === "boolean" ? timeControl.enabled : preset.enabled
    ),
    baseMs: Number(timeControl?.baseMs ?? preset.baseMs ?? 0),
    incrementMs: Number(timeControl?.incrementMs ?? preset.incrementMs ?? 0)
  };
};

const isTimedGameState = (gameState = state.game) =>
  Boolean(gameState?.clockState?.enabled && gameState.clockState.timeControlId !== "untimed");

const getClockDisplayState = (clockState = state.game?.clockState) => {
  if (!clockState?.enabled) {
    return null;
  }

  const serverNowMs = Date.parse(clockState.serverNow || "") || Date.now();
  const elapsedSinceSyncMs = Math.max(0, Date.now() - serverNowMs);
  let whiteMs = Math.max(0, Number(clockState.whiteMs || 0));
  let blackMs = Math.max(0, Number(clockState.blackMs || 0));

  if (clockState.isRunning && clockState.activeColor === "white") {
    whiteMs = Math.max(0, whiteMs - elapsedSinceSyncMs);
  }

  if (clockState.isRunning && clockState.activeColor === "black") {
    blackMs = Math.max(0, blackMs - elapsedSinceSyncMs);
  }

  return {
    ...clockState,
    whiteMs,
    blackMs
  };
};

const formatClockMs = (milliseconds = 0) => {
  const clampedMs = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainderMinutes = minutes % 60;
    return `${hours}:${String(remainderMinutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getBoardClockColors = (gameState = state.game) => {
  const playerColor =
    gameState?.hasStarted ? gameState?.settings?.playerColor || "white" : getChosenColor();

  return playerColor === "black"
    ? {
        top: "white",
        bottom: "black"
      }
    : {
        top: "black",
        bottom: "white"
      };
};

const isAuthenticated = () =>
  Boolean(state.session?.authenticated && state.session.user?.id);

const getSessionDisplayName = () =>
  state.session?.user?.displayName || state.session?.user?.email || "Arcane Player";

const getLocalPlayerDisplayName = () =>
  isAuthenticated()
    ? getSessionDisplayName()
    : state.guest?.displayName || "Guest";

const getGuestHeaders = () =>
  state.guest?.guestId ? { "X-Guest-Id": state.guest.guestId } : {};

const setSessionState = (session = {}) => {
  state.session = {
    authenticated: Boolean(session.authenticated && session.user),
    user: session.user || null
  };

  renderGuestProfile();
  renderSessionUi();
  syncActionButtons();
};

const renderGuestProfile = () => {
  if (isAuthenticated()) {
    guestName.textContent = getSessionDisplayName();
    guestSubtitle.textContent = state.persistence.available
      ? "Account sync is active for this archive."
      : "Account session is active, but MongoDB persistence is offline.";
    guestMeta.textContent = state.session.user?.email
      ? `${state.session.user.email} · Unfinished and completed games belong to your account.`
      : "Unfinished and completed games belong to your account.";
    return;
  }

  guestName.textContent = state.guest?.displayName || "Playing as Guest";

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

const renderSessionUi = () => {
  if (!authSessionHeading) {
    return;
  }

  const persistenceAvailable = Boolean(state.persistence.available);
  const authenticated = isAuthenticated();

  if (authenticated) {
    authSessionHeading.textContent = "Account connected";
    authSessionPill.textContent = "Signed In";
    authSessionPill.className = "pill pill-ok";
    authSessionCopy.textContent = persistenceAvailable
      ? "Saved and completed games now follow your account across devices and browsers."
      : "Your session is active, but account sync is paused until MongoDB returns.";
    authUserDisplay.textContent = getSessionDisplayName();
    authUserEmail.textContent = state.session.user?.email || "Account email unavailable";
    authGuestView.classList.add("hidden");
    authUserView.classList.remove("hidden");
    return;
  }

  authSessionHeading.textContent = "Sign in or create an account";
  authSessionPill.textContent = persistenceAvailable ? "Guest" : "Offline";
  authSessionPill.className = persistenceAvailable ? "pill" : "pill pill-error";
  authSessionCopy.textContent = persistenceAvailable
    ? "Accounts sync unfinished and completed games beyond this browser."
    : "MongoDB is offline, so account sign-in and long-term sync are unavailable right now.";
  authGuestView.classList.remove("hidden");
  authUserView.classList.add("hidden");
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

  const authDisabled = state.busy || !state.persistence.available;

  if (authEmailInput) {
    authEmailInput.disabled = authDisabled || isAuthenticated();
  }

  if (authPasswordInput) {
    authPasswordInput.disabled = authDisabled || isAuthenticated();
  }

  if (authDisplayNameInput) {
    authDisplayNameInput.disabled = authDisabled || isAuthenticated();
  }

  if (loginButton) {
    loginButton.disabled = authDisabled || isAuthenticated();
  }

  if (registerButton) {
    registerButton.disabled = authDisabled || isAuthenticated();
  }

  if (logoutButton) {
    logoutButton.disabled = state.busy || !isAuthenticated();
  }
};

const setPersistence = (persistence = {}) => {
  state.persistence = {
    available: Boolean(persistence.available),
    status: persistence.status || "disconnected"
  };

  renderGuestProfile();
  renderSessionUi();
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
  renderBoardOverlays();

  if (message) {
    setCoachMessage(message);
  }
};

const setApiHealth = (healthy) => {
  apiHealth.textContent = healthy ? "API Ready" : "API Error";
  apiHealth.className = healthy ? "pill pill-ok" : "pill pill-error";
};

const renderClockCard = ({
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
  if (!labelElement || !cardElement || !sideElement || !timeElement || !metaElement) {
    return;
  }

  const playerColor = gameState?.settings?.playerColor || getChosenColor();
  const isPlayerSide = color === playerColor;
  const rowElement = cardElement.closest(".board-player-row");
  const startingTimeLabel =
    timeControl.id === "untimed" ? "Untimed" : formatClockMs(timeControl.baseMs);

  labelElement.textContent = roleLabel;
  sideElement.textContent = `${formatColor(color)} pieces`;
  rowElement?.setAttribute("data-player-side", isPlayerSide ? "self" : "opponent");

  if (!clockDisplayState?.enabled) {
    timeElement.textContent = startingTimeLabel;
    metaElement.textContent = timeControl.id === "untimed" ? "Untimed" : "";
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
      ? `Stopped · ${timeControl.label}`
      : `${isActive ? "Running" : "Waiting"} · ${timeControl.label}`;
  metaElement.textContent = flagged
    ? "Flag"
    : timeControl.incrementMs
      ? `+${Math.round(timeControl.incrementMs / 1000)}`
      : "";
  metaElement.classList.toggle("hidden", !metaElement.textContent);
  cardElement.dataset.active = isActive ? "true" : "false";
  cardElement.dataset.urgent = isUrgent ? "true" : "false";
  cardElement.dataset.untimed = "false";
  rowElement?.setAttribute("data-active", isActive ? "true" : "false");
};

const renderClocks = () => {
  const gameState = state.game;
  const boardClockColors = getBoardClockColors(gameState);
  const playerColor = gameState?.settings?.playerColor || getChosenColor();
  const timeControl = gameState?.hasStarted
    ? getResolvedTimeControl(gameState.settings?.timeControl)
    : getResolvedTimeControl(getSelectedTimeControlId());
  const clockDisplayState = getClockDisplayState(gameState?.clockState);

  renderClockCard({
    labelElement: topClockLabel,
    cardElement: topClockCard,
    sideElement: topClockSide,
    timeElement: topClockTime,
    metaElement: topClockMeta,
    roleLabel:
      boardClockColors.top === playerColor ? getLocalPlayerDisplayName() : "Stockfish",
    color: boardClockColors.top,
    clockDisplayState,
    timeControl,
    gameState
  });

  renderClockCard({
    labelElement: bottomClockLabel,
    cardElement: bottomClockCard,
    sideElement: bottomClockSide,
    timeElement: bottomClockTime,
    metaElement: bottomClockMeta,
    roleLabel:
      boardClockColors.bottom === playerColor
        ? getLocalPlayerDisplayName()
        : "Stockfish",
    color: boardClockColors.bottom,
    clockDisplayState,
    timeControl,
    gameState
  });
};

const syncTimedGameState = async () => {
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
  } catch (error) {
    setApiHealth(false);
  } finally {
    state.clockSyncInFlight = false;
  }
};

const updateClockLoops = () => {
  if (clockDisplayIntervalId) {
    window.clearInterval(clockDisplayIntervalId);
    clockDisplayIntervalId = null;
  }

  if (clockSyncIntervalId) {
    window.clearInterval(clockSyncIntervalId);
    clockSyncIntervalId = null;
  }

  renderClocks();

  if (!isTimedGameState(state.game) || !state.game?.hasStarted || state.game?.isGameOver) {
    return;
  }

  clockDisplayIntervalId = window.setInterval(renderClocks, CLOCK_TICK_INTERVAL_MS);
  clockSyncIntervalId = window.setInterval(syncTimedGameState, CLOCK_SYNC_INTERVAL_MS);
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

const PROMOTION_OPTION_LABELS = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight"
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

const syncPromotionActionLabels = () => {
  const promotionColor =
    state.game?.settings?.playerColor === "black" ? "black" : "white";

  promotionPanel.querySelectorAll("[data-promotion]").forEach((button) => {
    const promotionType = button.dataset.promotion;
    const pieceGlyph = PIECES[promotionColor]?.[promotionType] || "";
    const pieceLabel = PROMOTION_OPTION_LABELS[promotionType] || promotionType?.toUpperCase?.() || "";

    button.innerHTML = `
      <span class="promotion-choice-piece">${pieceGlyph}</span>
      <span class="promotion-choice-copy">
        <strong>${pieceLabel}</strong>
        <small>${promotionType.toUpperCase()}</small>
      </span>
    `;
  });
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

  syncPromotionActionLabels();

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

const hideBoardFeedback = () => {
  if (!boardFeedbackBanner) {
    return;
  }

  boardFeedbackBanner.classList.add("hidden");
  boardFeedbackBanner.setAttribute("aria-hidden", "true");
  boardFeedbackBanner.dataset.tone = "neutral";
  claimDrawButton?.classList.add("hidden");
  continuePlayButton?.classList.add("hidden");
};

const renderBoardFeedback = () => {
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
    hideBoardFeedback();
    return;
  }

  if (drawClaim?.available) {
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
    boardFeedbackBanner.classList.remove("hidden");
    boardFeedbackBanner.setAttribute("aria-hidden", "false");
    boardFeedbackBanner.dataset.tone = "warning";
    boardFeedbackTitle.textContent = "Check";
    boardFeedbackMessage.textContent =
      trimTerminalPeriod(state.game.status.message) || "The king is under attack.";
    claimDrawButton?.classList.add("hidden");
    continuePlayButton?.classList.add("hidden");
    return;
  }

  hideBoardFeedback();
};

const renderBoardOverlays = () => {
  renderGameOverBanner();
  renderBoardFeedback();

  if (state.pendingPromotion?.moveChoices?.length) {
    renderPromotionPrompt();
    return;
  }

  promotionPanel.classList.add("hidden");
};

const renderMoveRows = (
  moveList = [],
  emptyMessage = "No moves recorded yet.",
  lastMove = null
) => {
  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  const currentTurn = moveList.at(-1)?.turn ?? null;
  const currentMoveColor = lastMove?.color || null;

  return `
    <div class="move-row move-row-head" role="presentation">
      <span>Turn</span>
      <span>White</span>
      <span>Black</span>
    </div>
    ${moveList
    .map(
      (move) => {
        const highlightWhite =
          currentMoveColor === "white" && currentTurn === move.turn && Boolean(move.white);
        const highlightBlack =
          currentMoveColor === "black" && currentTurn === move.turn && Boolean(move.black);

        return `
        <div class="move-row ${highlightWhite || highlightBlack ? "move-row-current" : ""}">
          <strong class="move-turn">${escapeHtml(`${move.turn}.`)}</strong>
          <span class="move-cell ${highlightWhite ? "move-cell-current" : ""}">${escapeHtml(
            move.white || "-"
          )}</span>
          <span class="move-cell ${highlightBlack ? "move-cell-current" : ""}">${escapeHtml(
            move.black || "-"
          )}</span>
        </div>
      `;
      }
    )
    .join("")}
  `;
};

const renderMoveList = () => {
  moveListElement.innerHTML = renderMoveRows(
    state.game?.moveList || [],
    "No moves have been recorded yet.",
    state.game?.lastMove || null
  );
};

const renderSavedGames = () => {
  savedGamesCount.textContent = `${state.savedGames.length} saved`;
  const ownerLabel = isAuthenticated() ? "your account" : "this browser";

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
        <span>Use Save Game on any in-progress duel to archive it for later on ${escapeHtml(
          ownerLabel
        )}.</span>
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
            <span>${escapeHtml(formatTimeControl(game.timeControl))}</span>
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
// ── Replay board ─────────────────────────────────────────────────────────

const parseFenToBoard = (fen) => {
  const position = fen.split(" ")[0];
  const rows = position.split("/");
  const RANK_LABELS = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const board = [];

  rows.forEach((row, rankIndex) => {
    const rank = RANK_LABELS[rankIndex];
    let fileIndex = 0;

    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const count = Number(ch);

        for (let i = 0; i < count; i++) {
          const file = FILE_LABELS[fileIndex + i];
          board.push({ square: `${file}${rank}`, file, rank, piece: null });
        }

        fileIndex += count;
      } else {
        const file = FILE_LABELS[fileIndex];
        const color = ch === ch.toUpperCase() ? "white" : "black";
        const type = ch.toLowerCase();
        board.push({ square: `${file}${rank}`, file, rank, piece: { type, color } });
        fileIndex++;
      }
    }
  });

  return board;
};

const renderReplayBoard = () => {
  if (!replayBoard) return;

  const fen = replayFenSteps[replayIndex];

  if (!fen) {
    replayBoard.innerHTML = "";
    return;
  }

  const boardData = parseFenToBoard(fen);
  const lookup = new Map(boardData.map((e) => [e.square, e]));
  const files =
    replayPlayerColor === "black"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks =
    replayPlayerColor === "black"
      ? ["1", "2", "3", "4", "5", "6", "7", "8"]
      : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const lastMoveFrom = replayIndex > 0 ? replayMoveHistory[replayIndex - 1]?.from : null;
  const lastMoveTo = replayIndex > 0 ? replayMoveHistory[replayIndex - 1]?.to : null;

  const squares = [];
  ranks.forEach((rank) => files.forEach((file) => squares.push(lookup.get(`${file}${rank}`))));

  replayBoard.innerHTML = squares
    .map((entry, index) => {
      if (!entry) return "";
      const colorClass = getSquareColorClass(entry.square);
      const classes = ["square", colorClass];
      if (entry.square === lastMoveFrom) classes.push("square-last-from");
      if (entry.square === lastMoveTo) classes.push("square-last-to");

      const fileLabel =
        index >= 56 ? `<span class="square-label square-file">${entry.file}</span>` : "";
      const rankLabel =
        index % 8 === 0 ? `<span class="square-label square-rank">${entry.rank}</span>` : "";

      return `
        <div class="${classes.join(" ")}" data-square="${entry.square}">
          ${rankLabel}${fileLabel}
          ${entry.piece
            ? `<span class="piece piece-${entry.piece.color}">${PIECES[entry.piece.color][entry.piece.type]}</span>`
            : ""}
        </div>
      `;
    })
    .join("");
};

const renderReplayMoveRows = (moveList = [], activeHalfMoveIndex = -1) => {
  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>No moves were recorded for this game.</strong>
      </div>
    `;
  }

  return `
    <div class="move-row move-row-head" role="presentation">
      <span>Turn</span>
      <span>White</span>
      <span>Black</span>
    </div>
    ${moveList
      .map((move) => {
        const whiteMoveIdx = (move.turn - 1) * 2;
        const blackMoveIdx = (move.turn - 1) * 2 + 1;
        const highlightWhite = activeHalfMoveIndex === whiteMoveIdx && Boolean(move.white);
        const highlightBlack = activeHalfMoveIndex === blackMoveIdx && Boolean(move.black);

        return `
          <div class="move-row ${highlightWhite || highlightBlack ? "move-row-current" : ""}">
            <strong class="move-turn">${escapeHtml(`${move.turn}.`)}</strong>
            <span class="move-cell ${highlightWhite ? "move-cell-current" : ""}">${escapeHtml(move.white || "-")}</span>
            <span class="move-cell ${highlightBlack ? "move-cell-current" : ""}">${escapeHtml(move.black || "-")}</span>
          </div>
        `;
      })
      .join("")}
  `;
};

const updateReplayControls = () => {
  const total = Math.max(0, replayFenSteps.length - 1);
  const hasData = replayFenSteps.length > 0;

  if (replayStepLabel) {
    if (!hasData) {
      replayStepLabel.textContent = "No data";
    } else {
      replayStepLabel.textContent = replayIndex === 0 ? "Start" : `Move ${replayIndex} of ${total}`;
    }
  }

  if (replayBack) replayBack.disabled = replayIndex <= 0 || !hasData;
  if (replayForward) replayForward.disabled = replayIndex >= total || !hasData;
};

const scrollReplayActiveMoveIntoView = () => {
  if (!historyDetailMoves) return;
  const active = historyDetailMoves.querySelector(".move-cell-current");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
};

const setReplayStep = (index) => {
  replayIndex = Math.max(0, Math.min(index, Math.max(0, replayFenSteps.length - 1)));
  renderReplayBoard();
  if (historyDetailMoves) {
    historyDetailMoves.innerHTML = renderReplayMoveRows(replayMoveList, replayIndex - 1);
  }
  updateReplayControls();
  scrollReplayActiveMoveIntoView();
};

const stepReplay = (delta) => setReplayStep(replayIndex + delta);

const initReplay = (moveList, fenSteps, moveHistory, playerColor) => {
  replayMoveList = moveList || [];
  replayFenSteps = fenSteps || [];
  replayMoveHistory = moveHistory || [];
  replayPlayerColor = playerColor || "white";
  setReplayStep(0);
};

const clearReplay = () => {
  replayFenSteps = [];
  replayMoveHistory = [];
  replayMoveList = [];
  replayIndex = 0;
  if (replayBoard) replayBoard.innerHTML = "";
  updateReplayControls();
};

const renderHistory = () => {
  historyCount.textContent = `${state.history.length} recorded`;
  const ownerLabel = isAuthenticated() ? "your account" : "this browser";

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
        <span>Finish a duel to store its summary and move record for ${escapeHtml(
          ownerLabel
        )}.</span>
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
            <span>${escapeHtml(formatTimeControl(record.timeControl))}</span>
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
  if (historyDetailMoves) {
    historyDetailMoves.innerHTML = renderReplayMoveRows([], -1);
  }
  clearReplay();
};

const renderBoard = () => {
  const legalTargets = getLegalTargets();
  const targetSquares = new Map(legalTargets.map((move) => [move.to, move]));
  const orderedSquares = getOrderedSquares();
  const lastMove = state.game?.lastMove || null;
  const checkedKingSquare = getCheckedKingSquare(state.game);
  const playerColor = state.game?.settings?.playerColor || "white";
  const isPlayerTurn = state.game?.turn === playerColor;
  const canInteract =
    !state.busy &&
    !state.game?.isGameOver &&
    !state.pendingPromotion?.moveChoices?.length;

  boardElement.innerHTML = orderedSquares
    .map((entry, index) => {
      const moveTarget = targetSquares.get(entry.square);
      const colorClass = getSquareColorClass(entry.square);
      const isSelected = state.selectedSquare === entry.square;
      const isLastFrom = lastMove?.from === entry.square;
      const isLastTo = lastMove?.to === entry.square;
      const isCheckedKing = checkedKingSquare === entry.square;
      const isOwnPiece = entry.piece?.color === playerColor;
      const isSelectable =
        canInteract && isPlayerTurn && isOwnPiece && Boolean(state.game?.legalMoves?.[entry.square]?.length);
      const squareClasses = ["square", colorClass];

      if (moveTarget) {
        squareClasses.push(moveTarget.captured ? "square-capture" : "square-target");
        squareClasses.push("square-legal-destination");
      }

      if (isSelected) {
        squareClasses.push("square-selected");
      }

      if (isLastFrom) {
        squareClasses.push("square-last-from");
      }

      if (isLastTo) {
        squareClasses.push("square-last-to");
      }

      if (isCheckedKing) {
        squareClasses.push("square-check");
      }

      if (isSelectable) {
        squareClasses.push("square-selectable");
      }

      const fileLabel =
        index >= 56
          ? `<span class="square-label square-file">${entry.file}</span>`
          : "";
      const rankLabel =
        index % 8 === 0
          ? `<span class="square-label square-rank">${entry.rank}</span>`
          : "";
      const pieceDescription = entry.piece
        ? `${formatColor(entry.piece.color)} ${PIECE_LABELS[entry.piece.type] || "piece"}`
        : "empty square";
      const ariaStates = [];

      if (isSelected) {
        ariaStates.push("selected");
      }

      if (moveTarget) {
        ariaStates.push(moveTarget.captured ? "capture available" : "legal destination");
      }

      if (isLastFrom || isLastTo) {
        ariaStates.push("part of the last move");
      }

      if (isCheckedKing) {
        ariaStates.push("king in check");
      }

      const ariaLabel = [entry.square, pieceDescription, ...ariaStates].join(", ");

      return `
        <button
          type="button"
          class="${squareClasses.join(" ")}"
          data-square="${entry.square}"
          aria-label="${escapeHtml(ariaLabel)}"
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

  statusText.textContent =
    getDrawClaimState(state.game)?.message || state.game.status.message;
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
  renderSessionUi();
  renderBoardSurface();
  renderClocks();
  renderMoveList();
  renderSavedGames();
  renderHistory();
  renderCoachPanel();
  updateSummary();
  setRecordView(state.activeRecordView);
  syncActionButtons();
  updateClockLoops();
};

const syncControls = () => {
  if (!state.game) {
    if (timeControlSelect) {
      timeControlSelect.value = getSelectedTimeControlId();
    }
    return;
  }

  difficultySelect.value = state.game.settings.difficulty;
  if (timeControlSelect) {
    timeControlSelect.value = state.game.settings.timeControl?.id || "untimed";
  }
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
  if (!options.preserveSelection) {
    clearSelectedSquare();
  }
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

const clearAuthInputs = ({ keepEmail = false } = {}) => {
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

const getAuthTransferMessage = (transferred = {}) => {
  const totalTransferred =
    (transferred.savedGamesTransferred || 0) +
    (transferred.historyGamesTransferred || 0);

  if (!totalTransferred) {
    return "Account sync is ready. New saves and completed games now belong to your account.";
  }

  const noun = totalTransferred === 1 ? "game" : "games";
  return `${totalTransferred} archived ${noun} moved from this browser guest profile into your account.`;
};

const loadSession = async () => {
  const payload = await request("/api/auth/session");
  setPersistence(payload.persistence);
  setSessionState(payload);
  return payload;
};

const registerAccount = async () => {
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
    await Promise.all([loadGame(), refreshCollections()]);
    setRecordView("saves");
    setCoachMessage(
      "Account created.",
      getAuthTransferMessage(payload.transferred)
    );
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const loginAccount = async () => {
  setBusy(true, "Signing you in...");

  try {
    const payload = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: authEmailInput?.value?.trim() || "",
        password: authPasswordInput?.value || ""
      })
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    setSessionState(payload);
    clearAuthInputs({
      keepEmail: true
    });
    await Promise.all([loadGame(), refreshCollections()]);
    setRecordView("saves");
    setCoachMessage("Signed in.", getAuthTransferMessage(payload.transferred));
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const logoutAccount = async () => {
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
        playerColor: getChosenColor(),
        timeControl: getSelectedTimeControlId()
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
      feedbackMessage: isAuthenticated()
        ? "Game saved to your account archive."
        : "Game saved to your guest archive."
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

const claimAvailableDraw = async () => {
  const drawClaim = getDrawClaimState(state.game);

  if (!drawClaim?.available) {
    return;
  }

  beginMoveCycle();
  setBusy(true, "Claiming the draw...");

  try {
    const gameState = await request("/api/game/claim-draw", {
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

const continueAfterDrawClaim = async () => {
  const drawClaim = getDrawClaimState(state.game);
  const engineTurnPaused =
    drawClaim?.available && state.game?.turn === state.game?.settings?.engineColor;

  if (!engineTurnPaused) {
    return;
  }

  beginMoveCycle();
  setBusy(true, "Continuing the duel...");

  try {
    const payload = await request("/api/game/engine", {
      method: "POST"
    });

    setApiHealth(true);

    if (payload.game.isGameOver) {
      setCoachStageRank(COACH_STAGE_GAME_OVER);
      applyGameState(payload.game);
      void refreshCollections();
    } else if (payload.game.coachFeedback) {
      setCoachStageRank(COACH_STAGE_ENGINE_FEEDBACK);
      applyGameState(payload.game);
    } else {
      applyGameState(payload.game, {
        preserveCoach: true
      });
    }
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const populateHistoryDetail = (record, fenSteps = [], moveHistory = []) => {
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
  initReplay(normalizedRecord.moveList, fenSteps, moveHistory, normalizedRecord.playerColor);
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
    populateHistoryDetail(payload.record, payload.fenSteps || [], payload.moveHistory || []);
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

  const drawClaim = getDrawClaimState(state.game);

  if (state.game.turn !== state.game.settings.playerColor) {
    if (drawClaim?.available) {
      setCoachMessage(
        drawClaim.message,
        state.game.turn === state.game.settings.engineColor
          ? "Claim the draw now, or continue play to let the engine answer."
          : "You may claim the draw before playing on from this position."
      );
      return;
    }

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
  renderSessionUi();
  setRecordView(state.activeRecordView);
  syncBoardViewUi();

  try {
    await ensureGuestSession();
    await loadSession();
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

claimDrawButton?.addEventListener("click", claimAvailableDraw);
continuePlayButton?.addEventListener("click", continueAfterDrawClaim);

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
    return;
  }

  if (state.historyModalOpen && event.key === "ArrowLeft") {
    event.preventDefault();
    stepReplay(-1);
  }

  if (state.historyModalOpen && event.key === "ArrowRight") {
    event.preventDefault();
    stepReplay(1);
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

closeHistoryButton.addEventListener("click", (event) => {
  event.preventDefault();
  closeHistoryDetail();
});

replayBack?.addEventListener("click", () => stepReplay(-1));
replayForward?.addEventListener("click", () => stepReplay(1));
newGameButton.addEventListener("click", startNewGame);
saveGameButton.addEventListener("click", saveCurrentGame);
offerDrawButton.addEventListener("click", offerDraw);
resignButton.addEventListener("click", resignCurrentGame);
loginButton?.addEventListener("click", loginAccount);
registerButton?.addEventListener("click", registerAccount);
logoutButton?.addEventListener("click", logoutAccount);
timeControlSelect?.addEventListener("change", renderClocks);
colorInputs.forEach((input) => {
  input.addEventListener("change", renderClocks);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void syncTimedGameState();
  }
});

initialize();
