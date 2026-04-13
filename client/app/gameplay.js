import { request } from "./api.js";
import * as dom from "./dom.js";
import { state, runtimeState } from "./state.js";
import { renderBoard, renderBoardSurface } from "./render-board.js";
import {
  getThinkingCoachState,
  renderCoachPanel,
  scheduleWizardReactionState,
  setCoachMessage,
  setWizardThinkingState
} from "./render-coach.js";
import { emitMultiplayerEvent } from "./realtime.js";

let gameplayDeps = {
  beginMoveCycle: () => 0,
  isMoveCycleActive: () => true,
  isRealtimeMultiplayerGame: () => false,
  getDrawClaimState: () => null,
  debugGameplaySync: () => {},
  setBusy: () => {},
  setApiHealth: () => {},
  syncActionButtons: () => {},
  syncBoard3D: () => {},
  applyMultiplayerSocketState: () => {},
  loadCoachFeedback: async () => {},
  loadEngineReply: async () => {},
  getLastPlyIndexFromMoveList: () => null,
  applyGameState: () => {},
  refreshCollections: async () => {}
};

export const configureGameplayDependencies = (deps = {}) => {
  gameplayDeps = {
    ...gameplayDeps,
    ...deps
  };
};

export const clearPromotionPrompt = () => {
  state.pendingPromotion = null;
  dom.promotionPanel.classList.add("hidden");
  dom.promotionPanel.style.left = "";
  dom.promotionPanel.style.top = "";
  dom.promotionPanel.style.visibility = "";
};

export const clearHintState = () => {
  state.hint = {
    bestMove: null,
    continuation: [],
    fen: "",
    summary: "",
    whyExpanded: false,
    freshHint: false,
    requestedThisTurn: false
  };

  dom.hintWhyButton?.classList.add("hidden");
};

export const applyHintHighlights = () => {
  if (!state.game) {
    return;
  }

  if (state.viewMode === "3D") {
    gameplayDeps.syncBoard3D();
  }

  if (state.viewMode === "2D") {
    renderBoard();
  }
};

export const getLegalTargets = () => {
  if (!state.selectedSquare || !state.game) {
    return [];
  }

  const legalTargets = state.game.legalMoves[state.selectedSquare] || [];
  gameplayDeps.debugGameplaySync("selection:legal-targets", {
    selectedSquare: state.selectedSquare,
    legalTargets
  });
  return legalTargets;
};

export const setSelectedSquare = (square) => {
  state.selectedSquare = square;
  clearPromotionPrompt();
  gameplayDeps.debugGameplaySync("selection:set", {
    selectedSquare: square,
    legalMoves: state.game?.legalMoves?.[square] || []
  });
};

export const clearSelectedSquare = () => {
  if (state.selectedSquare) {
    gameplayDeps.debugGameplaySync("selection:clear", {
      selectedSquare: state.selectedSquare
    });
  }

  state.selectedSquare = null;
  clearPromotionPrompt();
};

export const openPromotionPrompt = (moveChoices, anchorSquare) => {
  state.pendingPromotion = {
    moveChoices,
    anchorSquare
  };
  setCoachMessage(
    "Choose a promotion piece.",
    "Select how the pawn should transform before the move is sent."
  );
};

export const submitMove = async ({ from, to, promotion, previewMove }) => {
  if (gameplayDeps.isRealtimeMultiplayerGame()) {
    gameplayDeps.setBusy(true, "Sending move...");

    try {
      const socketState = await emitMultiplayerEvent("multiplayer:move", {
        from,
        to,
        promotion
      });

      gameplayDeps.setApiHealth(true);
      gameplayDeps.applyMultiplayerSocketState(socketState);
    } catch (error) {
      gameplayDeps.setApiHealth(false);
      setCoachMessage(error.message);
    } finally {
      gameplayDeps.setBusy(false);
    }

    return;
  }

  const cycleId = gameplayDeps.beginMoveCycle();
  gameplayDeps.setBusy(true);
  clearHintState();
  gameplayDeps.syncActionButtons();
  clearSelectedSquare();
  gameplayDeps.debugGameplaySync("move:submit", {
    from,
    to,
    promotion: promotion || null,
    previewMove
  });
  state.coach = getThinkingCoachState();
  setWizardThinkingState();
  renderCoachPanel();

  try {
    const payload = await request("/api/game/move", {
      method: "POST",
      body: JSON.stringify({ from, to, promotion })
    });

    if (!gameplayDeps.isMoveCycleActive(cycleId)) {
      return;
    }

    gameplayDeps.setApiHealth(true);
    if (previewMove?.captured) {
      scheduleWizardReactionState("st-capture", {
        delayMs: 900,
        holdMs: 2000
      });
    }
    gameplayDeps.applyGameState(payload.game, {
      wizardSource: "human",
      coachState:
        payload.pending?.engine
          ? getThinkingCoachState()
          : null
    });

    if (payload.pending?.engine) {
      const localMovePly = gameplayDeps.getLastPlyIndexFromMoveList(payload.game?.moveList || []);
      void gameplayDeps.loadCoachFeedback({
        cycleId,
        moveToken: payload.moveToken,
        plyIndex: localMovePly
      });
      void gameplayDeps.loadEngineReply({
        cycleId,
        moveToken: payload.moveToken
      });
      return;
    }

    gameplayDeps.setBusy(false);

    if (payload.game.isGameOver) {
      void gameplayDeps.refreshCollections();
    }
  } catch (error) {
    if (!gameplayDeps.isMoveCycleActive(cycleId)) {
      return;
    }

    clearSelectedSquare();
    gameplayDeps.setApiHealth(false);
    setCoachMessage(error.message);
    gameplayDeps.setBusy(false);
  }
};

export const handleSquareClick = (square) => {
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

  const drawClaim = gameplayDeps.getDrawClaimState(state.game);

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
      gameplayDeps.isRealtimeMultiplayerGame() ? "Wait for your opponent to move." : "Wait for Stockfish to move.",
      gameplayDeps.isRealtimeMultiplayerGame()
        ? "The board will update automatically when your opponent plays."
        : "Use Hint when you want engine guidance for your next move."
    );
    return;
  }

  const squareData = state.game.board.find((entry) => entry.square === square);
  const ownPiece =
    squareData?.piece && squareData.piece.color === state.game.settings.playerColor;
  gameplayDeps.debugGameplaySync("input:click", {
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
  gameplayDeps.debugGameplaySync("move:attempt", {
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