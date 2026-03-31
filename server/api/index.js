const express = require("express");

const healthRouter = require("./health");
const gameRouter = require("./game");
const guestRouter = require("./guest");
const savesRouter = require("./saves");
const historyRouter = require("./history");

const router = express.Router();

router.use("/health", healthRouter);
router.use("/guest", guestRouter);
router.use("/game", gameRouter);
router.use("/saves", savesRouter);
router.use("/history", historyRouter);

module.exports = router;
