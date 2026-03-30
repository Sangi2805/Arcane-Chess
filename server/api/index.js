const express = require("express");

const healthRouter = require("./health");
const gameRouter = require("./game");
const { createGuestSession } = require("../auth/guestAuth");

const router = express.Router();

router.use("/health", healthRouter);
router.use("/game", gameRouter);

router.post("/auth/guest", (request, response) => {
  const session = createGuestSession();

  response.status(201).json({
    status: "placeholder",
    session
  });
});

module.exports = router;
