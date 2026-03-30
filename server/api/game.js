const express = require("express");

const {
  createNewGame,
  getSerializableState,
  makePlayerMove,
  performEngineMove,
  resetGame
} = require("../game/gameManager");

const router = express.Router();

router.get("/", (request, response) => {
  response.json(getSerializableState());
});

router.post("/new", async (request, response) => {
  try {
    const gameState = await createNewGame(request.body);

    response.status(201).json(gameState);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

router.post("/move", async (request, response) => {
  try {
    const gameState = await makePlayerMove(request.body);

    response.json(gameState);
  } catch (error) {
    response.status(400).json({ message: error.message });
  }
});

router.post("/engine", async (request, response) => {
  try {
    const gameState = await performEngineMove();

    response.json(gameState);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

router.post("/reset", async (request, response) => {
  try {
    const gameState = await resetGame();

    response.json(gameState);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

module.exports = router;
