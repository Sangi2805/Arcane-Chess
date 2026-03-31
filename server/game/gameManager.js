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
    message: `${formatColor(color)} resigned`
  }
});

const getBoardOutcome = (snapshot) => {
  if (snapshot.status.code === "checkmate") {
    return {
      result: snapshot.turn === "white" ? "black-win" : "white-win",
      status: {
        code: "checkmate",
        message: "Checkmate"
      }
    };
  }

  if (snapshot.status.code === "check") {
    return {
      result: "in-progress",
      status: {
        code: "check",
        message: "Check"
      }
    };
  }

  if (snapshot.isGameOver) {
    return {
      result: "draw",
      status: {
        code: "draw",
        message: "Draw"
      }
    };
  }

  return {
    result: "in-progress",
    status: IN_PROGRESS_STATUS
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
      turn: null
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

const buildSerializableState = (game) => {
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
    status: resolvedState.status
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
    manualOutcome: null
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

const getSerializableState = (guestId) => {
  const game = ensureGame(guestId);

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
    await performEngineMove(game.guestId);
  }

  return getSerializableState(game.guestId);
};

const resetGame = async (guestId) =>
  createNewGame({
    guestId,
    settings: DEFAULT_SETTINGS
  });

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

  const move = applyMove(game.chess, { from, to, promotion });

  if (!move) {
    throw new Error("Illegal move.");
  }

  touchGame(game);

  if (!game.chess.isGameOver() && getTurn(game) === getEngineColor(game)) {
    await performEngineMove(game.guestId);
  } else {
    await persistCompletedGameIfNeeded(game);
  }

  return getSerializableState(game.guestId);
};

const performEngineMove = async (guestId) => {
  const game = ensureGame(guestId);

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

  const bestMove = await engineService.getBestMove({
    fen: game.chess.fen(),
    difficulty: game.settings.difficulty
  });

  if (!bestMove) {
    return getSerializableState(game.guestId);
  }

  const move = applyMove(game.chess, bestMove);

  if (!move) {
    throw new Error("Engine returned an invalid move.");
  }

  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return getSerializableState(game.guestId);
};

const resignGame = async (guestId) => {
  const game = ensureGame(guestId);

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

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

  game.manualOutcome = {
    result: "draw",
    status: {
      code: "draw-agreed",
      message: "Draw"
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
  makePlayerMove,
  offerDraw,
  performEngineMove,
  resetGame,
  resignGame,
  saveCurrentGame,
  resumeSavedGame
};
