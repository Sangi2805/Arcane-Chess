const express = require("express");

const {
  getSerializableState,
  resumeSavedGame,
  saveCurrentGame
} = require("../game/gameManager");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const { listSavedGames } = require("../services/persistenceService");
const { requireGuestId, sendApiError } = require("./requestContext");

const router = express.Router();

const getPersistencePayload = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

router.get("/", async (request, response) => {
  try {
    const guestId = requireGuestId(request);

    if (!isMongoAvailable()) {
      response.json({
        items: [],
        persistence: getPersistencePayload()
      });
      return;
    }

    const items = await listSavedGames(guestId);

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
    const guestId = requireGuestId(request);
    const savedGame = await saveCurrentGame(guestId);

    response.status(201).json({
      savedGame,
      game: getSerializableState(guestId),
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/:gameId/resume", async (request, response) => {
  try {
    const guestId = requireGuestId(request);
    const gameState = await resumeSavedGame({
      guestId,
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
