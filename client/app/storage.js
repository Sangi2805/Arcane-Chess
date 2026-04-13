import {
  GUEST_STORAGE_KEY,
  LOBBY_MODE_STORAGE_KEY,
  RECORD_VIEW_STORAGE_KEY,
  VALID_APP_VIEWS,
  VIEW_STORAGE_KEY
} from "./constants.js";

const INTRO_SEEN_KEY = "ss-intro-seen";

export const hasSeenIntroSplash = () =>
  Boolean(window.sessionStorage.getItem(INTRO_SEEN_KEY));

export const markIntroSplashSeen = () => {
  window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
};

export const persistView = (view) => {
  window.localStorage.setItem(VIEW_STORAGE_KEY, view);
};

export const getSavedView = () => {
  const savedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return VALID_APP_VIEWS.has(savedView) ? savedView : null;
};

export const persistLobbyMode = (mode) => {
  window.localStorage.setItem(LOBBY_MODE_STORAGE_KEY, mode);
};

export const persistRecordView = (view) => {
  window.localStorage.setItem(RECORD_VIEW_STORAGE_KEY, view);
};

export const readStoredGuest = () => {
  try {
    const storedValue = window.localStorage.getItem(GUEST_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedGuest = JSON.parse(storedValue);

    return parsedGuest?.guestId ? parsedGuest : null;
  } catch {
    return null;
  }
};

export const persistGuest = (guest) => {
  if (!guest?.guestId) {
    return;
  }

  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
};
