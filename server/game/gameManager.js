const { randomUUID } = require("crypto");

const {
  applyMove,
  createChessGame,
  serializeGame
} = require("../services/chessService");
const { engineService } = require("../services/engineService");

const DEFAULT_SETTINGS = {
  difficulty: "easy",
  playerColor: "white"
};

let currentGame = null;

const normalizeSettings = (settings = {}) => ({
  difficulty: settings.difficulty || DEFAULT_SETTINGS.difficulty,
  playerColor: settings.playerColor === "black" ? "black" : "white"
});

const createGame = (settings = {}) => {
  const normalizedSettings = normalizeSettings(settings);

  currentGame = {
    id: randomUUID(),
    chess: createChessGame(),
    settings: normalizedSettings
  };

  return currentGame;
};

const ensureGame = () => currentGame || createGame();

const getEngineColor = (game) =>
  game.settings.playerColor === "white" ? "black" : "white";

const getTurn = (game) => serializeGame(game.chess).turn;

const getSerializableState = () => {
  const game = ensureGame();

  return {
    id: game.id,
    settings: {
      ...game.settings,
      engineColor: getEngineColor(game)
    },
    ...serializeGame(game.chess)
  };
};

const createNewGame = async (settings = {}) => {
  createGame(settings);

  if (ensureGame().settings.playerColor === "black") {
    await performEngineMove();
  }

  return getSerializableState();
};

const resetGame = async () => createNewGame(DEFAULT_SETTINGS);

const makePlayerMove = async ({ from, to, promotion }) => {
  const game = ensureGame();

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

  if (!game.chess.isGameOver() && getTurn(game) === getEngineColor(game)) {
    await performEngineMove();
  }

  return getSerializableState();
};

const performEngineMove = async () => {
  const game = ensureGame();

  if (game.chess.isGameOver()) {
    return getSerializableState();
  }

  if (getTurn(game) !== getEngineColor(game)) {
    return getSerializableState();
  }

  const bestMove = await engineService.getBestMove({
    fen: game.chess.fen(),
    difficulty: game.settings.difficulty
  });

  if (!bestMove) {
    return getSerializableState();
  }

  const move = applyMove(game.chess, bestMove);

  if (!move) {
    throw new Error("Engine returned an invalid move.");
  }

  return getSerializableState();
};

module.exports = {
  createNewGame,
  getSerializableState,
  makePlayerMove,
  performEngineMove,
  resetGame
};
