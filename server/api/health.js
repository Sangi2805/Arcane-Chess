const express = require("express");

const { getMongoStatus } = require("../db/mongo");
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
      guestAuth: "placeholder",
      chessService: getChessServiceStatus(),
      stockfish: "enabled"
    },
    game: {
      supportedDifficulties: Object.keys(DIFFICULTY_PRESETS)
    }
  });
});

module.exports = router;
