const express = require("express");

const {
  createNewGame,
  getSerializableState,
  getLiveSerializableState,
  makePlayerMove,
  offerDraw,
  performEngineMove,
  resolveCoachFeedback,
  resolvePendingEngineMove,
  resignGame,
  resetGame
} = require("../game/gameManager");
const { getGuestIdFromRequest, sendApiError } = require("./requestContext");

const router = express.Router();

router.get("/", async (request, response) => {
  try {
    const gameState = await getLiveSerializableState(getGuestIdFromRequest(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
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
    const outcome = await makePlayerMove({
      guestId: getGuestIdFromRequest(request),
      ...request.body
    });

    response.json(outcome);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/coach", async (request, response) => {
  try {
    const outcome = await resolveCoachFeedback({
      guestId: getGuestIdFromRequest(request),
      moveToken: request.body?.moveToken
    });

    response.json(outcome);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/engine", async (request, response) => {
  try {
    if (request.body?.moveToken) {
      const outcome = await resolvePendingEngineMove({
        guestId: getGuestIdFromRequest(request),
        moveToken: request.body.moveToken
      });

      response.json(outcome);
      return;
    }

    const gameState = await performEngineMove(getGuestIdFromRequest(request));

    response.json({
      stale: false,
      moveToken: null,
      game: gameState
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/resign", async (request, response) => {
  try {
    const gameState = await resignGame(getGuestIdFromRequest(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/draw", async (request, response) => {
  try {
    const outcome = await offerDraw(getGuestIdFromRequest(request));

    response.json(outcome);
  } catch (error) {
    sendApiError(response, error, 400);
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
