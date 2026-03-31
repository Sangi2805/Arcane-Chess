const { randomUUID } = require("crypto");

const {
  applyMove,
  createChessGame,
  restoreChessGame,
  serializeGame
} = require("../services/chessService");
const { engineService } = require("../services/engineService");
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

const buildSerializableState = (game) => ({
  id: game.id,
  guestId: game.guestId,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
  settings: {
    ...game.settings,
    engineColor: getEngineColor(game)
  },
  persistence: getPersistencePayload(),
  ...serializeGame(game.chess)
});

const createGame = ({ guestId, settings = {}, snapshot = null } = {}) => {
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
    historyRecorded: snapshot?.historyRecorded || false
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
  if (!game.chess.isGameOver() || game.historyRecorded) {
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
      snapshot: serializeGame(game.chess)
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
    settings
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

  if (game.chess.isGameOver()) {
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

  if (game.chess.isGameOver()) {
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

const saveCurrentGame = async (guestId) => {
  const game = ensureGame(guestId);

  if (game.chess.isGameOver()) {
    throw new Error(
      "Completed games are saved to history automatically. Start a new game to continue."
    );
  }

  const snapshot = serializeGame(game.chess);
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
    }
  });

  touchGame(game);

  return getSerializableState(game.guestId);
};

module.exports = {
  createNewGame,
  getSerializableState,
  makePlayerMove,
  performEngineMove,
  resetGame,
  saveCurrentGame,
  resumeSavedGame
};
