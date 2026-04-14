const GuestProfile = require("../models/GuestProfile");
const { buildGuestIdentity, normalizeGuestId } = require("../auth/guestAuth");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const formatGuestProfile = (profile) => ({
  guestId: profile.guestId,
  displayName: profile.displayName,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
  lastActiveAt: profile.lastActiveAt
});

const getGuestPersistence = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

const ensureGuestProfile = async (input = {}) => {
  const identity = buildGuestIdentity(input);

  if (!isMongoAvailable()) {
    return {
      guest: identity,
      persistence: getGuestPersistence()
    };
  }

  const now = new Date();
  const profile = await GuestProfile.findOneAndUpdate(
    {
      guestId: identity.guestId
    },
    {
      $set: {
        displayName: identity.displayName,
        lastActiveAt: now
      },
      $setOnInsert: {
        guestId: identity.guestId
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return {
    guest: formatGuestProfile(profile),
    persistence: getGuestPersistence()
  };
};

const fetchGuestProfile = async (guestId) => {
  const normalizedGuestId = normalizeGuestId(guestId);

  if (!normalizedGuestId) {
    return null;
  }

  if (!isMongoAvailable()) {
    return null;
  }

  const profile = await GuestProfile.findOne({ guestId: normalizedGuestId }).lean();

  return profile ? formatGuestProfile(profile) : null;
};

module.exports = {
  ensureGuestProfile,
  fetchGuestProfile,
  getGuestPersistence
};
