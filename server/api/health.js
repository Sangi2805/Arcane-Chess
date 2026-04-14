const express = require("express");

const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const { getChessServiceStatus } = require("../services/chessService");
const { DIFFICULTY_PRESETS } = require("../services/engineService");

const router = express.Router();

router.get("/", (request, response) => {
  const isProduction = process.env.NODE_ENV === "production";
  const databaseReady = isMongoAvailable();
  const ready = !isProduction || databaseReady;

  response.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    ready,
    service: "arcane-chess",
    db: getMongoStatus(),
    database: getMongoStatus(),
    timestamp: new Date().toISOString(),
    features: {
      auth: {
        mode: "session-and-guest",
        ready
      },
      chessService: {
        status: getChessServiceStatus(),
        ready: true
      },
      stockfish: {
        status: "enabled",
        ready: true
      },
      persistence: {
        status: databaseReady ? "mongo-ready" : "mongo-unavailable",
        ready: databaseReady
      }
    },
    game: {
      supportedDifficulties: Object.keys(DIFFICULTY_PRESETS)
    }
  });
});

module.exports = router;
