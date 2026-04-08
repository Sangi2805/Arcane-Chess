const { Chess } = require("chess.js");

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const COLOR_LABELS = {
  w: "white",
  b: "black"
};
const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

const DEFAULT_PROMOTION = "q";
const FEN_POSITION_FIELDS = 4;
const CLAIMABLE_DRAW_REASON_DEFINITIONS = [
  {
    code: "repetition",
    statusCode: "draw-repetition",
    outcomeLabel: "Draw by repetition"
  },
  {
    code: "fifty-move-rule",
    statusCode: "draw-fifty-move",
    outcomeLabel: "Draw by fifty-move rule"
  }
];

const createStatus = (code, message, extras = {}) => ({
  code,
  message,
  ...extras
});

const setInitialFenMarker = (chess, fen) => {
  chess.__arcaneInitialFen = fen;
  return chess;
};

const createChessGame = () => setInitialFenMarker(new Chess(), new Chess().fen());

const restoreChessGame = ({ fen, pgn } = {}) => {
  const chess = createChessGame();

  if (pgn) {
    chess.loadPgn(pgn);
    setInitialFenMarker(chess, new Chess().fen());
    return chess;
  }

  if (fen) {
    chess.load(fen);
    setInitialFenMarker(chess, fen);
  }

  return chess;
};

const getColorLabel = (color) => COLOR_LABELS[color] || "white";

const getDefaultPromotion = (move) => {
  const isPawnMove = move.piece === "p";
  const reachesBackRank = ["1", "8"].includes(move.to?.[1]);

  return isPawnMove && reachesBackRank ? DEFAULT_PROMOTION : undefined;
};

const getFenPositionKey = (fen = "") =>
  fen
    .split(" ")
    .slice(0, FEN_POSITION_FIELDS)
    .join(" ");

const getHalfMoveClock = (chess) => {
  const halfMoveClock = Number.parseInt(chess.fen().split(" ")[4], 10);

  return Number.isFinite(halfMoveClock) ? halfMoveClock : 0;
};

const getCurrentPositionRepetitionCount = (chess) => {
  const history = chess.history({ verbose: true });
  const replay = createChessGame();
  const initialFen = chess.__arcaneInitialFen;

  if (initialFen && initialFen !== replay.fen()) {
    replay.load(initialFen);
    setInitialFenMarker(replay, initialFen);
  }

  const positionCounts = new Map([[getFenPositionKey(replay.fen()), 1]]);

  history.forEach((move) => {
    replay.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || undefined
    });

    const positionKey = getFenPositionKey(replay.fen());
    positionCounts.set(positionKey, (positionCounts.get(positionKey) || 0) + 1);
  });

  return positionCounts.get(getFenPositionKey(chess.fen())) || 1;
};

const buildDrawClaimReasons = ({
  repetitionCount,
  halfMoveClock,
  fivefoldRepetition,
  seventyFiveMoveRule
}) => {
  const claimReasons = [];

  if (repetitionCount >= 3 && !fivefoldRepetition) {
    claimReasons.push(CLAIMABLE_DRAW_REASON_DEFINITIONS[0]);
  }

  if (halfMoveClock >= 100 && !seventyFiveMoveRule) {
    claimReasons.push(CLAIMABLE_DRAW_REASON_DEFINITIONS[1]);
  }

  return claimReasons;
};

const getDrawClaimState = ({
  repetitionCount,
  halfMoveClock,
  fivefoldRepetition,
  seventyFiveMoveRule
}) => {
  const reasons = buildDrawClaimReasons({
    repetitionCount,
    halfMoveClock,
    fivefoldRepetition,
    seventyFiveMoveRule
  });
  const primaryReason = reasons[0] || null;

  return {
    available: reasons.length > 0,
    reasons,
    primaryReasonCode: primaryReason?.code || null,
    primaryStatusCode: primaryReason?.statusCode || null,
    outcomeLabel: primaryReason?.outcomeLabel || null,
    message:
      reasons.length > 1
        ? "Draw can be claimed by repetition or fifty-move rule."
        : primaryReason
          ? `${primaryReason.outcomeLabel} can be claimed.`
          : null
  };
};

const getRuleState = (chess) => {
  const halfMoveClock = getHalfMoveClock(chess);
  const repetitionCount = getCurrentPositionRepetitionCount(chess);
  const check = chess.isCheck();
  const checkmate = chess.isCheckmate();
  const stalemate = chess.isStalemate();
  const insufficientMaterial = chess.isInsufficientMaterial();
  const threefoldRepetition = repetitionCount >= 3;
  const fivefoldRepetition = repetitionCount >= 5;
  const fiftyMoveRule = halfMoveClock >= 100;
  const seventyFiveMoveRule = halfMoveClock >= 150;
  const drawClaim = getDrawClaimState({
    repetitionCount,
    halfMoveClock,
    fivefoldRepetition,
    seventyFiveMoveRule
  });
  const automaticDraw =
    stalemate ||
    insufficientMaterial ||
    fivefoldRepetition ||
    seventyFiveMoveRule;

  return {
    activeColor: getColorLabel(chess.turn()),
    checkedColor: check || checkmate ? getColorLabel(chess.turn()) : null,
    check,
    checkmate,
    stalemate,
    insufficientMaterial,
    halfMoveClock,
    repetitionCount,
    threefoldRepetition,
    fivefoldRepetition,
    fiftyMoveRule,
    seventyFiveMoveRule,
    automaticDraw,
    drawClaim,
    isGameOver: checkmate || automaticDraw
  };
};

const normalizeMoveInput = (move) => {
  if (!move || !move.from || !move.to) {
    throw new Error("A move requires both from and to squares.");
  }

  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion || getDefaultPromotion(move)
  };
};

const applyMove = (chess, move) => {
  const candidateMoves = chess.moves({ verbose: true });
  const matchingMove = candidateMoves.find(
    (candidate) => candidate.from === move.from && candidate.to === move.to
  );

  if (!matchingMove) {
    return null;
  }

  return chess.move(
    normalizeMoveInput({
      ...move,
      piece: matchingMove.piece
    })
  );
};

const getLegalMovesMap = (chess) => {
  const legalMoves = {};

  chess.moves({ verbose: true }).forEach((move) => {
    if (!legalMoves[move.from]) {
      legalMoves[move.from] = [];
    }

    legalMoves[move.from].push({
      to: move.to,
      san: move.san,
      flags: move.flags,
      promotion: move.promotion || null,
      piece: move.piece,
      captured: move.captured || null
    });
  });

  return legalMoves;
};

const getBoardSquares = (chess) => {
  const board = chess.board();
  const squares = [];

  board.forEach((rank, rankIndex) => {
    rank.forEach((piece, fileIndex) => {
      const square = `${FILES[fileIndex]}${RANKS[rankIndex]}`;

      squares.push({
        square,
        file: FILES[fileIndex],
        rank: RANKS[rankIndex],
        piece: piece
          ? {
              type: piece.type,
              color: getColorLabel(piece.color)
            }
          : null
      });
    });
  });

  return squares;
};

const getMaterialBalance = (chess) => {
  const board = chess.board();

  return board.reduce((balance, rank) => {
    return (
      balance +
      rank.reduce((rankBalance, piece) => {
        if (!piece) {
          return rankBalance;
        }

        const value = PIECE_VALUES[piece.type] || 0;
        return rankBalance + (piece.color === "w" ? value : -value);
      }, 0)
    );
  }, 0);
};

const getMoveList = (chess) => {
  const history = chess.history({ verbose: true });
  const moveList = [];

  for (let index = 0; index < history.length; index += 2) {
    moveList.push({
      turn: Math.floor(index / 2) + 1,
      white: history[index]?.san || null,
      black: history[index + 1]?.san || null
    });
  }

  return moveList;
};

const getLastMove = (chess) => {
  const history = chess.history({ verbose: true });
  const lastMove = history.at(-1);

  if (!lastMove) {
    return null;
  }

  return {
    from: lastMove.from,
    to: lastMove.to,
    san: lastMove.san,
    color: getColorLabel(lastMove.color),
    piece: lastMove.piece,
    captured: lastMove.captured || null,
    promotion: lastMove.promotion || null
  };
};

const getDrawStatus = (chess, ruleState = getRuleState(chess)) => {
  if (ruleState.stalemate) {
    return createStatus("stalemate", "Stalemate.", {
      outcomeLabel: "Stalemate",
      drawReason: "stalemate"
    });
  }

  if (ruleState.insufficientMaterial) {
    return createStatus("draw-insufficient-material", "Draw by insufficient material.", {
      outcomeLabel: "Draw by insufficient material",
      drawReason: "insufficient-material"
    });
  }

  if (ruleState.fivefoldRepetition) {
    return createStatus("draw-fivefold-repetition", "Draw by fivefold repetition.", {
      outcomeLabel: "Draw by fivefold repetition",
      drawReason: "fivefold-repetition"
    });
  }

  if (ruleState.seventyFiveMoveRule) {
    return createStatus("draw-seventy-five-move", "Draw by seventy-five-move rule.", {
      outcomeLabel: "Draw by seventy-five-move rule",
      drawReason: "seventy-five-move-rule"
    });
  }

  if (chess.isDraw() && !ruleState.drawClaim.available) {
    return createStatus("draw", "Draw.", {
      outcomeLabel: "Draw",
      drawReason: "generic-draw"
    });
  }

  return null;
};

const getGameStatus = (chess, ruleState = getRuleState(chess)) => {
  if (ruleState.checkmate) {
    return createStatus(
      "checkmate",
      `Checkmate. ${chess.turn() === "w" ? "Black" : "White"} wins.`,
      {
        outcomeLabel: "Checkmate"
      }
    );
  }

  const drawStatus = getDrawStatus(chess, ruleState);

  if (drawStatus) {
    return drawStatus;
  }

  if (ruleState.check) {
    return createStatus(
      "check",
      `${chess.turn() === "w" ? "White" : "Black"} to move - Check.`
    );
  }

  return createStatus("active", `${chess.turn() === "w" ? "White" : "Black"} to move.`);
};

const serializeGame = (chess) => {
  const ruleState = getRuleState(chess);

  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: getColorLabel(chess.turn()),
    isGameOver: ruleState.isGameOver,
    isCheck: ruleState.check,
    legalMoves: getLegalMovesMap(chess),
    board: getBoardSquares(chess),
    moveList: getMoveList(chess),
    lastMove: getLastMove(chess),
    ruleState,
    status: getGameStatus(chess, ruleState)
  };
};

const getChessServiceStatus = () => "playable-rules-enabled";

module.exports = {
  applyMove,
  createChessGame,
  getChessServiceStatus,
  getGameStatus,
  getMaterialBalance,
  getRuleState,
  restoreChessGame,
  serializeGame
};
