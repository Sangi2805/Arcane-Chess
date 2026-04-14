let replayHistoryDeps = {
  state: null,
  replayState: null,
  dom: {
    historyCount: null,
    historyDetailCompleted: null,
    historyDetailDifficulty: null,
    historyDetailMoves: null,
    historyDetailPgn: null,
    historyDetailPlayer: null,
    historyDetailResult: null,
    historyDetailStatus: null,
    historyList: null,
    historyModal: null,
    closeHistoryButton: null,
    replayBack: null,
    replayBoard: null,
    replayForward: null,
    replayStepLabel: null,
    savedGamesCount: null,
    savedGamesList: null
  },
  helpers: {
    PIECES: null,
    escapeHtml: (value) => String(value ?? ""),
    formatColor: (value) => String(value ?? ""),
    formatHistoryHeadline: (value) => String(value ?? ""),
    formatResult: (value) => String(value ?? ""),
    formatTimeControl: (value) => String(value ?? ""),
    formatTimestamp: (value) => String(value ?? ""),
    getLocalPlayerDisplayName: () => "Guest",
    getSquareColorClass: () => "square-dark",
    isAuthenticated: () => false,
    normalizeHistoryRecord: (record) => record || {},
    request: async () => ({}),
    setApiHealth: () => {},
    setCoachMessage: () => {},
    setPersistence: () => {}
  }
};

export const configureReplayHistoryDependencies = (deps = {}) => {
  replayHistoryDeps = {
    ...replayHistoryDeps,
    ...deps,
    dom: {
      ...replayHistoryDeps.dom,
      ...(deps.dom || {})
    },
    helpers: {
      ...replayHistoryDeps.helpers,
      ...(deps.helpers || {})
    }
  };
};

export const getSavedGameHeadline = (game = {}) => {
  const playerName = replayHistoryDeps.helpers.getLocalPlayerDisplayName();
  const isMultiplayerSave = game.actorType === "multiplayer";

  if (isMultiplayerSave) {
    const opponentName =
      game.opponentName ||
      game.opponentDisplayName ||
      game.opponent ||
      "Opponent";
    return `${playerName} vs ${opponentName}`;
  }

  const difficulty = game.difficulty || "Easy";
  return `${playerName} vs Stockfish · ${difficulty}`;
};

export const renderSavedGames = () => {
  const { state } = replayHistoryDeps;
  const { savedGamesCount, savedGamesList } = replayHistoryDeps.dom;
  const { escapeHtml, formatTimeControl, formatTimestamp, isAuthenticated } = replayHistoryDeps.helpers;

  if (!state || !savedGamesCount || !savedGamesList) {
    return;
  }

  savedGamesCount.textContent = `${state.savedGames.length} saved`;
  const ownerLabel = isAuthenticated() ? "your account" : "this browser";

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
        <span>Use Save Game on any in-progress duel to archive it for later on ${escapeHtml(
          ownerLabel
        )}.</span>
      </div>
    `;
    return;
  }

  savedGamesList.innerHTML = state.savedGames
    .map(
      (game) => `
        <article class="record-card">
          <div class="record-card-copy">
            <strong>${escapeHtml(getSavedGameHeadline(game))}</strong>
            <span>${escapeHtml(game.status.message)}</span>
            <span>${escapeHtml(game.difficulty)} difficulty - ${escapeHtml(
              `${game.moveCount} moves`
            )}</span>
            <span>${escapeHtml(formatTimeControl(game.timeControl))}</span>
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

export const parseFenToBoard = (fen) => {
  const position = fen.split(" ")[0];
  const rows = position.split("/");
  const RANK_LABELS = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const board = [];

  rows.forEach((row, rankIndex) => {
    const rank = RANK_LABELS[rankIndex];
    let fileIndex = 0;

    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const count = Number(ch);

        for (let i = 0; i < count; i++) {
          const file = FILE_LABELS[fileIndex + i];
          board.push({ square: `${file}${rank}`, file, rank, piece: null });
        }

        fileIndex += count;
      } else {
        const file = FILE_LABELS[fileIndex];
        const color = ch === ch.toUpperCase() ? "white" : "black";
        const type = ch.toLowerCase();
        board.push({ square: `${file}${rank}`, file, rank, piece: { type, color } });
        fileIndex++;
      }
    }
  });

  return board;
};

export const renderReplayBoard = () => {
  const { replayState } = replayHistoryDeps;
  const { replayBoard } = replayHistoryDeps.dom;
  const { PIECES, getSquareColorClass } = replayHistoryDeps.helpers;

  if (!replayBoard || !replayState || !PIECES) {
    return;
  }

  const fen = replayState.fenSteps[replayState.index];

  if (!fen) {
    replayBoard.innerHTML = "";
    return;
  }

  const boardData = parseFenToBoard(fen);
  const lookup = new Map(boardData.map((e) => [e.square, e]));
  const files =
    replayState.playerColor === "black"
      ? ["h", "g", "f", "e", "d", "c", "b", "a"]
      : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks =
    replayState.playerColor === "black"
      ? ["1", "2", "3", "4", "5", "6", "7", "8"]
      : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const lastMoveFrom = replayState.index > 0 ? replayState.moveHistory[replayState.index - 1]?.from : null;
  const lastMoveTo = replayState.index > 0 ? replayState.moveHistory[replayState.index - 1]?.to : null;

  const squares = [];
  ranks.forEach((rank) => files.forEach((file) => squares.push(lookup.get(`${file}${rank}`))));

  replayBoard.innerHTML = squares
    .map((entry, index) => {
      if (!entry) {
        return "";
      }

      const colorClass = getSquareColorClass(entry.square);
      const classes = ["square", colorClass];
      if (entry.square === lastMoveFrom) {
        classes.push("square-last-from");
      }
      if (entry.square === lastMoveTo) {
        classes.push("square-last-to");
      }

      const fileLabel =
        index >= 56 ? `<span class="square-label square-file">${entry.file}</span>` : "";
      const rankLabel =
        index % 8 === 0 ? `<span class="square-label square-rank">${entry.rank}</span>` : "";

      return `
        <div class="${classes.join(" ")}" data-square="${entry.square}">
          ${rankLabel}${fileLabel}
          ${entry.piece
            ? `<span class="piece piece-${entry.piece.color}">${PIECES[entry.piece.color][entry.piece.type]}</span>`
            : ""}
        </div>
      `;
    })
    .join("");
};

export const renderReplayMoveRows = (moveList = [], activeHalfMoveIndex = -1) => {
  const { escapeHtml } = replayHistoryDeps.helpers;

  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>No moves were recorded for this game.</strong>
      </div>
    `;
  }

  return `
    <div class="move-row move-row-head" role="presentation">
      <span>Turn</span>
      <span>White</span>
      <span>Black</span>
    </div>
    ${moveList
      .map((move) => {
        const whiteMoveIdx = (move.turn - 1) * 2;
        const blackMoveIdx = (move.turn - 1) * 2 + 1;
        const highlightWhite = activeHalfMoveIndex === whiteMoveIdx && Boolean(move.white);
        const highlightBlack = activeHalfMoveIndex === blackMoveIdx && Boolean(move.black);

        return `
          <div class="move-row ${highlightWhite || highlightBlack ? "move-row-current" : ""}">
            <strong class="move-turn">${escapeHtml(`${move.turn}.`)}</strong>
            <span class="move-cell ${highlightWhite ? "move-cell-current" : ""}">${escapeHtml(move.white || "-")}</span>
            <span class="move-cell ${highlightBlack ? "move-cell-current" : ""}">${escapeHtml(move.black || "-")}</span>
          </div>
        `;
      })
      .join("")}
  `;
};

export const updateReplayControls = () => {
  const { replayState } = replayHistoryDeps;
  const { replayStepLabel, replayBack, replayForward } = replayHistoryDeps.dom;

  if (!replayState) {
    return;
  }

  const total = Math.max(0, replayState.fenSteps.length - 1);
  const hasData = replayState.fenSteps.length > 0;

  if (replayStepLabel) {
    if (!hasData) {
      replayStepLabel.textContent = "No data";
    } else {
      replayStepLabel.textContent = replayState.index === 0 ? "Start" : `Move ${replayState.index} of ${total}`;
    }
  }

  if (replayBack) {
    replayBack.disabled = replayState.index <= 0 || !hasData;
  }
  if (replayForward) {
    replayForward.disabled = replayState.index >= total || !hasData;
  }
};

export const scrollReplayActiveMoveIntoView = () => {
  const { historyDetailMoves } = replayHistoryDeps.dom;

  if (!historyDetailMoves) {
    return;
  }

  const active = historyDetailMoves.querySelector(".move-cell-current");
  if (active) {
    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

export const setReplayStep = (index) => {
  const { replayState } = replayHistoryDeps;
  const { historyDetailMoves } = replayHistoryDeps.dom;

  if (!replayState) {
    return;
  }

  replayState.index = Math.max(0, Math.min(index, Math.max(0, replayState.fenSteps.length - 1)));
  renderReplayBoard();
  if (historyDetailMoves) {
    historyDetailMoves.innerHTML = renderReplayMoveRows(replayState.moveList, replayState.index - 1);
  }
  updateReplayControls();
  scrollReplayActiveMoveIntoView();
};

export const stepReplay = (delta) => {
  const { replayState } = replayHistoryDeps;

  if (!replayState) {
    return;
  }

  setReplayStep(replayState.index + delta);
};

export const initReplay = (moveList, fenSteps, moveHistory, playerColor) => {
  const { replayState } = replayHistoryDeps;

  if (!replayState) {
    return;
  }

  replayState.moveList = moveList || [];
  replayState.fenSteps = fenSteps || [];
  replayState.moveHistory = moveHistory || [];
  replayState.playerColor = playerColor || "white";
  setReplayStep(0);
};

export const clearReplay = () => {
  const { replayState } = replayHistoryDeps;
  const { replayBoard } = replayHistoryDeps.dom;

  if (!replayState) {
    return;
  }

  replayState.fenSteps = [];
  replayState.moveHistory = [];
  replayState.moveList = [];
  replayState.index = 0;
  if (replayBoard) {
    replayBoard.innerHTML = "";
  }
  updateReplayControls();
};

export const renderHistory = () => {
  const { state } = replayHistoryDeps;
  const { historyCount, historyList } = replayHistoryDeps.dom;
  const {
    escapeHtml,
    formatColor,
    formatHistoryHeadline,
    formatTimeControl,
    formatTimestamp,
    isAuthenticated
  } = replayHistoryDeps.helpers;

  if (!state || !historyCount || !historyList) {
    return;
  }

  historyCount.textContent = `${state.history.length} recorded`;
  const ownerLabel = isAuthenticated() ? "your account" : "this browser";

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
        <span>Finish a duel to store its summary and move record for ${escapeHtml(
          ownerLabel
        )}.</span>
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
            <span>${escapeHtml(formatTimeControl(record.timeControl))}</span>
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

export const resetHistoryDetail = () => {
  const {
    historyDetailResult,
    historyDetailDifficulty,
    historyDetailPlayer,
    historyDetailCompleted,
    historyDetailStatus,
    historyDetailPgn,
    historyDetailMoves
  } = replayHistoryDeps.dom;

  if (historyDetailResult) {
    historyDetailResult.textContent = "-";
  }
  if (historyDetailDifficulty) {
    historyDetailDifficulty.textContent = "-";
  }
  if (historyDetailPlayer) {
    historyDetailPlayer.textContent = "-";
  }
  if (historyDetailCompleted) {
    historyDetailCompleted.textContent = "-";
  }
  if (historyDetailStatus) {
    historyDetailStatus.textContent = "-";
  }
  if (historyDetailPgn) {
    historyDetailPgn.textContent = "-";
  }
  if (historyDetailMoves) {
    historyDetailMoves.innerHTML = renderReplayMoveRows([], -1);
  }
  clearReplay();
};

export const populateHistoryDetail = (record, fenSteps = [], moveHistory = []) => {
  const {
    historyDetailResult,
    historyDetailDifficulty,
    historyDetailPlayer,
    historyDetailCompleted,
    historyDetailStatus,
    historyDetailPgn
  } = replayHistoryDeps.dom;
  const { formatColor, formatResult, formatTimestamp, normalizeHistoryRecord } = replayHistoryDeps.helpers;

  const normalizedRecord = normalizeHistoryRecord(record);

  if (historyDetailResult) {
    historyDetailResult.textContent = formatResult(
      normalizedRecord.result,
      normalizedRecord.playerColor,
      normalizedRecord
    );
  }
  if (historyDetailDifficulty) {
    historyDetailDifficulty.textContent = normalizedRecord.difficulty;
  }
  if (historyDetailPlayer) {
    historyDetailPlayer.textContent = formatColor(normalizedRecord.playerColor);
  }
  if (historyDetailCompleted) {
    historyDetailCompleted.textContent = formatTimestamp(normalizedRecord.completedAt);
  }
  if (historyDetailStatus) {
    historyDetailStatus.textContent = normalizedRecord.statusMessage;
  }
  if (historyDetailPgn) {
    historyDetailPgn.textContent = normalizedRecord.pgn || "No PGN available.";
  }

  initReplay(normalizedRecord.moveList, fenSteps, moveHistory, normalizedRecord.playerColor);
};

export const showHistoryModal = () => {
  const { state } = replayHistoryDeps;
  const { historyModal, closeHistoryButton } = replayHistoryDeps.dom;

  if (!state || !historyModal) {
    return;
  }

  state.historyModalOpen = true;
  historyModal.classList.remove("hidden");
  historyModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  closeHistoryButton?.focus();
};

export const closeHistoryDetail = () => {
  const { state } = replayHistoryDeps;
  const { historyModal } = replayHistoryDeps.dom;

  if (!state || !historyModal) {
    return;
  }

  state.historyModalOpen = false;
  state.historyDetailLoading = false;
  state.activeHistoryRequestId += 1;
  historyModal.classList.add("hidden");
  historyModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

export const openHistoryDetail = async (gameId) => {
  const { state } = replayHistoryDeps;
  const {
    request,
    setCoachMessage,
    setApiHealth,
    setPersistence
  } = replayHistoryDeps.helpers;

  if (!state) {
    return;
  }

  const requestId = state.activeHistoryRequestId + 1;
  state.activeHistoryRequestId = requestId;
  state.historyDetailLoading = true;
  setCoachMessage(
    "Opening completed game summary...",
    "The active board remains unchanged while the history archive loads."
  );
  resetHistoryDetail();
  showHistoryModal();

  try {
    const payload = await request(`/api/history/${gameId}`);

    if (requestId !== state.activeHistoryRequestId || !state.historyModalOpen) {
      return;
    }

    setApiHealth(true);
    setPersistence(payload.persistence);
    populateHistoryDetail(payload.record, payload.fenSteps || [], payload.moveHistory || []);
  } catch (error) {
    if (requestId !== state.activeHistoryRequestId) {
      return;
    }

    setApiHealth(false);
    closeHistoryDetail();
    setCoachMessage(error.message);
  } finally {
    if (requestId === state.activeHistoryRequestId) {
      state.historyDetailLoading = false;
    }
  }
};
