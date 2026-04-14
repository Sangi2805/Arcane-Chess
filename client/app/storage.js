import {
  GUEST_STORAGE_KEY,
  LOBBY_MODE_STORAGE_KEY,
  RECORD_VIEW_STORAGE_KEY,
  VALID_APP_VIEWS,
  VIEW_STORAGE_KEY
} from "./constants.js";

const INTRO_SEEN_KEY = "ss-intro-seen";
const MUTED_STORAGE_KEY = "arcane-chess-muted";
const BOARD_VIEW_MODE_KEY = "arcane-chess-board-view-mode";

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

export const persistMuted = (muted) => {
  window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
};

export const getSavedMuted = () => {
  return window.localStorage.getItem(MUTED_STORAGE_KEY) === "1";
};

export const persistBoardViewMode = (mode) => {
  window.localStorage.setItem(BOARD_VIEW_MODE_KEY, mode);
};

export const getSavedBoardViewMode = () => {
  const saved = window.localStorage.getItem(BOARD_VIEW_MODE_KEY);
  return saved === "3d" ? "3d" : "2d";
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