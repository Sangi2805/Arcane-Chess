import {
  HALL_RANDOM_TIME_CONTROL_IDS,
  PIECES,
  TIME_CONTROL_PRESETS

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
  renderBoard,
  renderBoardOverlays,
  renderBoardSurface,
  renderClocks,
  renderGameOverBanner,
  renderHintPanel,
  renderMoveList,
  animateMiniBoard,
  hideMiniBoard,
  showMiniBoard,
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
  updateAmbientToggleLabel,
  syncAmbientTogglePlacement,
  syncAmbientMusic,
  unlockAmbientMusic,
  setAmbientMuted,
  ambientState
} from "./app/audio-controller.js";
import {
  closeHistoryDetail,
  configureReplayHistoryDependencies,
  openHistoryDetail,
  renderHistory,
  renderSavedGames,
  stepReplay,
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
  setSessionState
} from "./app/auth-session-controller.js";
import {
  configureHallActionsDependencies,
  leaveCompletedMultiplayerGameIfNeeded,
  normalizeLobbyMode,
  setLobbyMode
} from "./app/hall-actions-controller.js";
import {
  configureUIFeedbackDependencies,
  dismissGameEndOverlay,
  getCheckedKingSquare,
  getDrawClaimState,
  getGameOverBannerKey,
  getGameOverCopy,
  hideBoardFeedback,
  hideGameOverBanner,
  isTerminalGameState,
  render,
  renderBoardFeedback,
  renderClockCard,
  renderImmersiveHud,
  resetFinishedGameResetLifecycle,
  resetGameOverBannerLifecycle,
  scheduleFinishedGameReset,
  scheduleGameOverBannerDismissal,
  setApiHealth,
  setBusy,
  setRecordView,
  showGameEndOverlay,
  syncActionButtons,
  syncControls,
  syncTimedGameState,
  triggerGameEndCinematic,
  updateEvalBar,
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
  joinMultiplayerRoom,
  rejoinMultiplayerMatch
} from "./app/multiplayer-controller.js";
import {
  applyGameState,
  beginMoveCycle,
  CHRONICLE_BADGE_SYMBOLS,
  claimAvailableDraw,
  configureGameLifecycleDependencies,
  continueAfterDrawClaim,
  enterGameView,
  getLastPlyIndexFromMoveList,
  getPlyIndexForTurnColor,
  initialize,
  isLocalPlayerPly,
  isMoveCycleActive,
  loadCoachFeedback,
  loadEngineReply,
  loadGame,
  offerDraw,
  PIECE_LABELS,
  refreshCollections,
  requestHint,
  resignCurrentGame,
  resumeSavedGame,
  saveCurrentGame,
  startNewGame,
} from "./app/game-lifecycle-controller.js";
import {
  configureBoardViewDependencies,
  getArcaneBoard3D,
  getBoardClockColors,
  getBoardPerspectiveColor,
  getBoardRenderFailureReason,
  getChosenColor,
  getClockDisplayState,
  getIs3DMoveAnimating,
  getOrderedSquares,
  getSelectedTimeControlId,
  getSquareColorClass,
  handleBoardModeToggle,
  launchSelectedBoard,
  renderPromotionPrompt,
  resetBoardViewTo2D,
  setArcaneBoard3D,
  syncBoard3D,
  syncBoardViewUi,
  validate3DBoardInstance,
  waitForBoardContainerReady
} from "./app/board-view-controller.js";
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

const isActiveGameState = (gameState) =>
  Boolean(gameState?.id && gameState?.hasStarted && !gameState?.isGameOver);

const setPersistence = (persistence = {}) => {
  state.persistence = {
    available: Boolean(persistence.available),
    status: persistence.status || "disconnected"
  };

  renderGuestProfile();
  renderSessionUi();
  syncActionButtons();
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
    getArcaneBoard3D()?._onResize?.();
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
  hideMiniBoard();
  getArcaneBoard3D()?.scheduleResize?.({
    immediate: true
  });
  const board3DInstance = getArcaneBoard3D();
  if (board3DInstance && state.boardViewMode === "3d") {
    board3DInstance.camera.aspect = window.innerWidth / window.innerHeight;
    board3DInstance.camera.updateProjectionMatrix();
    board3DInstance.renderer.setSize(window.innerWidth, window.innerHeight);
  } else {
    board3DInstance?._onResize?.();
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
  timeControlSelect.dataset.userChanged = "true";
  renderClocks();
  renderMultiplayerLobby();
  renderLobbyTimeControlButtons();
});
colorInputs.forEach((input) => {
  input.addEventListener("change", () => {
    renderClocks();
    const board3DInstance = getArcaneBoard3D();
    if (!state.game?.hasStarted && board3DInstance?.setPerspective) {
      board3DInstance.setPerspective(getBoardPerspectiveColor());
    }
  });
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void syncTimedGameState();
  }
});

if (toggle2dBtn) toggle2dBtn.addEventListener("click", () => handleBoardModeToggle("2d"));
if (toggle3dBtn) toggle3dBtn.addEventListener("click", () => handleBoardModeToggle("3d"));
if (immersiveExitButton) immersiveExitButton.addEventListener("click", switchTo2D);

configureBoardViewDependencies({
  state,
  runtimeState,
  dom: {
    board3dElement,
    boardElement,
    boardModeLabel,
    boardShell,
    immersiveHud,
    promotionPanel,
    shellElement,
    timeControlSelect,
    toggle2dBtn,
    toggle3dBtn
  },
  callbacks: {
    applyHintHighlights,
    clearPromotionPrompt,
    renderBoard,
    renderImmersiveHud,
    switchTo2D,
    switchTo3D,
    syncCoachAvatarMode,
    syncImmersiveControlsMount
  }
});

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
  getArcaneBoard3D,
  setArcaneBoard3D,
  getBoardClockColors,
  getBoardPerspectiveColor,
  getBoardRenderFailureReason,
  getCheckedKingSquare,
  getClockDisplayState,
  getGameOverBannerKey,
  getGameOverCopy,
  getIs3DMoveAnimating,
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
  getArcaneBoard3D,
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
    getArcaneBoard3D,
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
    getArcaneBoard3D,
    getChosenColor,
    getIs3DMoveAnimating,
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

let hoverActive = false;

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
  if (!state.hint?.fen || !state.hint?.continuation?.length) {
    return;
  }

  hoverActive = true;
  const continuation = state.hint.continuation.slice(0, 6);

  showMiniBoard({
    anchorElement: hintWhyButton,
    label: "Hint Why Line"
  });
  animateMiniBoard(state.hint.fen, continuation, "Hint Why Line");

  const miniBoardTooltip = document.querySelector(".mini-board-tooltip");
  if (miniBoardTooltip && miniBoardTooltip.dataset.hoverBound !== "true") {
    miniBoardTooltip.dataset.hoverBound = "true";
    miniBoardTooltip.addEventListener("mouseenter", () => {
      hoverActive = true;
    });
    miniBoardTooltip.addEventListener("mouseleave", () => {
      hoverActive = false;
      setTimeout(() => {
        if (!hoverActive) {
          hideMiniBoard();
        }
      }, 250);
    });
  }
});

hintWhyButton?.addEventListener("mouseleave", () => {
  hoverActive = false;
  setTimeout(() => {
    if (!hoverActive) {
      hideMiniBoard();
    }
  }, 250);
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

initialize();

ensureMultiplayerSocket();
