const PIECES = {
  white: {
    p: "♙",
    r: "♖",
    n: "♘",
    b: "♗",
    q: "♕",
    k: "♔"
  },
  black: {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚"
  }
};

const difficultySelect = document.getElementById("difficulty-select");
const newGameButton = document.getElementById("new-game-button");
const boardElement = document.getElementById("board");
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

const state = {
  game: null,
  selectedSquare: null,
  pendingPromotion: null,
  busy: false
};

const getChosenColor = () =>
  document.querySelector('input[name="player-color"]:checked')?.value || "white";

const setBusy = (busy, message) => {
  state.busy = busy;
  newGameButton.disabled = busy;
  difficultySelect.disabled = busy;
  colorInputs.forEach((input) => {
    input.disabled = busy;
  });

  if (message) {
    feedbackText.textContent = message;
  }
};

const setApiHealth = (healthy) => {
  apiHealth.textContent = healthy ? "API Ready" : "API Error";
  apiHealth.className = healthy ? "pill pill-ok" : "pill pill-error";
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
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

  const ordered = [];

  ranks.forEach((rank) => {
    files.forEach((file) => {
      const square = `${file}${rank}`;
      ordered.push(lookup.get(square));
    });
  });

  return ordered;
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
};

const openPromotionPrompt = (moveChoices) => {
  state.pendingPromotion = moveChoices;
  promotionPanel.classList.remove("hidden");
  feedbackText.textContent = "Choose a promotion piece.";
};

const renderMoveList = () => {
  if (!state.game?.moveList?.length) {
    moveListElement.innerHTML = '<div class="move-row"><strong>1</strong><span>...</span><span>...</span></div>';
    return;
  }

  moveListElement.innerHTML = state.game.moveList
    .map(
      (move) => `
        <div class="move-row">
          <strong>${move.turn}.</strong>
          <span>${move.white || "-"}</span>
          <span>${move.black || "-"}</span>
        </div>
      `
    )
    .join("");
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
  turnIndicator.textContent =
    state.game.turn === "white" ? "White" : "Black";
  lastMoveText.textContent = state.game.lastMove?.san || "None";
};

const render = () => {
  renderBoard();
  renderMoveList();
  updateSummary();
};

const syncControls = () => {
  if (!state.game) {
    return;
  }

  difficultySelect.value = state.game.settings.difficulty;
  document
    .querySelector(`input[name="player-color"][value="${state.game.settings.playerColor}"]`)
    ?.setAttribute("checked", "checked");
  document
    .querySelectorAll('input[name="player-color"]')
    .forEach((input) => (input.checked = input.value === state.game.settings.playerColor));
};

const applyGameState = (gameState, feedbackMessage) => {
  state.game = gameState;
  state.selectedSquare = null;
  clearPromotionPrompt();
  syncControls();
  render();

  if (feedbackMessage) {
    feedbackText.textContent = feedbackMessage;
  } else if (gameState.lastMove?.captured) {
    feedbackText.textContent = `${gameState.lastMove.san} captured a piece.`;
  } else {
    feedbackText.textContent = gameState.status.message;
  }
};

const loadGame = async () => {
  try {
    const gameState = await request("/api/game");
    setApiHealth(true);
    applyGameState(gameState, "Board ready.");
  } catch (error) {
    setApiHealth(false);
    statusText.textContent = "Unable to load the game.";
    feedbackText.textContent = error.message;
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
  } catch (error) {
    setApiHealth(false);
    feedbackText.textContent = error.message;
  } finally {
    setBusy(false);
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

  if (state.game.isGameOver) {
    feedbackText.textContent = "The game is over. Start a new one to continue.";
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
      renderBoard();
    } else {
      feedbackText.textContent = "Select one of your pieces with a legal move.";
    }

    return;
  }

  if (state.selectedSquare === square) {
    state.selectedSquare = null;
    clearPromotionPrompt();
    feedbackText.textContent = "Selection cleared.";
    renderBoard();
    return;
  }

  if (ownPiece && state.game.legalMoves[square]?.length) {
    state.selectedSquare = square;
    clearPromotionPrompt();
    feedbackText.textContent = `Selected ${square}.`;
    renderBoard();
    return;
  }

  const matchingMoves = getLegalTargets().filter((move) => move.to === square);

  if (!matchingMoves.length) {
    feedbackText.textContent = "Illegal move. Choose a highlighted destination.";
    return;
  }

  if (matchingMoves.length > 1) {
    openPromotionPrompt(matchingMoves);
    renderBoard();
    return;
  }

  submitMove({
    from: state.selectedSquare,
    to: square,
    promotion: matchingMoves[0].promotion || undefined
  });
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

  if (!action || !state.pendingPromotion?.length || !state.selectedSquare) {
    return;
  }

  const chosenMove = state.pendingPromotion.find(
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

newGameButton.addEventListener("click", startNewGame);

loadGame();
