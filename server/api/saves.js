const express = require("express");

const {
  getSerializableState,
  resumeSavedGame,
  saveCurrentGame
} = require("../game/gameManager");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const { listSavedGames } = require("../services/persistenceService");
const { getRequestActor, sendApiError } = require("./requestContext");

const router = express.Router();

const getPersistencePayload = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

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

    const items = await listSavedGames(actor);

    response.json({
      items,
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/", async (request, response) => {
  try {
    const actor = getRequestActor(request);
    const savedGame = await saveCurrentGame(actor);

    response.status(201).json({
      savedGame,
      game: getSerializableState(actor),
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/:gameId/resume", async (request, response) => {
  try {
    const actor = getRequestActor(request);
    const gameState = await resumeSavedGame({
      actor,
      gameId: request.params.gameId
    });

    response.json({
      game: gameState,
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

module.exports = router;
