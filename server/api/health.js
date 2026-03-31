const express = require("express");

const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const { getChessServiceStatus } = require("../services/chessService");
const { DIFFICULTY_PRESETS } = require("../services/engineService");

const router = express.Router();

router.get("/", (request, response) => {
  response.json({
    status: "ok",
    service: "arcane-chess",
    database: getMongoStatus(),
    timestamp: new Date().toISOString(),
    features: {
      guestAuth: "guest-continuity",
      chessService: getChessServiceStatus(),
      stockfish: "enabled",
      persistence: isMongoAvailable() ? "mongo-ready" : "mongo-unavailable"
    },
    game: {
      supportedDifficulties: Object.keys(DIFFICULTY_PRESETS)
    }
  });
});

module.exports = router;
