const express = require("express");

const { transferActiveGame } = require("../game/gameManager");
const {
  AuthenticationError,
  authenticateUser,
  clearSessionCookie,
  createSession,
  getAuthPersistence,
  registerUser,
  serializeUser,
  setSessionCookie
} = require("../services/authService");
const {
  transferGuestRecordsToUser
} = require("../services/persistenceService");
const { getGuestIdFromRequest, sendApiError } = require("./requestContext");

const router = express.Router();

const getRequestMetadata = (request) => ({
  userAgent: request.get("user-agent") || null,
  ipAddress: request.ip || request.socket?.remoteAddress || null
});

router.get("/session", async (request, response) => {
  response.json({
    authenticated: Boolean(request.auth?.authenticated),
    user: request.auth?.user || null,
    persistence: getAuthPersistence()
  });
});

router.post("/register", async (request, response) => {
  try {
    const guestId = getGuestIdFromRequest(request);
    const user = await registerUser(request.body || {});
    const session = await createSession(user, getRequestMetadata(request));
    const transferred = await transferGuestRecordsToUser({
      guestId,
      userId: user._id
    });
    transferActiveGame({
      fromActor: {
        type: "guest",
        guestId
      },
      toActor: {
        type: "user",
        userId: user._id
      }
    });

    setSessionCookie(response, session.token);
    response.status(201).json({
      authenticated: true,
      user: serializeUser(user),
      transferred,
      persistence: getAuthPersistence()
    });
  } catch (error) {
    sendApiError(response, error, error instanceof AuthenticationError ? error.statusCode : 400);
  }
});

router.post("/login", async (request, response) => {
  try {
    const guestId = getGuestIdFromRequest(request);
    const user = await authenticateUser(request.body || {});
    const session = await createSession(user, getRequestMetadata(request));
    const transferred = await transferGuestRecordsToUser({
      guestId,
      userId: user._id
    });
    transferActiveGame({
      fromActor: {
        type: "guest",
        guestId
      },
      toActor: {
        type: "user",
        userId: user._id
      }
    });

    setSessionCookie(response, session.token);
    response.json({
      authenticated: true,
      user: serializeUser(user),
      transferred,
      persistence: getAuthPersistence()
    });
  } catch (error) {
    sendApiError(response, error, error instanceof AuthenticationError ? error.statusCode : 400);
  }
});

router.post("/logout", async (request, response) => {
  try {
    if (request.auth?.token) {
      const { destroySessionByToken } = require("../services/authService");
      await destroySessionByToken(request.auth.token);
    }

    clearSessionCookie(response);
    response.json({
      authenticated: false,
      user: null,
      persistence: getAuthPersistence()
    });
  } catch (error) {
    sendApiError(response, error);
  }
});

module.exports = router;
