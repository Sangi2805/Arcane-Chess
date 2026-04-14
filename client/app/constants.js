export const GUEST_STORAGE_KEY = "arcane-chess-guest-profile";
export const RECORD_VIEW_STORAGE_KEY = "arcane-chess-record-view";
export const LOBBY_MODE_STORAGE_KEY = "arcane-chess-lobby-mode";
export const VIEW_STORAGE_KEY = "arcane-chess-view";
export const VALID_APP_VIEWS = new Set(["auth", "hall", "game"]);
export const QUICK_PLAY_TIME_CONTROL_ID = "blitz-5";

export const PIECES = {
  white: {
    p: "\u2659",
    r: "\u2656",
    n: "\u2658",
    b: "\u2657",
    q: "\u2655",
    k: "\u2654"
  },
  black: {
    p: "\u265F",
    r: "\u265C",
    n: "\u265E",
    b: "\u265D",
    q: "\u265B",
    k: "\u265A"
  }
};

export const DEFAULT_COACH_EXPLANATION =
  "Use Hint when you want engine guidance for the current position.";
export const THINKING_COACH_EXPLANATION =
  "Your move is down. The reply is forming now.";
export const GAME_OVER_BANNER_DURATION_MS = 4200;
export const CLOCK_TICK_INTERVAL_MS = 250;
export const CLOCK_SYNC_INTERVAL_MS = 1000;

export const TIME_CONTROL_PRESETS = {
  untimed: {
    label: "Untimed",
    enabled: false,
    baseMs: 0,
    incrementMs: 0
  },
  "bullet-30": {
    label: "30 sec",
    enabled: true,
    baseMs: 30_000,
    incrementMs: 0
  },
  "bullet-1": {
    label: "1 min",
    enabled: true,
    baseMs: 60_000,
    incrementMs: 0
  },
  "bullet-1-1": {
    label: "1 | 1",
    enabled: true,
    baseMs: 60_000,
    incrementMs: 1_000
  },
  "bullet-2-1": {
    label: "2 | 1",
    enabled: true,
    baseMs: 120_000,
    incrementMs: 1_000
  },
  "blitz-3": {
    label: "3 min",
    enabled: true,
    baseMs: 180_000,
    incrementMs: 0
  },
  "blitz-3-2": {
    label: "3 | 2",
    enabled: true,
    baseMs: 180_000,
    incrementMs: 2_000
  },
  "blitz-5": {
    label: "5 min",
    enabled: true,
    baseMs: 300_000,
    incrementMs: 0
  },
  "blitz-5-2": {
    label: "5 | 2",
    enabled: true,
    baseMs: 300_000,
    incrementMs: 2_000
  },
  "blitz-5-5": {
    label: "5 | 5",
    enabled: true,
    baseMs: 300_000,
    incrementMs: 5_000
  },
  "rapid-10": {
    label: "10 min",
    enabled: true,
    baseMs: 600_000,
    incrementMs: 0
  },
  "rapid-10-5": {
    label: "10 | 5",
    enabled: true,
    baseMs: 600_000,
    incrementMs: 5_000
  },
  "rapid-15-10": {
    label: "15 | 10",
    enabled: true,
    baseMs: 900_000,
    incrementMs: 10_000
  },
  "rapid-20": {
    label: "20 min",
    enabled: true,
    baseMs: 1_200_000,
    incrementMs: 0
  },
  "rapid-30": {
    label: "30 min",
    enabled: true,
    baseMs: 1_800_000,
    incrementMs: 0
  },
  "rapid-60": {
    label: "60 min",
    enabled: true,
    baseMs: 3_600_000,
    incrementMs: 0
  }
};

export const HALL_RANDOM_TIME_CONTROL_IDS = [
  "bullet-1",
  "blitz-3-2",
  "blitz-5",
  "rapid-10",
  "rapid-15-10",
  "rapid-30"
];

export const DRAW_OUTCOME_LABELS = {
  stalemate: "Stalemate",
  "draw-repetition": "Draw by repetition",
  "draw-fivefold-repetition": "Draw by fivefold repetition",
  "draw-insufficient-material": "Draw by insufficient material",
  "draw-fifty-move": "Draw by fifty-move rule",
  "draw-seventy-five-move": "Draw by seventy-five-move rule",
  "draw-timeout-insufficient-material": "Draw by timeout vs insufficient material",
  "draw-agreed": "Draw agreed",
  draw: "Draw"
};

export const COACH_STAGE_PLAYER_FEEDBACK = 2;
export const COACH_STAGE_ENGINE_FEEDBACK = 3;
export const COACH_STAGE_GAME_OVER = 4;

export const AMBIENT_TRACK_VOLUMES = {
  hall: 0.2,
  game: 0.15
};

export const VALID_RECORD_VIEWS = new Set(["moves", "saves", "history"]);
export const VALID_LOBBY_MODES = new Set(["solo", "multiplayer"]);

export const WIZARD_STATE_CLASSNAMES = [
  "st-idle",
  "st-check",
  "st-capture",
  "st-blunder",
  "st-win",
  "st-think"
];

export const WIZARD_STATE_LABELS = {
  "st-idle": "IDLE",
  "st-check": "CHECK",
  "st-capture": "CAPTURE",
  "st-blunder": "BLUNDER",
  "st-win": "WIN",
  "st-think": "THINKING"
};

export const WIZARD_STATE_VISUALS = {
  "st-idle": {
    mouth: "M92 156 Q110 168 128 156",
    browLeft: "M70 112 Q87 104 100 112",
    browRight: "M120 112 Q133 104 150 112",
    iris: "#6abcf5",
    irisLeft: { cx: 88, cy: 130, r: 4 },
    irisRight: { cx: 132, cy: 130, r: 4 },
    orb: "#c7a06e",
    orbStroke: "#f0c269"
  },
  "st-check": {
    mouth: "M104 150 C104 141 116 141 116 150 C116 159 104 159 104 150 Z",
    browLeft: "M70 104 Q86 94 100 101",
    browRight: "M120 101 Q134 94 150 104",
    iris: "#f4c8b8",
    irisLeft: { cx: 88, cy: 130, r: 6 },
    irisRight: { cx: 132, cy: 130, r: 6 },
    orb: "#cb514a",
    orbStroke: "#ef8a7f"
  },
  "st-capture": {
    mouth: "M88 148 Q110 182 132 148",
    browLeft: "M70 108 Q86 96 100 102",
    browRight: "M120 102 Q134 96 150 108",
    iris: "#ffefb4",
    irisLeft: { cx: 89, cy: 129, r: 5 },
    irisRight: { cx: 131, cy: 129, r: 5 },
    orb: "#f0c269",
    orbStroke: "#ffe6a3"
  },
  "st-blunder": {
    mouth: "M90 166 Q110 142 130 166",
    browLeft: "M68 118 Q84 100 100 96",
    browRight: "M120 96 Q136 100 152 118",
    iris: "#d8cdf2",
    irisLeft: { cx: 88, cy: 132, r: 4 },
    irisRight: { cx: 132, cy: 132, r: 4 },
    orb: "#4d396f",
    orbStroke: "#8b6cc6"
  },
  "st-win": {
    mouth: "M84 146 Q110 188 136 146",
    browLeft: "M70 108 Q86 96 100 102",
    browRight: "M120 102 Q134 96 150 108",
    iris: "#fff4bf",
    irisLeft: { cx: 89, cy: 128, r: 5 },
    irisRight: { cx: 131, cy: 128, r: 5 },
    orb: "#ffd978",
    orbStroke: "#fff2be"
  },
  "st-think": {
    mouth: "M92 159 L128 159",
    browLeft: "M68 106 Q84 96 100 102",
    browRight: "M122 113 Q136 108 150 112",
    iris: "#d7cbfb",
    irisLeft: { cx: 85, cy: 126, r: 5 },
    irisRight: { cx: 129, cy: 126, r: 5 },
    orb: "#9f8ad0",
    orbStroke: "#d7cbfb"
  }
};