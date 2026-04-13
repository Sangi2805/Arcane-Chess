import {
  CLOCK_SYNC_INTERVAL_MS,
  CLOCK_TICK_INTERVAL_MS,
  COACH_STAGE_ENGINE_FEEDBACK,
  COACH_STAGE_GAME_OVER,
  COACH_STAGE_PLAYER_FEEDBACK,
  DEFAULT_COACH_EXPLANATION,
  GAME_OVER_BANNER_DURATION_MS,
  HALL_RANDOM_TIME_CONTROL_IDS,
  PIECES,
  THINKING_COACH_EXPLANATION,
  TIME_CONTROL_PRESETS,
  VALID_RECORD_VIEWS,
  WIZARD_STATE_CLASSNAMES,
  WIZARD_STATE_LABELS,
  WIZARD_STATE_VISUALS

} from "./app/constants.js";
import {
  replayState,
  runtimeState,
  state
} from "./app/state.js";
import {
  escapeHtml,
  formatClockMs,
  formatColor,
  formatHistoryHeadline,
  formatResult,
  formatTimeControl,
  formatTimestamp,

  getOutcomeLabel,
  getResolvedTimeControl,
  normalizeChronicleWhyLines,
  normalizeHistoryRecord,
  trimTerminalPeriod
} from "./app/formatting.js";
import {
  ensureGuestSession,
  loadHistory,
  loadSavedGames,
  loadSession,
  request
} from "./app/api.js";
import {
  emitMultiplayerEvent,
  ensureMultiplayerSocket,
  initializeMultiplayerRealtime,
  leaveMultiplayerRoom
} from "./app/realtime.js";
import {
  configureRenderViewDependencies,
  renderGuestProfile,
  renderLobbyTimeControlButtons,
  renderMultiplayerLobby,
  renderSessionUi,
  renderView
} from "./app/render-view.js";
import {
  configureRenderBoardDependencies,
  destroyMiniBoardTooltip,
  renderBoard,
  renderBoardOverlays,
  renderBoardSurface,
  renderClocks,
  renderGameOverBanner,
  renderHintPanel,
  renderMoveList,
  showMiniBoardTooltip,
  switchTo2D,
  switchTo3D
} from "./app/render-board.js";
import {
  buildCoachFeedbackState,
  clearWizardStateTimers,
  configureRenderCoachDependencies,
  createCoachState,
  createPersistentCoachMotion,
  createTransientCoachMotion,
  getCoachLead,
  getCoachTone,
  getDefaultCoachState,
  getGameOverCoachState,
  getIdleCoachState,
  getReactionMotionState,
  getThinkingCoachState,
  getWelcomeCoachState,
  renderCoachPanel,
  scheduleWizardReactionState,
  setCoachMessage,
  setWizardIdleState,
  setWizardState,
  setWizardThinkingState,
  syncCoachAvatarMode
} from "./app/render-coach.js";
import {
  applyHintHighlights,
  clearPromotionPrompt,
  clearHintState,
  clearSelectedSquare,
  configureGameplayDependencies,
  getLegalTargets,
  handleSquareClick,
  openPromotionPrompt,
  setSelectedSquare,
  submitMove
} from "./app/gameplay.js";
import {
  getSavedView,
  hasSeenIntroSplash,
  markIntroSplashSeen,
  persistGuest,
  persistLobbyMode,
  persistRecordView,
  readStoredGuest
} from "./app/storage.js";
import {
  configureAudioDependencies,
  getAmbientTargetKey,
  clearAmbientFade,
  updateAmbientToggleLabel,
  syncAmbientTogglePlacement,
  fadeAmbientAudio,
  stopAmbientMusic,
  syncAmbientMusic,
  unlockAmbientMusic,
  setAmbientMuted,
  ambientTracks,
  ambientState
} from "./app/audio-controller.js";
import {
  clearReplay,
  closeHistoryDetail,
  configureReplayHistoryDependencies,
  getSavedGameHeadline,
  initReplay,
  openHistoryDetail,
  parseFenToBoard,
  populateHistoryDetail,
  renderHistory,
  renderReplayBoard,
  renderReplayMoveRows,
  renderSavedGames,
  resetHistoryDetail,
  scrollReplayActiveMoveIntoView,
  setReplayStep,
  showHistoryModal,
  stepReplay,
  updateReplayControls
} from "./app/replay-history-controller.js";
import {
  configureAuthSessionDependencies,
  focusAuthField,
  getLocalPlayerDisplayName,
  getSessionDisplayName,
  isAuthenticated,
  loginAccount,
  logoutAccount,
  registerAccount,
  renderAuthMode,
  setSessionState,
  showSignupMode
} from "./app/auth-session-controller.js";
import {
  configureHallActionsDependencies,
  leaveCompletedMultiplayerGameIfNeeded,
  normalizeLobbyMode,
  setLobbyMode
} from "./app/hall-actions-controller.js";
import {
  clearBoardFeedbackTimer,
  clearCompletedLiveBoard,
  clearFinishedGameResetTimer,
  clearGameOverBannerTimer,
  configureUIFeedbackDependencies,
  dismissGameEndOverlay,
  getCheckedKingSquare,
  getCinematicResultLabel,
  getCinematicSubtitle,
  getDrawClaimState,
  getGameOverBannerKey,
  getGameOverCopy,
  getWinnerFromResult,
  hideBoardFeedback,
  hideGameOverBanner,
  isTerminalGameState,
  PIECE_VALUES,
  render,
  renderBoardFeedback,
  renderClockCard,
  renderImmersiveHud,
  resetFinishedGameResetLifecycle,
  resetGameOverBannerLifecycle,
  scheduleBoardFeedbackDismissal,
  scheduleFinishedGameReset,
  scheduleGameOverBannerDismissal,
  setApiHealth,
  setBusy,
  setRecordView,
  showGameEndOverlay,
  syncActionButtons,
  syncControls,
  syncTimedGameState,
  TERMINAL_STATUS_CODES,
  triggerGameEndCinematic,
  updateClockLoops,
  updateEvalBar,
  updateSummary
} from "./app/ui-feedback-controller.js";
import {
  applyMultiplayerSocketState,
  applyQueueStatusState,
  configureMultiplayerDependencies,
  createMultiplayerRoom,
  getMultiplayerActorPayload,
  getMultiplayerCoachState,
  getMultiplayerDisplayName,
  handleQuickPlayClick,
  isRealtimeMultiplayerGame,
  joinMatchmakingQueue,
  joinMultiplayerRoom,
  leaveMatchmakingQueue,
  rejoinMultiplayerMatch
} from "./app/multiplayer-controller.js";
import {
  applyChronicleMoveMetadata,
  applyGameState,
  appendMoveToList,
  beginMoveCycle,
  buildOptimisticGameState,
  canApplyCoachStage,
  CHRONICLE_BADGE_SYMBOLS,
  claimAvailableDraw,
  cloneValue,
  configureGameLifecycleDependencies,
  continueAfterDrawClaim,
  COACH_CLASSIFICATION_SET,
  ensureLiveChronicleForGame,
  enterGameView,
  getLastPlyIndexFromMoveList,
  getPlyColor,
  getPlyIndexForTurnColor,
  initialize,
  isHumanBlunderFeedback,
  isLocalPlayerPly,
  isMoveCycleActive,
  loadCoachFeedback,
  loadEngineReply,
  loadGame,
  moveBoardPiece,
  offerDraw,
  PIECE_LABELS,
  refreshCollections,
  requestHint,
  resetLiveChronicleState,
  resignCurrentGame,
  resumeSavedGame,
  sanitizeLiveChronicleRatingsForLocalPlayer,
  saveCurrentGame,
  setCoachStageRank,
  setCoachStateForGame,
  startNewGame,
  upsertLocalMoveChronicleRating
} from "./app/game-lifecycle-controller.js";
import * as dom from "./app/dom.js";

const {
  ambientAudioToggleButton,
  apiHealth,
  authContinueGuestButton,
  authDisplayNameInput,
  authEmailInput,
  authGuestView,
  authPasswordInput,
  authSessionCopy,
  authSessionHeading,
  authSessionPill,
  authSignupOnlyFields,
  authUserDisplay,
  authUserEmail,
  authUserView,
  authView,
  backToHallButton,
  board3dElement,
  boardElement,
  boardFeedbackBanner,
  boardFeedbackMessage,
  boardFeedbackTitle,
  boardModeLabel,
  boardShell,
  bottomClockCard,
  bottomClockLabel,
  bottomClockMeta,
  bottomClockSide,
  bottomClockTime,
  claimDrawButton,
  closeHistoryButton,
  coachAvatarImage,
  coachBubbleCopy,
  coachFooter,
  coachPanel,
  coachWizardBrowLeft,
  coachWizardBrowRight,
  coachWizardIrisLeft,
  coachWizardIrisRight,
  coachWizardMouth,
  coachWizardOrb,
  coachWizardSvg,
  colorInputs,
  continuePlayButton,
  controlsPanel,
  dashboardTimeControlButtons,
  difficultySelect,
  engineSide,
  evalBarBlack,
  evalBarWhite,
  feedbackBadge,
  feedbackExplanation,
  feedbackSuggestion,
  feedbackText,
  feedbackThinking,
  feedbackWhyLines,
  feedbackWhyToggle,
  gameOverBanner,
  gameOverMessage,
  gameOverTitle,
  gameView,
  gatewayCreateButton,
  gatewayGuestButton,
  gatewaySignInButton,
  guestMeta,
  guestName,
  guestSubtitle,
  hallHistoryButton,
  hallHeroActions,
  hallLogoutButton,
  hallRandomTimeControlButton,
  hallRandomTimeControlLabel,
  hallResumeButton,
  historyCount,
  historyDetailCompleted,
  historyDetailDifficulty,
  historyDetailMoves,
  historyDetailPgn,
  historyDetailPlayer,
  historyDetailResult,
  historyDetailStatus,
  historyList,
  historyModal,
  historyModalCard,
  hintButton,
  hintWhyButton,
  hintWhyText,
  immersiveControls,
  immersiveControlsHost,
  immersiveExitButton,
  immersiveFullscreenButton,
  immersiveHud,
  immersiveNewGameButton,
  immersiveOfferDrawButton,
  immersiveResignButton,
  immersiveStatus,
  immersiveStatusHeading,
  immersiveStatusMeta,
  lobbyView,
  logoutButton,
  multiplayerConnectionStatus,
  multiplayerCreateGameButton,
  multiplayerCreateRoomButton,
  multiplayerDashboard,
  multiplayerGateway,
  multiplayerInviteList,
  multiplayerJoinGameButton,
  multiplayerLobbyButton,
  multiplayerPlayerList,
  multiplayerPresencePill,
  multiplayerRejoinGameButton,
  multiplayerRoomIdInput,
  multiplayerRoomIdLabel,
  multiplayerStatusCopy,
  moveListElement,
  newGameButton,
  offerDrawButton,
  playArea,
  playerSide,
  promotionPanel,
  recordTabs,
  recordViews,
  replayBack,
  replayBoard,
  replayForward,
  replayStepLabel,
  resignButton,
  saveGameButton,
  savedGamesCount,
  savedGamesList,
  shellElement,
  soloLobbyButton,
  statusText,
  loginButton,
  movesPanelHeaderActions,
  registerButton,
  timeControlSelect,
  topClockCard,
  topClockLabel,
  topClockMeta,
  topClockSide,
  topClockTime,
  toggle2dBtn,
  toggle3dBtn,
  turnIndicator,
  lastMoveText,
  wizardSide,
  wizardStateLabel
} = dom;

(function() {
  if (hasSeenIntroSplash()) {
    const s = document.getElementById('ss-intro-splash');
    if (s) s.remove();
    return;
  }
  const splash = document.getElementById('ss-intro-splash');
  if (!splash) return;
  const sparks = document.getElementById('intro-sparks');
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'intro-spark';
    const left = i < 8;
    el.style.left = left ? (Math.random() * 14 + 1) + '%' : (Math.random() * 14 + 85) + '%';
    el.style.bottom = (Math.random() * 35 + 5) + '%';
    const sz = Math.random() * 3 + 1.5;
    el.style.width = el.style.height = sz + 'px';
    el.style.setProperty('--d', (1.2 + Math.random() * 1.4) + 's');
    el.style.setProperty('--dl', (Math.random() * 2) + 's');
    el.style.setProperty('--sx', (Math.random() * 22 - 11) + 'px');
    sparks.appendChild(el);
  }
  const dismiss = () => {
    markIntroSplashSeen();
    splash.remove();
  };
  splash.addEventListener('click', dismiss);
  document.addEventListener('keydown', dismiss, { once: true });
})();

let arcaneBoard3D = null;
let lastAnimated3DMoveKey = "";
let is3DMoveAnimating = false;
let last3DAnimationStartedAt = 0;

const isGameplayDebugEnabled = () => window.__ARCANE_DEBUG_SYNC !== false;
const debugGameplaySync = (event, payload = {}) => {
  if (!isGameplayDebugEnabled()) {
    return;
  }

  console.debug(`[ArcaneSync] ${event}`, payload);
};

const syncImmersiveControlsMount = () => {
  if (!immersiveControls || !immersiveHud) {
    return;
  }

  const mountInPanel =
    state.view === "game" &&
    state.boardViewMode === "3d" &&
    immersiveControlsHost;

  if (mountInPanel) {
    if (immersiveControls.parentElement !== immersiveControlsHost) {
      immersiveControlsHost.appendChild(immersiveControls);
    }
    immersiveControls.dataset.mount = "panel";
    immersiveControlsHost.classList.remove("hidden");
    immersiveControlsHost.setAttribute("aria-hidden", "false");
    return;
  }

  if (immersiveControls.parentElement !== immersiveHud) {
    immersiveHud.insertBefore(immersiveControls, immersiveStatus || null);
  }
  immersiveControls.dataset.mount = "hud";
  immersiveControlsHost?.classList.add("hidden");
  immersiveControlsHost?.setAttribute("aria-hidden", "true");
};


const isPlayerInCheckState = (gameState = state.game) => {
  const playerColor = gameState?.settings?.playerColor;
  const checkedColor = gameState?.ruleState?.checkedColor;

  if (checkedColor && playerColor) {
    return checkedColor === playerColor;
  }

  return gameState?.status?.code === "check" && gameState?.turn === playerColor;
};

const applyWizardStateFromGameState = (gameState = state.game, options = {}) => {
  if (!gameState) {
    return;
  }

  const source = options.source || "system";

  if (isTerminalGameState(gameState)) {
    const playerWon =
      (gameState.result === "white-win" && gameState.settings?.playerColor === "white") ||
      (gameState.result === "black-win" && gameState.settings?.playerColor === "black");
    if (playerWon) {
      clearWizardStateTimers();
      setWizardState("st-win", {
        force: true
      });
    } else if (gameState.result !== "draw") {
      scheduleWizardReactionState("st-blunder", {
        delayMs: 900,
        holdMs: 3000,
        force: true
      });
    } else {
      setWizardIdleState();
    }
    return;
  }

  if (source === "engine") {
    if (isPlayerInCheckState(gameState)) {
      scheduleWizardReactionState("st-check", {
        delayMs: 600,
        holdMs: 2000,
        force: true
      });
      return;
    }

    if (
      runtimeState.currentWizardState === "st-think" &&
      !runtimeState.wizardReactionDelayTimeoutId &&
      !runtimeState.wizardStateResetTimeoutId
    ) {
      setWizardIdleState();
    }
    return;
  }

  if (source === "human" && isPlayerInCheckState(gameState)) {
    scheduleWizardReactionState("st-check", {
      delayMs: 600,
      holdMs: 2000
    });
  }
};

const normalizeBoardViewMode = (mode) => (mode === "3d" ? "3d" : "2d");

const updateBoardModeToggleUi = () => {
  const is3D = state.boardViewMode === "3d";
  toggle2dBtn?.classList.toggle("mode-btn-active", !is3D);
  toggle3dBtn?.classList.toggle("mode-btn-active", is3D);

  if (boardModeLabel) {
    boardModeLabel.textContent = is3D ? "3D duel interface" : "Duel Interface";
  }
};

const setBoardViewModePreference = (mode, { source = "system" } = {}) => {
  state.boardViewMode = normalizeBoardViewMode(mode);
  state.viewMode = state.boardViewMode === "3d" ? "3D" : "2D";
  updateBoardModeToggleUi();
  syncBoardViewUi();
  console.log("[board] selected mode changed:", state.boardViewMode, "source:", source);
};

const validate3DBoardInstance = ({ logFailure = false } = {}) => {
  const canvas = arcaneBoard3D?.renderer?.domElement || null;
  const healthy =
    Boolean(arcaneBoard3D) &&
    Boolean(arcaneBoard3D?.renderer) &&
    Boolean(arcaneBoard3D?.camera) &&
    Boolean(arcaneBoard3D?.scene) &&
    Boolean(canvas) &&
    Boolean(board3dElement?.contains(canvas)) &&
    Number(canvas?.width || 0) > 0 &&
    Number(canvas?.height || 0) > 0 &&
    Number(board3dElement?.offsetWidth || 0) > 0 &&
    Number(board3dElement?.offsetHeight || 0) > 0;

  if (!healthy && logFailure) {
    console.warn("[board] 3D init failed health check");
  }

  return healthy;
};

const syncBoardViewUi = () => {
  const is3D = state.boardViewMode === "3d";
  const show3DInGameView =
    is3D &&
    state.view === "game" &&
    validate3DBoardInstance();
  state.viewMode = is3D ? "3D" : "2D";

  document.body.dataset.boardViewMode = state.boardViewMode;
  document.body.classList.toggle("board-mode-3d", show3DInGameView);

  if (shellElement) {
    shellElement.dataset.boardViewMode = state.boardViewMode;
  }

  if (boardShell) {
    boardShell.dataset.viewMode = state.boardViewMode;
  }

  if (boardElement) {
    boardElement.classList.toggle("hidden", show3DInGameView);
    boardElement.setAttribute("aria-hidden", show3DInGameView ? "true" : "false");
  }

  if (board3dElement) {
    board3dElement.classList.toggle("hidden", !show3DInGameView);
    board3dElement.setAttribute("aria-hidden", show3DInGameView ? "false" : "true");
  }

  if (immersiveHud) {
    immersiveHud.setAttribute("aria-hidden", show3DInGameView ? "false" : "true");
  }

  arcaneBoard3D?.setArenaGuardiansVisible?.(show3DInGameView);
  syncCoachAvatarMode();
  syncImmersiveControlsMount();
  renderImmersiveHud();
};

const syncBoard3D = ({ refreshPerspective = false } = {}) => {
  const now = performance.now();
  if (is3DMoveAnimating) {
    // Safety release if a callback never arrives.
    if (now - last3DAnimationStartedAt < 900) {
      return;
    }
    is3DMoveAnimating = false;
  }

  syncBoardViewUi();

  if (!arcaneBoard3D || state.boardViewMode !== "3d" || !state.game?.board) {
    return;
  }

  const applyBoardSyncState = () => {
    arcaneBoard3D.setPosition(state.game.board);
    const legalForSelected =
      state.selectedSquare && state.game.legalMoves
        ? (state.game.legalMoves[state.selectedSquare] || []).map((move) => move.to)
        : [];
    arcaneBoard3D.highlightSquares(
      state.selectedSquare,
      legalForSelected,
      state.hint?.bestMove || null
    );

    if (state.game.lastMove) {
      arcaneBoard3D.setLastMove(
        state.game.lastMove.from,
        state.game.lastMove.to
      );
    }
  };

  if (refreshPerspective) {
    arcaneBoard3D.setPerspective?.(getBoardPerspectiveColor());
  }

  const lastMove = state.game.lastMove;
  const nextMoveKey = lastMove
    ? `${lastMove.from}:${lastMove.to}:${lastMove.san || ""}:${lastMove.promotion || ""}`
    : "";
  const canAnimateMove =
    Boolean(lastMove?.from && lastMove?.to) &&
    typeof arcaneBoard3D.animateMove === "function" &&
    arcaneBoard3D.pieces instanceof Map &&
    arcaneBoard3D.pieces.has(lastMove.from) &&
    now - last3DAnimationStartedAt >= 580;

  if (!is3DMoveAnimating && nextMoveKey && nextMoveKey !== lastAnimated3DMoveKey && canAnimateMove) {
    is3DMoveAnimating = true;
    last3DAnimationStartedAt = now;

    arcaneBoard3D.animateMove(
      lastMove.from,
      lastMove.to,
      Boolean(lastMove.captured),
      () => {
        applyBoardSyncState();
        is3DMoveAnimating = false;
        lastAnimated3DMoveKey = nextMoveKey;
      }
    );

    return;
  }

  applyBoardSyncState();
};

const resetBoardViewTo2D = () => {
  setBoardViewModePreference("2d", {
    source: "fallback"
  });

  document.body.classList.remove("board-mode-3d");
  document.body.dataset.boardViewMode = "2d";

  if (shellElement) {
    shellElement.dataset.boardViewMode = "2d";
  }

  if (boardShell) {
    boardShell.dataset.viewMode = "2d";
  }

  if (boardElement) {
    boardElement.classList.remove("hidden");
    boardElement.setAttribute("aria-hidden", "false");
  }

  if (board3dElement) {
    board3dElement.classList.add("hidden");
    board3dElement.setAttribute("aria-hidden", "true");
  }

  if (immersiveHud) {
    immersiveHud.setAttribute("aria-hidden", "true");
  }

  arcaneBoard3D?.setArenaGuardiansVisible?.(false);
  syncCoachAvatarMode();
  syncImmersiveControlsMount();
  renderImmersiveHud();

  if (arcaneBoard3D) {
    arcaneBoard3D.destroy();
    arcaneBoard3D = null;
  }
  document.getElementById('hud-player-name')?.remove();
  document.getElementById('hud-opponent-name')?.remove();
  is3DMoveAnimating = false;
};

const isActiveGameState = (gameState) =>
  Boolean(gameState?.id && gameState?.hasStarted && !gameState?.isGameOver);

const getChosenColor = () =>
  document.querySelector('input[name="player-color"]:checked')?.value || "white";

const getBoardPerspectiveColor = () =>
  state.game?.settings?.playerColor || getChosenColor();

const getSelectedTimeControlId = () => timeControlSelect?.value || "untimed";

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

const setPersistence = (persistence = {}) => {
  state.persistence = {
    available: Boolean(persistence.available),
    status: persistence.status || "disconnected"
  };

  renderGuestProfile();
  renderSessionUi();
  syncActionButtons();
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

const getBoardRenderFailureReason = (boardState = []) => {
  if (!Array.isArray(boardState)) {
    return "board state is not an array";
  }

  if (boardState.length !== 64) {
    return `expected 64 squares but received ${boardState.length}`;
  }

  const squares = new Set();

  for (const entry of boardState) {
    if (!entry || typeof entry !== "object") {
      return "board contains an undefined square entry";
    }

    if (typeof entry.square !== "string" || typeof entry.file !== "string" || typeof entry.rank !== "string") {
      return "board contains square entries with missing coordinates";
    }

    squares.add(entry.square);
  }

  for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    for (const rank of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const square = `${file}${rank}`;
      if (!squares.has(square)) {
        return `missing required square ${square}`;
      }
    }
  }

  return null;
};

const waitForBoardContainerReady = ({ maxFrames = 30 } = {}) =>
  new Promise((resolve) => {
    let frameCount = 0;

    const pollContainer = () => {
      const boardContainerElement =
        document.querySelector("#game-view .board-container") ||
        document.querySelector("#game-view .board-shell") ||
        boardElement?.parentElement ||
        null;

      if (
        state.view === "game" &&
        boardContainerElement &&
        boardContainerElement.offsetWidth > 0 &&
        boardContainerElement.offsetHeight > 0
      ) {
        resolve(boardContainerElement);
        return;
      }

      frameCount += 1;
      if (frameCount >= maxFrames) {
        resolve(null);
        return;
      }

      requestAnimationFrame(pollContainer);
    };

    requestAnimationFrame(pollContainer);
  });

const PROMOTION_OPTION_LABELS = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight"
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

const renderPromotionPrompt = () => {
  if (!state.pendingPromotion?.moveChoices?.length || !boardShell || !promotionPanel) {
    clearPromotionPrompt();
    return;
  }

  syncPromotionActionLabels();

  const boardRect = boardShell.getBoundingClientRect();
  let anchorRect = null;

  if (state.boardViewMode === "3d" && arcaneBoard3D?.projectSquare) {
    const projected = arcaneBoard3D.projectSquare(state.pendingPromotion.anchorSquare);

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
    const anchorSquare = state.pendingPromotion.anchorSquare;
    const squareButton = boardElement?.querySelector(`[data-square="${anchorSquare}"]`);

    if (squareButton) {
      anchorRect = squareButton.getBoundingClientRect();
    }
  }

  if (!anchorRect) {
    promotionPanel.classList.remove("hidden");
    promotionPanel.style.visibility = "hidden";
    return;
  }

  promotionPanel.classList.remove("hidden");
  promotionPanel.style.visibility = "hidden";

  const panelWidth = promotionPanel.offsetWidth || 220;
  const panelHeight = promotionPanel.offsetHeight || 180;
  const centerX = anchorRect.left + (anchorRect.width || 0) / 2;

  const minLeft = boardRect.left + 8;
  const maxLeft = boardRect.right - panelWidth - 8;
  const preferredLeft = centerX - panelWidth / 2;
  const left = Math.min(Math.max(preferredLeft, minLeft), Math.max(minLeft, maxLeft));

  const preferredTop = anchorRect.top - panelHeight - 12;
  const fallbackTop = anchorRect.bottom + 12;
  const minTop = boardRect.top + 8;
  const maxTop = boardRect.bottom - panelHeight - 8;
  const top = preferredTop >= minTop
    ? preferredTop
    : Math.min(Math.max(fallbackTop, minTop), Math.max(minTop, maxTop));

  promotionPanel.style.left = `${Math.round(left)}px`;
  promotionPanel.style.top = `${Math.round(top)}px`;
  promotionPanel.style.visibility = "visible";
};

// Replay + history detail controller extracted to app/replay-history-controller.js


// ── Game-End Cinematic ───────────────────────────────────────────────────────
// Extracted to app/ui-feedback-controller.js

boardElement.addEventListener("click", (event) => {
  const squareButton = event.target.closest("[data-square]");

  if (!squareButton) {
    return;
  }

  handleSquareClick(squareButton.dataset.square);
});

moveListElement?.addEventListener("click", (event) => {
  const whyToggle = event.target.closest("[data-move-why-toggle]");

  if (!whyToggle) {
    return;
  }

  event.preventDefault();
  const plyIndex = Number.parseInt(whyToggle.dataset.moveWhyToggle || "", 10);

  if (!Number.isInteger(plyIndex) || plyIndex < 0) {
    return;
  }

  const moveMeta = state.liveChronicle.ratingsByPly[plyIndex];

  if (!moveMeta?.whyLines?.length) {
    return;
  }

  state.liveChronicle.expandedWhyPly =
    state.liveChronicle.expandedWhyPly === plyIndex ? null : plyIndex;
  renderMoveList();
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
immersiveFullscreenButton?.addEventListener('click', () => {
  const el = document.getElementById('board-3d') ||
              document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
    immersiveFullscreenButton.textContent = 'Exit Fullscreen';
  } else {
    document.exitFullscreen();
    immersiveFullscreenButton.textContent = 'Fullscreen';
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    immersiveFullscreenButton.textContent = 'Fullscreen';
    arcaneBoard3D?._onResize?.();
  }
});

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
  destroyMiniBoardTooltip();
  arcaneBoard3D?.scheduleResize?.({
    immediate: true
  });
  if (arcaneBoard3D && state.boardViewMode === "3d") {
    arcaneBoard3D.camera.aspect = window.innerWidth / window.innerHeight;
    arcaneBoard3D.camera.updateProjectionMatrix();
    arcaneBoard3D.renderer.setSize(window.innerWidth, window.innerHeight);
  } else {
    arcaneBoard3D?._onResize?.();
  }

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
loginButton?.addEventListener("click", async () => {
  if (state.authMode === "signup") {
    state.authMode = "login";
    renderAuthMode();
    return;
  }

  const success = await loginAccount();
  console.log("login button success:", success);
  if (success) {
    state.view = "hall";
    renderView();
  }
});
registerButton?.addEventListener("click", () => {
  if (state.authMode !== "signup") {
      state.authMode = "signup";
      renderAuthMode();
    return;
  }

    registerAccount();
});
logoutButton?.addEventListener("click", logoutAccount);
hallLogoutButton?.addEventListener("click", logoutAccount);

authContinueGuestButton?.addEventListener("click", async () => {
  setBusy(true, "Continuing as guest...");

  try {
    const guestSession = await ensureGuestSession();
    state.isGuest = true;
    state.guest = guestSession.guest || null;
    setPersistence(guestSession.persistence || state.persistence);
    state.view = "hall";
    setLobbyMode("solo");
    renderView();
    setApiHealth(true);
    setCoachMessage(
      "Guest mode active.",
      "You can play immediately without signing in."
    );
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
});

soloLobbyButton?.addEventListener("click", () => {
  setLobbyMode("solo");
});
multiplayerLobbyButton?.addEventListener("click", () => {
  setLobbyMode("multiplayer");
  state.view = "hall";
  renderView();
});
gatewaySignInButton?.addEventListener("click", () => {
  setLobbyMode("multiplayer");
  focusAuthField(authEmailInput);
});
gatewayCreateButton?.addEventListener("click", () => {
  setLobbyMode("multiplayer");
  focusAuthField(authDisplayNameInput || authEmailInput);
});
gatewayGuestButton?.addEventListener("click", () => {
  setLobbyMode("solo");
});

hallResumeButton?.addEventListener("click", () => {
  void enterGameView({ coachContext: "resume", fallbackView: "hall" }).then((restored) => {
    if (restored) {
      setRecordView("saves");
    }
  });
});

hallHistoryButton?.addEventListener("click", () => {
  void enterGameView({ coachContext: "load-active", fallbackView: "hall" }).then((restored) => {
    if (restored) {
      setRecordView("history");
    }
  });
});

ambientAudioToggleButton?.addEventListener("click", () => {
  if (ambientState.muted) {
    unlockAmbientMusic();
    setAmbientMuted(false);
  } else {
    setAmbientMuted(true);
  }
});

if (backToHallButton) {
  backToHallButton.addEventListener("click", () => {
    dismissGameEndOverlay();
    arcaneBoard3D?.clearGameEndCurtain?.();
    leaveCompletedMultiplayerGameIfNeeded();
    clearSelectedSquare();
    clearHintState();
    clearPromotionPrompt();
    hideBoardFeedback();
    resetBoardViewTo2D();
    state.view = "hall";
    renderView();
  });
}
document.addEventListener("pointerdown", unlockAmbientMusic, { capture: true, passive: true });
document.addEventListener("keydown", unlockAmbientMusic, { capture: true });
document.addEventListener("touchstart", unlockAmbientMusic, { capture: true, passive: true });
hallRandomTimeControlButton?.addEventListener("click", () => {
  const availableRandomTimeControlIds = HALL_RANDOM_TIME_CONTROL_IDS.filter(
    (timeControlId) => Boolean(TIME_CONTROL_PRESETS[timeControlId])
  );

  if (!timeControlSelect || availableRandomTimeControlIds.length === 0) {
    return;
  }

  const nextTimeControlId =
    availableRandomTimeControlIds[Math.floor(Math.random() * availableRandomTimeControlIds.length)] ||
    getSelectedTimeControlId();

  timeControlSelect.value = nextTimeControlId;
  setLobbyMode("solo");
  renderLobbyTimeControlButtons();
  void startNewGame();
});
timeControlSelect?.addEventListener("change", () => {
  renderClocks();
  renderMultiplayerLobby();
  renderLobbyTimeControlButtons();
});
colorInputs.forEach((input) => {
  input.addEventListener("change", () => {
    renderClocks();
    if (!state.game?.hasStarted && arcaneBoard3D?.setPerspective) {
      arcaneBoard3D.setPerspective(getBoardPerspectiveColor());
    }
  });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void syncTimedGameState();
  }
});

// ── 2D / 3D TOGGLE ─────────────────────────────────────────
const launchSelectedBoard = async ({ trigger = "game-start" } = {}) => {
  const requestedMode = normalizeBoardViewMode(state.boardViewMode);
  console.log("[board] game start requested:", trigger, "mode:", requestedMode);

  if (requestedMode === "2d") {
    console.log("[board] launching 2D");
    setBoardViewModePreference("2d", {
      source: `launch:${trigger}`
    });
    switchTo2D();
    return "2d";
  }

  console.log("[board] requested 3D launch");

  try {
    await switchTo3D();
    setBoardViewModePreference("3d", {
      source: `launch:${trigger}`
    });
    syncBoard3D({
      refreshPerspective: true
    });
    return "3d";
  } catch (error) {
    console.warn("[board] 3D init failed health check", error);
    if (arcaneBoard3D) {
      arcaneBoard3D.destroy?.();
      arcaneBoard3D = null;
    }
    console.log("[board] fallback to 2D");
    setBoardViewModePreference("2d", {
      source: "fallback"
    });
    switchTo2D();
    return "2d";
  }
};

const handleBoardModeToggle = (mode) => {
  if (mode === "3d" && state.view !== "game") {
    state.boardViewMode = "3d";
    state.viewMode = "3D";
    toggle2dBtn?.classList.remove("mode-btn-active");
    toggle3dBtn?.classList.add("mode-btn-active");
    return;
  }

  setBoardViewModePreference(mode, {
    source: "toggle"
  });

  if (state.view === "game") {
    void launchSelectedBoard({
      trigger: "Mode Toggle"
    });
  }
};

if (toggle2dBtn) toggle2dBtn.addEventListener("click", () => handleBoardModeToggle("2d"));
if (toggle3dBtn) toggle3dBtn.addEventListener("click", () => handleBoardModeToggle("3d"));
if (immersiveExitButton) immersiveExitButton.addEventListener("click", switchTo2D);

configureRenderViewDependencies({
  getSessionDisplayName,
  getSelectedTimeControlId,
  isAuthenticated,
  normalizeLobbyMode,
  syncAmbientMusic,
  syncAmbientTogglePlacement,
  syncBoardViewUi,
  updateAmbientToggleLabel
});

configureRenderBoardDependencies({
  chronicleBadgeSymbols: CHRONICLE_BADGE_SYMBOLS,
  pieceLabels: PIECE_LABELS,
  getArcaneBoard3D: () => arcaneBoard3D,
  setArcaneBoard3D: (nextBoard) => {
    arcaneBoard3D = nextBoard;
  },
  getBoardClockColors,
  getBoardPerspectiveColor,
  getBoardRenderFailureReason,
  getCheckedKingSquare,
  getClockDisplayState,
  getGameOverBannerKey,
  getGameOverCopy,
  getIs3DMoveAnimating: () => is3DMoveAnimating,
  getLegalTargets,
  getLocalPlayerDisplayName,
  getOrderedSquares,
  getPlyIndexForTurnColor,
  getSelectedTimeControlId,
  getSquareColorClass,
  handleSquareClick,
  hideGameOverBanner,
  isLocalPlayerPly,
  renderBoardFeedback,
  renderClockCard,
  renderPromotionPrompt,
  resetBoardViewTo2D,
  resetGameOverBannerLifecycle,
  scheduleGameOverBannerDismissal,
  syncBoard3D,
  updateEvalBar,
  validate3DBoardInstance,
  waitForBoardContainerReady
});

configureRenderCoachDependencies({
  getArcaneBoard3D: () => arcaneBoard3D,
  getDrawClaimState
});

configureGameplayDependencies({
  beginMoveCycle,
  isMoveCycleActive,
  isRealtimeMultiplayerGame,
  getDrawClaimState,
  debugGameplaySync,
  setBusy,
  setApiHealth,
  syncActionButtons,
  syncBoard3D,
  applyMultiplayerSocketState,
  loadCoachFeedback,
  loadEngineReply,
  getLastPlyIndexFromMoveList,
  applyGameState,
  renderGameOverBanner,
  refreshCollections
});

initializeMultiplayerRealtime({
  onConnected: () => {
    renderMultiplayerLobby();
    syncActionButtons();
  },
  onDisconnected: () => {
    applyQueueStatusState({ queued: false });
    renderMultiplayerLobby();
    syncActionButtons();
  },
  onSocketUnavailable: () => {
    setCoachMessage("Socket client failed to load.", "Reload the page and try again.");
  },
  onQueueStatus: (queueState) => {
    applyQueueStatusState(queueState);
  },
  onQueueError: (payload = {}) => {
    setCoachMessage(payload.message || "Quick play queue request failed.");
  },
  onMatchFound: async (payload = {}) => {
    state.view = "game";
    renderView();
    await launchSelectedBoard({
      trigger: "Quick Play"
    });
    renderMultiplayerLobby();
    syncActionButtons();

    setCoachMessage(
      `Match found: ${payload.opponentName || "Opponent"}`,
      "Blitz 5 duel ready. Pieces are loading now."
    );
  },
  onMultiplayerState: (socketState) => {
    if (state.lobbyMode !== "multiplayer" && !state.multiplayer.roomId) {
      return;
    }

    setApiHealth(true);
    applyMultiplayerSocketState(socketState);

    if (socketState?.event === "opponent-disconnected") {
      const remainingSeconds = Number.isFinite(Date.parse(socketState.reconnectDeadlineAt || ""))
        ? Math.max(0, Math.ceil((Date.parse(socketState.reconnectDeadlineAt) - Date.now()) / 1000))
        : 60;
      setCoachMessage(
        "Opponent disconnected.",
        `Waiting ${remainingSeconds}s for reconnection. If they do not return, you win by timeout.`
      );
    }

    if (socketState?.event === "disconnect-forfeit") {
      setCoachMessage(
        "Reconnect window expired.",
        "Your opponent did not return in time. The game is awarded by timeout."
      );
    }

    if (socketState?.event === "draw-offered") {
      if (socketState?.offeredBy && socketState.offeredBy !== socketState?.youAre) {
        setCoachMessage(
          "Opponent offered a draw.",
          "Click Offer Draw to accept, or make a move to continue the game."
        );
      } else {
        setCoachMessage(
          "Draw offer sent.",
          "Waiting for your opponent to accept, or they can decline by moving."
        );
      }
    }

    if (socketState?.event === "move" && socketState?.drawOfferDeclinedByMove) {
      setCoachMessage(
        "Draw offer declined.",
        "A move was played, so the game continues."
      );
    }

    setBusy(false);
  }
});

// Configure audio controller dependencies
configureAudioDependencies({
  ambientAudioToggleButton,
  movesPanelHeaderActions,
  hallHeroActions
});

configureReplayHistoryDependencies({
  state,
  replayState,
  dom: {
    closeHistoryButton,
    historyCount,
    historyDetailCompleted,
    historyDetailDifficulty,
    historyDetailMoves,
    historyDetailPgn,
    historyDetailPlayer,
    historyDetailResult,
    historyDetailStatus,
    historyList,
    historyModal,
    replayBack,
    replayBoard,
    replayForward,
    replayStepLabel,
    savedGamesCount,
    savedGamesList
  },
  helpers: {
    PIECES,
    escapeHtml,
    formatColor,
    formatHistoryHeadline,
    formatResult,
    formatTimeControl,
    formatTimestamp,
    getLocalPlayerDisplayName,
    getSquareColorClass,
    isAuthenticated,
    normalizeHistoryRecord,
    request,
    setApiHealth,
    setCoachMessage,
    setPersistence
  }
});

configureAuthSessionDependencies({
  state,
  dom: {
    authDisplayNameInput,
    authEmailInput,
    authPasswordInput,
    authSignupOnlyFields
  },
  api: {
    ensureGuestSession,
    request
  },
  actions: {
    loadGame,
    refreshCollections,
    renderGuestProfile,
    renderSessionUi,
    renderView,
    setApiHealth,
    setBusy,
    setCoachMessage,
    setPersistence,
    setRecordView,
    syncActionButtons
  }
});

configureHallActionsDependencies({
  state,
  realtime: {
    ensureMultiplayerSocket,
    leaveMultiplayerRoom
  },
  actions: {
    applyQueueStatusState,
    persistLobbyMode,
    renderMultiplayerLobby
  }
});

configureGameLifecycleDependencies({
  state,
  runtimeState,
  dom: {
    difficultySelect,
    statusText
  },
  api: {
    request,
    loadHistory,
    loadSavedGames,
    loadSession,
    readStoredGuest,
    getSavedView
  },
  callbacks: {
    applyHintHighlights,
    applyMultiplayerSocketState,
    applyWizardStateFromGameState,
    buildCoachFeedbackState,
    clearHintState,
    clearPromotionPrompt,
    clearSelectedSquare,
    createCoachState,
    dismissGameEndOverlay,
    emitMultiplayerEvent,
    getArcaneBoard3D: () => arcaneBoard3D,
    getBoardRenderFailureReason,
    getChosenColor,
    getDefaultCoachState,
    getDrawClaimState,
    getGameOverCoachState,
    getGameOverCopy,
    getSelectedTimeControlId,
    hideGameOverBanner,
    isAuthenticated,
    isRealtimeMultiplayerGame,
    isTerminalGameState,
    launchSelectedBoard,
    leaveMultiplayerRoom,
    render,
    renderCoachPanel,
    renderGuestProfile,
    renderHintPanel,
    renderHistory,
    renderMoveList,
    renderSavedGames,
    renderSessionUi,
    renderView,
    resetFinishedGameResetLifecycle,
    resetGameOverBannerLifecycle,
    scheduleFinishedGameReset,
    scheduleWizardReactionState,
    setApiHealth,
    setBusy,
    setCoachMessage,
    setPersistence,
    setRecordView,
    setSessionState,
    setWizardIdleState,
    setWizardThinkingState,
    switchTo3D,
    syncActionButtons,
    syncBoardViewUi,
    syncControls,
    triggerGameEndCinematic,
    waitForBoardContainerReady
  }
});

configureMultiplayerDependencies({
  state,
  dom: {
    multiplayerRoomIdInput
  },
  api: {
    request
  },
  realtime: {
    emitMultiplayerEvent,
    ensureMultiplayerSocket
  },
  auth: {
    isAuthenticated,
    getSessionDisplayName
  },
  ui: {
    renderMultiplayerLobby,
    renderView,
    setApiHealth,
    setBusy,
    setCoachMessage,
    syncActionButtons
  },
  game: {
    applyGameState,
    launchSelectedBoard,
    startNewGame,
    enterGameView
  }
});

configureUIFeedbackDependencies({
  state,
  runtimeState,
  dom: {
    apiHealth,
    authDisplayNameInput,
    authEmailInput,
    authPasswordInput,
    boardFeedbackBanner,
    boardFeedbackMessage,
    boardFeedbackTitle,
    claimDrawButton,
    colorInputs,
    continuePlayButton,
    dashboardTimeControlButtons,
    difficultySelect,
    engineSide,
    evalBarBlack,
    evalBarWhite,
    gameOverBanner,
    gameOverMessage,
    gameOverTitle,
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
    immersiveStatusHeading,
    immersiveStatusMeta,
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
    playerSide,
    recordTabs,
    recordViews,
    registerButton,
    resignButton,
    saveGameButton,
    soloLobbyButton,
    statusText,
    timeControlSelect,
    turnIndicator,
    lastMoveText
  },
  helpers: {
    escapeHtml,
    formatClockMs,
    formatColor,
    getOutcomeLabel,
    trimTerminalPeriod
  },
  callbacks: {
    applyGameState,
    clearHintState,
    clearPromotionPrompt,
    clearSelectedSquare,
    getArcaneBoard3D: () => arcaneBoard3D,
    getChosenColor,
    getIs3DMoveAnimating: () => is3DMoveAnimating,
    getLocalPlayerDisplayName,
    getSelectedTimeControlId,
    isAuthenticated,
    isRealtimeMultiplayerGame,
    leaveCompletedMultiplayerGameIfNeeded,
    persistRecordView,
    renderAuthMode,
    renderBoardOverlays,
    renderBoardSurface,
    renderClocks,
    renderCoachPanel,
    renderGuestProfile,
    renderHintPanel,
    renderHistory,
    renderMoveList,
    renderSavedGames,
    renderSessionUi,
    renderView,
    request,
    resetBoardViewTo2D,
    setCoachMessage,
    setPersistence,
    startNewGame,
    syncBoard3D
  }
});

initialize();

ensureMultiplayerSocket();

multiplayerCreateGameButton?.addEventListener("click", () => {
  void handleQuickPlayClick();
});

multiplayerCreateRoomButton?.addEventListener("click", () => {
  void createMultiplayerRoom();
});

multiplayerRejoinGameButton?.addEventListener("click", () => {
  void rejoinMultiplayerMatch();
});

multiplayerJoinGameButton?.addEventListener("click", () => {
  void joinMultiplayerRoom();
});

multiplayerRoomIdInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void joinMultiplayerRoom();
  }
});

hintButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  void requestHint();
});

hintWhyButton?.addEventListener("click", () => {
  const hasHintLine =
    Array.isArray(state.hint?.continuation) && state.hint.continuation.length > 0;

  if (!hasHintLine) {
    return;
  }

  state.hint.whyExpanded = !state.hint.whyExpanded;
  renderHintPanel();
});

hintWhyButton?.addEventListener("mouseenter", () => {
  const continuation = Array.isArray(state.hint?.continuation)
    ? state.hint.continuation.slice(0, 6)
    : [];

  showMiniBoardTooltip({
    anchorElement: hintWhyButton,
    fen: state.hint?.fen || state.game?.fen || "",
    continuation,
    label: "Hint Why Line"
  });
});

hintWhyButton?.addEventListener("mouseleave", () => {
  destroyMiniBoardTooltip();
});

feedbackWhyToggle?.addEventListener("click", () => {
  const hasWhyLines = Array.isArray(state.coach?.whyLines) && state.coach.whyLines.length > 0;

  if (!hasWhyLines) {
    return;
  }

  state.coach = createCoachState({
    ...state.coach,
    whyExpanded: !state.coach.whyExpanded,
    animate: false
  });
  renderCoachPanel();
});
