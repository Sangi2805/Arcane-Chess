const express = require("express");

const { getMongoStatus, isMongoAvailable } = require("../db/mongo");
const {
  getCompletedGame,
  getStoredGame,
  listCompletedGames,
  listSavedGames
} = require("../services/persistenceService");
const {
  getSerializableState,
  resumeSavedGame,
  saveCurrentGame
} = require("../game/gameManager");
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

    const scope = request.query?.scope || "all";

    if (scope === "unfinished") {
      response.json({
        items: await listSavedGames(actor),
        persistence: getPersistencePayload()
      });
      return;
    }

    if (scope === "completed") {
      response.json({
        items: await listCompletedGames(actor),
        persistence: getPersistencePayload()
      });
      return;
    }

    response.json({
      items: {
        unfinished: await listSavedGames(actor),
        completed: await listCompletedGames(actor)
      },
      persistence: getPersistencePayload()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.get("/:gameId", async (request, response) => {
  try {
    const actor = getRequestActor(request);
    const record = await getStoredGame(actor, request.params.gameId);

    if (!record) {
      response.status(404).json({ message: "Game not found." });
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

router.post("/current/save", async (request, response) => {
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

router.get("/:gameId/history", async (request, response) => {
  try {
    const actor = getRequestActor(request);
    const record = await getCompletedGame(actor, request.params.gameId);

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
