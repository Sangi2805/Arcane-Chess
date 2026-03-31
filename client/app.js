const GUEST_STORAGE_KEY = "arcane-chess-guest-profile";
const RECORD_VIEW_STORAGE_KEY = "arcane-chess-record-view";

const PIECES = {
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

const difficultySelect = document.getElementById("difficulty-select");
const newGameButton = document.getElementById("new-game-button");
const saveGameButton = document.getElementById("save-game-button");
const offerDrawButton = document.getElementById("offer-draw-button");
const resignButton = document.getElementById("resign-button");
const boardShell = document.querySelector(".board-shell");
const boardElement = document.getElementById("board");
const gameOverBanner = document.getElementById("game-over-banner");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverMessage = document.getElementById("game-over-message");
const moveListElement = document.getElementById("move-list");
const statusText = document.getElementById("status-text");
const feedbackText = document.getElementById("feedback-text");
const playerSide = document.getElementById("player-side");
const engineSide = document.getElementById("engine-side");
const turnIndicator = document.getElementById("turn-indicator");
const lastMoveText = document.getElementById("last-move-text");
const apiHealth = document.getElementById("api-health");
const promotionPanel = document.getElementById("promotion-panel");
const colorInputs = document.querySelectorAll('input[name="player-color"]');
const guestSubtitle = document.getElementById("guest-subtitle");
const guestName = document.getElementById("guest-name");
const guestMeta = document.getElementById("guest-meta");
const recordTabs = document.querySelectorAll("[data-record-view]");
const recordViews = document.querySelectorAll("[data-view-panel]");
const savedGamesList = document.getElementById("saved-games-list");
const historyList = document.getElementById("history-list");
const savedGamesCount = document.getElementById("saved-games-count");
const historyCount = document.getElementById("history-count");
const historyModal = document.getElementById("history-modal");
const historyModalCard = historyModal?.querySelector(".modal-card");
const closeHistoryButton = document.getElementById("close-history-button");
const historyDetailResult = document.getElementById("history-detail-result");
const historyDetailDifficulty = document.getElementById("history-detail-difficulty");
const historyDetailPlayer = document.getElementById("history-detail-player");
const historyDetailCompleted = document.getElementById("history-detail-completed");
const historyDetailStatus = document.getElementById("history-detail-status");
const historyDetailPgn = document.getElementById("history-detail-pgn");
const historyDetailMoves = document.getElementById("history-detail-moves");

const state = {
  guest: null,
  game: null,
  selectedSquare: null,
  pendingPromotion: null,
  busy: false,
  savedGames: [],
  history: [],
  persistence: {
    available: false,
    status: "disconnected"
  },
  historyDetailLoading: false,
  historyModalOpen: false,
  activeHistoryRequestId: 0,
  activeRecordView:
    window.localStorage.getItem(RECORD_VIEW_STORAGE_KEY) || "moves"
};

const VALID_RECORD_VIEWS = new Set(["moves", "saves", "history"]);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatColor = (color) =>
  color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : "-";

const formatResult = (result, playerColor) => {
  switch (result) {
    case "white-win":
      return playerColor ? (playerColor === "white" ? "Won" : "Lost") : "White won";
    case "black-win":
      return playerColor ? (playerColor === "black" ? "Won" : "Lost") : "Black won";
    case "draw":
      return "Draw";
    case "not-started":
      return "Not started";
    default:
      return "In Progress";
  }
};

const formatHistoryHeadline = (record = {}) => {
  const result = formatResult(record.result, record.playerColor);

  if (!record.playerColor || result === "In Progress") {
    return result;
  }

  if (result === "Draw") {
    return `Drew as ${formatColor(record.playerColor)}`;
  }

  return `${result} as ${formatColor(record.playerColor)}`;
};

const getWinnerFromResult = (result) => {
  if (result === "white-win") {
    return "White";
  }

  if (result === "black-win") {
    return "Black";
  }

  return null;
};

const getGameOverCopy = (gameState) => {
  if (!gameState?.isGameOver) {
    return null;
  }

  if (gameState.status.code === "checkmate") {
    const winner = getWinnerFromResult(gameState.result);

    return {
      title: "Game Over",
      message: winner ? `${winner} wins by checkmate` : "Checkmate"
    };
  }

  if (gameState.status.code === "resignation") {
    return {
      title: "Game Over",
      message: gameState.status.message
    };
  }

  return {
    title: "Game Over",
    message: "Draw"
  };
};

const getDefaultFeedbackMessage = (gameState) => {
  if (!gameState?.hasStarted) {
    return "Move feedback not yet enabled. Start a new game or resume a saved one.";
  }

  if (gameState.isGameOver) {
    return "Game complete. Start a new game or review the result in History.";
  }

  return "Move feedback not yet enabled for this phase.";
};

const formatTimestamp = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const normalizeHistoryRecord = (record = {}) => ({
  result: record.result || "in-progress",
  difficulty: record.difficulty || record.level || "-",
  playerColor: record.playerColor || record.playerSide || "-",
  engineColor: record.engineColor || "-",
  completedAt: record.completedAt || record.updatedAt || record.createdAt || null,
  statusMessage:
    record.statusMessage || record.status?.message || record.statusCode || "-",
  pgn: record.pgn || record.gamePgn || "",
  moveList: Array.isArray(record.moveList)
    ? record.moveList
    : Array.isArray(record.moves)
      ? record.moves
      : []
});

const readStoredGuest = () => {
  try {
    const storedValue = window.localStorage.getItem(GUEST_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedGuest = JSON.parse(storedValue);

    return parsedGuest?.guestId ? parsedGuest : null;
  } catch (error) {
    return null;
  }
};

const persistGuest = (guest) => {
  if (!guest?.guestId) {
    return;
  }

  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
};

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

const getChosenColor = () =>
  document.querySelector('input[name="player-color"]:checked')?.value || "white";

const getGuestHeaders = () =>
  state.guest?.guestId ? { "X-Guest-Id": state.guest.guestId } : {};

const renderGuestProfile = () => {
  guestName.textContent = "Playing as Guest";

  if (!state.persistence.available) {
    guestSubtitle.textContent = "Guest mode is local until MongoDB returns.";
    guestMeta.textContent =
      "Saved games and history stay on this browser when persistence is available.";
    return;
  }

  guestSubtitle.textContent = "Guest mode is active on this browser.";
  guestMeta.textContent =
    "Save and resume untimed games here without creating an account.";
};

const syncActionButtons = () => {
  const inProgress =
    Boolean(state.game?.hasStarted) && Boolean(state.game) && !state.game.isGameOver;
  const saveDisabled =
    state.busy ||
    !state.game ||
    !state.game.hasStarted ||
    !state.persistence.available ||
    state.game.isGameOver;

  newGameButton.disabled = state.busy;
  saveGameButton.disabled = saveDisabled;
  offerDrawButton.disabled = state.busy || !inProgress;
  resignButton.disabled = state.busy || !inProgress;
  difficultySelect.disabled = state.busy;

  colorInputs.forEach((input) => {
    input.disabled = state.busy;
  });
};

const setPersistence = (persistence = {}) => {
  state.persistence = {
    available: Boolean(persistence.available),
    status: persistence.status || "disconnected"
  };

  renderGuestProfile();
  syncActionButtons();
};

const setBusy = (busy, message) => {
  state.busy = busy;
  syncActionButtons();

  if (message) {
    feedbackText.textContent = message;
  }
};

const setApiHealth = (healthy) => {
  apiHealth.textContent = healthy ? "API Ready" : "API Error";
  apiHealth.className = healthy ? "pill pill-ok" : "pill pill-error";
};

const request = async (url, options = {}) => {
  const headers = {
    ...getGuestHeaders(),
    ...options.headers
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
};

const setRecordView = (view) => {
  const normalizedView = VALID_RECORD_VIEWS.has(view) ? view : "moves";
  state.activeRecordView = normalizedView;
  window.localStorage.setItem(RECORD_VIEW_STORAGE_KEY, normalizedView);

  recordTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.recordView === normalizedView);
  });

  recordViews.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== normalizedView);
  });
};

const getSquareColorClass = (square) => {
  const file = square.charCodeAt(0) - 96;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0 ? "square-dark" : "square-light";
};

const getOrderedSquares = () => {
  const boardSquares = state.game?.board || [];
  const lookup = new Map(boardSquares.map((entry) => [entry.square, entry]));

  const files =
    state.game?.settings.playerColor === "black"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks =
    state.game?.settings.playerColor === "black"
      ? ["1", "2", "3", "4", "5", "6", "7", "8"]
      : ["8", "7", "6", "5", "4", "3", "2", "1"];

  const orderedSquares = [];

  ranks.forEach((rank) => {
    files.forEach((file) => {
      const square = `${file}${rank}`;
      orderedSquares.push(lookup.get(square));
    });
  });

  return orderedSquares;
};

const getLegalTargets = () => {
  if (!state.selectedSquare || !state.game) {
    return [];
  }

  return state.game.legalMoves[state.selectedSquare] || [];
};

const clearPromotionPrompt = () => {
  state.pendingPromotion = null;
  promotionPanel.classList.add("hidden");
  promotionPanel.style.left = "";
  promotionPanel.style.top = "";
  promotionPanel.style.visibility = "";
};

const openPromotionPrompt = (moveChoices, anchorSquare) => {
  state.pendingPromotion = {
    moveChoices,
    anchorSquare
  };
  feedbackText.textContent = "Choose a promotion piece.";
};

const renderGameOverBanner = () => {
  const gameOverCopy = getGameOverCopy(state.game);

  if (!gameOverCopy) {
    gameOverBanner.classList.add("hidden");
    gameOverBanner.setAttribute("aria-hidden", "true");
    return;
  }

  gameOverTitle.textContent = gameOverCopy.title;
  gameOverMessage.textContent = gameOverCopy.message;
  gameOverBanner.classList.remove("hidden");
  gameOverBanner.setAttribute("aria-hidden", "false");
};

const renderPromotionPrompt = () => {
  if (!state.pendingPromotion?.moveChoices?.length || !boardShell) {
    clearPromotionPrompt();
    return;
  }

  const anchorSquare = boardElement.querySelector(
    `[data-square="${state.pendingPromotion.anchorSquare}"]`
  );

  if (!anchorSquare) {
    clearPromotionPrompt();
    return;
  }

  promotionPanel.classList.remove("hidden");
  promotionPanel.style.visibility = "hidden";

  const boardRect = boardShell.getBoundingClientRect();
  const squareRect = anchorSquare.getBoundingClientRect();
  const panelWidth = promotionPanel.offsetWidth || 196;
  const panelHeight = promotionPanel.offsetHeight || 148;
  const margin = 12;
  const preferredLeft =
    squareRect.left - boardRect.left + squareRect.width / 2 - panelWidth / 2;
  const maxLeft = Math.max(margin, boardRect.width - panelWidth - margin);
  const left = Math.min(Math.max(preferredLeft, margin), maxLeft);
  const anchorIsNearTop = squareRect.top - boardRect.top < boardRect.height / 2;
  const preferredTop = anchorIsNearTop
    ? squareRect.bottom - boardRect.top + margin
    : squareRect.top - boardRect.top - panelHeight - margin;
  const maxTop = Math.max(margin, boardRect.height - panelHeight - margin);
  const top = Math.min(Math.max(preferredTop, margin), maxTop);

  promotionPanel.style.left = `${Math.round(left)}px`;
  promotionPanel.style.top = `${Math.round(top)}px`;
  promotionPanel.style.visibility = "";
};

const renderBoardOverlays = () => {
  renderGameOverBanner();

  if (state.pendingPromotion?.moveChoices?.length) {
    renderPromotionPrompt();
    return;
  }

  promotionPanel.classList.add("hidden");
};

const renderMoveRows = (moveList = [], emptyMessage = "No moves recorded yet.") => {
  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  return moveList
    .map(
      (move) => `
        <div class="move-row">
          <strong>${escapeHtml(`${move.turn}.`)}</strong>
          <span>${escapeHtml(move.white || "-")}</span>
          <span>${escapeHtml(move.black || "-")}</span>
        </div>
      `
    )
    .join("");
};

const renderMoveList = () => {
  moveListElement.innerHTML = renderMoveRows(
    state.game?.moveList || [],
    "No moves have been recorded yet."
  );
};

const renderSavedGames = () => {
  savedGamesCount.textContent = `${state.savedGames.length} saved`;

  if (!state.persistence.available) {
    savedGamesList.innerHTML = `
      <div class="empty-state">
        <strong>MongoDB is unavailable.</strong>
        <span>Start MongoDB to enable save and resume support.</span>
      </div>
    `;
    return;
  }

  if (!state.savedGames.length) {
    savedGamesList.innerHTML = `
      <div class="empty-state">
        <strong>No saved games yet.</strong>
        <span>Use Save Game on any in-progress duel to archive it for later.</span>
      </div>
    `;
    return;
  }

  savedGamesList.innerHTML = state.savedGames
    .map(
      (game) => `
        <article class="record-card">
          <div class="record-card-copy">
            <strong>${escapeHtml(formatColor(game.playerColor))} vs ${escapeHtml(
              formatColor(game.engineColor)
            )}</strong>
            <span>${escapeHtml(game.status.message)}</span>
            <span>${escapeHtml(game.difficulty)} difficulty - ${escapeHtml(
              `${game.moveCount} moves`
            )}</span>
            <span>Saved ${escapeHtml(formatTimestamp(game.updatedAt))}</span>
          </div>
          <button
            type="button"
            class="button-secondary button-small"
            data-resume-game="${escapeHtml(game.gameId)}"
            ${state.busy ? "disabled" : ""}
          >
            Resume
          </button>
        </article>
      `
    )
    .join("");
};
const renderHistory = () => {
  historyCount.textContent = `${state.history.length} recorded`;

  if (!state.persistence.available) {
    historyList.innerHTML = `
      <div class="empty-state">
        <strong>History is offline.</strong>
        <span>Completed games will appear here when MongoDB is available.</span>
      </div>
    `;
    return;
  }

  if (!state.history.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <strong>No completed games yet.</strong>
        <span>Finish a duel to store its summary and move record here.</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = state.history
    .map(
      (record) => `
        <article class="record-card">
          <div class="record-card-copy">
            <strong>${escapeHtml(formatHistoryHeadline(record))}</strong>
            <span>${escapeHtml(record.statusMessage)}</span>
            <span>${escapeHtml(formatColor(record.playerColor))} vs ${escapeHtml(
              formatColor(record.engineColor)
            )}</span>
            <span>${escapeHtml(record.difficulty)} difficulty - ${escapeHtml(
              `${record.moveCount} moves`
            )}</span>
            <span>Completed ${escapeHtml(formatTimestamp(record.completedAt))}</span>
          </div>
          <button
            type="button"
            class="button-secondary button-small"
            data-history-game="${escapeHtml(record.gameId)}"
            ${state.busy ? "disabled" : ""}
          >
            View
          </button>
        </article>
      `
    )
    .join("");
};

const resetHistoryDetail = () => {
  historyDetailResult.textContent = "-";
  historyDetailDifficulty.textContent = "-";
  historyDetailPlayer.textContent = "-";
  historyDetailCompleted.textContent = "-";
  historyDetailStatus.textContent = "-";
  historyDetailPgn.textContent = "-";
  historyDetailMoves.innerHTML = renderMoveRows(
    [],
    "No moves were recorded for this game."
  );
};

const renderBoard = () => {
  const legalTargets = getLegalTargets();
  const targetSquares = new Map(legalTargets.map((move) => [move.to, move]));
  const lastMoveSquares = state.game?.lastMove
    ? [state.game.lastMove.from, state.game.lastMove.to]
    : [];
  const orderedSquares = getOrderedSquares();

  boardElement.innerHTML = orderedSquares
    .map((entry, index) => {
      const moveTarget = targetSquares.get(entry.square);
      const isSelected = state.selectedSquare === entry.square;
      const isLastMove = lastMoveSquares.includes(entry.square);
      const colorClass = getSquareColorClass(entry.square);
      const targetClass = moveTarget
        ? moveTarget.captured
          ? "square-capture"
          : "square-target"
        : "";
      const fileLabel =
        index >= 56
          ? `<span class="square-label square-file">${entry.file}</span>`
          : "";
      const rankLabel =
        index % 8 === 0
          ? `<span class="square-label square-rank">${entry.rank}</span>`
          : "";

      return `
        <button
          type="button"
          class="square ${colorClass} ${isSelected ? "square-selected" : ""} ${
            isLastMove ? "square-last-move" : ""
          } ${targetClass}"
          data-square="${entry.square}"
          aria-label="${entry.square}"
        >
          ${rankLabel}
          ${fileLabel}
          ${
            entry.piece
              ? `<span class="piece piece-${entry.piece.color}">${PIECES[entry.piece.color][entry.piece.type]}</span>`
              : ""
          }
        </button>
      `;
    })
    .join("");
};

const updateSummary = () => {
  if (!state.game) {
    return;
  }

  statusText.textContent = state.game.status.message;
  playerSide.textContent =
    state.game.settings.playerColor === "white" ? "White" : "Black";
  engineSide.textContent =
    state.game.settings.engineColor === "white" ? "White" : "Black";
  turnIndicator.textContent = state.game.turn ? formatColor(state.game.turn) : "-";
  lastMoveText.textContent = state.game.lastMove?.san || "None";
};

const renderBoardSurface = () => {
  renderBoard();
  renderBoardOverlays();
};

const render = () => {
  renderGuestProfile();
  renderBoardSurface();
  renderMoveList();
  renderSavedGames();
  renderHistory();
  updateSummary();
  setRecordView(state.activeRecordView);
  syncActionButtons();
};

const syncControls = () => {
  if (!state.game) {
    return;
  }

  difficultySelect.value = state.game.settings.difficulty;
  document
    .querySelectorAll('input[name="player-color"]')
    .forEach((input) => (input.checked = input.value === state.game.settings.playerColor));
};

const applyGameState = (gameState, feedbackMessage) => {
  state.game = gameState;
  state.selectedSquare = null;
  clearPromotionPrompt();
  syncControls();
  setPersistence(gameState.persistence);
  render();

  const gameOverCopy = getGameOverCopy(gameState);

  if (gameOverCopy) {
    feedbackText.textContent = gameOverCopy.message;
  } else if (feedbackMessage) {
    feedbackText.textContent = feedbackMessage;
  } else if (gameState.lastMove?.captured) {
    feedbackText.textContent = `${gameState.lastMove.san} captured a piece.`;
  } else {
    feedbackText.textContent = getDefaultFeedbackMessage(gameState);
  }
};

const loadGame = async () => {
  const gameState = await request("/api/game");
  applyGameState(gameState);
};

const loadSavedGames = async () => {
  const payload = await request("/api/saves");
  state.savedGames = payload.items || [];
  setPersistence(payload.persistence);
  renderSavedGames();
};

const loadHistory = async () => {
  const payload = await request("/api/history");
  state.history = payload.items || [];
  setPersistence(payload.persistence);
  renderHistory();
};

const refreshCollections = async () => {
  await Promise.all([loadSavedGames(), loadHistory()]);
};

const ensureGuestSession = async () => {
  const storedGuest = readStoredGuest();

  try {
    const payload = await request("/api/guest/session", {
      method: "POST",
      body: JSON.stringify(storedGuest || {})
    });

    state.guest = payload.guest;
    persistGuest(payload.guest);
    setPersistence(payload.persistence);
  } catch (error) {
    const fallbackGuest = createFallbackGuest(storedGuest);
    state.guest = fallbackGuest;
    persistGuest(fallbackGuest);
    setPersistence({
      available: false,
      status: "guest-offline"
    });
    feedbackText.textContent = `${error.message} Guest mode has fallen back to local storage only.`;
  }
};

const startNewGame = async () => {
  setBusy(true, "Forging a new duel...");

  try {
    const gameState = await request("/api/game/new", {
      method: "POST",
      body: JSON.stringify({
        difficulty: difficultySelect.value,
        playerColor: getChosenColor()
      })
    });

    setApiHealth(true);
    applyGameState(gameState, "A new match has begun.");
    await refreshCollections();
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const saveCurrentGame = async () => {
  setBusy(true, "Inscribing the current duel into your archive...");

  try {
    const payload = await request("/api/saves", {
      method: "POST"
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    applyGameState(payload.game, "Game saved to your guest archive.");
    await refreshCollections();
    setRecordView("saves");
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const resumeSavedGame = async (gameId) => {
  setBusy(true, "Restoring a saved duel...");

  try {
    const payload = await request(`/api/saves/${gameId}/resume`, {
      method: "POST"
    });

    setApiHealth(true);
    setPersistence(payload.persistence);
    applyGameState(payload.game, "Saved game resumed.");
    await refreshCollections();
    setRecordView("moves");
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const resignCurrentGame = async () => {
  if (!window.confirm("Resign the current game?")) {
    return;
  }

  setBusy(true, "Ending the match by resignation...");

  try {
    const gameState = await request("/api/game/resign", {
      method: "POST"
    });

    setApiHealth(true);
    applyGameState(gameState, "Game ended by resignation.");
    await refreshCollections();
    setRecordView("history");
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const offerDraw = async () => {
  setBusy(true, "Offering a draw...");

  try {
    const payload = await request("/api/game/draw", {
      method: "POST"
    });

    setApiHealth(true);
    applyGameState(payload.game, payload.message);

    if (payload.accepted) {
      await refreshCollections();
      setRecordView("history");
    }
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const populateHistoryDetail = (record) => {
  const normalizedRecord = normalizeHistoryRecord(record);

  historyDetailResult.textContent = formatResult(
    normalizedRecord.result,
    normalizedRecord.playerColor
  );
  historyDetailDifficulty.textContent = normalizedRecord.difficulty;
  historyDetailPlayer.textContent = formatColor(normalizedRecord.playerColor);
  historyDetailCompleted.textContent = formatTimestamp(normalizedRecord.completedAt);
  historyDetailStatus.textContent = normalizedRecord.statusMessage;
  historyDetailPgn.textContent = normalizedRecord.pgn || "No PGN available.";
  historyDetailMoves.innerHTML = renderMoveRows(
    normalizedRecord.moveList,
    "No moves were recorded for this game."
  );
};

const showHistoryModal = () => {
  state.historyModalOpen = true;
  historyModal.classList.remove("hidden");
  historyModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  closeHistoryButton.focus();
};

const closeHistoryDetail = () => {
  state.historyModalOpen = false;
  state.historyDetailLoading = false;
  state.activeHistoryRequestId += 1;
  historyModal.classList.add("hidden");
  historyModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const openHistoryDetail = async (gameId) => {
  const requestId = state.activeHistoryRequestId + 1;
  state.activeHistoryRequestId = requestId;
  state.historyDetailLoading = true;
  feedbackText.textContent = "Opening completed game summary...";
  resetHistoryDetail();
  showHistoryModal();

  try {
    const payload = await request(`/api/history/${gameId}`);

    if (requestId !== state.activeHistoryRequestId || !state.historyModalOpen) {
      return;
    }

    setApiHealth(true);
    setPersistence(payload.persistence);
    populateHistoryDetail(payload.record);
  } catch (error) {
    if (requestId !== state.activeHistoryRequestId) {
      return;
    }

    setApiHealth(false);
    closeHistoryDetail();
    feedbackText.textContent = error.message;
  } finally {
    if (requestId === state.activeHistoryRequestId) {
      state.historyDetailLoading = false;
    }
  }
};

const submitMove = async ({ from, to, promotion }) => {
  setBusy(true, "Stockfish is considering the board...");

  try {
    const gameState = await request("/api/game/move", {
      method: "POST",
      body: JSON.stringify({ from, to, promotion })
    });

    setApiHealth(true);
    applyGameState(gameState, `Move played: ${gameState.lastMove?.san || `${from}-${to}`}`);
    await refreshCollections();
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
  }
};

const handleSquareClick = (square) => {
  if (!state.game || state.busy) {
    return;
  }

  if (!state.game.hasStarted) {
    feedbackText.textContent =
      "Start a new game or resume a saved one. Move feedback arrives next phase.";
    return;
  }

  if (state.game.isGameOver) {
    feedbackText.textContent = "The game is over. Start a new one or review it in history.";
    return;
  }

  if (state.game.turn !== state.game.settings.playerColor) {
    feedbackText.textContent = "Wait for Stockfish to move.";
    return;
  }

  const squareData = state.game.board.find((entry) => entry.square === square);
  const ownPiece =
    squareData?.piece && squareData.piece.color === state.game.settings.playerColor;

  if (!state.selectedSquare) {
    if (ownPiece && state.game.legalMoves[square]?.length) {
      state.selectedSquare = square;
      feedbackText.textContent = `Selected ${square}. Choose a legal destination.`;
      renderBoardSurface();
    } else {
      feedbackText.textContent = "Select one of your pieces with a legal move.";
    }

    return;
  }

  if (state.selectedSquare === square) {
    state.selectedSquare = null;
    clearPromotionPrompt();
    feedbackText.textContent = "Selection cleared.";
    renderBoardSurface();
    return;
  }

  if (ownPiece && state.game.legalMoves[square]?.length) {
    state.selectedSquare = square;
    clearPromotionPrompt();
    feedbackText.textContent = `Selected ${square}.`;
    renderBoardSurface();
    return;
  }

  const matchingMoves = getLegalTargets().filter((move) => move.to === square);

  if (!matchingMoves.length) {
    feedbackText.textContent = "Illegal move. Choose a highlighted destination.";
    return;
  }

  if (matchingMoves.length > 1) {
    openPromotionPrompt(matchingMoves, square);
    renderBoardSurface();
    return;
  }

  submitMove({
    from: state.selectedSquare,
    to: square,
    promotion: matchingMoves[0].promotion || undefined
  });
};

const initialize = async () => {
  renderGuestProfile();
  setRecordView(state.activeRecordView);

  try {
    await ensureGuestSession();
    await Promise.all([loadGame(), refreshCollections()]);
    setApiHealth(true);
  } catch (error) {
    setApiHealth(false);
    statusText.textContent = "Unable to load the game.";
    feedbackText.textContent = error.message;
  } finally {
    syncActionButtons();
  }
};

boardElement.addEventListener("click", (event) => {
  const squareButton = event.target.closest("[data-square]");

  if (!squareButton) {
    return;
  }

  handleSquareClick(squareButton.dataset.square);
});

promotionPanel.addEventListener("click", (event) => {
  const action = event.target.closest("[data-promotion]");

  if (!action || !state.pendingPromotion?.moveChoices?.length || !state.selectedSquare) {
    return;
  }

  const chosenMove = state.pendingPromotion.moveChoices.find(
    (move) => move.promotion === action.dataset.promotion
  );

  if (!chosenMove) {
    return;
  }

  submitMove({
    from: state.selectedSquare,
    to: chosenMove.to,
    promotion: chosenMove.promotion
  });
});

recordTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setRecordView(tab.dataset.recordView);
  });
});

savedGamesList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-resume-game]");

  if (!action) {
    return;
  }

  resumeSavedGame(action.dataset.resumeGame);
});

historyList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-history-game]");

  if (!action) {
    return;
  }

  openHistoryDetail(action.dataset.historyGame);
});

historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal || event.target.closest("[data-close-history]")) {
    closeHistoryDetail();
  }
});

historyModalCard?.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.pendingPromotion?.moveChoices?.length) {
    event.preventDefault();
    clearPromotionPrompt();
    renderBoardOverlays();
    return;
  }

  if (event.key === "Escape" && state.historyModalOpen) {
    event.preventDefault();
    closeHistoryDetail();
  }
});

window.addEventListener("resize", () => {
  if (state.pendingPromotion?.moveChoices?.length || state.game?.isGameOver) {
    renderBoardOverlays();
  }
});

closeHistoryButton.addEventListener("click", (event) => {
  event.preventDefault();
  closeHistoryDetail();
});
newGameButton.addEventListener("click", startNewGame);
saveGameButton.addEventListener("click", saveCurrentGame);
offerDrawButton.addEventListener("click", offerDraw);
resignButton.addEventListener("click", resignCurrentGame);

initialize();
