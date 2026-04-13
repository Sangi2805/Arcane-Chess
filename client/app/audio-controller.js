import { AMBIENT_TRACK_VOLUMES } from "./constants.js";
import { state } from "./state.js";

// ── Ambient Audio State ──────────────────────────────────────────────────────

const createAmbientTrack = (src) => {
  const audio = new Audio(src);

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;

  return audio;
};

export const ambientTracks = {
  hall: createAmbientTrack("assets/audio/hall-ambient.mp3"),
  game: createAmbientTrack("assets/audio/game-ambient.mp3")
};

export const ambientState = {
  muted: false,
  unlocked: false,
  activeKey: null,
  transitionId: 0,
  fadeTimerId: null,
  fadeResolve: null
};

// ── Dependency Injection ─────────────────────────────────────────────────────

let injectedDom = {
  ambientAudioToggleButton: null,
  movesPanelHeaderActions: null,
  hallHeroActions: null
};

export const configureAudioDependencies = (dom) => {
  injectedDom = {
    ambientAudioToggleButton: dom.ambientAudioToggleButton,
    movesPanelHeaderActions: dom.movesPanelHeaderActions,
    hallHeroActions: dom.hallHeroActions
  };
};

// ── Audio Controller Functions ───────────────────────────────────────────────

export const getAmbientTargetKey = () => (state.view === "game" ? "game" : "hall");

export const clearAmbientFade = () => {
  if (ambientState.fadeTimerId !== null) {
    window.cancelAnimationFrame(ambientState.fadeTimerId);
    ambientState.fadeTimerId = null;
  }

  if (ambientState.fadeResolve) {
    const resolveFade = ambientState.fadeResolve;
    ambientState.fadeResolve = null;
    resolveFade();
  }
};

export const updateAmbientToggleLabel = () => {
  if (!injectedDom.ambientAudioToggleButton) {
    return;
  }

  const muted = ambientState.muted;
  const nextLabel = muted ? "Unmute Music" : "Mute Music";

  injectedDom.ambientAudioToggleButton.textContent = nextLabel;
  injectedDom.ambientAudioToggleButton.setAttribute("aria-label", muted ? "Unmute ambient music" : "Mute ambient music");
  injectedDom.ambientAudioToggleButton.setAttribute("aria-pressed", muted ? "true" : "false");
};

export const syncAmbientTogglePlacement = () => {
  if (!injectedDom.ambientAudioToggleButton) {
    return;
  }

  const targetMount = state.view === "game" ? injectedDom.movesPanelHeaderActions : injectedDom.hallHeroActions;

  if (targetMount && injectedDom.ambientAudioToggleButton.parentElement !== targetMount) {
    targetMount.appendChild(injectedDom.ambientAudioToggleButton);
  }
};

export const fadeAmbientAudio = (audio, fromVolume, toVolume, durationMs, token = ambientState.transitionId) =>
  new Promise((resolve) => {
    const startTime = performance.now();

    clearAmbientFade();
    ambientState.fadeResolve = resolve;

    const step = () => {
      if (token !== ambientState.transitionId) {
        ambientState.fadeTimerId = null;
        ambientState.fadeResolve = null;
        resolve();
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      audio.volume = fromVolume + (toVolume - fromVolume) * progress;

      if (progress >= 1) {
        ambientState.fadeTimerId = null;
        ambientState.fadeResolve = null;
        resolve();
        return;
      }

      ambientState.fadeTimerId = window.requestAnimationFrame(step);
    };

    ambientState.fadeTimerId = window.requestAnimationFrame(step);
  });

export const stopAmbientMusic = () => {
  ambientState.transitionId += 1;
  clearAmbientFade();

  Object.values(ambientTracks).forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
  });

  ambientState.activeKey = null;
};

export const syncAmbientMusic = async () => {
  const targetKey = getAmbientTargetKey();
  const targetAudio = ambientTracks[targetKey];
  const targetVolume = AMBIENT_TRACK_VOLUMES[targetKey];

  if (ambientState.muted) {
    stopAmbientMusic();
    updateAmbientToggleLabel();
    return;
  }

  if (!ambientState.unlocked) {
    updateAmbientToggleLabel();
    return;
  }

  if (ambientState.activeKey === targetKey && !targetAudio.paused) {
    targetAudio.volume = targetVolume;
    updateAmbientToggleLabel();
    return;
  }

  const transitionId = ++ambientState.transitionId;
  const previousKey = ambientState.activeKey;
  const previousAudio = previousKey ? ambientTracks[previousKey] : null;

  ambientState.activeKey = targetKey;

  if (previousAudio && previousAudio !== targetAudio) {
    const fromVolume = previousAudio.volume || AMBIENT_TRACK_VOLUMES[previousKey] || 0;
    await fadeAmbientAudio(previousAudio, fromVolume, 0, 240, transitionId);

    if (transitionId !== ambientState.transitionId) {
      return;
    }

    previousAudio.pause();
    previousAudio.currentTime = 0;
  }

  if (transitionId !== ambientState.transitionId) {
    return;
  }

  targetAudio.currentTime = 0;
  targetAudio.volume = 0;

  try {
    await targetAudio.play();
  } catch {
    if (transitionId === ambientState.transitionId) {
      ambientState.activeKey = null;
    }

    return;
  }

  if (transitionId !== ambientState.transitionId) {
    targetAudio.pause();
    targetAudio.currentTime = 0;
    return;
  }

  await fadeAmbientAudio(targetAudio, 0, targetVolume, 360, transitionId);
  updateAmbientToggleLabel();
};

export const unlockAmbientMusic = () => {
  if (ambientState.unlocked) {
    return;
  }

  ambientState.unlocked = true;
  void syncAmbientMusic();
};

export const setAmbientMuted = (muted) => {
  ambientState.muted = muted;

  if (muted) {
    stopAmbientMusic();
  } else {
    void syncAmbientMusic();
  }

  updateAmbientToggleLabel();
};
