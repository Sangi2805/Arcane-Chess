const express = require("express");

const healthRouter = require("./health");
const authRouter = require("./auth");
const gameRouter = require("./game");
const gamesRouter = require("./games");
const guestRouter = require("./guest");
const savesRouter = require("./saves");
const historyRouter = require("./history");

const router = express.Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/guest", guestRouter);
router.use("/game", gameRouter);
router.use("/games", gamesRouter);
router.use("/saves", savesRouter);
router.use("/history", historyRouter);

module.exports = router;
