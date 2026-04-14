import {
  persistGuest,
  readStoredGuest
} from "./storage.js";

const createFallbackGuest = (storedGuest) => {
  const guestId =
    storedGuest?.guestId ||
    `guest_${window.crypto?.randomUUID?.() || Date.now().toString(36)}`;
  const suffix = guestId.replace("guest_", "").slice(-4).toUpperCase();

  return {
    guestId,
    displayName: storedGuest?.displayName || `Guest-${suffix}`
  };
};

export const request = async (url, options = {}) => {
  const headers = {
    ...options.headers
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
};

export const loadSession = async () => request("/api/auth/session");

export const ensureGuestSession = async () => {
  const storedGuest = readStoredGuest();

  try {
    const payload = await request("/api/guest/session", {
      method: "POST",
      body: JSON.stringify(storedGuest || {})
    });

    if (payload.guest) {
      persistGuest(payload.guest);
    }

    return {
      ...payload,
      guest: payload.guest || null,
      storedGuest
    };
  } catch (error) {
    const fallbackGuest = createFallbackGuest(storedGuest);
    persistGuest(fallbackGuest);

    return {
      guest: fallbackGuest,
      storedGuest,
      persistence: {
        available: false,
        status: "guest-offline"
      },
      errorMessage: error.message || "Guest mode has fallen back to local storage only."
    };
  }
};

export const loadSavedGames = async () => request("/api/saves");

export const loadHistory = async () => request("/api/history");
