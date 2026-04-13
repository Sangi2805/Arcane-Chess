import { PIECES } from "./constants.js";

let arcaneBoard3D = null;
let lastAnimated3DMoveKey = "";
let is3DMoveAnimating = false;
let last3DAnimationStartedAt = 0;

export const PROMOTION_OPTION_LABELS = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight"
};

let boardViewDeps = {
  state: null,
  runtimeState: null,
  dom: {
    board3dElement: null,
    boardElement: null,
    boardModeLabel: null,
    boardShell: null,
    immersiveHud: null,
    promotionPanel: null,
    shellElement: null,
    timeControlSelect: null,
    toggle2dBtn: null,
    toggle3dBtn: null
  },
  callbacks: {
    applyHintHighlights: () => {},
    clearPromotionPrompt: () => {},
    renderBoard: () => {},
    renderImmersiveHud: () => {},
    switchTo2D: () => {},
    switchTo3D: async () => {},
    syncCoachAvatarMode: () => {},
    syncImmersiveControlsMount: () => {}
  }
};

export const configureBoardViewDependencies = (deps = {}) => {
  boardViewDeps = {
    ...boardViewDeps,
    ...deps,
    dom: {
      ...boardViewDeps.dom,
      ...(deps.dom || {})
    },
    callbacks: {
      ...boardViewDeps.callbacks,
      ...(deps.callbacks || {})
    }
  };
};

export const getArcaneBoard3D = () => arcaneBoard3D;

export const setArcaneBoard3D = (nextBoard) => {
  arcaneBoard3D = nextBoard || null;
};

export const getIs3DMoveAnimating = () => is3DMoveAnimating;

export const normalizeBoardViewMode = (mode) => (mode === "3d" ? "3d" : "2d");

export const updateBoardModeToggleUi = () => {
  const { state, dom } = boardViewDeps;
  const is3D = state.boardViewMode === "3d";

  dom.toggle2dBtn?.classList.toggle("mode-btn-active", !is3D);
  dom.toggle3dBtn?.classList.toggle("mode-btn-active", is3D);

  if (dom.boardModeLabel) {
    dom.boardModeLabel.textContent = is3D ? "3D duel interface" : "Duel Interface";
  }
};

export const setBoardViewModePreference = (mode, { source = "system" } = {}) => {
  const { state } = boardViewDeps;

  state.boardViewMode = normalizeBoardViewMode(mode);
  state.viewMode = state.boardViewMode === "3d" ? "3D" : "2D";
  updateBoardModeToggleUi();
  syncBoardViewUi();
  console.log("[board] selected mode changed:", state.boardViewMode, "source:", source);
};

export const validate3DBoardInstance = ({ logFailure = false } = {}) => {
  const { dom } = boardViewDeps;
  const canvas = arcaneBoard3D?.renderer?.domElement || null;
  const healthy =
    Boolean(arcaneBoard3D) &&
    Boolean(arcaneBoard3D?.renderer) &&
    Boolean(arcaneBoard3D?.camera) &&
    Boolean(arcaneBoard3D?.scene) &&
    Boolean(canvas) &&
    Boolean(dom.board3dElement?.contains(canvas)) &&
    Number(canvas?.width || 0) > 0 &&
    Number(canvas?.height || 0) > 0 &&
    Number(dom.board3dElement?.offsetWidth || 0) > 0 &&
    Number(dom.board3dElement?.offsetHeight || 0) > 0;

  if (!healthy && logFailure) {
    console.warn("[board] 3D init failed health check");
  }

  return healthy;
};

export const syncBoardViewUi = () => {
  const { state, dom, callbacks } = boardViewDeps;
  const is3D = state.boardViewMode === "3d";
  const show3DInGameView =
    is3D &&
    state.view === "game" &&
    validate3DBoardInstance();

  state.viewMode = is3D ? "3D" : "2D";

  document.body.dataset.boardViewMode = state.boardViewMode;
  document.body.classList.toggle("board-mode-3d", show3DInGameView);

  if (dom.shellElement) {
    dom.shellElement.dataset.boardViewMode = state.boardViewMode;
  }

  if (dom.boardShell) {
    dom.boardShell.dataset.viewMode = state.boardViewMode;
  }

  if (dom.boardElement) {
    dom.boardElement.classList.toggle("hidden", show3DInGameView);
    dom.boardElement.setAttribute("aria-hidden", show3DInGameView ? "true" : "false");
  }

  if (dom.board3dElement) {
    dom.board3dElement.classList.toggle("hidden", !show3DInGameView);
    dom.board3dElement.setAttribute("aria-hidden", show3DInGameView ? "false" : "true");
  }

  if (dom.immersiveHud) {
    dom.immersiveHud.setAttribute("aria-hidden", show3DInGameView ? "false" : "true");
  }

  arcaneBoard3D?.setArenaGuardiansVisible?.(show3DInGameView);
  callbacks.syncCoachAvatarMode();
  callbacks.syncImmersiveControlsMount();
  callbacks.renderImmersiveHud();
};

export const syncBoard3D = ({ refreshPerspective = false } = {}) => {
  const { state } = boardViewDeps;
  const now = performance.now();

  if (is3DMoveAnimating) {
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

export const resetBoardViewTo2D = () => {
  const { dom, callbacks } = boardViewDeps;

  setBoardViewModePreference("2d", {
    source: "fallback"
  });

  document.body.classList.remove("board-mode-3d");
  document.body.dataset.boardViewMode = "2d";

  if (dom.shellElement) {
    dom.shellElement.dataset.boardViewMode = "2d";
  }

  if (dom.boardShell) {
    dom.boardShell.dataset.viewMode = "2d";
  }

  if (dom.boardElement) {
    dom.boardElement.classList.remove("hidden");
    dom.boardElement.setAttribute("aria-hidden", "false");
  }

  if (dom.board3dElement) {
    dom.board3dElement.classList.add("hidden");
    dom.board3dElement.setAttribute("aria-hidden", "true");
  }

  if (dom.immersiveHud) {
    dom.immersiveHud.setAttribute("aria-hidden", "true");
  }

  arcaneBoard3D?.setArenaGuardiansVisible?.(false);
  callbacks.syncCoachAvatarMode();
  callbacks.syncImmersiveControlsMount();
  callbacks.renderImmersiveHud();

  if (arcaneBoard3D) {
    arcaneBoard3D.destroy();
    arcaneBoard3D = null;
  }
  document.getElementById("hud-player-name")?.remove();
  document.getElementById("hud-opponent-name")?.remove();
  is3DMoveAnimating = false;
};

export const launchSelectedBoard = async ({ trigger = "game-start" } = {}) => {
  const { state, callbacks } = boardViewDeps;
  const requestedMode = normalizeBoardViewMode(state.boardViewMode);

  console.log("[board] game start requested:", trigger, "mode:", requestedMode);

  if (requestedMode === "2d") {
    console.log("[board] launching 2D");
    setBoardViewModePreference("2d", {
      source: `launch:${trigger}`
    });
    callbacks.switchTo2D();
    return "2d";
  }

  console.log("[board] requested 3D launch");

  try {
    await callbacks.switchTo3D();
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
    callbacks.switchTo2D();
    return "2d";
  }
};

export const handleBoardModeToggle = (mode) => {
  const { state, dom } = boardViewDeps;

  if (mode === "3d" && state.view !== "game") {
    state.boardViewMode = "3d";
    state.viewMode = "3D";
    dom.toggle2dBtn?.classList.remove("mode-btn-active");
    dom.toggle3dBtn?.classList.add("mode-btn-active");
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

export const getSquareColorClass = (square) => {
  const file = square.charCodeAt(0) - 96;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0 ? "square-dark" : "square-light";
};

export const getOrderedSquares = () => {
  const { state } = boardViewDeps;
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

export const getBoardRenderFailureReason = (boardState = []) => {
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

export const waitForBoardContainerReady = ({ maxFrames = 30 } = {}) =>
  new Promise((resolve) => {
    const { state, dom } = boardViewDeps;
    let frameCount = 0;

    const pollContainer = () => {
      const boardContainerElement =
        document.querySelector("#game-view .board-container") ||
        document.querySelector("#game-view .board-shell") ||
        dom.boardElement?.parentElement ||
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

export const getChosenColor = () =>
  document.querySelector('input[name="player-color"]:checked')?.value || "white";

export const getBoardPerspectiveColor = () =>
  boardViewDeps.state.game?.settings?.playerColor || getChosenColor();

export const getSelectedTimeControlId = () => boardViewDeps.dom.timeControlSelect?.value || "untimed";

export const isTimedGameState = (gameState = boardViewDeps.state.game) =>
  Boolean(gameState?.clockState?.enabled && gameState.clockState.timeControlId !== "untimed");

export const getClockDisplayState = (clockState = boardViewDeps.state.game?.clockState) => {
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

export const getBoardClockColors = (gameState = boardViewDeps.state.game) => {
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

export const syncPromotionActionLabels = () => {
  const { state, dom } = boardViewDeps;
  const promotionColor =
    state.game?.settings?.playerColor === "black" ? "black" : "white";

  dom.promotionPanel.querySelectorAll("[data-promotion]").forEach((button) => {
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

export const renderPromotionPrompt = () => {
  const { state, dom, callbacks } = boardViewDeps;

  if (!state.pendingPromotion?.moveChoices?.length || !dom.boardShell || !dom.promotionPanel) {
    callbacks.clearPromotionPrompt();
    return;
  }

  syncPromotionActionLabels();

  const boardRect = dom.boardShell.getBoundingClientRect();
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
    const squareButton = dom.boardElement?.querySelector(`[data-square="${anchorSquare}"]`);

    if (squareButton) {
      anchorRect = squareButton.getBoundingClientRect();
    }
  }

  if (!anchorRect) {
    dom.promotionPanel.classList.remove("hidden");
    dom.promotionPanel.style.visibility = "hidden";
    return;
  }

  dom.promotionPanel.classList.remove("hidden");
  dom.promotionPanel.style.visibility = "hidden";

  const panelWidth = dom.promotionPanel.offsetWidth || 220;
  const panelHeight = dom.promotionPanel.offsetHeight || 180;
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

  dom.promotionPanel.style.left = `${Math.round(left)}px`;
  dom.promotionPanel.style.top = `${Math.round(top)}px`;
  dom.promotionPanel.style.visibility = "visible";
};
