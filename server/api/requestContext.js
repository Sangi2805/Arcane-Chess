const { normalizeGuestId } = require("../auth/guestAuth");
const { PersistenceUnavailableError } = require("../services/persistenceService");

const getGuestIdFromRequest = (request) =>
  normalizeGuestId(
    request.get("x-guest-id") ||
      request.body?.guestId ||
      request.query?.guestId ||
      null
  );

const getRequestActor = (request) => {
  if (request.auth?.authenticated && request.auth.user?.id) {
    return {
      type: "user",
      actorId: String(request.auth.user.id),
      userId: String(request.auth.user.id),
      guestId: null,
      key: `user:${request.auth.user.id}`,
      user: request.auth.user
    };
  }

  const guestId = getGuestIdFromRequest(request);

  return {
    type: "guest",
    actorId: guestId || null,
    guestId: guestId || null,
    userId: null,
    key: guestId ? `guest:${guestId}` : null,
    user: null
  };
};

const requireGuestId = (request) => {
  const guestId = getGuestIdFromRequest(request);

  if (!guestId) {
    const error = new Error("A guest identity is required for this request.");
    error.statusCode = 400;
    throw error;
  }

  return guestId;
};

const requireAuthenticatedUser = (request) => {
  if (request.auth?.authenticated && request.auth.user) {
    return request.auth.user;
  }

  const error = new Error("Sign in to use this endpoint.");
  error.statusCode = 401;
  throw error;
};

const sendApiError = (response, error, fallbackStatus = 500) => {
  if (error instanceof PersistenceUnavailableError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  response
    .status(error.statusCode || fallbackStatus)
    .json({ message: error.message || "Request failed." });
};

module.exports = {
  getGuestIdFromRequest,
  getRequestActor,
  requireGuestId,
  requireAuthenticatedUser,
  sendApiError
};
