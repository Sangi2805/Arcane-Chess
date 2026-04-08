const Game = require("../models/Game");
const MatchmakingQueue = require("../models/MatchmakingQueue");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

class MultiplayerPersistenceUnavailableError extends Error {
  constructor(message = "Multiplayer persistence is currently unavailable.") {
    super(message);
    this.name = "MultiplayerPersistenceUnavailableError";
    this.statusCode = 503;
  }
}

const ensureMultiplayerPersistence = () => {
  if (!isMongoAvailable()) {
    throw new MultiplayerPersistenceUnavailableError(
      `Multiplayer persistence is unavailable (${getMongoStatus()}).`
    );
  }
};

const normalizeClockState = (clockState = null) => {
  if (!clockState) {
    return null;
  }

  return {
    whiteMsLeft:
      Number.isFinite(clockState.whiteMsLeft) && clockState.whiteMsLeft >= 0
        ? clockState.whiteMsLeft
        : null,
    blackMsLeft:
      Number.isFinite(clockState.blackMsLeft) && clockState.blackMsLeft >= 0
        ? clockState.blackMsLeft
        : null,
    runningSide:
      clockState.runningSide === "white" || clockState.runningSide === "black"
        ? clockState.runningSide
        : null,
    lastUpdatedAt: clockState.lastUpdatedAt ? new Date(clockState.lastUpdatedAt) : null
  };
};

const normalizeMoveHistory = (moveHistory = []) =>
  moveHistory
    .filter(Boolean)
    .map((move, index) => ({
      moveNumber:
        Number.isFinite(move.moveNumber) && move.moveNumber > 0
          ? move.moveNumber
          : Math.floor(index / 2) + 1,
      side: move.side === "black" ? "black" : "white",
      san: String(move.san || "").trim(),
      uci: String(move.uci || "").trim(),
      fenAfter: String(move.fenAfter || "").trim(),
      playedAt: move.playedAt ? new Date(move.playedAt) : new Date(),
      clockAfter: normalizeClockState(move.clockAfter)
    }))
    .filter((move) => move.san && move.uci && move.fenAfter);

const createGameRecord = async ({
  mode = "multiplayer",
  status = "waiting",
  whitePlayerId = null,
  blackPlayerId = null,
  timeControl = null,
  clockState = null,
  currentFen = INITIAL_FEN,
  moveHistory = [],
  result = null,
  winner = null,
  finishReason = null,
  completedAt = null
} = {}) => {
  ensureMultiplayerPersistence();

  return Game.create({
    mode,
    status,
    whitePlayerId,
    blackPlayerId,
    timeControl,
    clockState: normalizeClockState(clockState),
    currentFen: currentFen || INITIAL_FEN,
    moveHistory: normalizeMoveHistory(moveHistory),
    result,
    winner,
    finishReason,
    completedAt: completedAt ? new Date(completedAt) : null
  });
};

const getGameRecord = async (gameId) => {
  ensureMultiplayerPersistence();
  return Game.findById(gameId).lean();
};

const updateGameRecord = async (gameId, updates = {}) => {
  ensureMultiplayerPersistence();

  const nextState = {
    ...updates
  };

  if ("clockState" in nextState) {
    nextState.clockState = normalizeClockState(nextState.clockState);
  }

  if ("moveHistory" in nextState) {
    nextState.moveHistory = normalizeMoveHistory(nextState.moveHistory);
  }

  if ("completedAt" in nextState) {
    nextState.completedAt = nextState.completedAt ? new Date(nextState.completedAt) : null;
  }

  return Game.findByIdAndUpdate(
    gameId,
    {
      $set: nextState
    },
    {
      new: true,
      runValidators: true
    }
  ).lean();
};

const enqueueMatchmakingRequest = async ({ userId, desiredTimeControl }) => {
  ensureMultiplayerPersistence();

  return MatchmakingQueue.findOneAndUpdate(
    {
      userId
    },
    {
      $set: {
        desiredTimeControl
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  ).lean();
};

const removeMatchmakingRequest = async ({ queueId = null, userId = null } = {}) => {
  ensureMultiplayerPersistence();

  if (queueId) {
    return MatchmakingQueue.findByIdAndDelete(queueId).lean();
  }

  if (userId) {
    return MatchmakingQueue.findOneAndDelete({ userId }).lean();
  }

  return null;
};

const listMatchmakingQueue = async ({ limit = 50 } = {}) => {
  ensureMultiplayerPersistence();

  return MatchmakingQueue.find({})
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
};

module.exports = {
  MultiplayerPersistenceUnavailableError,
  createGameRecord,
  enqueueMatchmakingRequest,
  getGameRecord,
  listMatchmakingQueue,
  removeMatchmakingRequest,
  updateGameRecord
};
