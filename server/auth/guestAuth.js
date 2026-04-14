const { randomUUID } = require("crypto");

const GUEST_ID_PATTERN = /^guest_[a-z0-9-]+$/i;

const normalizeGuestId = (guestId) => {
  if (typeof guestId !== "string") {
    return null;
  }

  const trimmedGuestId = guestId.trim();

  return GUEST_ID_PATTERN.test(trimmedGuestId) ? trimmedGuestId : null;
};

const normalizeDisplayName = (displayName) => {
  if (typeof displayName !== "string") {
    return null;
  }

  const trimmedDisplayName = displayName.trim();

  return trimmedDisplayName ? trimmedDisplayName.slice(0, 40) : null;
};

const buildGuestIdentity = (input = {}) => {
  const guestPrefix = process.env.GUEST_NAME_PREFIX || "Guest";
  const guestId = normalizeGuestId(input.guestId) || `guest_${randomUUID()}`;
  const suffix = guestId.replace("guest_", "").slice(-4).toUpperCase();

  return {
    guestId,
    displayName:
      normalizeDisplayName(input.displayName) || `${guestPrefix}-${suffix}`
  };
};

module.exports = {
  buildGuestIdentity,
  normalizeDisplayName,
  normalizeGuestId
};
