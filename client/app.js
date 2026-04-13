import {
  AMBIENT_TRACK_VOLUMES,
  CLOCK_SYNC_INTERVAL_MS,
  CLOCK_TICK_INTERVAL_MS,
  COACH_STAGE_ENGINE_FEEDBACK,
  COACH_STAGE_GAME_OVER,
  COACH_STAGE_PLAYER_FEEDBACK,
  DEFAULT_COACH_EXPLANATION,
  GAME_OVER_BANNER_DURATION_MS,
  HALL_RANDOM_TIME_CONTROL_IDS,
  PIECES,
  QUICK_PLAY_TIME_CONTROL_ID,
  THINKING_COACH_EXPLANATION,
  TIME_CONTROL_PRESETS,
  VALID_LOBBY_MODES,
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
  getSavedView,
  hasSeenIntroSplash,
  markIntroSplashSeen,
  persistGuest,
  persistLobbyMode,
  persistRecordView,
  persistView,
  readStoredGuest
} from "./app/storage.js";
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


const createAmbientTrack = (src) => {
  const audio = new Audio(src);

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;

  return audio;
};

const ambientTracks = {
  hall: createAmbientTrack("assets/audio/hall-ambient.mp3"),
  game: createAmbientTrack("assets/audio/game-ambient.mp3")
};

const ambientState = {
  muted: false,
  unlocked: false,
  activeKey: null,
  transitionId: 0,
  fadeTimerId: null,
  fadeResolve: null
};

// ── Replay state ─────────────────────────────────────────────────────────

const clearWizardReactionDelayTimer = () => {
  if (!runtimeState.wizardReactionDelayTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.wizardReactionDelayTimeoutId);
  runtimeState.wizardReactionDelayTimeoutId = null;
};

const clearWizardStateResetTimer = () => {
  if (!runtimeState.wizardStateResetTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.wizardStateResetTimeoutId);
  runtimeState.wizardStateResetTimeoutId = null;
};

const clearWizardStateTimers = () => {
  clearWizardReactionDelayTimer();
  clearWizardStateResetTimer();
};

const scheduleWizardIdleReset = (delayMs = 2000) => {
  clearWizardStateResetTimer();
  runtimeState.wizardStateResetTimeoutId = window.setTimeout(() => {
    setWizardIdleState();
    runtimeState.wizardStateResetTimeoutId = null;
  }, delayMs);
};

const scheduleWizardReactionState = (
  nextState,
  {
    delayMs = 900,
    holdMs = 2000,
    force = false
  } = {}
) => {
  if (!WIZARD_STATE_VISUALS[nextState]) {
    return;
  }

  clearWizardStateTimers();
  const effectiveDelay = runtimeState.currentWizardState === "st-think" ? delayMs : 0;

  runtimeState.wizardReactionDelayTimeoutId = window.setTimeout(() => {
    runtimeState.wizardReactionDelayTimeoutId = null;
    setWizardState(nextState, {
      force
    });
    if (holdMs > 0 && nextState !== "st-win") {
      scheduleWizardIdleReset(holdMs);
    }
  }, effectiveDelay);
};

const setWizardThinkingState = ({ preserveTimers = false } = {}) => {
  if (!preserveTimers) {
    clearWizardStateTimers();
  }

  if (runtimeState.currentWizardState !== "st-think") {
    setWizardState("st-think", {
      force: true
    });
  }
};

const setWizardIdleState = () => {
  clearWizardStateTimers();
  setWizardState("st-idle", {
    force: true
  });
};

const isHumanBlunderFeedback = (coachFeedback = {}) => {
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

const syncCoachAvatarMode = () => {
  if (!coachPanel) {
    return;
  }

  const showWizard = state.view === "game";
  coachPanel.classList.add("coach-avatar-relocated");
  coachPanel.classList.remove("coach-avatar-3d");
  if (coachAvatarImage) {
    coachAvatarImage.setAttribute("aria-hidden", "true");
  }
  if (coachWizardSvg) {
    coachWizardSvg.setAttribute("aria-hidden", showWizard ? "false" : "true");
  }
  wizardSide?.setAttribute("aria-hidden", showWizard ? "false" : "true");
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

const setWizardState = (nextState) => {
  if (!coachWizardSvg || !WIZARD_STATE_VISUALS[nextState]) {
    return;
  }

  WIZARD_STATE_CLASSNAMES.forEach((stateClass) => {
    coachWizardSvg.classList.remove(stateClass);
  });
  coachWizardSvg.classList.add(nextState);
  runtimeState.currentWizardState = nextState;
  wizardSide?.setAttribute("data-state", nextState);
  if (wizardStateLabel) {
    wizardStateLabel.textContent = WIZARD_STATE_LABELS[nextState] || "IDLE";
  }

  const visual = WIZARD_STATE_VISUALS[nextState];
  coachWizardMouth?.setAttribute("d", visual.mouth);
  coachWizardBrowLeft?.setAttribute("d", visual.browLeft);
  coachWizardBrowRight?.setAttribute("d", visual.browRight);
  coachWizardIrisLeft?.setAttribute("fill", visual.iris);
  coachWizardIrisRight?.setAttribute("fill", visual.iris);
  coachWizardIrisLeft?.setAttribute("cx", String(visual.irisLeft.cx));
  coachWizardIrisLeft?.setAttribute("cy", String(visual.irisLeft.cy));
  coachWizardIrisLeft?.setAttribute("r", String(visual.irisLeft.r));
  coachWizardIrisRight?.setAttribute("cx", String(visual.irisRight.cx));
  coachWizardIrisRight?.setAttribute("cy", String(visual.irisRight.cy));
  coachWizardIrisRight?.setAttribute("r", String(visual.irisRight.r));
  coachWizardOrb?.setAttribute("fill", visual.orb);
  coachWizardOrb?.setAttribute("stroke", visual.orbStroke);

  if (nextState === "st-win") {
    arcaneBoard3D?.triggerSpectatorCelebration?.();
  }
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

  if (gameState.isGameOver) {
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

const normalizeLobbyMode = (value) =>
  VALID_LOBBY_MODES.has(value) ? value : "solo";

const isRealtimeMultiplayerGame = () =>
  Boolean(state.multiplayer.roomId) && state.game?.actorType === "multiplayer";

const isActiveGameState = (gameState) =>
  Boolean(gameState?.id && gameState?.hasStarted && !gameState?.isGameOver);

const getMultiplayerDisplayName = () => {
  if (isAuthenticated()) {
    return getSessionDisplayName();
  }

  return state.guest?.displayName || state.guest?.name || "Guest";
};

const getMultiplayerActorPayload = () => {
  if (isAuthenticated()) {
    return {
      actorType: "user",
      userId: state.session.user.id,
      guestId: null,
      displayName: getSessionDisplayName()
    };
  }

  return {
    actorType: "guest",
    userId: null,
    guestId: state.guest?.guestId || null,
    displayName: state.guest?.displayName || "Guest"
  };
};

const renderMultiplayerRealtimeControls = () => {
  if (multiplayerRoomIdLabel) {
    const hasRoom = Boolean(state.multiplayer.roomId);
    multiplayerRoomIdLabel.classList.toggle("hidden", !hasRoom);
    multiplayerRoomIdLabel.textContent = hasRoom
      ? `Room ID: ${state.multiplayer.roomId}`
      : "";
  }

  if (multiplayerConnectionStatus) {
    multiplayerConnectionStatus.classList.toggle("hidden", !state.multiplayer.connected);
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
    multiplayerConnectionStatus.textContent = state.multiplayer.connected
      ? `Socket connected (${phaseLabel})${queueSuffix}`
      : "";
  }
};

const renderLobbyTimeControlButtons = () => {
  if (!hallRandomTimeControlLabel) {
    return;
  }

  const activeTimeControl = getResolvedTimeControl(getSelectedTimeControlId());
  hallRandomTimeControlLabel.textContent = `Selected: ${activeTimeControl.label}`;
};

const getAmbientTargetKey = () => (state.view === "game" ? "game" : "hall");

const clearAmbientFade = () => {
  if (ambientState.fadeTimerId !== null) {
    window.cancelAnimationFrame(ambientState.fadeTimerId);
    ambientState.fadeTimerId = null;
  }

  if (ambientState.fadeResolve) {
    const resolveFade = ambientState.fadeResolve;
    ambientState.fadeResolve = null;
    resolveFade();
  }
};

const updateAmbientToggleLabel = () => {
  if (!ambientAudioToggleButton) {
    return;
  }

  const muted = ambientState.muted;
  const nextLabel = muted ? "Unmute Music" : "Mute Music";

  ambientAudioToggleButton.textContent = nextLabel;
  ambientAudioToggleButton.setAttribute("aria-label", muted ? "Unmute ambient music" : "Mute ambient music");
  ambientAudioToggleButton.setAttribute("aria-pressed", muted ? "true" : "false");
};

const syncAmbientTogglePlacement = () => {
  if (!ambientAudioToggleButton) {
    return;
  }

  const targetMount = state.view === "game" ? movesPanelHeaderActions : hallHeroActions;

  if (targetMount && ambientAudioToggleButton.parentElement !== targetMount) {
    targetMount.appendChild(ambientAudioToggleButton);
  }
};

const fadeAmbientAudio = (audio, fromVolume, toVolume, durationMs, token = ambientState.transitionId) =>
  new Promise((resolve) => {
    const startTime = performance.now();

    clearAmbientFade();
    ambientState.fadeResolve = resolve;

    const step = () => {
      if (token !== ambientState.transitionId) {
        ambientState.fadeTimerId = null;
        ambientState.fadeResolve = null;
        resolve();
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      audio.volume = fromVolume + (toVolume - fromVolume) * progress;

      if (progress >= 1) {
        ambientState.fadeTimerId = null;
        ambientState.fadeResolve = null;
        resolve();
        return;
      }

      ambientState.fadeTimerId = window.requestAnimationFrame(step);
    };

    ambientState.fadeTimerId = window.requestAnimationFrame(step);
  });

const stopAmbientMusic = () => {
  ambientState.transitionId += 1;
  clearAmbientFade();

  Object.values(ambientTracks).forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
  });

  ambientState.activeKey = null;
};

const syncAmbientMusic = async () => {
  const targetKey = getAmbientTargetKey();
  const targetAudio = ambientTracks[targetKey];
  const targetVolume = AMBIENT_TRACK_VOLUMES[targetKey];

  if (ambientState.muted) {
    stopAmbientMusic();
    updateAmbientToggleLabel();
    return;
  }

  if (!ambientState.unlocked) {
    updateAmbientToggleLabel();
    return;
  }

  if (ambientState.activeKey === targetKey && !targetAudio.paused) {
    targetAudio.volume = targetVolume;
    updateAmbientToggleLabel();
    return;
  }

  const transitionId = ++ambientState.transitionId;
  const previousKey = ambientState.activeKey;
  const previousAudio = previousKey ? ambientTracks[previousKey] : null;

  ambientState.activeKey = targetKey;

  if (previousAudio && previousAudio !== targetAudio) {
    const fromVolume = previousAudio.volume || AMBIENT_TRACK_VOLUMES[previousKey] || 0;
    await fadeAmbientAudio(previousAudio, fromVolume, 0, 240, transitionId);

    if (transitionId !== ambientState.transitionId) {
      return;
    }

    previousAudio.pause();
    previousAudio.currentTime = 0;
  }

  if (transitionId !== ambientState.transitionId) {
    return;
  }

  targetAudio.currentTime = 0;
  targetAudio.volume = 0;

  try {
    await targetAudio.play();
  } catch {
    if (transitionId === ambientState.transitionId) {
      ambientState.activeKey = null;
    }

    return;
  }

  if (transitionId !== ambientState.transitionId) {
    targetAudio.pause();
    targetAudio.currentTime = 0;
    return;
  }

  await fadeAmbientAudio(targetAudio, 0, targetVolume, 360, transitionId);
  updateAmbientToggleLabel();
};

const unlockAmbientMusic = () => {
  if (ambientState.unlocked) {
    return;
  }

  ambientState.unlocked = true;
  void syncAmbientMusic();
};

const setAmbientMuted = (muted) => {
  ambientState.muted = muted;

  if (muted) {
    stopAmbientMusic();
  } else {
    void syncAmbientMusic();
  }

  updateAmbientToggleLabel();
};

function renderView() {
  document.body.classList.toggle("view-auth", state.view === "auth");
  document.body.classList.toggle("view-hall", state.view === "hall");
  document.body.classList.toggle("view-game", state.view === "game");
  document.body.classList.toggle("hall-view", state.view === "hall");
  persistView(state.view);

  if (authView) {
    authView.style.display = state.view === "auth" ? "flex" : "none";
  }

  if (playArea) {
    playArea.style.display = state.view === "auth" ? "none" : "grid";
  }

  if (lobbyView) {
    lobbyView.style.display = state.view === "hall" ? "block" : "none";
  }

  if (gameView) {
    gameView.style.display = state.view === "game" ? "grid" : "none";
  }

  syncBoardViewUi();

  console.log("renderView:", state.view);
  console.log("Hall visible:", lobbyView?.style.display, "Game visible:", gameView?.style.display);

  syncAmbientTogglePlacement();
  updateAmbientToggleLabel();
  void syncAmbientMusic();
}

const renderMultiplayerLobby = () => {
  const lobbyMode = normalizeLobbyMode(state.lobbyMode);
  const persistenceAvailable = Boolean(state.persistence.available);
  const showGateway = false;
  const showDashboard = lobbyMode === "multiplayer";

  state.lobbyMode = lobbyMode;

  if (controlsPanel) {
    controlsPanel.dataset.lobbyMode = lobbyMode;
  }

  if (soloLobbyButton) {
    const isActive = lobbyMode === "solo";
    soloLobbyButton.classList.toggle("cp-mode-btn-active", isActive);
    soloLobbyButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  if (multiplayerLobbyButton) {
    const isActive = lobbyMode === "multiplayer";
    multiplayerLobbyButton.classList.toggle("cp-mode-btn-active", isActive);
    multiplayerLobbyButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  if (multiplayerGateway) {
    multiplayerGateway.classList.toggle("hidden", !showGateway);
  }

  if (multiplayerDashboard) {
    multiplayerDashboard.classList.toggle("hidden", !showDashboard);
  }

  if (multiplayerPresencePill) {
    if (showDashboard && state.multiplayer.connected && state.multiplayer.roomId) {
      multiplayerPresencePill.textContent = "In Match";
      multiplayerPresencePill.className = "pill pill-ok";
    } else if (showDashboard && state.multiplayer.connected) {
      multiplayerPresencePill.textContent = "Online";
      multiplayerPresencePill.className = "pill pill-ok";
    } else if (!persistenceAvailable) {
      multiplayerPresencePill.textContent = "Offline";
      multiplayerPresencePill.className = "pill pill-error";
    } else if (showDashboard) {
      multiplayerPresencePill.textContent = "Ready";
      multiplayerPresencePill.className = "pill pill-ok";
    } else {
      multiplayerPresencePill.textContent = "Preview";
      multiplayerPresencePill.className = "pill";
    }
  }

  if (multiplayerStatusCopy) {
    if (showDashboard && state.multiplayer.roomId) {
      multiplayerStatusCopy.textContent =
        "Live room active. Share the Room ID so your opponent can join and play in real time.";
    } else if (showDashboard && state.multiplayer.queued) {
      multiplayerStatusCopy.textContent =
        "Searching for a Blitz 5 opponent now. Stay on this page while queued.";
    } else if (showDashboard && state.multiplayer.connected) {
      multiplayerStatusCopy.textContent =
        "Live socket connected. Click Online Quick Play to queue instantly for Blitz 5.";
    } else if (!persistenceAvailable) {
      multiplayerStatusCopy.textContent =
        "MongoDB is offline, so presence, invites, and PvP history stay parked until persistence returns.";
    } else if (showDashboard) {
      multiplayerStatusCopy.textContent =
        "Your account is ready for live duels. Create a room or join by Room ID to start.";
    } else {
      multiplayerStatusCopy.textContent =
        "Sign in to unlock the live roster, incoming invites, and cross-device multiplayer archives.";
    }
  }

  if (multiplayerPlayerList) {
    multiplayerPlayerList.innerHTML = showDashboard
      ? `
        <article class="lobby-roster-card">
          <div class="lobby-roster-copy">
            <strong>${escapeHtml(getSessionDisplayName())}</strong>
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

  if (multiplayerInviteList) {
    multiplayerInviteList.innerHTML = showDashboard
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

const setLobbyMode = (mode = "solo") => {
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

const getMultiplayerCoachState = (socketState) => {
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

const applyMultiplayerSocketState = (socketState) => {
  if (!socketState?.game) {
    return;
  }

  state.multiplayer.roomId = socketState.roomId || state.multiplayer.roomId;
  state.multiplayer.color = socketState.youAre || state.multiplayer.color;
  state.multiplayer.phase = socketState.phase || state.multiplayer.phase;

  applyGameState(
    {
      ...socketState.game,
      persistence: state.persistence
    },
    {
      coachState: getMultiplayerCoachState(socketState)
    }
  );
};

const leaveCompletedMultiplayerGameIfNeeded = () => {
  const hasLiveRoom = Boolean(state.multiplayer.roomId);
  const gameIsOver = Boolean(state.game?.isGameOver);
  const noActiveMoves = !state.game?.hasStarted || gameIsOver;

  if (!hasLiveRoom || !noActiveMoves) {
    return;
  }

  leaveMultiplayerRoom();
  applyQueueStatusState({ queued: false });
};

const applyQueueStatusState = (queueState = {}) => {
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

  renderMultiplayerLobby();
  syncActionButtons();
};

const joinMatchmakingQueue = async () => {
  if (state.multiplayer.roomId) {
    setCoachMessage(
      "Leave your current room before joining quick play.",
      "Quick play queue is only available when you are not inside a multiplayer room."
    );
    return;
  }

  setBusy(true, "Joining Blitz 5 quick play queue...");

  try {
    const queueState = await emitMultiplayerEvent("queue:join", {
      actor: getMultiplayerActorPayload()
    });

    setApiHealth(true);
    applyQueueStatusState(queueState);
    setCoachMessage(
      "Queued for Blitz 5 quick play.",
      "Matchmaking is live. We will drop you into a game as soon as another player queues."
    );
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const leaveMatchmakingQueue = async () => {
  setBusy(true, "Leaving quick play queue...");

  try {
    const queueState = await emitMultiplayerEvent("queue:leave");

    setApiHealth(true);
    applyQueueStatusState(queueState);
    setCoachMessage(
      "Quick play queue canceled.",
      "You can rejoin Blitz 5 quick play at any time."
    );
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const handleQuickPlayClick = async () => {
  if (state.multiplayer.queued) {
    await leaveMatchmakingQueue();
    return;
  }

  await joinMatchmakingQueue();
};

const rejoinMultiplayerMatch = async () => {
  if (!state.multiplayer.roomId) {
    setCoachMessage("No active multiplayer room found.", "Create or join a room to start a live match.");
    return;
  }

  state.view = "game";
  renderView();
  await launchSelectedBoard({
    trigger: "Resume Game"
  });
  syncActionButtons();
  setCoachMessage("Rejoined live match.", "You are back in the active multiplayer board.");
};

const createMultiplayerRoom = async () => {
  setBusy(true, "Creating multiplayer room...");

  try {
    const socketState = await emitMultiplayerEvent("multiplayer:create", {
      displayName: getMultiplayerDisplayName()
    });

    setApiHealth(true);
    state.view = "game";
    renderView();
    await launchSelectedBoard({
      trigger: "Create Room"
    });
    applyMultiplayerSocketState(socketState);
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const joinMultiplayerRoom = async () => {
  const roomId = multiplayerRoomIdInput?.value?.trim()?.toUpperCase() || "";

  if (!roomId) {
    setCoachMessage("Enter a Room ID first.", "Use the ID shared by the host player.");
    return;
  }

  setBusy(true, `Joining room ${roomId}...`);

  try {
    const socketState = await emitMultiplayerEvent("multiplayer:join", {
      roomId,
      displayName: getMultiplayerDisplayName()
    });

    setApiHealth(true);
    state.view = "game";
    renderView();
    await launchSelectedBoard({
      trigger: "Join Game"
    });
    applyMultiplayerSocketState(socketState);
  } catch (error) {
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
    setBusy(false);
  }
};

const focusAuthField = (input) => {
  input?.focus();
  input?.select?.();
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
  whyLines: [],
  whyExpanded: false,
  motionState: "idle",
  motionSettleTo: null,
  motionDurationMs: 0,
  motionPulseId: null,
  outcome: "neutral",
  animate: false,
  ...overrides
});

const getNextCoachMotionPulseId = () => {
  runtimeState.coachMotionSequence += 1;
  return runtimeState.coachMotionSequence;
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

const COACH_CLASSIFICATION_SET = new Set([
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

const CHRONICLE_BADGE_SYMBOLS = {
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

const getPlyIndexForTurnColor = (turn, color) => {
  const normalizedTurn = Number(turn);

  if (!Number.isFinite(normalizedTurn) || normalizedTurn < 1) {
    return null;
  }

  return (normalizedTurn - 1) * 2 + (color === "black" ? 1 : 0);
};

const getPlyColor = (plyIndex) => (plyIndex % 2 === 0 ? "white" : "black");

const isLocalPlayerPly = (plyIndex, gameState = state.game) => {
  if (!Number.isInteger(plyIndex) || plyIndex < 0) {
    return false;
  }

  const localPlayerColor = gameState?.settings?.playerColor;

  if (localPlayerColor !== "white" && localPlayerColor !== "black") {
    return false;
  }

  return getPlyColor(plyIndex) === localPlayerColor;
};

const getLastPlyIndexFromMoveList = (moveList = []) => {
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

const resetLiveChronicleState = (gameId = null) => {
  state.liveChronicle = {
    gameId,
    ratingsByPly: {},
    expandedWhyPly: null
  };
};

const ensureLiveChronicleForGame = (gameState = {}) => {
  const nextGameId = gameState?.id || null;

  if (!nextGameId) {
    resetLiveChronicleState();
    return;
  }

  if (state.liveChronicle.gameId !== nextGameId) {
    resetLiveChronicleState(nextGameId);
  }
};

const sanitizeLiveChronicleRatingsForLocalPlayer = (gameState = state.game) => {
  const entries = Object.entries(state.liveChronicle.ratingsByPly || {});

  entries.forEach(([plyKey]) => {
    const plyIndex = Number.parseInt(plyKey, 10);

    if (!isLocalPlayerPly(plyIndex, gameState)) {
      delete state.liveChronicle.ratingsByPly[plyKey];
      if (state.liveChronicle.expandedWhyPly === plyIndex) {
        state.liveChronicle.expandedWhyPly = null;
      }
    }
  });
};

const applyChronicleMoveMetadata = (gameState) => {
  if (!gameState) {
    return gameState;
  }

  sanitizeLiveChronicleRatingsForLocalPlayer(gameState);

  const moveList = Array.isArray(gameState.moveList) ? gameState.moveList : [];
  const enrichedMoveList = moveList.map((move) => {
    const nextMove = { ...move };
    const whitePly = getPlyIndexForTurnColor(move.turn, "white");
    const blackPly = getPlyIndexForTurnColor(move.turn, "black");
    const whiteMeta = whitePly !== null ? state.liveChronicle.ratingsByPly[whitePly] : null;
    const blackMeta = blackPly !== null ? state.liveChronicle.ratingsByPly[blackPly] : null;

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

const upsertLocalMoveChronicleRating = (plyIndex, coachFeedback = {}) => {
  if (!Number.isInteger(plyIndex) || plyIndex < 0 || !state.game?.settings?.playerColor) {
    return;
  }

  if (!isLocalPlayerPly(plyIndex, state.game)) {
    return;
  }

  const classification = String(coachFeedback.classification || "").toLowerCase();

  if (!COACH_CLASSIFICATION_SET.has(classification)) {
    return;
  }

  const whyLines = normalizeChronicleWhyLines(coachFeedback.whyLines);

  state.liveChronicle.ratingsByPly[plyIndex] = {
    classification,
    whyLines,
    beforeFen:
      typeof coachFeedback.beforeFen === "string" ? coachFeedback.beforeFen : ""
  };

  if (!whyLines.length && state.liveChronicle.expandedWhyPly === plyIndex) {
    state.liveChronicle.expandedWhyPly = null;
  }
};

const getCoachLead = (classification) => {
  if (COACH_CLASSIFICATION_SET.has(classification)) {
    return classification;
  }

  return "Arcane Coach is watching the board.";
};

const getCoachTone = (classification) => {
  if (["blunder", "miss"].includes(classification)) {
    return "blunder";
  }

  if (["mistake", "inaccuracy"].includes(classification)) {
    return "inaccuracy";
  }

  if (["good", "excellent", "best", "great", "brilliant"].includes(classification)) {
    return "good";
  }

  return "neutral";
};

const getReactionMotionState = (coachFeedback = {}) => {
  if (coachFeedback.motionState) {
    return coachFeedback.motionState;
  }

  if (["good", "excellent", "best", "great", "brilliant"].includes(coachFeedback.classification)) {
    return "good";
  }

  if (["mistake", "inaccuracy"].includes(coachFeedback.classification)) {
    return "inaccuracy";
  }

  if (["blunder", "miss"].includes(coachFeedback.classification)) {
    return "blunder";
  }

  return "idle";
};

const buildCoachFeedbackState = (coachFeedback = {}) => {
  const source = coachFeedback.source || "system";
  const isOpponentFeedback = source === "engine" || source === "opponent";
  const motionState = getReactionMotionState(coachFeedback);
  const motionDurationMs = coachFeedback.motionDurationMs || 1650;
  const normalizedClassification =
    typeof coachFeedback.classification === "string"
      ? coachFeedback.classification.trim().toLowerCase()
      : "";
  const ratingMessage = normalizedClassification && !isOpponentFeedback
    ? `Your move was rated ${normalizedClassification}.`
    : null;
  const threatSummary =
    typeof coachFeedback.threatSummary === "string" ? coachFeedback.threatSummary.trim() : "";
  const advisoryMessage =
    threatSummary ||
    (typeof coachFeedback.message === "string" ? coachFeedback.message.trim() : "") ||
    "Your opponent is applying pressure. Choose a concrete defensive plan.";
  const whyLines = Array.isArray(coachFeedback.whyLines)
    ? coachFeedback.whyLines
        .map((line = {}) => ({
          rank: Number(line.rank) || null,
          eval: typeof line.eval === "number" ? line.eval : null,
          san: Array.isArray(line.san)
            ? line.san.filter((move) => typeof move === "string" && move.trim().length > 0)
            : []
        }))
        .filter((line) => line.san.length > 0)
    : [];

  return createCoachState({
    source,
    classification: coachFeedback.classification || null,
    tone:
      coachFeedback.tone ||
      (isOpponentFeedback ? "warning" : getCoachTone(coachFeedback.classification)),
    message:
      ratingMessage ||
      (isOpponentFeedback
        ? advisoryMessage
        : coachFeedback.message || getCoachLead(coachFeedback.classification)),
    explanation:
      coachFeedback.explanation ||
      (isOpponentFeedback
        ? "Advisory mode: read the threat and choose your response."
        : DEFAULT_COACH_EXPLANATION),
    bestMove: coachFeedback.bestMove || null,
    whyLines,
    whyExpanded: false,
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
    guestSubtitle.textContent = "Signed in";
    guestMeta.textContent = "Unfinished and completed games belong to your account.";
    return;
  }

  guestName.textContent = state.guest?.displayName || "Playing as Guest";
  guestSubtitle.textContent = "Guest mode active";
  guestMeta.textContent = state.persistence.available
    ? "Save and resume untimed games here without creating an account."
    : "Saved games and history stay on this browser when persistence is available.";
};

const renderSessionUi = () => {
  if (!authSessionHeading) {
    return;
  }

  const persistenceAvailable = Boolean(state.persistence.available);
  const authenticated = isAuthenticated();

  if (authenticated) {
    if (authSessionHeading) {
      authSessionHeading.textContent = "Account connected";
    }
    if (authSessionPill) {
      authSessionPill.textContent = "SIGNED IN";
      authSessionPill.className = "pill pill-ok";
    }
    if (authSessionCopy) {
      authSessionCopy.textContent = persistenceAvailable
        ? "Saved and completed games now follow your account across devices and browsers."
        : "Your session is active, but account sync is paused until MongoDB returns.";
    }
    if (!authUserDisplay) {
      console.log("renderSessionUi: missing #auth-user-display");
    }
    if (authUserDisplay) {
      authUserDisplay.textContent = getSessionDisplayName();
    }
    // authUserEmail.textContent = state.session.user?.email || "Account email unavailable";
    if (authGuestView) {
      authGuestView.classList.add("hidden");
    }
    if (authUserView) {
      authUserView.classList.remove("hidden");
    }
    if (hallLogoutButton) {
      hallLogoutButton.classList.remove("hidden");
    }
  } else {
    if (authSessionHeading) {
      authSessionHeading.textContent = "Sign in or create an account";
    }
    if (authSessionPill) {
      authSessionPill.textContent = persistenceAvailable ? "Guest" : "Offline";
      authSessionPill.className = persistenceAvailable ? "pill" : "pill pill-error";
    }
    if (authSessionCopy) {
      authSessionCopy.textContent = persistenceAvailable
        ? "Accounts sync unfinished and completed games beyond this browser."
        : "MongoDB is offline, so account sign-in and long-term sync are unavailable right now.";
    }
    if (authGuestView) {
      authGuestView.classList.remove("hidden");
    }
    if (authUserView) {
      authUserView.classList.add("hidden");
    }
    if (hallLogoutButton) {
      hallLogoutButton.classList.add("hidden");
    }
  }

  renderMultiplayerLobby();
};

const syncActionButtons = () => {
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

const clearHintState = () => {
  state.hint = {
    bestMove: null,
    continuation: [],
    fen: "",
    summary: "",
    whyExpanded: false,
    freshHint: false,
    requestedThisTurn: false
  };

  hintWhyButton?.classList.add("hidden");
};

const applyHintHighlights = () => {
  if (!state.game) {
    return;
  }

  if (state.viewMode === "3D") {
    syncBoard3D();
  }

  if (state.viewMode === "2D") {
    renderBoard();
  }
};

const renderHintPanel = () => {
  if (!hintWhyButton || !hintWhyText) {
    return;
  }

  hintWhyButton.classList.add("hidden");

  const hasHint = Boolean(state.hint?.bestMove) &&
    state.hint?.freshHint === true;
  const hasFreshHint = hasHint && Boolean(state.hint?.requestedThisTurn);
  const hasLine = Array.isArray(state.hint?.continuation) && state.hint.continuation.length > 0;

  hintWhyButton.textContent = state.hint?.whyExpanded ? "Hide Why" : "Why?";
  hintWhyButton.setAttribute(
    "aria-expanded",
    state.hint?.whyExpanded ? "true" : "false"
  );
  if (hasFreshHint) {
    hintWhyButton.classList.remove("hidden");
  }
  hintWhyButton.disabled = !hasFreshHint;

  if (!hasFreshHint || !state.hint?.whyExpanded) {
    destroyMiniBoardTooltip();
    hintWhyText.textContent = "";
    hintWhyText.classList.add("hidden");
    return;
  }

  const bestMoveLabel =
    state.hint.bestMove.san || `${state.hint.bestMove.from}${state.hint.bestMove.to}`;
  const lineText = hasLine ? ` Line: ${state.hint.continuation.join(" ")}` : "";
  hintWhyText.textContent = `Hint: ${bestMoveLabel}. ${state.hint.summary}${lineText}`;
  hintWhyText.classList.remove("hidden");
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

  if (runtimeState.coachMessageAnimationTimeoutId) {
    window.clearTimeout(runtimeState.coachMessageAnimationTimeoutId);
  }

  coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  void coachBubbleCopy.offsetWidth;
  coachBubbleCopy.classList.add("coach-bubble-copy-update");

  if (coachPanel) {
    if (runtimeState.coachSpeakingAnimationTimeoutId) {
      window.clearTimeout(runtimeState.coachSpeakingAnimationTimeoutId);
    }

    coachPanel.classList.remove("coach-panel-speaking");
    void coachPanel.offsetWidth;
    coachPanel.classList.add("coach-panel-speaking");

    runtimeState.coachSpeakingAnimationTimeoutId = window.setTimeout(() => {
      coachPanel.classList.remove("coach-panel-speaking");
    }, 360);
  }

  runtimeState.coachMessageAnimationTimeoutId = window.setTimeout(() => {
    coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  }, 180);
};

const scheduleCoachMotionReset = (coachState) => {
  if (runtimeState.coachMotionAnimationTimeoutId) {
    window.clearTimeout(runtimeState.coachMotionAnimationTimeoutId);
    runtimeState.coachMotionAnimationTimeoutId = null;
  }

  if (!coachState.motionPulseId || !coachState.motionDurationMs) {
    runtimeState.lastRenderedCoachMotionPulseId = coachState.motionPulseId || null;
    return;
  }

  const motionPulseId = coachState.motionPulseId;
  const settleTo = coachState.motionSettleTo || "idle";
  const nextOutcome = settleTo === "game-over" ? coachState.outcome : "neutral";

  runtimeState.coachMotionAnimationTimeoutId = window.setTimeout(() => {
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

  runtimeState.lastRenderedCoachMotionPulseId = motionPulseId;
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
    bestMove: coachState.bestMove,
    whyExpanded: coachState.whyExpanded,
    whyLines: coachState.whyLines
  });
  const motionPulseChanged = coachState.motionPulseId !== runtimeState.lastRenderedCoachMotionPulseId;

  coachPanel.dataset.tone = coachState.tone || "neutral";
  coachPanel.dataset.motionState = coachState.motionState || "idle";
  coachPanel.dataset.outcome = coachState.outcome || "neutral";

  feedbackText.textContent = coachState.message;
  feedbackText.title = coachState.message || "";
  feedbackExplanation.textContent =
    coachState.explanation || DEFAULT_COACH_EXPLANATION;
  feedbackExplanation.title = coachState.explanation || DEFAULT_COACH_EXPLANATION;

  const showClassificationBadge =
    Boolean(coachState.classification) &&
    !["engine", "opponent"].includes(coachState.source || "");

  if (showClassificationBadge) {
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

  const hasWhyLines = Array.isArray(coachState.whyLines) && coachState.whyLines.length > 0;

  if (feedbackWhyToggle) {
    feedbackWhyToggle.classList.toggle("hidden", !hasWhyLines);
    feedbackWhyToggle.disabled = !hasWhyLines;
    feedbackWhyToggle.textContent = coachState.whyExpanded ? "Hide Why" : "Why?";
    feedbackWhyToggle.setAttribute("aria-expanded", coachState.whyExpanded ? "true" : "false");
  }

  if (feedbackWhyLines) {
    feedbackWhyLines.replaceChildren();
    feedbackWhyLines.classList.toggle("hidden", !hasWhyLines || !coachState.whyExpanded);

    if (hasWhyLines && coachState.whyExpanded) {
      coachState.whyLines.forEach((line, index) => {
        const lineElement = document.createElement("p");
        lineElement.className = "coach-why-line";

        const rank = Number(line.rank) || index + 1;
        const evalText = typeof line.eval === "number" ? ` (${line.eval >= 0 ? "+" : ""}${line.eval})` : "";
        lineElement.textContent = `Line ${rank}${evalText}: ${line.san.join(" ")}`;
        feedbackWhyLines.appendChild(lineElement);
      });
    }
  }

  feedbackThinking?.classList.toggle(
    "hidden",
    coachState.motionState !== "thinking"
  );

  coachFooter?.classList.toggle(
    "coach-footer-empty",
    !coachState.classification && !coachState.bestMove && !hasWhyLines
  );

  if (
    coachState.animate &&
    coachState.motionState !== "thinking" &&
    coachSignature !== runtimeState.lastRenderedCoachSignature
  ) {
    animateCoachMessage();
  }

  if (motionPulseChanged || coachState.motionPulseId === null) {
    scheduleCoachMotionReset(coachState);
  }

  runtimeState.lastRenderedCoachSignature = coachSignature;
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
    whyLines: [],
    whyExpanded: false,
    animate: false,
    ...createPersistentCoachMotion("idle")
  });
  renderCoachPanel();
};

const setBusy = (busy, message) => {
  state.busy = busy;
  syncActionButtons();
  if (!is3DMoveAnimating) {
    syncBoard3D();
  }
  renderBoardOverlays();

  if (message) {
    setCoachMessage(message);
  }
};

const setApiHealth = (healthy) => {
  apiHealth.textContent = healthy ? "Live" : "Offline";
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
      ? `Stopped · ${timeControl.label}`
      : `${isActive ? "Running" : "Waiting"} · ${timeControl.label}${
          timeControl.incrementMs
            ? ` · +${Math.round(timeControl.incrementMs / 1000)}`
            : ""
        }`;
  metaElement.classList.toggle("hidden", !metaElement.textContent);
  cardElement.dataset.active = isActive ? "true" : "false";
  cardElement.dataset.urgent = isUrgent ? "true" : "false";
  cardElement.dataset.untimed = "false";
  rowElement?.setAttribute("data-active", isActive ? "true" : "false");
};

const renderAuthMode = () => {
  const signupMode = state.authMode === "signup";

  authSignupOnlyFields.forEach((field) => {
    field.classList.toggle("hidden", !signupMode);
  });
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

const setRecordView = (view) => {
  const normalizedView = VALID_RECORD_VIEWS.has(view) ? view : "moves";
  state.activeRecordView = normalizedView;
  persistRecordView(normalizedView);

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
  if (!runtimeState.gameOverBannerTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.gameOverBannerTimeoutId);
  runtimeState.gameOverBannerTimeoutId = null;
};

const clearFinishedGameResetTimer = () => {
  if (!runtimeState.finishedGameResetTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.finishedGameResetTimeoutId);
  runtimeState.finishedGameResetTimeoutId = null;
};

const clearBoardFeedbackTimer = () => {
  if (!runtimeState.boardFeedbackTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.boardFeedbackTimeoutId);
  runtimeState.boardFeedbackTimeoutId = null;
};

const scheduleBoardFeedbackDismissal = (feedbackKey, durationMs = 1000) => {
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

const resetFinishedGameResetLifecycle = () => {
  clearFinishedGameResetTimer();
  runtimeState.activeFinishedGameResetKey = "";
};

const resetGameOverBannerLifecycle = () => {
  clearGameOverBannerTimer();
  runtimeState.activeGameOverBannerKey = "";
  runtimeState.dismissedGameOverBannerKey = "";
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
  if (isRealtimeMultiplayerGame()) {
    return;
  }

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

const scheduleFinishedGameReset = (gameState) => {
  if (isRealtimeMultiplayerGame()) {
    resetFinishedGameResetLifecycle();
    return;
  }

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

const scheduleGameOverBannerDismissal = (bannerKey) => {
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

  if (runtimeState.dismissedGameOverBannerKey === bannerKey) {
    hideGameOverBanner({
      resetCopy: true
    });
    return;
  }

  gameOverTitle.textContent = gameOverCopy.title;
  gameOverMessage.textContent = gameOverCopy.message;
  gameOverBanner.classList.remove("hidden");
  gameOverBanner.setAttribute("aria-hidden", "false");

  if (runtimeState.activeGameOverBannerKey !== bannerKey) {
    runtimeState.activeGameOverBannerKey = bannerKey;
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

const renderBoardOverlays = () => {
  renderGameOverBanner();
  renderBoardFeedback();

  if (state.pendingPromotion?.moveChoices?.length) {
    renderPromotionPrompt();
    return;
  }

  promotionPanel.classList.add("hidden");
};

const getMoveRatingTone = (classification = "") => {
  if (["blunder", "miss"].includes(classification)) {
    return "bad";
  }

  if (["mistake", "inaccuracy"].includes(classification)) {
    return "warn";
  }

  if (classification === "brilliant") {
    return "brilliant";
  }

  return "good";
};

const getChronicleWhyLineText = (whyLines = []) => {
  const bestLine = Array.isArray(whyLines)
    ? whyLines.find((line) => Array.isArray(line?.san) && line.san.length > 0)
    : null;

  return bestLine ? bestLine.san.join(" ") : "";
};

const renderMoveCell = ({ san, plyIndex, meta, isCurrent, allowRating }) => {
  if (!san) {
    return `<span class="move-cell-content"><span class="move-san">-</span></span>`;
  }

  if (!allowRating || !meta?.classification) {
    return `
      <span class="move-cell-content">
        <span class="move-san">${escapeHtml(san)}</span>
      </span>
    `;
  }

  const badgeSymbol = CHRONICLE_BADGE_SYMBOLS[meta.classification] || "•";
  const tone = getMoveRatingTone(meta.classification);
  const hasWhyLines = Array.isArray(meta.whyLines) && meta.whyLines.length > 0;

  return `
    <span class="move-cell-content">
      <span class="move-san">${escapeHtml(san)}</span>
      <span class="move-rating-badge move-rating-${tone}" title="${escapeHtml(meta.classification)}">${escapeHtml(badgeSymbol)}</span>
      ${
        hasWhyLines
          ? `<button
              type="button"
              class="move-why-toggle${isCurrent ? " move-why-toggle-current" : ""}"
              data-move-why-toggle="${plyIndex}"
              aria-label="Show why line for ${escapeHtml(san)}"
              title="Why line"
            >?</button>`
          : ""
      }
    </span>
  `;
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
        const whitePly = getPlyIndexForTurnColor(move.turn, "white");
        const blackPly = getPlyIndexForTurnColor(move.turn, "black");
        const whiteMeta =
          typeof move.whiteRating === "string"
            ? {
                classification: move.whiteRating,
                whyLines: Array.isArray(move.whiteWhyLines) ? move.whiteWhyLines : []
              }
            : null;
        const blackMeta =
          typeof move.blackRating === "string"
            ? {
                classification: move.blackRating,
                whyLines: Array.isArray(move.blackWhyLines) ? move.blackWhyLines : []
              }
            : null;
        const whiteAllowRating = isLocalPlayerPly(whitePly, state.game);
        const blackAllowRating = isLocalPlayerPly(blackPly, state.game);
        const expandedWhyPly = state.liveChronicle.expandedWhyPly;
        const expandedMeta =
          expandedWhyPly === whitePly && whiteAllowRating
            ? whiteMeta
            : expandedWhyPly === blackPly && blackAllowRating
              ? blackMeta
              : null;
        const expandedWhyLine = getChronicleWhyLineText(expandedMeta?.whyLines || []);
        const expandedClassification = expandedMeta?.classification || "";

        return `
        <div class="move-row ${highlightWhite || highlightBlack ? "move-row-current" : ""}">
          <strong class="move-turn">${escapeHtml(`${move.turn}.`)}</strong>
          <span class="move-cell ${highlightWhite ? "move-cell-current" : ""}">${renderMoveCell({
            san: move.white,
            plyIndex: whitePly,
            meta: whiteMeta,
            isCurrent: highlightWhite,
            allowRating: whiteAllowRating
          })}</span>
          <span class="move-cell ${highlightBlack ? "move-cell-current" : ""}">${renderMoveCell({
            san: move.black,
            plyIndex: blackPly,
            meta: blackMeta,
            isCurrent: highlightBlack,
            allowRating: blackAllowRating
          })}</span>
        </div>
        ${
          expandedWhyLine
            ? `<div class="move-why-row">
                <span class="move-why-label">${escapeHtml(expandedClassification)} Why:</span>
                <span class="move-why-line">${escapeHtml(expandedWhyLine)}</span>
              </div>`
            : ""
        }
      `;
      }
    )
    .join("")}
  `;
};

const renderMoveList = () => {
  destroyMiniBoardTooltip();
  const liveMoveList = state.game?.moveList || state.game?.moves || [];
  moveListElement.innerHTML = renderMoveRows(
    liveMoveList,
    "No moves have been recorded yet.",
    state.game?.lastMove || null
  );
  attachChronicleWhyHoverListeners();
};

const getSavedGameHeadline = (game = {}) => {
  const playerName = getLocalPlayerDisplayName();
  const isMultiplayerSave = game.actorType === "multiplayer";

  if (isMultiplayerSave) {
    const opponentName =
      game.opponentName ||
      game.opponentDisplayName ||
      game.opponent ||
      "Opponent";
    return `${playerName} vs ${opponentName}`;
  }

  const difficulty = game.difficulty || "Easy";
  return `${playerName} vs Stockfish · ${difficulty}`;
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
            <strong>${escapeHtml(getSavedGameHeadline(game))}</strong>
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

const MINI_BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const MINI_BOARD_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const MINI_BOARD_STEP_MS = 800;

const cloneMiniBoardMap = (boardMap = {}) => {
  const next = {};

  Object.entries(boardMap).forEach(([square, piece]) => {
    next[square] = piece ? { ...piece } : null;
  });

  return next;
};

const getMiniBoardStateFromFen = (fen = "") => {
  const boardData = parseFenToBoard(fen);
  const boardMap = {};

  boardData.forEach((entry) => {
    boardMap[entry.square] = entry.piece ? { ...entry.piece } : null;
  });

  const fenParts = String(fen || "").split(" ");

  return {
    boardMap,
    turn: fenParts[1] === "b" ? "black" : "white",
    enPassant: fenParts[3] && fenParts[3] !== "-" ? fenParts[3] : null
  };
};

const getSquareCoords = (square = "") => ({
  file: square.charCodeAt(0),
  rank: Number(square[1])
});

const isInsideMiniBoard = (fileCode, rank) =>
  fileCode >= 97 && fileCode <= 104 && rank >= 1 && rank <= 8;

const sanitizeSanMove = (san = "") =>
  String(san || "")
    .trim()
    .replace(/[+#]+$/g, "")
    .replace(/[!?]+/g, "");

const isPathClear = (boardMap, fromSquare, toSquare) => {
  const from = getSquareCoords(fromSquare);
  const to = getSquareCoords(toSquare);
  const fileStep = Math.sign(to.file - from.file);
  const rankStep = Math.sign(to.rank - from.rank);
  let file = from.file + fileStep;
  let rank = from.rank + rankStep;

  while (file !== to.file || rank !== to.rank) {
    const square = `${String.fromCharCode(file)}${rank}`;

    if (boardMap[square]) {
      return false;
    }

    file += fileStep;
    rank += rankStep;
  }

  return true;
};

const canPieceReachTarget = ({
  boardMap,
  fromSquare,
  toSquare,
  piece,
  isCapture,
  sideToMove,
  enPassantSquare
}) => {
  const from = getSquareCoords(fromSquare);
  const to = getSquareCoords(toSquare);
  const fileDiff = to.file - from.file;
  const rankDiff = to.rank - from.rank;
  const absFile = Math.abs(fileDiff);
  const absRank = Math.abs(rankDiff);
  const targetPiece = boardMap[toSquare] || null;

  if (targetPiece?.color === piece.color) {
    return false;
  }

  if (piece.type === "p") {
    const direction = sideToMove === "white" ? 1 : -1;
    const startRank = sideToMove === "white" ? 2 : 7;
    const oneStepSquare = `${fromSquare[0]}${from.rank + direction}`;

    if (isCapture) {
      const isDiagonal = absFile === 1 && rankDiff === direction;
      const capturesEnPassant =
        !targetPiece && enPassantSquare && enPassantSquare === toSquare;

      return isDiagonal && Boolean(targetPiece || capturesEnPassant);
    }

    if (fileDiff !== 0 || targetPiece) {
      return false;
    }

    if (rankDiff === direction) {
      return true;
    }

    return (
      from.rank === startRank &&
      rankDiff === direction * 2 &&
      !boardMap[oneStepSquare]
    );
  }

  if (piece.type === "n") {
    return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  }

  if (piece.type === "k") {
    return absFile <= 1 && absRank <= 1;
  }

  if (piece.type === "b") {
    return absFile === absRank && isPathClear(boardMap, fromSquare, toSquare);
  }

  if (piece.type === "r") {
    return (fileDiff === 0 || rankDiff === 0) && isPathClear(boardMap, fromSquare, toSquare);
  }

  if (piece.type === "q") {
    const diagonal = absFile === absRank;
    const straight = fileDiff === 0 || rankDiff === 0;
    return (diagonal || straight) && isPathClear(boardMap, fromSquare, toSquare);
  }

  return false;
};

const resolveSanMove = ({ boardMap, san, sideToMove, enPassantSquare }) => {
  const cleanedSan = sanitizeSanMove(san);

  if (!cleanedSan) {
    return null;
  }

  if (cleanedSan === "O-O" || cleanedSan === "0-0") {
    return sideToMove === "white"
      ? { from: "e1", to: "g1", pieceType: "k", isCastle: "king" }
      : { from: "e8", to: "g8", pieceType: "k", isCastle: "king" };
  }

  if (cleanedSan === "O-O-O" || cleanedSan === "0-0-0") {
    return sideToMove === "white"
      ? { from: "e1", to: "c1", pieceType: "k", isCastle: "queen" }
      : { from: "e8", to: "c8", pieceType: "k", isCastle: "queen" };
  }

  const sanMatch = cleanedSan.match(/^([KQRBN])?([a-h1-8]{0,2})(x)?([a-h][1-8])(=?[QRBN])?$/);

  if (!sanMatch) {
    return null;
  }

  const [, pieceLetter, disambiguation, captureFlag, targetSquare, promotionPart] = sanMatch;
  const pieceType = pieceLetter ? pieceLetter.toLowerCase() : "p";
  const isCapture = captureFlag === "x";
  const promotion = promotionPart ? promotionPart.replace("=", "").toLowerCase() : null;
  const candidateSquares = Object.entries(boardMap)
    .filter(([, piece]) => piece && piece.color === sideToMove && piece.type === pieceType)
    .map(([square]) => square)
    .filter((square) =>
      canPieceReachTarget({
        boardMap,
        fromSquare: square,
        toSquare: targetSquare,
        piece: boardMap[square],
        isCapture,
        sideToMove,
        enPassantSquare
      })
    )
    .filter((square) => {
      if (!disambiguation) {
        return true;
      }

      if (disambiguation.length === 2) {
        return square === disambiguation;
      }

      const qualifier = disambiguation[0];
      return /[a-h]/.test(qualifier) ? square[0] === qualifier : square[1] === qualifier;
    });

  if (!candidateSquares.length) {
    return null;
  }

  return {
    from: candidateSquares[0],
    to: targetSquare,
    pieceType,
    promotion,
    isCapture
  };
};

const applyMiniBoardMove = ({ boardMap, resolvedMove, sideToMove, enPassantSquare }) => {
  if (!resolvedMove?.from || !resolvedMove?.to) {
    return null;
  }

  const nextBoardMap = cloneMiniBoardMap(boardMap);
  const movingPiece = nextBoardMap[resolvedMove.from]
    ? { ...nextBoardMap[resolvedMove.from] }
    : null;

  if (!movingPiece) {
    return null;
  }

  nextBoardMap[resolvedMove.from] = null;

  if (movingPiece.type === "p" && resolvedMove.isCapture && !nextBoardMap[resolvedMove.to]) {
    const to = getSquareCoords(resolvedMove.to);
    const capturedRank = sideToMove === "white" ? to.rank - 1 : to.rank + 1;
    const capturedSquare = `${resolvedMove.to[0]}${capturedRank}`;
    nextBoardMap[capturedSquare] = null;
  }

  if (resolvedMove.isCastle === "king" || resolvedMove.isCastle === "queen") {
    if (sideToMove === "white") {
      if (resolvedMove.isCastle === "king") {
        nextBoardMap.h1 = null;
        nextBoardMap.f1 = { type: "r", color: "white" };
      } else {
        nextBoardMap.a1 = null;
        nextBoardMap.d1 = { type: "r", color: "white" };
      }
    } else if (resolvedMove.isCastle === "king") {
      nextBoardMap.h8 = null;
      nextBoardMap.f8 = { type: "r", color: "black" };
    } else {
      nextBoardMap.a8 = null;
      nextBoardMap.d8 = { type: "r", color: "black" };
    }
  }

  const promotedType = movingPiece.type === "p" ? resolvedMove.promotion || movingPiece.type : movingPiece.type;
  nextBoardMap[resolvedMove.to] = {
    type: promotedType,
    color: movingPiece.color
  };

  const fromCoords = getSquareCoords(resolvedMove.from);
  const toCoords = getSquareCoords(resolvedMove.to);
  let nextEnPassant = null;

  if (movingPiece.type === "p" && Math.abs(toCoords.rank - fromCoords.rank) === 2) {
    const intermediateRank = (toCoords.rank + fromCoords.rank) / 2;
    nextEnPassant = `${resolvedMove.from[0]}${intermediateRank}`;
  }

  return {
    boardMap: nextBoardMap,
    from: resolvedMove.from,
    to: resolvedMove.to,
    ghostPiece: {
      ...movingPiece
    },
    turn: sideToMove === "white" ? "black" : "white",
    enPassant: nextEnPassant
  };
};

const createMiniBoardUI = ({ title = "Why line preview" } = {}) => {
  const root = document.createElement("div");
  root.className = "mini-board-tooltip";
  root.setAttribute("role", "tooltip");

  const heading = document.createElement("div");
  heading.className = "mini-board-heading";
  heading.textContent = title;
  root.appendChild(heading);

  const board = document.createElement("div");
  board.className = "mini-board-grid";
  root.appendChild(board);

  const squareNodes = {};

  MINI_BOARD_RANKS.forEach((rank) => {
    MINI_BOARD_FILES.forEach((file) => {
      const square = `${file}${rank}`;
      const squareNode = document.createElement("div");
      squareNode.className = `mini-board-square ${getSquareColorClass(square).replace("square", "mini-board")}`;
      squareNode.dataset.square = square;

      const pieceNode = document.createElement("span");
      pieceNode.className = "mini-board-piece";
      const ghostNode = document.createElement("span");
      ghostNode.className = "mini-board-piece ghost-piece";
      squareNode.appendChild(ghostNode);
      squareNode.appendChild(pieceNode);
      board.appendChild(squareNode);
      squareNodes[square] = {
        squareNode,
        ghostNode,
        pieceNode
      };
    });
  });

  return {
    root,
    squareNodes
  };
};

const renderMiniBoardPosition = (
  tooltipState,
  { lastFrom = "", lastTo = "", ghostSquare = "", ghostPiece = null } = {}
) => {
  Object.entries(tooltipState.squareNodes).forEach(([square, refs]) => {
    const piece = tooltipState.boardMap[square];
    const hasGhost = Boolean(ghostSquare) && ghostSquare === square && ghostPiece;

    refs.squareNode.classList.toggle("mini-board-last-from", square === lastFrom);
    refs.squareNode.classList.toggle("mini-board-last-to", square === lastTo);
    refs.ghostNode.textContent = hasGhost ? PIECES[ghostPiece.color][ghostPiece.type] : "";
    refs.ghostNode.classList.toggle("mini-board-piece-white", Boolean(hasGhost && ghostPiece.color === "white"));
    refs.ghostNode.classList.toggle("mini-board-piece-black", Boolean(hasGhost && ghostPiece.color === "black"));
    refs.pieceNode.textContent = piece ? PIECES[piece.color][piece.type] : "";
    refs.pieceNode.classList.toggle("mini-board-piece-white", piece?.color === "white");
    refs.pieceNode.classList.toggle("mini-board-piece-black", piece?.color === "black");
  });
};

const positionMiniBoardTooltip = (tooltipElement, anchorElement) => {
  const margin = 10;
  const anchorRect = anchorElement.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
  let top = anchorRect.bottom + 8;

  if (left + tooltipRect.width > viewportWidth - margin) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  if (left < margin) {
    left = margin;
  }

  if (top + tooltipRect.height > viewportHeight - margin) {
    top = anchorRect.top - tooltipRect.height - 8;
  }

  if (top < margin) {
    top = margin;
  }

  tooltipElement.style.left = `${Math.round(left)}px`;
  tooltipElement.style.top = `${Math.round(top)}px`;
};

const clearMiniBoardTooltipTimer = () => {
  if (runtimeState.activeMiniBoardTooltip?.timerId) {
    window.clearTimeout(runtimeState.activeMiniBoardTooltip.timerId);
  }
};

const destroyMiniBoardTooltip = () => {
  clearMiniBoardTooltipTimer();

  if (runtimeState.activeMiniBoardTooltip?.root?.parentNode) {
    runtimeState.activeMiniBoardTooltip.root.parentNode.removeChild(runtimeState.activeMiniBoardTooltip.root);
  }

  runtimeState.activeMiniBoardTooltip = null;
};

const scheduleMiniBoardStep = (tooltipState, delayMs = MINI_BOARD_STEP_MS) => {
  clearMiniBoardTooltipTimer();
  tooltipState.timerId = window.setTimeout(() => {
    if (runtimeState.activeMiniBoardTooltip !== tooltipState) {
      return;
    }

    if (!tooltipState.continuation.length) {
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    if (tooltipState.stepIndex >= tooltipState.continuation.length) {
      tooltipState.boardMap = cloneMiniBoardMap(tooltipState.initialBoardMap);
      tooltipState.turn = tooltipState.initialTurn;
      tooltipState.enPassant = tooltipState.initialEnPassant;
      tooltipState.stepIndex = 0;
      renderMiniBoardPosition(tooltipState, {
        ghostSquare: "",
        ghostPiece: null
      });
      scheduleMiniBoardStep(tooltipState, 440);
      return;
    }

    const san = tooltipState.continuation[tooltipState.stepIndex];
    const resolvedMove = resolveSanMove({
      boardMap: tooltipState.boardMap,
      san,
      sideToMove: tooltipState.turn,
      enPassantSquare: tooltipState.enPassant
    });

    if (!resolvedMove) {
      tooltipState.stepIndex += 1;
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    const applied = applyMiniBoardMove({
      boardMap: tooltipState.boardMap,
      resolvedMove,
      sideToMove: tooltipState.turn,
      enPassantSquare: tooltipState.enPassant
    });

    if (!applied) {
      tooltipState.stepIndex += 1;
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    tooltipState.boardMap = applied.boardMap;
    tooltipState.turn = applied.turn;
    tooltipState.enPassant = applied.enPassant;
    tooltipState.stepIndex += 1;
    renderMiniBoardPosition(tooltipState, {
      lastFrom: applied.from,
      lastTo: applied.to,
      ghostSquare: applied.from,
      ghostPiece: applied.ghostPiece || null
    });
    scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
  }, delayMs);
};

const showMiniBoardTooltip = ({ anchorElement, fen, continuation, label }) => {
  if (!anchorElement || !fen || !Array.isArray(continuation) || !continuation.length) {
    return;
  }

  const filteredContinuation = continuation
    .map((move) => String(move || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!filteredContinuation.length) {
    return;
  }

  destroyMiniBoardTooltip();
  runtimeState.miniBoardHoverToken += 1;

  const baseState = getMiniBoardStateFromFen(fen);
  const ui = createMiniBoardUI({
    title: label || "Why line preview"
  });

  document.body.appendChild(ui.root);
  positionMiniBoardTooltip(ui.root, anchorElement);

  const tooltipState = {
    id: runtimeState.miniBoardHoverToken,
    root: ui.root,
    squareNodes: ui.squareNodes,
    timerId: null,
    continuation: filteredContinuation,
    initialBoardMap: cloneMiniBoardMap(baseState.boardMap),
    boardMap: cloneMiniBoardMap(baseState.boardMap),
    initialTurn: baseState.turn,
    turn: baseState.turn,
    initialEnPassant: baseState.enPassant,
    enPassant: baseState.enPassant,
    stepIndex: 0
  };

  runtimeState.activeMiniBoardTooltip = tooltipState;
  renderMiniBoardPosition(tooltipState);
  scheduleMiniBoardStep(tooltipState, 360);
};

const getPrimaryWhyLineSan = (whyLines = []) => {
  const bestLine = Array.isArray(whyLines)
    ? whyLines.find((line) => Array.isArray(line?.san) && line.san.length > 0)
    : null;

  return bestLine?.san || [];
};

const attachChronicleWhyHoverListeners = () => {
  if (!moveListElement) {
    return;
  }

  moveListElement.querySelectorAll("[data-move-why-toggle]").forEach((button) => {
    if (button.dataset.hoverVisualizerBound === "true") {
      return;
    }

    button.dataset.hoverVisualizerBound = "true";

    button.addEventListener("mouseenter", () => {
      const plyIndex = Number.parseInt(button.dataset.moveWhyToggle || "", 10);

      if (!Number.isInteger(plyIndex) || plyIndex < 0) {
        return;
      }

      const moveMeta = state.liveChronicle.ratingsByPly[plyIndex];
      const continuation = getPrimaryWhyLineSan(moveMeta?.whyLines || []);
      const fen = moveMeta?.beforeFen || "";

      showMiniBoardTooltip({
        anchorElement: button,
        fen,
        continuation,
        label: "Chronicle Why Line"
      });
    });

    button.addEventListener("mouseleave", () => {
      destroyMiniBoardTooltip();
    });
  });
};

const renderReplayBoard = () => {
  if (!replayBoard) return;

  const fen = replayState.fenSteps[replayState.index];

  if (!fen) {
    replayBoard.innerHTML = "";
    return;
  }

  const boardData = parseFenToBoard(fen);
  const lookup = new Map(boardData.map((e) => [e.square, e]));
  const files =
    replayState.playerColor === "black"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks =
    replayState.playerColor === "black"
      ? ["1", "2", "3", "4", "5", "6", "7", "8"]
      : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const lastMoveFrom = replayState.index > 0 ? replayState.moveHistory[replayState.index - 1]?.from : null;
  const lastMoveTo = replayState.index > 0 ? replayState.moveHistory[replayState.index - 1]?.to : null;

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
  const total = Math.max(0, replayState.fenSteps.length - 1);
  const hasData = replayState.fenSteps.length > 0;

  if (replayStepLabel) {
    if (!hasData) {
      replayStepLabel.textContent = "No data";
    } else {
      replayStepLabel.textContent = replayState.index === 0 ? "Start" : `Move ${replayState.index} of ${total}`;
    }
  }

  if (replayBack) replayBack.disabled = replayState.index <= 0 || !hasData;
  if (replayForward) replayForward.disabled = replayState.index >= total || !hasData;
};

const scrollReplayActiveMoveIntoView = () => {
  if (!historyDetailMoves) return;
  const active = historyDetailMoves.querySelector(".move-cell-current");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
};

const setReplayStep = (index) => {
  replayState.index = Math.max(0, Math.min(index, Math.max(0, replayState.fenSteps.length - 1)));
  renderReplayBoard();
  if (historyDetailMoves) {
    historyDetailMoves.innerHTML = renderReplayMoveRows(replayState.moveList, replayState.index - 1);
  }
  updateReplayControls();
  scrollReplayActiveMoveIntoView();
};

const stepReplay = (delta) => setReplayStep(replayState.index + delta);

const initReplay = (moveList, fenSteps, moveHistory, playerColor) => {
  replayState.moveList = moveList || [];
  replayState.fenSteps = fenSteps || [];
  replayState.moveHistory = moveHistory || [];
  replayState.playerColor = playerColor || "white";
  setReplayStep(0);
};

const clearReplay = () => {
  replayState.fenSteps = [];
  replayState.moveHistory = [];
  replayState.moveList = [];
  replayState.index = 0;
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

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const updateEvalBar = () => {
  if (!evalBarBlack || !evalBarWhite) return;
  const board = state.game?.board;
  if (!board) return;

  let white = 0, black = 0;
  board.forEach(sq => {
    if (!sq.piece) return;
    const v = PIECE_VALUES[sq.piece.type] || 0;
    if (sq.piece.color === 'white') white += v;
    else black += v;
  });

  const diff = Math.max(-10, Math.min(10, white - black));
  const whitePct = Math.round(((diff + 10) / 20) * 100);
  const blackPct = 100 - whitePct;

  evalBarBlack.style.flex = blackPct;
  evalBarWhite.style.flex = whitePct;
};

const renderBoard = () => {
  const legalTargets = getLegalTargets();
  const targetSquares = new Map(legalTargets.map((move) => [move.to, move]));
  const orderedSquares = getOrderedSquares();
  const incompleteSquareData =
    orderedSquares.length !== 64 || orderedSquares.some((entry) => !entry || !entry.square);

  if (incompleteSquareData) {
    console.log("Skipping board render: square data is incomplete");
    return;
  }

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

      if (state.hint?.bestMove?.from === entry.square) {
        squareClasses.push("square-hint-from");
      }

      if (state.hint?.bestMove?.to === entry.square) {
        squareClasses.push("square-hint-to");
      }

      if (isSelectable) {
        squareClasses.push("square-selectable");
      }

      const file = entry.square?.[0] || "";
      const rank = entry.square?.[1] || "";
      const fileLabel =
        index >= 56
          ? `<span class="square-label square-file">${file}</span>`
          : "";
      const rankLabel =
        index % 8 === 0
          ? `<span class="square-label square-rank">${rank}</span>`
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

  updateEvalBar();
};

const updateSummary = () => {
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
  const playerName = getLocalPlayerDisplayName();
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
    immersiveStatusMeta.textContent = `${playerName} vs Stockfish`;
    return;
  }

  immersiveStatusHeading.textContent = `${turnLabel} to move · Last: ${lastMoveLabel}`;
  immersiveStatusMeta.textContent = `${playerName} vs Stockfish`;
};

const renderBoardSurface = () => {
  if (state.view !== "game") {
    return;
  }

  if (state.viewMode === "3D") {
    syncBoard3D();
    renderBoardOverlays();
    return;
  }

  const boardPanel = document.querySelector("#game-view .board-panel");
  const boardStage = document.querySelector("#game-view .board-stage");
  const boardContainerElement = document.querySelector("#game-view .board-container");
  const gameBoardShell = document.querySelector("#game-view .board-shell");
  const boardSurface = document.getElementById("board");
  const boardContainer = boardContainerElement || gameBoardShell || boardElement?.parentElement || null;
  const boardState = state.game?.board;
  const boardStateFailureReason = getBoardRenderFailureReason(boardState);
  const boardStageRows = Array.from(
    document.querySelectorAll("#game-view .board-stage .board-player-row") || []
  );
  const boardRowsHeight = boardStageRows.reduce(
    (totalHeight, row) => totalHeight + (row?.offsetHeight || 0),
    0
  );
  const boardShellWrap = document.querySelector("#game-view .board-shell-wrap");
  const boardStackHeight = boardRowsHeight + (boardShellWrap?.offsetHeight || 0);
  const logBox = (label, element) => {
    if (!element) {
      console.log(label, null);
      return;
    }

    const computedStyle = window.getComputedStyle(element);
    console.log(label, {
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      width: computedStyle.width,
      height: computedStyle.height
    });
  };

  console.log("Rendering board in view:", state.view);
  logBox("Board panel", boardPanel);
  logBox("Board stage", boardStage);
  logBox("Board shell", boardShell);
  logBox("Board container", boardContainer);
  logBox("Board surface", boardSurface);
  console.log("boardPanel offsetHeight", boardPanel?.offsetHeight ?? 0);
  console.log("boardStage offsetHeight", boardStage?.offsetHeight ?? 0);
  console.log("Board stack height", boardStackHeight);
  if (boardPanel) {
    const boardPanelStyle = window.getComputedStyle(boardPanel);
    console.log("Board panel layout", {
      justifyContent: boardPanelStyle.justifyContent,
      alignItems: boardPanelStyle.alignItems
    });
  }
  console.log(
    "Board final size:",
    boardContainer?.offsetWidth ?? 0,
    boardContainer?.offsetHeight ?? 0
  );
  console.log("Board state ready:", !boardStateFailureReason, boardState?.length);

  if (!boardSurface) {
    console.log("Skipping board render: board surface element is missing");
    return;
  }

  if (!boardContainer) {
    console.log("Skipping board render: board container is missing");
    return;
  }

  if (boardContainer.offsetWidth <= 0 || boardContainer.offsetHeight <= 0) {
    console.log("Skipping board render: board container has zero size");
    return;
  }

  if (boardStateFailureReason) {
    console.log("Skipping board render:", boardStateFailureReason);
    return;
  }

  renderBoard();
  renderBoardOverlays();
};

const render = () => {
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

// ── Game-End Cinematic ───────────────────────────────────────────────────────

const getCinematicResultLabel = (gameState) => {
  const code = gameState?.status?.code;
  if (code === "checkmate")  return "CHECKMATE";
  if (code === "resignation") return "RESIGNED";
  if (code === "timeout")    return "TIMEOUT";
  if (code === "stalemate")  return "STALEMATE";
  if (gameState?.result === "draw") return "DRAW";
  return "GAME OVER";
};

const getCinematicSubtitle = (gameState) => {
  if (gameState?.result === "draw") return "The duel ends in a draw";
  const winner = getWinnerFromResult(gameState?.result);
  return winner ? `${winner} wins the duel` : "";
};

const dismissGameEndOverlay = () => {
  const overlay = document.getElementById("game-end-overlay");
  if (!overlay) return;
  overlay.classList.remove("gec-visible");
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  // Wipe inner content after the fade-out (if any transition is running)
  setTimeout(() => { overlay.innerHTML = ""; }, 500);
  runtimeState.gameEndCinematicShownForKey = "";
};

const showGameEndOverlay = (gameState) => {
  const overlay = document.getElementById("game-end-overlay");
  if (!overlay) return;

  // Clear any prior content before repopulating
  overlay.innerHTML = "";

  const resultLabel = getCinematicResultLabel(gameState);
  const subtitle    = getCinematicSubtitle(gameState);

  // Build 24 gold particle divs with random trajectories
  let particlesHtml = "";
  for (let i = 0; i < 24; i++) {
    const leftPct  = (8  + Math.random() * 84).toFixed(1);
    const tx       = ((Math.random() * 200) - 100).toFixed(1);
    const ty       = (70 + Math.random() * 150).toFixed(1);
    const delay    = (Math.random() * 0.9).toFixed(2);
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
  // Force a reflow so the CSS transition fires on the next frame
  // eslint-disable-next-line no-unused-expressions
  overlay.offsetHeight;
  overlay.classList.add("gec-visible");

  const rematchBtn = overlay.querySelector("#gec-rematch-btn");
  const hallBtn    = overlay.querySelector("#gec-hall-btn");

  rematchBtn?.addEventListener("click", () => {
    dismissGameEndOverlay();
    arcaneBoard3D?.clearGameEndCurtain?.();
    startNewGame();
  });

  hallBtn?.addEventListener("click", () => {
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
};

/**
 * Entry point called once per unique game-over event.
 * In 3D: drops the Three.js curtain first, then fades in the HTML overlay.
 * In 2D: skips the curtain and shows the HTML overlay directly.
 */
const triggerGameEndCinematic = (gameState) => {
  const key = getGameOverBannerKey(gameState);
  if (!key || runtimeState.gameEndCinematicShownForKey === key) return;
  runtimeState.gameEndCinematicShownForKey = key;

  if (state.boardViewMode === "3d" && arcaneBoard3D?.showGameEndCurtain) {
    // Curtain fires callback at the 600 ms mark; overlay fades in from there
    arcaneBoard3D.showGameEndCurtain(() => showGameEndOverlay(gameState));
  } else {
    // 2D: brief delay so board can finish any final render
    setTimeout(() => showGameEndOverlay(gameState), 120);
  }
};

// ── End Game-End Cinematic ────────────────────────────────────────────────────

const applyGameState = (gameState, options = {}) => {
  state.pendingNewGame = false;
  ensureLiveChronicleForGame(gameState);
  state.game = applyChronicleMoveMetadata(gameState);
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
  if (!options.preserveHint) {
    clearHintState();
  }
  setCoachStateForGame(gameState, options);
  applyWizardStateFromGameState(gameState, {
    source: options.wizardSource
  });
  if (gameState?.isGameOver) {
    triggerGameEndCinematic(gameState);
  }
  if (!options.skipRender) {
    render();
  }
};

const loadGame = async ({ applyState = true, coachContext = "load-active" } = {}) => {
  beginMoveCycle();
  const gameState = await request("/api/game");

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

const enterGameView = async ({ coachContext = "load-active", fallbackView = "hall" } = {}) => {
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
    clearSelectedSquare();
    state.view = fallbackView;
    render();
    return false;
  }

  state.view = "game";
  renderView();
  await launchSelectedBoard({
    trigger: coachContext === "resume" ? "Resume Game" : "Enter Game"
  });
  applyGameState(gameState, {
    coachContext
  });

  return true;
};

const refreshCollections = async () => {
  const [savedGamesPayload, historyPayload] = await Promise.all([
    loadSavedGames(),
    loadHistory()
  ]);

  state.savedGames = savedGamesPayload.items || [];
  state.history = historyPayload.items || [];
  setPersistence(historyPayload.persistence || savedGamesPayload.persistence || state.persistence);
  renderSavedGames();
  renderHistory();
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
    setCoachMessage(error.message);
      return false;
  } finally {
    setBusy(false);
  }
};

const loginAccount = async () => {
  console.log("loginAccount: start");
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
    } catch (parseError) {
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
    setCoachMessage(error.message);
    return false;
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

const showSignupMode = () => {
  state.authMode = "signup";
  renderAuthMode();
};

const startNewGame = async () => {
  console.log("Start Duel clicked");

  if (state.pendingNewGame || state.busy) {
    return;
  }

  state.pendingNewGame = true;

  if (isRealtimeMultiplayerGame()) {
    leaveMultiplayerRoom();
  }

  dismissGameEndOverlay();
  arcaneBoard3D?.clearGameEndCurtain?.();

  beginMoveCycle();
  resetFinishedGameResetLifecycle();
  resetGameOverBannerLifecycle();
  clearSelectedSquare();
  hideGameOverBanner({
    resetCopy: true
  });
  console.log("Initializing solo game state");
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
    const boardStateFailureReason = getBoardRenderFailureReason(gameState?.board);

    console.log("Board state ready:", !boardStateFailureReason, gameState?.board?.length);

    if (boardStateFailureReason) {
      throw new Error(`Unable to render new duel board: ${boardStateFailureReason}`);
    }

    setApiHealth(true);
    applyGameState(gameState, {
      coachContext: "new-game",
      skipRender: true
    });
    setWizardIdleState();
    console.log("Switching to game view");
    state.view = "game";
    renderView();
    render();
    const boardContainer = await waitForBoardContainerReady();
    if (boardContainer && state.boardViewMode === "3d") {
      await switchTo3D();
    }

    void refreshCollections();
  } catch (error) {
    state.pendingNewGame = false;
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
    state.view = "game";
    renderView();
    await launchSelectedBoard({
      trigger: "Resume Game"
    });
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
    if (isRealtimeMultiplayerGame()) {
      const socketState = await emitMultiplayerEvent("multiplayer:resign");

      setApiHealth(true);
      applyMultiplayerSocketState(socketState);
      setCoachMessage(
        "Resignation submitted.",
        "The multiplayer game has ended."
      );
      return;
    }

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
    if (isRealtimeMultiplayerGame()) {
      const socketState = await emitMultiplayerEvent("multiplayer:draw");

      setApiHealth(true);
      applyMultiplayerSocketState(socketState);

      if (socketState?.event === "draw-agreed") {
        setCoachMessage(
          "Draw agreed.",
          "The multiplayer game has ended as a draw."
        );
      } else {
        setCoachMessage(
          "Draw offer sent.",
          "Waiting for your opponent to accept, or they can decline by moving."
        );
      }
      return;
    }

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
  if (isRealtimeMultiplayerGame()) {
    setCoachMessage(
      "Draw claim via board controls is solo-only right now.",
      "For multiplayer, continue play until checkmate or a draw result occurs naturally."
    );
    return;
  }

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
  if (isRealtimeMultiplayerGame()) {
    return;
  }

  const drawClaim = getDrawClaimState(state.game);
  const engineTurnPaused =
    drawClaim?.available && state.game?.turn === state.game?.settings?.engineColor;

  if (!engineTurnPaused) {
    return;
  }

  beginMoveCycle();
  setBusy(true, "Continuing the duel...");

  try {
    setWizardThinkingState();
    const payload = await request("/api/game/engine", {
      method: "POST"
    });

    setApiHealth(true);

    if (payload.game.isGameOver) {
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

const loadCoachFeedback = async ({ cycleId, moveToken, plyIndex = null }) => {
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
    if (isHumanBlunderFeedback(payload.coachFeedback)) {
      scheduleWizardReactionState("st-blunder", {
        delayMs: 900,
        holdMs: 3000
      });
    }
    setCoachStageRank(COACH_STAGE_PLAYER_FEEDBACK);
    if (isLocalPlayerPly(plyIndex, state.game)) {
      upsertLocalMoveChronicleRating(plyIndex, payload.coachFeedback);
    }
    state.game = applyChronicleMoveMetadata(state.game);
    renderMoveList();
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
    setWizardThinkingState({
      preserveTimers: true
    });
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
        state.coach = buildCoachFeedbackState(payload.game.coachFeedback);
        renderCoachPanel();
      }
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
  if (isRealtimeMultiplayerGame()) {
    setBusy(true, "Sending move...");

    try {
      const socketState = await emitMultiplayerEvent("multiplayer:move", {
        from,
        to,
        promotion
      });

      setApiHealth(true);
      applyMultiplayerSocketState(socketState);
    } catch (error) {
      setApiHealth(false);
      setCoachMessage(error.message);
    } finally {
      setBusy(false);
    }

    return;
  }

  const cycleId = beginMoveCycle();
  setBusy(true);
  clearHintState();
  setCoachStageRank(1);
  clearSelectedSquare();
  debugGameplaySync("move:submit", {
    from,
    to,
    promotion: promotion || null,
    previewMove
  });
  syncActionButtons();
  state.coach = getThinkingCoachState();
  setWizardThinkingState();
  renderCoachPanel();

  try {
    const payload = await request("/api/game/move", {
      method: "POST",
      body: JSON.stringify({ from, to, promotion })
    });

    if (!isMoveCycleActive(cycleId)) {
      return;
    }

    setApiHealth(true);
    if (previewMove?.captured) {
      scheduleWizardReactionState("st-capture", {
        delayMs: 900,
        holdMs: 2000
      });
    }
    applyGameState(payload.game, {
      wizardSource: "human",
      coachState:
        payload.pending?.engine
          ? getThinkingCoachState()
          : null
    });

    if (payload.pending?.engine) {
      const localMovePly = getLastPlyIndexFromMoveList(payload.game?.moveList || []);
      void loadCoachFeedback({
        cycleId,
        moveToken: payload.moveToken,
        plyIndex: localMovePly
      });
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

    clearSelectedSquare();
    setApiHealth(false);
    setCoachMessage(error.message);
    setBusy(false);
  }
};

const requestHint = async () => {
  if (!state.game || isRealtimeMultiplayerGame()) {
    setCoachMessage(
      "Hints are unavailable in this mode.",
      "Hints can be requested only during solo games on your turn."
    );
    return;
  }

  setBusy(true, "Consulting Arcane Coach for the best line...");

  try {
    const payload = await request("/api/game/hint", {
      method: "POST"
    });

    setApiHealth(true);
    state.hint = {
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

    const hintMove = state.hint.bestMove;
    const hintLabel = hintMove?.san || `${hintMove?.from || ""}${hintMove?.to || ""}`;
    setCoachMessage(
      hintMove ? `Hint ready: ${hintLabel}` : "Hint ready.",
      state.hint.summary
    );
    renderHintPanel();
    applyHintHighlights();
  } catch (error) {
    clearHintState();
    renderHintPanel();
    applyHintHighlights();
    setApiHealth(false);
    setCoachMessage(error.message);
  } finally {
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
      isRealtimeMultiplayerGame() ? "Wait for your opponent to move." : "Wait for Stockfish to move.",
      isRealtimeMultiplayerGame()
        ? "The board will update automatically when your opponent plays."
        : "Use Hint when you want engine guidance for your next move."
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
      setWizardThinkingState();
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
    setWizardThinkingState();
    setCoachMessage(
      `Selected ${square}.`,
      "Choose one of the highlighted targets to complete the move."
    );
    renderBoardSurface();
    return;
  }

  if (ownPiece && state.game.legalMoves[square]?.length) {
    setSelectedSquare(square);
    setWizardThinkingState();
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
  setRecordView(state.activeRecordView);
  syncBoardViewUi();

  try {
    const sessionPayload = await loadSession();
    const storedGuest = readStoredGuest();
    const hasGuestProfile = Boolean(storedGuest?.guestId);
    const savedView = getSavedView();
    state.isGuest = !sessionPayload?.authenticated && hasGuestProfile;
    state.guest = sessionPayload?.authenticated ? null : storedGuest || null;
    setPersistence(sessionPayload.persistence);
    setSessionState(sessionPayload);
    const desiredView = sessionPayload?.authenticated
      ? savedView || "hall"
      : hasGuestProfile
        ? savedView || "hall"
        : "auth";

    state.view = desiredView;
    console.log("Session restore:", state.view, "authenticated:", sessionPayload?.authenticated);

    renderGuestProfile();
    renderSessionUi();

    if (sessionPayload?.authenticated || hasGuestProfile) {
      if (desiredView === "game") {
        const restored = await enterGameView({ coachContext: "load-active" });
      } else {
        renderView();
        await loadGame();
      }
    } else {
      renderView();
      state.isGuest = false;
      state.guest = null;
      setApiHealth(true);
      return;
    }

    await refreshCollections();
    setApiHealth(true);
  } catch (error) {
    state.view = "auth";
    console.log("Session restore:", state.view);
    renderView();
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
const switchTo3D = async () => {
  const boardContainer = await waitForBoardContainerReady();
  if (!boardContainer || state.view !== "game") {
    throw new Error("3D board container is not ready in game view.");
  }

  if (!board3dElement) {
    throw new Error("3D board container is unavailable.");
  }

  if (board3dElement.offsetWidth <= 0 || board3dElement.offsetHeight <= 0) {
    throw new Error("3D board container has no visible size.");
  }

  if (typeof window.ArcaneBoardV2 !== "function") {
    throw new Error("3D renderer is unavailable.");
  }

  if (arcaneBoard3D && !validate3DBoardInstance()) {
    arcaneBoard3D.destroy?.();
    arcaneBoard3D = null;
  }

  try {
    if (!arcaneBoard3D) {
      const staleCanvases = board3dElement.querySelectorAll("canvas");
      if (staleCanvases.length) {
        staleCanvases.forEach((canvas) => canvas.remove());
      }
      arcaneBoard3D = new window.ArcaneBoardV2(board3dElement);
      arcaneBoard3D.init();
    }
  } catch (error) {
    arcaneBoard3D?.destroy?.();
    arcaneBoard3D = null;
    console.warn("[board] 3D init failed health check");
    throw error;
  }

  if (!validate3DBoardInstance({ logFailure: true })) {
    arcaneBoard3D?.destroy?.();
    arcaneBoard3D = null;
    throw new Error("3D renderer failed health check.");
  }

  console.log("[board] 3D init passed health check");

  arcaneBoard3D?._onResize?.();
  arcaneBoard3D.setPerspective?.(getBoardPerspectiveColor());

  // Sync current board position
  if (state.game && state.game.board) {
    if (!is3DMoveAnimating) {
      arcaneBoard3D.setPosition(state.game.board);
      const legalForSelected = state.selectedSquare && state.game.legalMoves
        ? (state.game.legalMoves[state.selectedSquare] || []).map((move) => move.to)
        : [];
      arcaneBoard3D.highlightSquares(
        state.selectedSquare,
        legalForSelected,
        state.hint?.bestMove || null
      );
    }
  }
  if (state.game && state.game.lastMove) {
    if (!is3DMoveAnimating) {
      arcaneBoard3D.setLastMove(state.game.lastMove.from, state.game.lastMove.to);
    }
  }

  // Route square clicks through 3D board
  arcaneBoard3D.onSquareClick((square) => {
    handleSquareClick(square);
  });

  // Remove old nameplates if re-entering 3D
  document.getElementById('hud-player-name')?.remove();
  document.getElementById('hud-opponent-name')?.remove();

  const playerColor = getBoardPerspectiveColor();
  const playerName = getLocalPlayerDisplayName();

  const playerPlate = document.createElement('div');
  playerPlate.id = 'hud-player-name';
  playerPlate.style.cssText = `
    position:absolute; bottom:16px; left:20px;
    color:#c9a84c; font-size:0.8rem; letter-spacing:0.08em;
    text-transform:uppercase; pointer-events:none; z-index:1002;
    text-shadow: 0 0 8px rgba(201,168,76,0.6);
  `;
  playerPlate.textContent = `${playerName} · ${playerColor}`;
  board3dElement.appendChild(playerPlate);

  const opponentPlate = document.createElement('div');
  opponentPlate.id = 'hud-opponent-name';
  opponentPlate.style.cssText = `
    position:absolute; top:16px; left:20px;
    color:#8a7a5a; font-size:0.8rem; letter-spacing:0.08em;
    text-transform:uppercase; pointer-events:none; z-index:1002;
    text-shadow: 0 0 6px rgba(100,80,40,0.5);
  `;
  opponentPlate.textContent = `Stockfish · ${playerColor === 'white' ? 'black' : 'white'}`;
  board3dElement.appendChild(opponentPlate);

  if (!board3dElement.dataset.arcaneHoverBound) {
    board3dElement.addEventListener('mousemove', (e) => {
      if (!arcaneBoard3D || state.boardViewMode !== '3d') return;
      if (!state.game || state.game.isGameOver) return;

      const rect = board3dElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Use raycaster to find hovered square
      if (!arcaneBoard3D.raycaster || !arcaneBoard3D.camera) return;
      arcaneBoard3D.raycaster.setFromCamera(
        { x, y }, arcaneBoard3D.camera
      );
      const squares = Array.from(arcaneBoard3D.squareMeshes?.values() || []);
      const pieces  = [];
      arcaneBoard3D.pieces?.forEach(({ mesh }) => {
        mesh.traverse(c => { if (c.isMesh) pieces.push(c); });
      });

      const hits = arcaneBoard3D.raycaster.intersectObjects(
        [...pieces, ...squares], false
      );
      if (!hits.length) {
        arcaneBoard3D.clearThreatLines?.();
        return;
      }

      let hoveredSquare = null;
      let obj = hits[0].object;
      while (obj && !obj.userData?.square) obj = obj.parent;
      if (obj?.userData?.square) hoveredSquare = obj.userData.square;

      if (!hoveredSquare) {
        arcaneBoard3D.clearThreatLines?.();
        return;
      }

      const legalMoves = state.game.legalMoves?.[hoveredSquare] || [];
      if (!legalMoves.length) {
        arcaneBoard3D.clearThreatLines?.();
        return;
      }

      arcaneBoard3D.selectedSquare = hoveredSquare;
      arcaneBoard3D.showThreatLines?.(legalMoves.map((move) => move.to));
    });

    board3dElement.addEventListener('mouseleave', () => {
      arcaneBoard3D?.clearThreatLines?.();
    });

    board3dElement.dataset.arcaneHoverBound = "true";
  }
};

const switchTo2D = () => {
  resetBoardViewTo2D();
  if (state.view === "game") {
    renderBoard();
  }
};

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
