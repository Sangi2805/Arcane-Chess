const express = require("express");

const {
  createNewGame,
  claimDraw,
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
const { getRequestActor, sendApiError } = require("./requestContext");

const router = express.Router();

router.get("/", async (request, response) => {
  try {
    const gameState = await getLiveSerializableState(getRequestActor(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
});

router.post("/new", async (request, response) => {
  try {
    const gameState = await createNewGame({
      actor: getRequestActor(request),
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
      actor: getRequestActor(request),
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
      actor: getRequestActor(request),
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
        actor: getRequestActor(request),
        moveToken: request.body.moveToken
      });

      response.json(outcome);
      return;
    }

    const gameState = await performEngineMove(getRequestActor(request));

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
    const gameState = await resignGame(getRequestActor(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/draw", async (request, response) => {
  try {
    const outcome = await offerDraw(getRequestActor(request));

    response.json(outcome);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/claim-draw", async (request, response) => {
  try {
    const gameState = await claimDraw(getRequestActor(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error, 400);
  }
});

router.post("/reset", async (request, response) => {
  try {
    const gameState = await resetGame(getRequestActor(request));

    response.json(gameState);
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
