const express = require("express");
const { Chess } = require("chess.js");

const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const {
  getCompletedGame,
  listCompletedGames
} = require("../services/persistenceService");
const { getRequestActor, sendApiError } = require("./requestContext");

const router = express.Router();

const getPersistencePayload = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

const buildReplayData = (record) => {
  try {
    const chess = new Chess();
    const fenSteps = [chess.fen()];
    const moveHistory = [];

    let sanMoves = [];

    if (record.pgn) {
      const playback = new Chess();
      playback.loadPgn(record.pgn);
      sanMoves = playback.history();
    } else if (Array.isArray(record.moveList)) {
      for (const row of record.moveList) {
        if (row.white) sanMoves.push(row.white);
        if (row.black) sanMoves.push(row.black);
      }
    }

    for (const san of sanMoves) {
      const result = chess.move(san);
      if (!result) break;
      fenSteps.push(chess.fen());
      moveHistory.push({ from: result.from, to: result.to, san: result.san });
    }

    return { fenSteps, moveHistory };
  } catch {
    return { fenSteps: [], moveHistory: [] };
  }
};

router.get("/", async (request, response) => {
  try {
    const actor = getRequestActor(request);

    if (!isMongoAvailable()) {
      response.json({
        items: [],
        persistence: getPersistencePayload()
      });
      return;
    }

    const items = await listCompletedGames(actor);

    response.json({
      items,
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.get("/:gameId", async (request, response) => {
  try {
    const actor = getRequestActor(request);
    const record = await getCompletedGame(actor, request.params.gameId);

    if (!record) {
      response.status(404).json({ message: "Completed game not found." });
      return;
    }

    const { fenSteps, moveHistory } = buildReplayData(record);

    response.json({
      record,
      fenSteps,
      moveHistory,
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
