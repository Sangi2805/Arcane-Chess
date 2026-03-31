const express = require("express");

const {
  createNewGame,
  getSerializableState,
  makePlayerMove,
  performEngineMove,
  resetGame
} = require("../game/gameManager");
const { getGuestIdFromRequest, sendApiError } = require("./requestContext");

const router = express.Router();

router.get("/", (request, response) => {
  response.json(getSerializableState(getGuestIdFromRequest(request)));
});

router.post("/new", async (request, response) => {
  try {
    const gameState = await createNewGame({
      guestId: getGuestIdFromRequest(request),
      settings: request.body
    });

    response.status(201).json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/move", async (request, response) => {
  try {
    const gameState = await makePlayerMove({
      guestId: getGuestIdFromRequest(request),
      ...request.body
    });

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/engine", async (request, response) => {
  try {
    const gameState = await performEngineMove(getGuestIdFromRequest(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/reset", async (request, response) => {
  try {
    const gameState = await resetGame(getGuestIdFromRequest(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
