const _savedBoardViewMode = window.localStorage.getItem("arcane-chess-board-view-mode") === "3d" ? "3d" : "2d";

export const state = {
  guest: null,
  session: {
    authenticated: false,
    user: null
  },
  game: null,
  boardViewMode: _savedBoardViewMode,
  viewMode: _savedBoardViewMode === "3d" ? "3D" : "2D",
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
  multiplayer: {
    socket: null,
    connected: false,
    roomId: null,
    opponentDisplayName: null,
    color: null,
    phase: "idle",
    queued: false,
    queuePosition: null,
    queueTimeControlId: null
  },
  view: "auth",
  authMode: "login",
  coach: {
    classification: null,
    tone: "neutral",
    message: "Preparing the board.",
    explanation: "Use Hint when you want engine guidance for the current position.",
    bestMove: null,
    whyLines: [],
    whyExpanded: false,
    animate: false
  },
  hint: {
    bestMove: null,
    continuation: [],
    fen: "",
    summary: "",
    whyExpanded: false,
    requestedThisTurn: false
  },
  liveChronicle: {
    gameId: null,
    ratingsByPly: {},
    expandedWhyPly: null
  },
  lobbyMode: window.localStorage.getItem("arcane-chess-lobby-mode") || "solo",
  activeRecordView:
    window.localStorage.getItem("arcane-chess-record-view") || "moves"
};

export const runtimeState = {
  lastRenderedCoachSignature: "",
  coachMessageAnimationTimeoutId: null,
  coachMotionAnimationTimeoutId: null,
  coachSpeakingAnimationTimeoutId: null,
  coachMotionSequence: 0,
  lastRenderedCoachMotionPulseId: null,
  wizardReactionDelayTimeoutId: null,
  wizardStateResetTimeoutId: null,
  gameOverBannerTimeoutId: null,
  activeGameOverBannerKey: "",
  dismissedGameOverBannerKey: "",
  finishedGameResetTimeoutId: null,
  activeFinishedGameResetKey: "",
  clockDisplayIntervalId: null,
  clockSyncIntervalId: null,
  boardFeedbackTimeoutId: null,
  activeBoardFeedbackKey: "",
  dismissedBoardFeedbackKey: "",
  activeMiniBoardTooltip: null,
  miniBoardHoverToken: 0,
  gameEndCinematicShownForKey: "",
  currentWizardState: "st-idle"
};

export const replayState = {
  fenSteps: [],
  moveHistory: [],
  moveList: [],
  index: 0,
  playerColor: "white"
};