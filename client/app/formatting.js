import {
  DRAW_OUTCOME_LABELS,
  TIME_CONTROL_PRESETS
} from "./constants.js";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const formatColor = (color) =>
  color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : "-";

export const trimTerminalPeriod = (value) =>
  typeof value === "string" ? value.replace(/\.$/, "") : "";

export const getOutcomeLabel = (value = {}) => {
  if (value.resultLabel) {
    return value.resultLabel;
  }

  if (value.status?.outcomeLabel) {
    return value.status.outcomeLabel;
  }

  const statusCode = value.status?.code || value.statusCode;

  if (statusCode && DRAW_OUTCOME_LABELS[statusCode]) {
    return DRAW_OUTCOME_LABELS[statusCode];
  }

  if (value.result === "draw") {
    return trimTerminalPeriod(value.status?.message || value.statusMessage) || "Draw";
  }

  return null;
};

export const formatResult = (result, playerColor, context = {}) => {
  switch (result) {
    case "white-win":
      return playerColor ? (playerColor === "white" ? "Won" : "Lost") : "White won";
    case "black-win":
      return playerColor ? (playerColor === "black" ? "Won" : "Lost") : "Black won";
    case "draw":
      return getOutcomeLabel({
        ...context,
        result
      }) || "Draw";
    case "not-started":
      return "Not started";
    default:
      return "In Progress";
  }
};

export const formatHistoryHeadline = (record = {}) => {
  const result = formatResult(record.result, record.playerColor, record);

  if (
    !record.playerColor ||
    result === "In Progress" ||
    result === "Not started"
  ) {
    return result;
  }

  return `${result} as ${formatColor(record.playerColor)}`;
};

export const normalizeChronicleWhyLines = (whyLines = []) =>
  Array.isArray(whyLines)
    ? whyLines
        .map((line = {}) => {
          const san = Array.isArray(line.san)
            ? line.san.filter((move) => typeof move === "string" && move.trim().length > 0)
            : [];

          return {
            rank: Number(line.rank) || null,
            eval: typeof line.eval === "number" ? line.eval : null,
            san
          };
        })
        .filter((line) => line.san.length > 0)
    : [];

export const formatTimestamp = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const getResolvedTimeControl = (timeControl = null) => {
  const id =
    typeof timeControl === "string"
      ? timeControl
      : typeof timeControl?.id === "string"
        ? timeControl.id
        : "untimed";
  const preset = TIME_CONTROL_PRESETS[id] || TIME_CONTROL_PRESETS.untimed;

  return {
    id,
    label: timeControl?.label || preset.label,
    enabled: Boolean(
      typeof timeControl?.enabled === "boolean" ? timeControl.enabled : preset.enabled
    ),
    baseMs: Number(timeControl?.baseMs ?? preset.baseMs ?? 0),
    incrementMs: Number(timeControl?.incrementMs ?? preset.incrementMs ?? 0)
  };
};

export const formatTimeControl = (timeControl = null) =>
  getResolvedTimeControl(timeControl).label;

export const normalizeHistoryRecord = (record = {}) => ({
  result: record.result || "in-progress",
  resultLabel: record.resultLabel || null,
  drawReason: record.drawReason || null,
  difficulty: record.difficulty || record.level || "-",
  playerColor: record.playerColor || record.playerSide || "-",
  engineColor: record.engineColor || "-",
  completedAt: record.completedAt || record.updatedAt || record.createdAt || null,
  statusCode: record.statusCode || record.status?.code || null,
  statusMessage:
    record.statusMessage || record.status?.message || record.statusCode || "-",
  pgn: record.pgn || record.gamePgn || "",
  moveList: Array.isArray(record.moveList)
    ? record.moveList
    : Array.isArray(record.moves)
      ? record.moves
      : []
});

export const formatClockMs = (milliseconds = 0) => {
  const clampedMs = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainderMinutes = minutes % 60;
    return `${hours}:${String(remainderMinutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
