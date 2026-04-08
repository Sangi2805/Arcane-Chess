const SavedGame = require("../models/SavedGame");
const GameHistory = require("../models/GameHistory");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const DEFAULT_GUEST_OWNER_ID = "guest_local_fallback";

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

const buildSavedGamePayload = ({ actor, gameId, settings, snapshot }) => ({
  ...buildOwnerPayload(actor),
  gameId,
  fen: snapshot.fen,
  pgn: snapshot.pgn,
  moveList: snapshot.moveList,
  playerColor: settings.playerColor,
  engineColor: settings.engineColor,
  difficulty: settings.difficulty,
  timeControl: snapshot.timeControl || settings.timeControl || null,
  clockState: snapshot.clockState || null,
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
  isResumable: record.isResumable,
  timeControl: record.timeControl || null,
  clockState: record.clockState || null
});

const buildSavedGameDetail = (record) => ({
  ...buildSavedGameSummary(record),
  statusCode: record.status?.code || null,
  statusMessage: record.status?.message || null,
  pgn: record.pgn,
  moveList: record.moveList
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
  createdAt: record.createdAt,
  timeControl: record.timeControl || null,
  clockState: record.clockState || null
});

const buildHistoryDetail = (record) => ({
  ...buildHistorySummary(record),
  pgn: record.pgn,
  moveList: record.moveList
});

const normalizeActor = (actor = {}) => {
  if (actor.type === "user" && actor.userId) {
    return {
      ownerType: "user",
      ownerId: String(actor.userId),
      userId: actor.userId,
      guestId: null
    };
  }

  const guestId = actor.guestId || actor.actorId || DEFAULT_GUEST_OWNER_ID;

  return {
    ownerType: "guest",
    ownerId: guestId,
    userId: null,
    guestId
  };
};

const buildOwnerPayload = (actor = {}) => {
  const normalizedActor = normalizeActor(actor);

  return {
    ownerType: normalizedActor.ownerType,
    ownerId: normalizedActor.ownerId,
    userId: normalizedActor.userId || null,
    guestId: normalizedActor.guestId || null
  };
};

const buildOwnerFilter = (actor = {}) => {
  const normalizedActor = normalizeActor(actor);

  return {
    ownerType: normalizedActor.ownerType,
    ownerId: normalizedActor.ownerId
  };
};

const saveGameSnapshot = async ({ actor, gameId, settings, snapshot }) => {
  ensurePersistence();

  const record = await SavedGame.findOneAndUpdate(
    {
      ...buildOwnerFilter(actor),
      gameId
    },
    {
      $set: buildSavedGamePayload({
        actor,
        gameId,
        settings,
        snapshot
      })
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return buildSavedGameSummary(record);
};

const listSavedGames = async (actor) => {
  ensurePersistence();

  const records = await SavedGame.find({
    ...buildOwnerFilter(actor),
    isResumable: true
  })
    .sort({ updatedAt: -1 })
    .lean();

  return records.map(buildSavedGameSummary);
};

const getSavedGameRecord = async (actor, gameId) => {
  ensurePersistence();

  return SavedGame.findOne({
    ...buildOwnerFilter(actor),
    gameId
  }).lean();
};

const recordCompletedGame = async ({ actor, gameId, settings, snapshot }) => {
  ensurePersistence();
  const ownerPayload = buildOwnerPayload(actor);

  const completedAt = new Date();
  await SavedGame.findOneAndUpdate(
    {
      ...buildOwnerFilter(actor),
      gameId
    },
    {
      $set: {
        ...buildSavedGamePayload({
          actor,
          gameId,
          settings,
          snapshot
        }),
        isResumable: false
      }
    },
    {
      new: true
    }
  );

  const record = await GameHistory.findOneAndUpdate(
    {
      ...buildOwnerFilter(actor),
      gameId
    },
    {
      $set: {
        ...ownerPayload,
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
        timeControl: snapshot.timeControl || settings.timeControl || null,
        clockState: snapshot.clockState || null,
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

const listCompletedGames = async (actor) => {
  ensurePersistence();

  const records = await GameHistory.find(buildOwnerFilter(actor))
    .sort({ completedAt: -1 })
    .lean();

  return records.map(buildHistorySummary);
};

const getCompletedGame = async (actor, gameId) => {
  ensurePersistence();

  const record = await GameHistory.findOne({
    ...buildOwnerFilter(actor),
    gameId
  }).lean();

  return record ? buildHistoryDetail(record) : null;
};

const getStoredGame = async (actor, gameId) => {
  ensurePersistence();

  const savedGameRecord = await getSavedGameRecord(actor, gameId);

  if (savedGameRecord) {
    return {
      scope: savedGameRecord.isResumable ? "unfinished" : "archived",
      ...buildSavedGameDetail(savedGameRecord)
    };
  }

  const completedGameRecord = await getCompletedGame(actor, gameId);

  if (!completedGameRecord) {
    return null;
  }

  return {
    scope: "completed",
    ...completedGameRecord
  };
};

const transferGuestRecordsToUser = async ({ guestId, userId }) => {
  ensurePersistence();

  if (!guestId || !userId) {
    return {
      savedGamesTransferred: 0,
      historyGamesTransferred: 0
    };
  }

  const normalizedUserId = String(userId);
  const nextOwnerPayload = {
    ownerType: "user",
    ownerId: normalizedUserId,
    userId: normalizedUserId,
    guestId: null
  };

  const [savedGamesResult, historyGamesResult] = await Promise.all([
    SavedGame.updateMany(
      {
        ownerType: "guest",
        ownerId: guestId
      },
      {
        $set: nextOwnerPayload
      }
    ),
    GameHistory.updateMany(
      {
        ownerType: "guest",
        ownerId: guestId
      },
      {
        $set: nextOwnerPayload
      }
    )
  ]);

  return {
    savedGamesTransferred: savedGamesResult.modifiedCount || 0,
    historyGamesTransferred: historyGamesResult.modifiedCount || 0
  };
};

module.exports = {
  PersistenceUnavailableError,
  buildOwnerFilter,
  buildOwnerPayload,
  getResultFromSnapshot,
  getStoredGame,
  getSavedGameRecord,
  listCompletedGames,
  listSavedGames,
  recordCompletedGame,
  saveGameSnapshot,
  getCompletedGame,
  transferGuestRecordsToUser
};
