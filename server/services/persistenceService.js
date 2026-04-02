const SavedGame = require("../models/SavedGame");
const GameHistory = require("../models/GameHistory");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

class PersistenceUnavailableError extends Error {
  constructor(message = "MongoDB persistence is currently unavailable.") {
    super(message);
    this.name = "PersistenceUnavailableError";
    this.statusCode = 503;
  }
}

const ensurePersistence = () => {
  if (!isMongoAvailable()) {
    throw new PersistenceUnavailableError(
      `MongoDB persistence is unavailable (${getMongoStatus()}).`
    );
  }
};

const countHalfMoves = (moveList = []) =>
  moveList.reduce(
    (total, move) => total + (move.white ? 1 : 0) + (move.black ? 1 : 0),
    0
  );

const trimTerminalPeriod = (value) =>
  typeof value === "string" ? value.replace(/\.$/, "") : null;

const getResultFromSnapshot = ({ snapshot }) => {
  if (snapshot.result && snapshot.result !== "not-started") {
    return snapshot.result;
  }

  if (!snapshot.isGameOver) {
    return "in-progress";
  }

  if (snapshot.status.code === "checkmate") {
    return snapshot.turn === "white" ? "black-win" : "white-win";
  }

  return "draw";
};

const getResultLabelFromSnapshot = ({ snapshot }) => {
  if (snapshot.resultLabel) {
    return snapshot.resultLabel;
  }

  if (snapshot.status?.outcomeLabel) {
    return snapshot.status.outcomeLabel;
  }

  if (snapshot.result === "draw") {
    return trimTerminalPeriod(snapshot.status?.message) || "Draw";
  }

  return null;
};

const getDrawReasonFromSnapshot = ({ snapshot }) =>
  snapshot.drawReason || snapshot.status?.drawReason || null;

const buildSavedGamePayload = ({ guestId, gameId, settings, snapshot }) => ({
  guestId,
  gameId,
  fen: snapshot.fen,
  pgn: snapshot.pgn,
  moveList: snapshot.moveList,
  playerColor: settings.playerColor,
  engineColor: settings.engineColor,
  difficulty: settings.difficulty,
  status: snapshot.status,
  lastMove: snapshot.lastMove,
  isResumable: !snapshot.isGameOver
});

const buildSavedGameSummary = (record) => ({
  gameId: record.gameId,
  difficulty: record.difficulty,
  playerColor: record.playerColor,
  engineColor: record.engineColor,
  status: record.status,
  lastMove: record.lastMove,
  moveCount: countHalfMoves(record.moveList),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  isResumable: record.isResumable
});

const buildHistorySummary = (record) => ({
  gameId: record.gameId,
  result: record.result,
  resultLabel: record.resultLabel || null,
  drawReason: record.drawReason || null,
  statusCode: record.statusCode,
  statusMessage: record.statusMessage,
  difficulty: record.difficulty,
  playerColor: record.playerColor,
  engineColor: record.engineColor,
  moveCount: countHalfMoves(record.moveList),
  completedAt: record.completedAt,
  createdAt: record.createdAt
});

const buildHistoryDetail = (record) => ({
  ...buildHistorySummary(record),
  pgn: record.pgn,
  moveList: record.moveList
});

const saveGameSnapshot = async ({ guestId, gameId, settings, snapshot }) => {
  ensurePersistence();

  const record = await SavedGame.findOneAndUpdate(
    {
      guestId,
      gameId
    },
    {
      $set: buildSavedGamePayload({ guestId, gameId, settings, snapshot })
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return buildSavedGameSummary(record);
};

const listSavedGames = async (guestId) => {
  ensurePersistence();

  const records = await SavedGame.find({
    guestId,
    isResumable: true
  })
    .sort({ updatedAt: -1 })
    .lean();

  return records.map(buildSavedGameSummary);
};

const getSavedGameRecord = async (guestId, gameId) => {
  ensurePersistence();

  return SavedGame.findOne({
    guestId,
    gameId
  }).lean();
};

const recordCompletedGame = async ({ guestId, gameId, settings, snapshot }) => {
  ensurePersistence();

  const completedAt = new Date();
  await SavedGame.findOneAndUpdate(
    {
      guestId,
      gameId
    },
    {
      $set: {
        ...buildSavedGamePayload({ guestId, gameId, settings, snapshot }),
        isResumable: false
      }
    },
    {
      new: true
    }
  );

  const record = await GameHistory.findOneAndUpdate(
    {
      guestId,
      gameId
    },
    {
      $set: {
        guestId,
        gameId,
        result: getResultFromSnapshot({ snapshot }),
        resultLabel: getResultLabelFromSnapshot({ snapshot }),
        drawReason: getDrawReasonFromSnapshot({ snapshot }),
        statusCode: snapshot.status.code,
        statusMessage: snapshot.status.message,
        pgn: snapshot.pgn,
        moveList: snapshot.moveList,
        playerColor: settings.playerColor,
        engineColor: settings.engineColor,
        difficulty: settings.difficulty,
        completedAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return buildHistorySummary(record);
};

const listCompletedGames = async (guestId) => {
  ensurePersistence();

  const records = await GameHistory.find({
    guestId
  })
    .sort({ completedAt: -1 })
    .lean();

  return records.map(buildHistorySummary);
};

const getCompletedGame = async (guestId, gameId) => {
  ensurePersistence();

  const record = await GameHistory.findOne({
    guestId,
    gameId
  }).lean();

  return record ? buildHistoryDetail(record) : null;
};

module.exports = {
  PersistenceUnavailableError,
  getResultFromSnapshot,
  getSavedGameRecord,
  listCompletedGames,
  listSavedGames,
  recordCompletedGame,
  saveGameSnapshot,
  getCompletedGame
};
