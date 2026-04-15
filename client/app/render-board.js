import { PIECES } from "./constants.js";
import { runtimeState, state } from "./state.js";
import { escapeHtml, formatColor, getResolvedTimeControl, trimTerminalPeriod } from "./formatting.js";
import * as dom from "./dom.js";

let renderBoardDeps = {
  chronicleBadgeSymbols: {},
  pieceLabels: {},
  getArcaneBoard3D: () => null,
  setArcaneBoard3D: () => {},
  getBoardClockColors: () => ({ top: "black", bottom: "white" }),
  getBoardPerspectiveColor: () => "white",
  getBoardRenderFailureReason: () => null,
  getCheckedKingSquare: () => null,
  getClockDisplayState: () => ({ white: null, black: null }),
  getGameOverBannerKey: () => "",
  getGameOverCopy: () => null,
  getIs3DMoveAnimating: () => false,
  getLegalTargets: () => [],
  getLocalPlayerDisplayName: () => "Player",
  getOrderedSquares: () => [],
  getPlyIndexForTurnColor: () => -1,
  getSelectedTimeControlId: () => "untimed",
  getSquareColorClass: () => "square-light",
  handleSquareClick: () => {},
  hideGameOverBanner: () => {},
  isLocalPlayerPly: () => false,
  renderBoardFeedback: () => {},
  renderClockCard: () => {},
  renderPromotionPrompt: () => {},
  resetBoardViewTo2D: () => {},
  resetGameOverBannerLifecycle: () => {},
  scheduleGameOverBannerDismissal: () => {},
  syncBoard3D: () => {},
  updateEvalBar: () => {},
  validate3DBoardInstance: () => false,
  waitForBoardContainerReady: async () => null
};

export const configureRenderBoardDependencies = (deps = {}) => {
  renderBoardDeps = {
    ...renderBoardDeps,
    ...deps
  };
};

export const renderHintPanel = () => {
  if (!dom.hintWhyButton || !dom.hintWhyText) {
    return;
  }

  dom.hintWhyButton.classList.add("hidden");

  const hasHint = Boolean(state.hint?.bestMove) && state.hint?.freshHint === true;
  const hasFreshHint = hasHint && Boolean(state.hint?.requestedThisTurn);
  const hasLine = Array.isArray(state.hint?.continuation) && state.hint.continuation.length > 0;

  dom.hintWhyButton.textContent = state.hint?.whyExpanded ? "Hide Why" : "Why?";
  dom.hintWhyButton.setAttribute("aria-expanded", state.hint?.whyExpanded ? "true" : "false");

  if (hasFreshHint) {
    dom.hintWhyButton.classList.remove("hidden");
  }

  dom.hintWhyButton.disabled = !hasFreshHint;

  if (!hasFreshHint || !state.hint?.whyExpanded) {
    destroyMiniBoardTooltip();
    dom.hintWhyText.textContent = "";
    dom.hintWhyText.classList.add("hidden");
    return;
  }

  const bestMoveLabel = state.hint.bestMove.san || `${state.hint.bestMove.from}${state.hint.bestMove.to}`;
  const lineText = hasLine ? ` Line: ${state.hint.continuation.join(" ")}` : "";
  dom.hintWhyText.textContent = `Hint: ${bestMoveLabel}. ${state.hint.summary}${lineText}`;
  dom.hintWhyText.classList.remove("hidden");
};

export const renderClocks = () => {
  const gameState = state.game;
  const boardClockColors = renderBoardDeps.getBoardClockColors(gameState);
  const playerColor = gameState?.settings?.playerColor || "white";
  const isMultiplayer = gameState?.actorType === "multiplayer";
  const opponentLabel =
    isMultiplayer && (state.multiplayer?.opponentDisplayName || gameState?.settings?.opponentDisplayName)
      ? state.multiplayer?.opponentDisplayName || gameState?.settings?.opponentDisplayName
      : "Stockfish";
  const timeControl = gameState?.hasStarted
    ? getResolvedTimeControl(gameState.settings?.timeControl)
    : getResolvedTimeControl(renderBoardDeps.getSelectedTimeControlId());
  const clockDisplayState = renderBoardDeps.getClockDisplayState(gameState?.clockState);

  renderBoardDeps.renderClockCard({
    labelElement: dom.topClockLabel,
    cardElement: dom.topClockCard,
    sideElement: dom.topClockSide,
    timeElement: dom.topClockTime,
    metaElement: dom.topClockMeta,
    roleLabel: boardClockColors.top === playerColor ? renderBoardDeps.getLocalPlayerDisplayName() : opponentLabel,
    color: boardClockColors.top,
    clockDisplayState,
    timeControl,
    gameState
  });

  renderBoardDeps.renderClockCard({
    labelElement: dom.bottomClockLabel,
    cardElement: dom.bottomClockCard,
    sideElement: dom.bottomClockSide,
    timeElement: dom.bottomClockTime,
    metaElement: dom.bottomClockMeta,
    roleLabel: boardClockColors.bottom === playerColor ? renderBoardDeps.getLocalPlayerDisplayName() : opponentLabel,
    color: boardClockColors.bottom,
    clockDisplayState,
    timeControl,
    gameState
  });

  if (state.boardViewMode === "3d") {
    const hudPlayerClock = document.getElementById("hud-player-clock");
    const hudOpponentClock = document.getElementById("hud-opponent-clock");
    if (hudPlayerClock && dom.bottomClockTime) {
      hudPlayerClock.textContent = dom.bottomClockTime.textContent;
    }
    if (hudOpponentClock && dom.topClockTime) {
      hudOpponentClock.textContent = dom.topClockTime.textContent;
    }
  }
};

export const renderGameOverBanner = () => {
  const gameOverCopy = renderBoardDeps.getGameOverCopy(state.game);

  if (!gameOverCopy) {
    renderBoardDeps.resetGameOverBannerLifecycle();
    renderBoardDeps.hideGameOverBanner({ resetCopy: true });
    return;
  }

  if (state.pendingNewGame || state.boardViewMode === "3d") {
    renderBoardDeps.hideGameOverBanner({ resetCopy: true });
    return;
  }

  const bannerKey = renderBoardDeps.getGameOverBannerKey(state.game);

  if (runtimeState.dismissedGameOverBannerKey === bannerKey) {
    renderBoardDeps.hideGameOverBanner({ resetCopy: true });
    return;
  }

  dom.gameOverTitle.textContent = gameOverCopy.title;
  dom.gameOverMessage.textContent = gameOverCopy.message;
  dom.gameOverBanner.classList.remove("hidden");
  dom.gameOverBanner.setAttribute("aria-hidden", "false");

  if (runtimeState.activeGameOverBannerKey !== bannerKey) {
    runtimeState.activeGameOverBannerKey = bannerKey;
    renderBoardDeps.scheduleGameOverBannerDismissal(bannerKey);
  }
};

export const renderBoardOverlays = () => {
  renderGameOverBanner();
  renderBoardDeps.renderBoardFeedback();

  if (state.pendingPromotion?.moveChoices?.length) {
    renderBoardDeps.renderPromotionPrompt();
    return;
  }

  dom.promotionPanel.classList.add("hidden");
};

const getMoveRatingTone = (classification = "") => {
  if (["blunder", "miss"].includes(classification)) {
    return "bad";
  }

  if (["mistake", "inaccuracy"].includes(classification)) {
    return "warn";
  }

  if (classification === "brilliant") {
    return "brilliant";
  }

  return "good";
};

const getChronicleWhyLineText = (whyLines = []) => {
  const bestLine = Array.isArray(whyLines)
    ? whyLines.find((line) => Array.isArray(line?.san) && line.san.length > 0)
    : null;

  return bestLine ? bestLine.san.join(" ") : "";
};

const renderMoveCell = ({ san, plyIndex, meta, isCurrent, allowRating }) => {
  if (!san) {
    return '<span class="move-cell-content"><span class="move-san">-</span></span>';
  }

  if (!allowRating || !meta?.classification) {
    return `
      <span class="move-cell-content">
        <span class="move-san">${escapeHtml(san)}</span>
      </span>
    `;
  }

  const badgeSymbol = renderBoardDeps.chronicleBadgeSymbols[meta.classification] || "•";
  const tone = getMoveRatingTone(meta.classification);
  const hasWhyLines = Array.isArray(meta.whyLines) && meta.whyLines.length > 0;

  return `
    <span class="move-cell-content">
      <span class="move-san">${escapeHtml(san)}</span>
      <span class="move-rating-badge move-rating-${tone}" title="${escapeHtml(meta.classification)}">${escapeHtml(badgeSymbol)}</span>
      ${
        hasWhyLines
          ? `<button
              type="button"
              class="move-why-toggle${isCurrent ? " move-why-toggle-current" : ""}"
              data-move-why-toggle="${plyIndex}"
              aria-label="Show why line for ${escapeHtml(san)}"
              title="Why line"
            >?</button>`
          : ""
      }
    </span>
  `;
};

const renderMoveRows = (moveList = [], emptyMessage = "No moves recorded yet.", lastMove = null) => {
  if (!moveList.length) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  const currentTurn = moveList.at(-1)?.turn ?? null;
  const currentMoveColor = lastMove?.color || null;

  return `
    <div class="move-row move-row-head" role="presentation">
      <span>Turn</span>
      <span>White</span>
      <span>Black</span>
    </div>
    ${moveList
      .map((move) => {
        const highlightWhite = currentMoveColor === "white" && currentTurn === move.turn && Boolean(move.white);
        const highlightBlack = currentMoveColor === "black" && currentTurn === move.turn && Boolean(move.black);
        const whitePly = renderBoardDeps.getPlyIndexForTurnColor(move.turn, "white");
        const blackPly = renderBoardDeps.getPlyIndexForTurnColor(move.turn, "black");
        const whiteMeta =
          typeof move.whiteRating === "string"
            ? {
                classification: move.whiteRating,
                whyLines: Array.isArray(move.whiteWhyLines) ? move.whiteWhyLines : []
              }
            : null;
        const blackMeta =
          typeof move.blackRating === "string"
            ? {
                classification: move.blackRating,
                whyLines: Array.isArray(move.blackWhyLines) ? move.blackWhyLines : []
              }
            : null;
        const whiteAllowRating = renderBoardDeps.isLocalPlayerPly(whitePly, state.game);
        const blackAllowRating = renderBoardDeps.isLocalPlayerPly(blackPly, state.game);
        const expandedWhyPly = state.liveChronicle.expandedWhyPly;
        const expandedMeta =
          expandedWhyPly === whitePly && whiteAllowRating
            ? whiteMeta
            : expandedWhyPly === blackPly && blackAllowRating
              ? blackMeta
              : null;
        const expandedWhyLine = getChronicleWhyLineText(expandedMeta?.whyLines || []);
        const expandedClassification = expandedMeta?.classification || "";

        return `
        <div class="move-row ${highlightWhite || highlightBlack ? "move-row-current" : ""}">
          <strong class="move-turn">${escapeHtml(`${move.turn}.`)}</strong>
          <span class="move-cell ${highlightWhite ? "move-cell-current" : ""}">${renderMoveCell({
            san: move.white,
            plyIndex: whitePly,
            meta: whiteMeta,
            isCurrent: highlightWhite,
            allowRating: whiteAllowRating
          })}</span>
          <span class="move-cell ${highlightBlack ? "move-cell-current" : ""}">${renderMoveCell({
            san: move.black,
            plyIndex: blackPly,
            meta: blackMeta,
            isCurrent: highlightBlack,
            allowRating: blackAllowRating
          })}</span>
        </div>
        ${
          expandedWhyLine
            ? `<div class="move-why-row">
                <span class="move-why-label">${escapeHtml(expandedClassification)} Why:</span>
                <span class="move-why-line">${escapeHtml(expandedWhyLine)}</span>
              </div>`
            : ""
        }
      `;
      })
      .join("")}
  `;
};

export const renderMoveList = () => {
  destroyMiniBoardTooltip();
  const liveMoveList = state.game?.moveList || state.game?.moves || [];
  dom.moveListElement.innerHTML = renderMoveRows(
    liveMoveList,
    "No moves have been recorded yet.",
    state.game?.lastMove || null
  );
  attachChronicleWhyHoverListeners();
};

const MINI_BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const MINI_BOARD_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const MINI_BOARD_STEP_MS = 800;

const parseFenToBoard = (fen) => {
  const position = fen.split(" ")[0];
  const rows = position.split("/");
  const rankLabels = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const fileLabels = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const board = [];

  rows.forEach((row, rankIndex) => {
    const rank = rankLabels[rankIndex];
    let fileIndex = 0;

    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const count = Number(ch);

        for (let i = 0; i < count; i += 1) {
          const file = fileLabels[fileIndex + i];
          board.push({ square: `${file}${rank}`, file, rank, piece: null });
        }

        fileIndex += count;
      } else {
        const file = fileLabels[fileIndex];
        const color = ch === ch.toUpperCase() ? "white" : "black";
        const type = ch.toLowerCase();
        board.push({ square: `${file}${rank}`, file, rank, piece: { type, color } });
        fileIndex += 1;
      }
    }
  });

  return board;
};

const cloneMiniBoardMap = (boardMap = {}) => {
  const next = {};

  Object.entries(boardMap).forEach(([square, piece]) => {
    next[square] = piece ? { ...piece } : null;
  });

  return next;
};

const getMiniBoardStateFromFen = (fen = "") => {
  const boardData = parseFenToBoard(fen);
  const boardMap = {};

  boardData.forEach((entry) => {
    boardMap[entry.square] = entry.piece ? { ...entry.piece } : null;
  });

  const fenParts = String(fen || "").split(" ");

  return {
    boardMap,
    turn: fenParts[1] === "b" ? "black" : "white",
    enPassant: fenParts[3] && fenParts[3] !== "-" ? fenParts[3] : null
  };
};

const getSquareCoords = (square = "") => ({
  file: square.charCodeAt(0),
  rank: Number(square[1])
});

const sanitizeSanMove = (san = "") =>
  String(san || "")
    .trim()
    .replace(/[+#]+$/g, "")
    .replace(/[!?]+/g, "");

const isPathClear = (boardMap, fromSquare, toSquare) => {
  const from = getSquareCoords(fromSquare);
  const to = getSquareCoords(toSquare);
  const fileStep = Math.sign(to.file - from.file);
  const rankStep = Math.sign(to.rank - from.rank);
  let file = from.file + fileStep;
  let rank = from.rank + rankStep;

  while (file !== to.file || rank !== to.rank) {
    const square = `${String.fromCharCode(file)}${rank}`;

    if (boardMap[square]) {
      return false;
    }

    file += fileStep;
    rank += rankStep;
  }

  return true;
};

const canPieceReachTarget = ({ boardMap, fromSquare, toSquare, piece, isCapture, sideToMove, enPassantSquare }) => {
  const from = getSquareCoords(fromSquare);
  const to = getSquareCoords(toSquare);
  const fileDiff = to.file - from.file;
  const rankDiff = to.rank - from.rank;
  const absFile = Math.abs(fileDiff);
  const absRank = Math.abs(rankDiff);
  const targetPiece = boardMap[toSquare] || null;

  if (targetPiece?.color === piece.color) {
    return false;
  }

  if (piece.type === "p") {
    const direction = sideToMove === "white" ? 1 : -1;
    const startRank = sideToMove === "white" ? 2 : 7;
    const oneStepSquare = `${fromSquare[0]}${from.rank + direction}`;

    if (isCapture) {
      const isDiagonal = absFile === 1 && rankDiff === direction;
      const capturesEnPassant = !targetPiece && enPassantSquare && enPassantSquare === toSquare;
      return isDiagonal && Boolean(targetPiece || capturesEnPassant);
    }

    if (fileDiff !== 0 || targetPiece) {
      return false;
    }

    if (rankDiff === direction) {
      return true;
    }

    return from.rank === startRank && rankDiff === direction * 2 && !boardMap[oneStepSquare];
  }

  if (piece.type === "n") {
    return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  }

  if (piece.type === "k") {
    return absFile <= 1 && absRank <= 1;
  }

  if (piece.type === "b") {
    return absFile === absRank && isPathClear(boardMap, fromSquare, toSquare);
  }

  if (piece.type === "r") {
    return (fileDiff === 0 || rankDiff === 0) && isPathClear(boardMap, fromSquare, toSquare);
  }

  if (piece.type === "q") {
    const diagonal = absFile === absRank;
    const straight = fileDiff === 0 || rankDiff === 0;
    return (diagonal || straight) && isPathClear(boardMap, fromSquare, toSquare);
  }

  return false;
};

const resolveSanMove = ({ boardMap, san, sideToMove, enPassantSquare }) => {
  const cleanedSan = sanitizeSanMove(san);

  if (!cleanedSan) {
    return null;
  }

  if (cleanedSan === "O-O" || cleanedSan === "0-0") {
    return sideToMove === "white"
      ? { from: "e1", to: "g1", pieceType: "k", isCastle: "king" }
      : { from: "e8", to: "g8", pieceType: "k", isCastle: "king" };
  }

  if (cleanedSan === "O-O-O" || cleanedSan === "0-0-0") {
    return sideToMove === "white"
      ? { from: "e1", to: "c1", pieceType: "k", isCastle: "queen" }
      : { from: "e8", to: "c8", pieceType: "k", isCastle: "queen" };
  }

  const sanMatch = cleanedSan.match(/^([KQRBN])?([a-h1-8]{0,2})(x)?([a-h][1-8])(=?[QRBN])?$/);

  if (!sanMatch) {
    return null;
  }

  const [, pieceLetter, disambiguation, captureFlag, targetSquare, promotionPart] = sanMatch;
  const pieceType = pieceLetter ? pieceLetter.toLowerCase() : "p";
  const isCapture = captureFlag === "x";
  const promotion = promotionPart ? promotionPart.replace("=", "").toLowerCase() : null;
  const candidateSquares = Object.entries(boardMap)
    .filter(([, piece]) => piece && piece.color === sideToMove && piece.type === pieceType)
    .map(([square]) => square)
    .filter((square) =>
      canPieceReachTarget({
        boardMap,
        fromSquare: square,
        toSquare: targetSquare,
        piece: boardMap[square],
        isCapture,
        sideToMove,
        enPassantSquare
      })
    )
    .filter((square) => {
      if (!disambiguation) {
        return true;
      }

      if (disambiguation.length === 2) {
        return square === disambiguation;
      }

      const qualifier = disambiguation[0];
      return /[a-h]/.test(qualifier) ? square[0] === qualifier : square[1] === qualifier;
    });

  if (!candidateSquares.length) {
    return null;
  }

  return {
    from: candidateSquares[0],
    to: targetSquare,
    pieceType,
    promotion,
    isCapture
  };
};

const applyMiniBoardMove = ({ boardMap, resolvedMove, sideToMove, enPassantSquare }) => {
  if (!resolvedMove?.from || !resolvedMove?.to) {
    return null;
  }

  const nextBoardMap = cloneMiniBoardMap(boardMap);
  const movingPiece = nextBoardMap[resolvedMove.from] ? { ...nextBoardMap[resolvedMove.from] } : null;

  if (!movingPiece) {
    return null;
  }

  nextBoardMap[resolvedMove.from] = null;

  if (movingPiece.type === "p" && resolvedMove.isCapture && !nextBoardMap[resolvedMove.to]) {
    const to = getSquareCoords(resolvedMove.to);
    const capturedRank = sideToMove === "white" ? to.rank - 1 : to.rank + 1;
    const capturedSquare = `${resolvedMove.to[0]}${capturedRank}`;
    nextBoardMap[capturedSquare] = null;
  }

  if (resolvedMove.isCastle === "king" || resolvedMove.isCastle === "queen") {
    if (sideToMove === "white") {
      if (resolvedMove.isCastle === "king") {
        nextBoardMap.h1 = null;
        nextBoardMap.f1 = { type: "r", color: "white" };
      } else {
        nextBoardMap.a1 = null;
        nextBoardMap.d1 = { type: "r", color: "white" };
      }
    } else if (resolvedMove.isCastle === "king") {
      nextBoardMap.h8 = null;
      nextBoardMap.f8 = { type: "r", color: "black" };
    } else {
      nextBoardMap.a8 = null;
      nextBoardMap.d8 = { type: "r", color: "black" };
    }
  }

  const promotedType = movingPiece.type === "p" ? resolvedMove.promotion || movingPiece.type : movingPiece.type;
  nextBoardMap[resolvedMove.to] = {
    type: promotedType,
    color: movingPiece.color
  };

  const fromCoords = getSquareCoords(resolvedMove.from);
  const toCoords = getSquareCoords(resolvedMove.to);
  let nextEnPassant = null;

  if (movingPiece.type === "p" && Math.abs(toCoords.rank - fromCoords.rank) === 2) {
    const intermediateRank = (toCoords.rank + fromCoords.rank) / 2;
    nextEnPassant = `${resolvedMove.from[0]}${intermediateRank}`;
  }

  return {
    boardMap: nextBoardMap,
    from: resolvedMove.from,
    to: resolvedMove.to,
    ghostPiece: {
      ...movingPiece
    },
    turn: sideToMove === "white" ? "black" : "white",
    enPassant: nextEnPassant
  };
};

const createMiniBoardUI = ({ title = "Why line preview" } = {}) => {
  const root = document.createElement("div");
  root.className = "mini-board-tooltip";
  root.setAttribute("role", "tooltip");

  const heading = document.createElement("div");
  heading.className = "mini-board-heading";
  heading.textContent = title;
  root.appendChild(heading);

  const board = document.createElement("div");
  board.className = "mini-board-grid";
  root.appendChild(board);

  const squareNodes = {};

  MINI_BOARD_RANKS.forEach((rank) => {
    MINI_BOARD_FILES.forEach((file) => {
      const square = `${file}${rank}`;
      const squareNode = document.createElement("div");
      squareNode.className = `mini-board-square ${renderBoardDeps.getSquareColorClass(square).replace("square", "mini-board")}`;
      squareNode.dataset.square = square;

      const pieceNode = document.createElement("span");
      pieceNode.className = "mini-board-piece";
      const ghostNode = document.createElement("span");
      ghostNode.className = "mini-board-piece ghost-piece";
      squareNode.appendChild(ghostNode);
      squareNode.appendChild(pieceNode);
      board.appendChild(squareNode);
      squareNodes[square] = {
        squareNode,
        ghostNode,
        pieceNode
      };
    });
  });

  return {
    root,
    squareNodes
  };
};

const renderMiniBoardPosition = (tooltipState, { lastFrom = "", lastTo = "", ghostSquare = "", ghostPiece = null } = {}) => {
  Object.entries(tooltipState.squareNodes).forEach(([square, refs]) => {
    const piece = tooltipState.boardMap[square];
    const hasGhost = Boolean(ghostSquare) && ghostSquare === square && ghostPiece;

    refs.squareNode.classList.toggle("mini-board-last-from", square === lastFrom);
    refs.squareNode.classList.toggle("mini-board-last-to", square === lastTo);
    refs.ghostNode.textContent = hasGhost ? PIECES[ghostPiece.color][ghostPiece.type] : "";
    refs.ghostNode.classList.toggle("mini-board-piece-white", Boolean(hasGhost && ghostPiece.color === "white"));
    refs.ghostNode.classList.toggle("mini-board-piece-black", Boolean(hasGhost && ghostPiece.color === "black"));
    refs.pieceNode.textContent = piece ? PIECES[piece.color][piece.type] : "";
    refs.pieceNode.classList.toggle("mini-board-piece-white", piece?.color === "white");
    refs.pieceNode.classList.toggle("mini-board-piece-black", piece?.color === "black");
  });
};

let miniBoardUI = null;

const ensureMiniBoardUI = ({ title = "Why line preview" } = {}) => {
  if (!miniBoardUI) {
    miniBoardUI = createMiniBoardUI({ title });
    miniBoardUI.root.style.display = "none";
    miniBoardUI.root.style.pointerEvents = "auto";
    document.body.appendChild(miniBoardUI.root);
  }

  return miniBoardUI;
};

const positionMiniBoardTooltip = (tooltipElement, anchorElement) => {
  const margin = 10;
  const anchorRect = anchorElement.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
  let top = anchorRect.bottom + 8;

  if (left + tooltipRect.width > viewportWidth - margin) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  if (left < margin) {
    left = margin;
  }

  if (top + tooltipRect.height > viewportHeight - margin) {
    top = anchorRect.top - tooltipRect.height - 8;
  }

  if (top < margin) {
    top = margin;
  }

  tooltipElement.style.left = `${Math.round(left)}px`;
  tooltipElement.style.top = `${Math.round(top)}px`;
};

const clearMiniBoardTooltipTimer = () => {
  if (runtimeState.activeMiniBoardTooltip?.timerId) {
    window.clearTimeout(runtimeState.activeMiniBoardTooltip.timerId);
  }
};

export const hideMiniBoard = () => {
  clearMiniBoardTooltipTimer();

  if (runtimeState.activeMiniBoardTooltip?.root) {
    runtimeState.activeMiniBoardTooltip.root.style.display = "none";
  }

  runtimeState.activeMiniBoardTooltip = null;
};

export const showMiniBoard = ({ anchorElement, label } = {}) => {
  const ui = ensureMiniBoardUI({ title: label || "Why line preview" });

  ui.root.style.display = "block";

  if (anchorElement) {
    positionMiniBoardTooltip(ui.root, anchorElement);
  }

  return ui.root;
};

const scheduleMiniBoardStep = (tooltipState, delayMs = MINI_BOARD_STEP_MS) => {
  clearMiniBoardTooltipTimer();
  tooltipState.timerId = window.setTimeout(() => {
    if (runtimeState.activeMiniBoardTooltip !== tooltipState) {
      return;
    }

    if (!tooltipState.continuation.length) {
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    if (tooltipState.stepIndex >= tooltipState.continuation.length) {
      tooltipState.boardMap = cloneMiniBoardMap(tooltipState.initialBoardMap);
      tooltipState.turn = tooltipState.initialTurn;
      tooltipState.enPassant = tooltipState.initialEnPassant;
      tooltipState.stepIndex = 0;
      renderMiniBoardPosition(tooltipState, {
        ghostSquare: "",
        ghostPiece: null
      });
      scheduleMiniBoardStep(tooltipState, 440);
      return;
    }

    const san = tooltipState.continuation[tooltipState.stepIndex];
    const resolvedMove = resolveSanMove({
      boardMap: tooltipState.boardMap,
      san,
      sideToMove: tooltipState.turn,
      enPassantSquare: tooltipState.enPassant
    });

    if (!resolvedMove) {
      tooltipState.stepIndex += 1;
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    const applied = applyMiniBoardMove({
      boardMap: tooltipState.boardMap,
      resolvedMove,
      sideToMove: tooltipState.turn,
      enPassantSquare: tooltipState.enPassant
    });

    if (!applied) {
      tooltipState.stepIndex += 1;
      scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
      return;
    }

    tooltipState.boardMap = applied.boardMap;
    tooltipState.turn = applied.turn;
    tooltipState.enPassant = applied.enPassant;
    tooltipState.stepIndex += 1;
    renderMiniBoardPosition(tooltipState, {
      lastFrom: applied.from,
      lastTo: applied.to,
      ghostSquare: applied.from,
      ghostPiece: applied.ghostPiece || null
    });
    scheduleMiniBoardStep(tooltipState, MINI_BOARD_STEP_MS);
  }, delayMs);
};

export const animateMiniBoard = (fen, continuation, label) => {
  if (!fen || !Array.isArray(continuation) || !continuation.length) {
    return;
  }

  const filteredContinuation = continuation
    .map((move) => String(move || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!filteredContinuation.length) {
    return;
  }

  clearMiniBoardTooltipTimer();
  runtimeState.activeMiniBoardTooltip = null;
  runtimeState.miniBoardHoverToken += 1;

  const baseState = getMiniBoardStateFromFen(fen);
  const ui = ensureMiniBoardUI({
    title: label || "Why line preview"
  });
  ui.root.style.display = "block";

  const tooltipState = {
    id: runtimeState.miniBoardHoverToken,
    root: ui.root,
    squareNodes: ui.squareNodes,
    timerId: null,
    continuation: filteredContinuation,
    initialBoardMap: cloneMiniBoardMap(baseState.boardMap),
    boardMap: cloneMiniBoardMap(baseState.boardMap),
    initialTurn: baseState.turn,
    turn: baseState.turn,
    initialEnPassant: baseState.enPassant,
    enPassant: baseState.enPassant,
    stepIndex: 0
  };

  runtimeState.activeMiniBoardTooltip = tooltipState;
  renderMiniBoardPosition(tooltipState);
  scheduleMiniBoardStep(tooltipState, 360);

  return ui.root;
};

export const showMiniBoardTooltip = ({ anchorElement, fen, continuation, label }) => {
  showMiniBoard({ anchorElement, label });
  return animateMiniBoard(fen, continuation, label);
};

export const destroyMiniBoardTooltip = () => {
  hideMiniBoard();
};

const getPrimaryWhyLineSan = (whyLines = []) => {
  const bestLine = Array.isArray(whyLines)
    ? whyLines.find((line) => Array.isArray(line?.san) && line.san.length > 0)
    : null;

  return bestLine?.san || [];
};

const attachChronicleWhyHoverListeners = () => {
  if (!dom.moveListElement) {
    return;
  }

  dom.moveListElement.querySelectorAll("[data-move-why-toggle]").forEach((button) => {
    if (button.dataset.hoverVisualizerBound === "true") {
      return;
    }

    button.dataset.hoverVisualizerBound = "true";

    button.addEventListener("mouseenter", () => {
      const plyIndex = Number.parseInt(button.dataset.moveWhyToggle || "", 10);

      if (!Number.isInteger(plyIndex) || plyIndex < 0) {
        return;
      }

      const moveMeta = state.liveChronicle.ratingsByPly[plyIndex];
      const continuation = getPrimaryWhyLineSan(moveMeta?.whyLines || []);
      const fen = moveMeta?.beforeFen || "";

      showMiniBoardTooltip({
        anchorElement: button,
        fen,
        continuation,
        label: "Chronicle Why Line"
      });
    });

    button.addEventListener("mouseleave", () => {
      destroyMiniBoardTooltip();
    });
  });
};

export const renderBoard = () => {
  const legalTargets = renderBoardDeps.getLegalTargets();
  const targetSquares = new Map(legalTargets.map((move) => [move.to, move]));
  const orderedSquares = renderBoardDeps.getOrderedSquares();
  const incompleteSquareData = orderedSquares.length !== 64 || orderedSquares.some((entry) => !entry || !entry.square);

  if (incompleteSquareData) {
    console.log("Skipping board render: square data is incomplete");
    return;
  }

  const lastMove = state.game?.lastMove || null;
  const checkedKingSquare = renderBoardDeps.getCheckedKingSquare(state.game);
  const playerColor = state.game?.settings?.playerColor || "white";
  const isPlayerTurn = state.game?.turn === playerColor;
  const canInteract = !state.busy && !state.game?.isGameOver && !state.pendingPromotion?.moveChoices?.length;

  dom.boardElement.innerHTML = orderedSquares
    .map((entry, index) => {
      const moveTarget = targetSquares.get(entry.square);
      const colorClass = renderBoardDeps.getSquareColorClass(entry.square);
      const isSelected = state.selectedSquare === entry.square;
      const isLastFrom = lastMove?.from === entry.square;
      const isLastTo = lastMove?.to === entry.square;
      const isCheckedKing = checkedKingSquare === entry.square;
      const isOwnPiece = entry.piece?.color === playerColor;
      const isSelectable =
        canInteract && isPlayerTurn && isOwnPiece && Boolean(state.game?.legalMoves?.[entry.square]?.length);
      const squareClasses = ["square", colorClass];

      if (moveTarget) {
        squareClasses.push(moveTarget.captured ? "square-capture" : "square-target");
        squareClasses.push("square-legal-destination");
      }

      if (isSelected) {
        squareClasses.push("square-selected");
      }

      if (isLastFrom) {
        squareClasses.push("square-last-from");
      }

      if (isLastTo) {
        squareClasses.push("square-last-to");
      }

      if (isCheckedKing) {
        squareClasses.push("square-check");
      }

      if (state.hint?.bestMove?.from === entry.square) {
        squareClasses.push("square-hint-from");
      }

      if (state.hint?.bestMove?.to === entry.square) {
        squareClasses.push("square-hint-to");
      }

      if (isSelectable) {
        squareClasses.push("square-selectable");
      }

      const file = entry.square?.[0] || "";
      const rank = entry.square?.[1] || "";
      const fileLabel = index >= 56 ? `<span class="square-label square-file">${file}</span>` : "";
      const rankLabel = index % 8 === 0 ? `<span class="square-label square-rank">${rank}</span>` : "";
      const pieceDescription = entry.piece
        ? `${formatColor(entry.piece.color)} ${renderBoardDeps.pieceLabels[entry.piece.type] || "piece"}`
        : "empty square";
      const ariaStates = [];

      if (isSelected) {
        ariaStates.push("selected");
      }

      if (moveTarget) {
        ariaStates.push(moveTarget.captured ? "capture available" : "legal destination");
      }

      if (isLastFrom || isLastTo) {
        ariaStates.push("part of the last move");
      }

      if (isCheckedKing) {
        ariaStates.push("king in check");
      }

      const ariaLabel = [entry.square, pieceDescription, ...ariaStates].join(", ");

      return `
        <button
          type="button"
          class="${squareClasses.join(" ")}"
          data-square="${entry.square}"
          aria-label="${escapeHtml(ariaLabel)}"
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

  renderBoardDeps.updateEvalBar();
};

export const renderBoardSurface = () => {
  if (state.view !== "game") {
    return;
  }

  if (state.viewMode === "3D") {
    renderBoardDeps.syncBoard3D();
    renderBoardOverlays();
    return;
  }

  const boardPanel = document.querySelector("#game-view .board-panel");
  const boardStage = document.querySelector("#game-view .board-stage");
  const boardContainerElement = document.querySelector("#game-view .board-container");
  const gameBoardShell = document.querySelector("#game-view .board-shell");
  const boardSurface = document.getElementById("board");
  const boardContainer = boardContainerElement || gameBoardShell || dom.boardElement?.parentElement || null;
  const boardState = state.game?.board;
  const boardStateFailureReason = renderBoardDeps.getBoardRenderFailureReason(boardState);
  const boardStageRows = Array.from(document.querySelectorAll("#game-view .board-stage .board-player-row") || []);
  const boardRowsHeight = boardStageRows.reduce((totalHeight, row) => totalHeight + (row?.offsetHeight || 0), 0);
  const boardShellWrap = document.querySelector("#game-view .board-shell-wrap");
  const boardStackHeight = boardRowsHeight + (boardShellWrap?.offsetHeight || 0);
  const logBox = (label, element) => {
    if (!element) {
      console.log(label, null);
      return;
    }

    const computedStyle = window.getComputedStyle(element);
    console.log(label, {
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      width: computedStyle.width,
      height: computedStyle.height
    });
  };

  console.log("Rendering board in view:", state.view);
  logBox("Board panel", boardPanel);
  logBox("Board stage", boardStage);
  logBox("Board shell", dom.boardShell);
  logBox("Board container", boardContainer);
  logBox("Board surface", boardSurface);
  console.log("boardPanel offsetHeight", boardPanel?.offsetHeight ?? 0);
  console.log("boardStage offsetHeight", boardStage?.offsetHeight ?? 0);
  console.log("Board stack height", boardStackHeight);

  if (boardPanel) {
    const boardPanelStyle = window.getComputedStyle(boardPanel);
    console.log("Board panel layout", {
      justifyContent: boardPanelStyle.justifyContent,
      alignItems: boardPanelStyle.alignItems
    });
  }

  console.log("Board final size:", boardContainer?.offsetWidth ?? 0, boardContainer?.offsetHeight ?? 0);
  console.log("Board state ready:", !boardStateFailureReason, boardState?.length);

  if (!boardSurface) {
    console.log("Skipping board render: board surface element is missing");
    return;
  }

  if (!boardContainer) {
    console.log("Skipping board render: board container is missing");
    return;
  }

  if (boardContainer.offsetWidth <= 0 || boardContainer.offsetHeight <= 0) {
    console.log("Skipping board render: board container has zero size");
    return;
  }

  if (boardStateFailureReason) {
    console.log("Skipping board render:", boardStateFailureReason);
    return;
  }

  renderBoard();
  renderBoardOverlays();
};

export const switchTo3D = async () => {
  const boardContainer = await renderBoardDeps.waitForBoardContainerReady();

  if (!boardContainer || state.view !== "game") {
    throw new Error("3D board container is not ready in game view.");
  }

  if (!dom.board3dElement) {
    throw new Error("3D board container is unavailable.");
  }

  if (dom.board3dElement.offsetWidth <= 0 || dom.board3dElement.offsetHeight <= 0) {
    throw new Error("3D board container has no visible size.");
  }

  if (typeof window.ArcaneBoardV2 !== "function") {
    throw new Error("3D renderer is unavailable.");
  }

  let arcaneBoard3D = renderBoardDeps.getArcaneBoard3D();

  if (arcaneBoard3D && !renderBoardDeps.validate3DBoardInstance()) {
    arcaneBoard3D.destroy?.();
    arcaneBoard3D = null;
    renderBoardDeps.setArcaneBoard3D(null);
  }

  try {
    if (!arcaneBoard3D) {
      const staleCanvases = dom.board3dElement.querySelectorAll("canvas");

      if (staleCanvases.length) {
        staleCanvases.forEach((canvas) => canvas.remove());
      }

      arcaneBoard3D = new window.ArcaneBoardV2(dom.board3dElement);
      arcaneBoard3D.init();
      renderBoardDeps.setArcaneBoard3D(arcaneBoard3D);
    }
  } catch (error) {
    arcaneBoard3D?.destroy?.();
    arcaneBoard3D = null;
    renderBoardDeps.setArcaneBoard3D(null);
    console.warn("[board] 3D init failed health check");
    throw error;
  }

  if (!renderBoardDeps.validate3DBoardInstance({ logFailure: true })) {
    arcaneBoard3D?.destroy?.();
    arcaneBoard3D = null;
    renderBoardDeps.setArcaneBoard3D(null);
    throw new Error("3D renderer failed health check.");
  }

  console.log("[board] 3D init passed health check");

  arcaneBoard3D?._onResize?.();
  arcaneBoard3D.setPerspective?.(renderBoardDeps.getBoardPerspectiveColor());

  if (state.game && state.game.board && !renderBoardDeps.getIs3DMoveAnimating()) {
    arcaneBoard3D.setPosition(state.game.board);
    const legalForSelected =
      state.selectedSquare && state.game.legalMoves
        ? (state.game.legalMoves[state.selectedSquare] || []).map((move) => move.to)
        : [];
    arcaneBoard3D.highlightSquares(state.selectedSquare, legalForSelected, state.hint?.bestMove || null);
  }

  if (state.game && state.game.lastMove && !renderBoardDeps.getIs3DMoveAnimating()) {
    arcaneBoard3D.setLastMove(state.game.lastMove.from, state.game.lastMove.to);
  }

  arcaneBoard3D.onSquareClick((square) => {
    renderBoardDeps.handleSquareClick(square);
  });

  document.getElementById("hud-player-name")?.remove();
  document.getElementById("hud-opponent-name")?.remove();

  const playerColor = renderBoardDeps.getBoardPerspectiveColor();
  const playerName = renderBoardDeps.getLocalPlayerDisplayName();

  const playerPlate = document.createElement("div");
  playerPlate.id = "hud-player-name";
  playerPlate.style.cssText = `
    position:absolute; bottom:16px; left:20px;
    color:#c9a84c; font-size:0.8rem; letter-spacing:0.08em;
    text-transform:uppercase; pointer-events:none; z-index:1002;
    text-shadow: 0 0 8px rgba(201,168,76,0.6);
  `;
  playerPlate.innerHTML = `<span style="display:block;margin-bottom:2px">${playerName} · ${playerColor}</span><span id="hud-player-clock" style="font-size:0.85rem;color:#c9a84c;letter-spacing:0.06em;font-family:inherit"></span>`;
  dom.board3dElement.appendChild(playerPlate);

  const opponentPlate = document.createElement("div");
  opponentPlate.id = "hud-opponent-name";
  opponentPlate.style.cssText = `
    position:absolute; top:16px; left:20px;
    color:#8a7a5a; font-size:0.8rem; letter-spacing:0.08em;
    text-transform:uppercase; pointer-events:none; z-index:1002;
    text-shadow: 0 0 6px rgba(100,80,40,0.5);
  `;
  const opponentName =
    state.game?.settings?.opponentDisplayName ||
    state.game?.settings?.opponentName ||
    state.game?.settings?.engineName ||
    "Stockfish";
  const opponentColor = playerColor === "white" ? "black" : "white";
  opponentPlate.innerHTML = `<span style="display:block;margin-bottom:2px">${opponentName} · ${opponentColor}</span><span id="hud-opponent-clock" style="font-size:0.85rem;color:#8a7a5a;letter-spacing:0.06em;font-family:inherit"></span>`;
  dom.board3dElement.appendChild(opponentPlate);

  if (!dom.board3dElement.dataset.arcaneHoverBound) {
    dom.board3dElement.addEventListener("mousemove", (e) => {
      const boardInstance = renderBoardDeps.getArcaneBoard3D();

      if (!boardInstance || state.boardViewMode !== "3d") {
        return;
      }

      if (!state.game || state.game.isGameOver) {
        return;
      }

      const rect = dom.board3dElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!boardInstance.raycaster || !boardInstance.camera) {
        return;
      }

      boardInstance.raycaster.setFromCamera({ x, y }, boardInstance.camera);
      const squares = Array.from(boardInstance.squareMeshes?.values() || []);
      const pieces = [];

      boardInstance.pieces?.forEach(({ mesh }) => {
        mesh.traverse((child) => {
          if (child.isMesh) {
            pieces.push(child);
          }
        });
      });

      const hits = boardInstance.raycaster.intersectObjects([...pieces, ...squares], false);

      if (!hits.length) {
        boardInstance.clearThreatLines?.();
        return;
      }

      let hoveredSquare = null;
      let obj = hits[0].object;

      while (obj && !obj.userData?.square) {
        obj = obj.parent;
      }

      if (obj?.userData?.square) {
        hoveredSquare = obj.userData.square;
      }

      if (!hoveredSquare) {
        boardInstance.clearThreatLines?.();
        return;
      }

      const legalMoves = state.game.legalMoves?.[hoveredSquare] || [];

      if (!legalMoves.length) {
        boardInstance.clearThreatLines?.();
        return;
      }

      boardInstance.selectedSquare = hoveredSquare;
      boardInstance.showThreatLines?.(legalMoves.map((move) => move.to));
    });

    dom.board3dElement.addEventListener("mouseleave", () => {
      renderBoardDeps.getArcaneBoard3D()?.clearThreatLines?.();
    });

    dom.board3dElement.dataset.arcaneHoverBound = "true";
  }
};

export const switchTo2D = () => {
  renderBoardDeps.resetBoardViewTo2D();

  if (state.view === "game") {
    renderBoard();
  }
};