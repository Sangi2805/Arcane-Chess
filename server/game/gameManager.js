const { randomUUID } = require("crypto");

const {
  applyMove,
  createChessGame,
  getMaterialBalance,
  restoreChessGame,
  serializeGame
} = require("../services/chessService");
const { DIFFICULTY_PRESETS, engineService } = require("../services/engineService");
const {
  PersistenceUnavailableError,
  getSavedGameRecord,
  recordCompletedGame,
  saveGameSnapshot
} = require("../services/persistenceService");
const {
  evaluateEngineMove,
  evaluateMove
} = require("../services/evaluationService");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const DEFAULT_SETTINGS = {
  difficulty: "easy",
  playerColor: "white"
};

const activeGames = new Map();
const DEFAULT_GUEST_ID = "guest_local_fallback";
const IN_PROGRESS_STATUS = {
  code: "in-progress",
  message: "In progress"
};
const NOT_STARTED_STATUS = {
  code: "not-started",
  message: "Not started"
};

const normalizeSettings = (settings = {}) => ({
  difficulty: settings.difficulty || DEFAULT_SETTINGS.difficulty,
  playerColor: settings.playerColor === "black" ? "black" : "white"
});

const getGuestId = (guestId) => guestId || DEFAULT_GUEST_ID;

const getEngineColor = (game) =>
  game.settings.playerColor === "white" ? "black" : "white";

const getPersistencePayload = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

const formatColor = (color) =>
  color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : "Unknown";

const getResignationOutcome = (color) => ({
  result: color === "white" ? "black-win" : "white-win",
  status: {
    code: "resignation",
    message: `${formatColor(color)} resigned`,
    outcomeLabel: "Resignation"
  },
  resultLabel: "Resignation",
  drawReason: null
});

const getBoardOutcome = (snapshot) => {
  if (snapshot.status.code === "checkmate") {
    return {
      result: snapshot.turn === "white" ? "black-win" : "white-win",
      status: snapshot.status,
      resultLabel: snapshot.status.outcomeLabel || "Checkmate",
      drawReason: null
    };
  }

  if (snapshot.status.code === "check") {
    return {
      result: "in-progress",
      status: snapshot.status,
      resultLabel: null,
      drawReason: null
    };
  }

  if (snapshot.isGameOver) {
    return {
      result: "draw",
      status: snapshot.status,
      resultLabel: snapshot.status.outcomeLabel || "Draw",
      drawReason: snapshot.status.drawReason || null
    };
  }

  return {
    result: "in-progress",
    status: IN_PROGRESS_STATUS,
    resultLabel: null,
    drawReason: null
  };
};

const isGameFinished = (game) => Boolean(game.manualOutcome) || game.chess.isGameOver();

const getResolvedGameState = (game, snapshot) => {
  if (game.manualOutcome) {
    return {
      ...game.manualOutcome,
      isGameOver: true,
      legalMoves: {},
      turn: null
    };
  }

  if (!game.hasStarted) {
    return {
      result: "not-started",
      status: NOT_STARTED_STATUS,
      isGameOver: false,
      legalMoves: {},
      turn: null,
      resultLabel: null,
      drawReason: null
    };
  }

  const boardOutcome = getBoardOutcome(snapshot);
  return {
    ...boardOutcome,
    isGameOver: snapshot.isGameOver,
    legalMoves: snapshot.isGameOver ? {} : snapshot.legalMoves,
    turn: snapshot.isGameOver ? null : snapshot.turn
  };
};

const buildSerializableState = (game, extras = {}) => {
  const snapshot = serializeGame(game.chess);
  const resolvedState = getResolvedGameState(game, snapshot);

  return {
    id: game.id,
    guestId: game.guestId,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    hasStarted: game.hasStarted,
    result: resolvedState.result,
    settings: {
      ...game.settings,
      engineColor: getEngineColor(game)
    },
    persistence: getPersistencePayload(),
    ...snapshot,
    turn: resolvedState.turn,
    legalMoves: resolvedState.legalMoves,
    isGameOver: resolvedState.isGameOver,
    status: resolvedState.status,
    resultLabel: resolvedState.resultLabel || null,
    drawReason: resolvedState.drawReason || null,
    coachFeedback: null,
    ...extras
  };
};

const createGame = ({
  guestId,
  settings = {},
  snapshot = null,
  hasStarted = false
} = {}) => {
  const normalizedSettings = normalizeSettings(settings);
  const chess = snapshot
    ? restoreChessGame({ fen: snapshot.fen, pgn: snapshot.pgn })
    : createChessGame();
  const now = new Date().toISOString();

  const game = {
    id: snapshot?.gameId || randomUUID(),
    guestId: getGuestId(guestId),
    chess,
    settings: normalizedSettings,
    createdAt: snapshot?.createdAt || now,
    updatedAt: snapshot?.updatedAt || now,
    historyRecorded: snapshot?.historyRecorded || false,
    hasStarted,
    manualOutcome: null,
    pendingCoachReview: null,
    pendingEngineTurn: null,
    resolvedEngineTurn: null
  };

  activeGames.set(game.guestId, game);

  return game;
};

const ensureGame = (guestId) =>
  activeGames.get(getGuestId(guestId)) ||
  createGame({ guestId: getGuestId(guestId) });

const getTurn = (game) => serializeGame(game.chess).turn;

const touchGame = (game) => {
  game.updatedAt = new Date().toISOString();
};

const clearPendingAsyncState = (game) => {
  game.pendingCoachReview = null;
  game.pendingEngineTurn = null;
  game.resolvedEngineTurn = null;
};

const createIdleGame = ({ guestId, settings = {} } = {}) =>
  createGame({
    guestId,
    settings,
    hasStarted: false
  });

const clearActiveGame = async (guestId, { settings = null } = {}) => {
  const normalizedGuestId = getGuestId(guestId);
  const currentGame = activeGames.get(normalizedGuestId);

  if (currentGame && isGameFinished(currentGame)) {
    await persistCompletedGameIfNeeded(currentGame);
  }

  const nextSettings = normalizeSettings(settings || currentGame?.settings || DEFAULT_SETTINGS);
  const game = createIdleGame({
    guestId: normalizedGuestId,
    settings: nextSettings
  });

  return buildSerializableState(game);
};

const getSerializableState = (guestId) => {
  const game = ensureGame(guestId);

  return buildSerializableState(game);
};

const getLiveSerializableState = async (guestId) => {
  const game = ensureGame(guestId);

  if (game.hasStarted && isGameFinished(game)) {
    return clearActiveGame(game.guestId, {
      settings: game.settings
    });
  }

  return buildSerializableState(game);
};

const persistCompletedGameIfNeeded = async (game) => {
  if (!game.hasStarted || !isGameFinished(game) || game.historyRecorded) {
    return;
  }

  try {
    await recordCompletedGame({
      guestId: game.guestId,
      gameId: game.id,
      settings: {
        ...game.settings,
        engineColor: getEngineColor(game)
      },
      snapshot: buildSerializableState(game)
    });
    game.historyRecorded = true;
  } catch (error) {
    if (error instanceof PersistenceUnavailableError) {
      return;
    }

    throw error;
  }
};

const createNewGame = async ({ guestId, settings = {} } = {}) => {
  const game = createGame({
    guestId,
    settings,
    hasStarted: true
  });

  if (game.settings.playerColor === "black") {
    await performEngineMove(game.guestId, {
      includeCoachFeedback: false
    });
  }

  return getSerializableState(game.guestId);
};

const resetGame = async (guestId) => clearActiveGame(guestId);

const makePlayerMove = async ({ guestId, from, to, promotion }) => {
  const game = ensureGame(guestId);

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  if (getTurn(game) !== game.settings.playerColor) {
    throw new Error("It is not the player's turn.");
  }

  const beforeFen = game.chess.fen();
  const move = applyMove(game.chess, { from, to, promotion });

  if (!move) {
    throw new Error("Illegal move.");
  }

  touchGame(game);
  clearPendingAsyncState(game);

  const moveToken = randomUUID();
  const gameContinues = !game.chess.isGameOver();
  const shouldQueueEngine =
    gameContinues && getTurn(game) === getEngineColor(game);

  if (gameContinues) {
    game.pendingCoachReview = {
      moveToken,
      beforeFen,
      afterFen: game.chess.fen(),
      playerColor: game.settings.playerColor,
      playedMove: {
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
        san: move.san
      },
      promise: null
    };
    game.pendingCoachReview.promise = evaluateMove(game.pendingCoachReview).catch(
      (error) => {
        console.warn("Arcane Coach evaluation skipped:", error.message);
        return null;
      }
    );
  }

  if (shouldQueueEngine) {
    const pendingEngineTurn = {
      moveToken,
      promise: null
    };

    game.pendingEngineTurn = pendingEngineTurn;
    pendingEngineTurn.promise = performEngineMove(game.guestId)
      .then((gameState) => {
        if (game.pendingEngineTurn === pendingEngineTurn) {
          game.resolvedEngineTurn = {
            moveToken,
            game: gameState,
            error: null
          };
          game.pendingEngineTurn = null;
        }

        return gameState;
      })
      .catch((error) => {
        if (game.pendingEngineTurn === pendingEngineTurn) {
          game.resolvedEngineTurn = {
            moveToken,
            game: null,
            error
          };
          game.pendingEngineTurn = null;
        }

        throw error;
      });
  } else {
    await persistCompletedGameIfNeeded(game);
  }

  return {
    game: buildSerializableState(game),
    moveToken,
    pending: {
      coach: Boolean(game.pendingCoachReview),
      engine: shouldQueueEngine
    }
  };
};

const performEngineMove = async (
  guestId,
  { includeCoachFeedback = true } = {}
) => {
  const game = ensureGame(guestId);
  const activePendingEngineTurn = game.pendingEngineTurn;

  if (!game.hasStarted) {
    return getSerializableState(game.guestId);
  }

  if (isGameFinished(game)) {
    await persistCompletedGameIfNeeded(game);
    return getSerializableState(game.guestId);
  }

  if (getTurn(game) !== getEngineColor(game)) {
    return getSerializableState(game.guestId);
  }

  const beforeFen = game.chess.fen();
  const preset = engineService.getDifficultyPreset(game.settings.difficulty);
  const engineAnalysis = await engineService.getPositionAnalysis({
    fen: beforeFen,
    depth: preset.depth,
    moveTime: preset.moveTime,
    skillLevel: preset.skillLevel
  });
  const bestMove = engineAnalysis.bestMove
    ? {
        ...engineAnalysis.bestMove,
        difficulty: preset
      }
    : null;

  if (!bestMove) {
    if (!activePendingEngineTurn) {
      game.pendingEngineTurn = null;
    }

    return getSerializableState(game.guestId);
  }

  const move = applyMove(game.chess, bestMove);

  if (!move) {
    throw new Error("Engine returned an invalid move.");
  }

  touchGame(game);

  if (!activePendingEngineTurn) {
    game.pendingEngineTurn = null;
  }

  await persistCompletedGameIfNeeded(game);

  let coachFeedback = null;

  if (includeCoachFeedback && !game.chess.isGameOver()) {
    coachFeedback = await evaluateEngineMove({
      beforeFen,
      afterFen: game.chess.fen(),
      playerColor: game.settings.playerColor,
      beforeAnalysis: engineAnalysis
    }).catch((error) => {
      console.warn("Arcane Coach engine commentary skipped:", error.message);
      return null;
    });

    if (coachFeedback) {
      coachFeedback.playedMove = {
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
        san: move.san
      };
    }
  }

  return buildSerializableState(game, {
    coachFeedback
  });
};

const resolveCoachFeedback = async ({ guestId, moveToken }) => {
  const game = ensureGame(guestId);
  const review = game.pendingCoachReview;

  if (!review || review.moveToken !== moveToken) {
    return {
      stale: true,
      moveToken,
      coachFeedback: null
    };
  }

  const coachFeedback = await review.promise;

  return {
    stale: game.pendingCoachReview !== review,
    moveToken,
    coachFeedback: game.pendingCoachReview === review ? coachFeedback : null
  };
};

const resolvePendingEngineMove = async ({ guestId, moveToken }) => {
  const game = ensureGame(guestId);

  if (game.pendingEngineTurn?.moveToken === moveToken) {
    const gameState = await game.pendingEngineTurn.promise;

    return {
      stale: false,
      moveToken,
      game: gameState
    };
  }

  if (game.resolvedEngineTurn?.moveToken === moveToken) {
    const resolvedTurn = game.resolvedEngineTurn;
    game.resolvedEngineTurn = null;

    if (resolvedTurn.error) {
      throw resolvedTurn.error;
    }

    return {
      stale: false,
      moveToken,
      game: resolvedTurn.game
    };
  }

  if (!game.pendingEngineTurn || game.pendingEngineTurn.moveToken !== moveToken) {
    return {
      stale: true,
      moveToken,
      game: getSerializableState(game.guestId)
    };
  }
};

const resignGame = async (guestId) => {
  const game = ensureGame(guestId);

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  clearPendingAsyncState(game);
  game.manualOutcome = getResignationOutcome(game.settings.playerColor);
  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return getSerializableState(game.guestId);
};

// Phase 3 draw handling stays intentionally simple: the engine only accepts
// offers once the game is calm and materially close, with stricter thresholds
// on higher difficulties.
const shouldAcceptDrawOffer = (game) => {
  const preset =
    DIFFICULTY_PRESETS[game.settings.difficulty] || DIFFICULTY_PRESETS.easy;
  const halfMoveCount = game.chess.history().length;
  const materialGap = Math.abs(getMaterialBalance(game.chess));

  if (game.chess.isCheck()) {
    return false;
  }

  return (
    halfMoveCount >= preset.drawOffer.minHalfMoves &&
    materialGap <= preset.drawOffer.maxMaterialGap
  );
};

const offerDraw = async (guestId) => {
  const game = ensureGame(guestId);

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  if (!shouldAcceptDrawOffer(game)) {
    return {
      accepted: false,
      message: "Draw offer declined. Play continues.",
      game: getSerializableState(game.guestId)
    };
  }

  clearPendingAsyncState(game);
  game.manualOutcome = {
    result: "draw",
    resultLabel: "Draw agreed",
    drawReason: "agreed",
    status: {
      code: "draw-agreed",
      message: "Draw agreed.",
      outcomeLabel: "Draw agreed",
      drawReason: "agreed"
    }
  };
  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return {
    accepted: true,
    message: "Draw offer accepted.",
    game: getSerializableState(game.guestId)
  };
};

const saveCurrentGame = async (guestId) => {
  const game = ensureGame(guestId);

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game before saving.");
  }

  if (isGameFinished(game)) {
    throw new Error(
      "Completed games are saved to history automatically. Start a new game to continue."
    );
  }

  const snapshot = buildSerializableState(game);
  const savedGame = await saveGameSnapshot({
    guestId: game.guestId,
    gameId: game.id,
    settings: {
      ...game.settings,
      engineColor: getEngineColor(game)
    },
    snapshot
  });

  return savedGame;
};

const resumeSavedGame = async ({ guestId, gameId }) => {
  const savedGame = await getSavedGameRecord(getGuestId(guestId), gameId);

  if (!savedGame) {
    throw new Error("Saved game not found for this guest.");
  }

  if (!savedGame.isResumable) {
    throw new Error("This saved game is no longer resumable.");
  }

  const game = createGame({
    guestId: getGuestId(guestId),
    settings: {
      difficulty: savedGame.difficulty,
      playerColor: savedGame.playerColor
    },
    snapshot: {
      gameId: savedGame.gameId,
      fen: savedGame.fen,
      pgn: savedGame.pgn,
      createdAt: savedGame.createdAt.toISOString(),
      updatedAt: savedGame.updatedAt.toISOString()
    },
    hasStarted: true
  });

  touchGame(game);

  return getSerializableState(game.guestId);
};

module.exports = {
  createNewGame,
  getSerializableState,
  getLiveSerializableState,
  makePlayerMove,
  offerDraw,
  performEngineMove,
  resolveCoachFeedback,
  resolvePendingEngineMove,
  resetGame,
  resignGame,
  saveCurrentGame,
  resumeSavedGame
};
