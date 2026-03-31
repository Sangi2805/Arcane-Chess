const express = require("express");

const { ensureGuestProfile, fetchGuestProfile } = require("../services/guestService");
const { getGuestIdFromRequest, sendApiError } = require("./requestContext");

const router = express.Router();

router.post("/session", async (request, response) => {
  try {
    const session = await ensureGuestProfile(request.body || {});
    response.status(201).json(session);
  } catch (error) {
    sendApiError(response, error);
  }
});

router.get("/session", async (request, response) => {
  try {
    const guestId = getGuestIdFromRequest(request);

    if (!guestId) {
      response.status(400).json({ message: "A guest identity is required." });
      return;
    }

    const guest = await fetchGuestProfile(guestId);

    if (!guest) {
      response.status(404).json({ message: "Guest profile not found." });
      return;
    }

    response.json({ guest });
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
