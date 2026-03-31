const { normalizeGuestId } = require("../auth/guestAuth");
const { PersistenceUnavailableError } = require("../services/persistenceService");

const getGuestIdFromRequest = (request) =>
  normalizeGuestId(
    request.get("x-guest-id") ||
      request.body?.guestId ||
      request.query?.guestId ||
      null
  );

const requireGuestId = (request) => {
  const guestId = getGuestIdFromRequest(request);

  if (!guestId) {
    const error = new Error("A guest identity is required for this request.");
    error.statusCode = 400;
    throw error;
  }

  return guestId;
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
  requireGuestId,
  sendApiError
};
