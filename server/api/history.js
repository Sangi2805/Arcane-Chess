const express = require("express");

const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const {
  getCompletedGame,
  listCompletedGames
} = require("../services/persistenceService");
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

    const items = await listCompletedGames(guestId);

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
    const guestId = requireGuestId(request);
    const record = await getCompletedGame(guestId, request.params.gameId);

    if (!record) {
      response.status(404).json({ message: "Completed game not found." });
      return;
    }

    response.json({
      record,
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
