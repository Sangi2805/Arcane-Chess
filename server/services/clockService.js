const DEFAULT_TIME_CONTROL_ID = "untimed";

const TIME_CONTROL_PRESET_DEFINITIONS = [
  {
    id: DEFAULT_TIME_CONTROL_ID,
    label: "Untimed",
    baseSeconds: 0,
    incrementSeconds: 0,
    enabled: false
  },
  {
    id: "bullet-30",
    label: "30 sec",
    baseSeconds: 30,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "bullet-1",
    label: "1 min",
    baseSeconds: 60,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "bullet-1-1",
    label: "1 | 1",
    baseSeconds: 60,
    incrementSeconds: 1,
    enabled: true
  },
  {
    id: "bullet-2-1",
    label: "2 | 1",
    baseSeconds: 120,
    incrementSeconds: 1,
    enabled: true
  },
  {
    id: "blitz-3",
    label: "3 min",
    baseSeconds: 180,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "blitz-3-2",
    label: "3 | 2",
    baseSeconds: 180,
    incrementSeconds: 2,
    enabled: true
  },
  {
    id: "blitz-5",
    label: "5 min",
    baseSeconds: 300,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "blitz-5-2",
    label: "5 | 2",
    baseSeconds: 300,
    incrementSeconds: 2,
    enabled: true
  },
  {
    id: "blitz-5-5",
    label: "5 | 5",
    baseSeconds: 300,
    incrementSeconds: 5,
    enabled: true
  },
  {
    id: "rapid-10",
    label: "10 min",
    baseSeconds: 600,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "rapid-10-5",
    label: "10 | 5",
    baseSeconds: 600,
    incrementSeconds: 5,
    enabled: true
  },
  {
    id: "rapid-15-10",
    label: "15 | 10",
    baseSeconds: 900,
    incrementSeconds: 10,
    enabled: true
  },
  {
    id: "rapid-20",
    label: "20 min",
    baseSeconds: 1200,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "rapid-30",
    label: "30 min",
    baseSeconds: 1800,
    incrementSeconds: 0,
    enabled: true
  },
  {
    id: "rapid-60",
    label: "60 min",
    baseSeconds: 3600,
    incrementSeconds: 0,
    enabled: true
  }
];

const TIME_CONTROL_PRESETS = new Map(
  TIME_CONTROL_PRESET_DEFINITIONS.map((preset) => [preset.id, preset])
);

const toMilliseconds = (seconds) => Math.max(0, Math.round(seconds * 1000));

const cloneTimeControl = (preset) => ({
  id: preset.id,
  label: preset.label,
  enabled: Boolean(preset.enabled),
  baseSeconds: preset.baseSeconds,
  incrementSeconds: preset.incrementSeconds,
  baseMs: toMilliseconds(preset.baseSeconds),
  incrementMs: toMilliseconds(preset.incrementSeconds)
});

const getTimeControlPreset = (value) => {
  const id =
    typeof value === "string"
      ? value
      : typeof value?.id === "string"
        ? value.id
        : DEFAULT_TIME_CONTROL_ID;

  return TIME_CONTROL_PRESETS.get(id) || TIME_CONTROL_PRESETS.get(DEFAULT_TIME_CONTROL_ID);
};

const normalizeTimeControl = (value) => cloneTimeControl(getTimeControlPreset(value));

const isTimedTimeControl = (timeControl) =>
  Boolean(timeControl?.enabled && timeControl.baseMs > 0);

const resolveNowMs = (value = Date.now()) => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  return Number.isFinite(value) ? value : Date.now();
};

const toIsoString = (value = Date.now()) => new Date(resolveNowMs(value)).toISOString();

const normalizeRemainingMs = (value, fallbackMs) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return Math.max(0, fallbackMs);
  }

  return Math.max(0, parsed);
};

const hydrateClockState = (clockState, timeControl, activeColor = "white") => {
  const normalizedTimeControl = normalizeTimeControl(timeControl);

  if (!isTimedTimeControl(normalizedTimeControl)) {
    return null;
  }

  if (!clockState) {
    return createClockState(normalizedTimeControl, activeColor);
  }

  return {
    enabled: true,
    timeControlId: normalizedTimeControl.id,
    label: normalizedTimeControl.label,
    baseMs: normalizedTimeControl.baseMs,
    incrementMs: normalizedTimeControl.incrementMs,
    whiteMs: normalizeRemainingMs(clockState.whiteMs, normalizedTimeControl.baseMs),
    blackMs: normalizeRemainingMs(clockState.blackMs, normalizedTimeControl.baseMs),
    activeColor: clockState.activeColor === "black" ? "black" : activeColor,
    runningSince: clockState.runningSince || null
  };
};

function createClockState(timeControl, activeColor = "white", now = Date.now()) {
  const normalizedTimeControl = normalizeTimeControl(timeControl);

  if (!isTimedTimeControl(normalizedTimeControl)) {
    return null;
  }

  return {
    enabled: true,
    timeControlId: normalizedTimeControl.id,
    label: normalizedTimeControl.label,
    baseMs: normalizedTimeControl.baseMs,
    incrementMs: normalizedTimeControl.incrementMs,
    whiteMs: normalizedTimeControl.baseMs,
    blackMs: normalizedTimeControl.baseMs,
    activeColor: activeColor === "black" ? "black" : "white",
    runningSince: toIsoString(now)
  };
}

const getClockStateView = (clockState, now = Date.now()) => {
  if (!clockState?.enabled) {
    return null;
  }

  const nowMs = resolveNowMs(now);
  const whiteMs = normalizeRemainingMs(clockState.whiteMs, clockState.baseMs || 0);
  const blackMs = normalizeRemainingMs(clockState.blackMs, clockState.baseMs || 0);
  let currentWhiteMs = whiteMs;
  let currentBlackMs = blackMs;
  let expiredColor = null;

  if (clockState.runningSince && clockState.activeColor) {
    const runningSinceMs = resolveNowMs(clockState.runningSince);
    const elapsedMs = Math.max(0, nowMs - runningSinceMs);

    if (clockState.activeColor === "white") {
      currentWhiteMs = Math.max(0, whiteMs - elapsedMs);

      if (currentWhiteMs === 0) {
        expiredColor = "white";
      }
    } else {
      currentBlackMs = Math.max(0, blackMs - elapsedMs);

      if (currentBlackMs === 0) {
        expiredColor = "black";
      }
    }
  }

  const activeRemainingMs =
    clockState.activeColor === "black" ? currentBlackMs : currentWhiteMs;

  return {
    enabled: true,
    timeControlId: clockState.timeControlId,
    label: clockState.label,
    baseMs: clockState.baseMs,
    incrementMs: clockState.incrementMs,
    whiteMs: currentWhiteMs,
    blackMs: currentBlackMs,
    activeColor: clockState.activeColor || "white",
    runningSince: clockState.runningSince || null,
    isRunning: Boolean(clockState.runningSince),
    activeRemainingMs,
    expiredColor,
    isExpired: Boolean(expiredColor),
    serverNow: toIsoString(nowMs)
  };
};

const pauseClockState = (clockState, now = Date.now()) => {
  const view = getClockStateView(clockState, now);

  if (!view) {
    return null;
  }

  return {
    enabled: true,
    timeControlId: view.timeControlId,
    label: view.label,
    baseMs: view.baseMs,
    incrementMs: view.incrementMs,
    whiteMs: view.whiteMs,
    blackMs: view.blackMs,
    activeColor: view.activeColor,
    runningSince: null
  };
};

const resumeClockState = (clockState, now = Date.now()) => {
  const pausedClockState = pauseClockState(clockState, now);

  if (!pausedClockState?.enabled || !pausedClockState.activeColor) {
    return pausedClockState;
  }

  const activeRemainingMs =
    pausedClockState.activeColor === "black"
      ? pausedClockState.blackMs
      : pausedClockState.whiteMs;

  if (activeRemainingMs <= 0) {
    return pausedClockState;
  }

  return {
    ...pausedClockState,
    runningSince: toIsoString(now)
  };
};

const switchClockTurn = (
  clockState,
  movingColor,
  nextTurnColor,
  now = Date.now()
) => {
  const pausedClockState = pauseClockState(clockState, now);

  if (!pausedClockState?.enabled) {
    return null;
  }

  const nextClockState = {
    ...pausedClockState
  };

  if (movingColor === "white") {
    nextClockState.whiteMs += nextClockState.incrementMs;
  } else if (movingColor === "black") {
    nextClockState.blackMs += nextClockState.incrementMs;
  }

  nextClockState.activeColor = nextTurnColor === "black" ? "black" : "white";

  const nextRemainingMs =
    nextClockState.activeColor === "black"
      ? nextClockState.blackMs
      : nextClockState.whiteMs;

  nextClockState.runningSince =
    nextRemainingMs > 0 ? toIsoString(now) : null;

  return nextClockState;
};

module.exports = {
  DEFAULT_TIME_CONTROL_ID,
  TIME_CONTROL_OPTIONS: TIME_CONTROL_PRESET_DEFINITIONS.map(cloneTimeControl),
  createClockState,
  getClockStateView,
  hydrateClockState,
  isTimedTimeControl,
  normalizeTimeControl,
  pauseClockState,
  resumeClockState,
  switchClockTurn
};
