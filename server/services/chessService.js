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

const createStatus = (code, message, extras = {}) => ({
  code,
  message,
  ...extras
});

const createChessGame = () => new Chess();

const restoreChessGame = ({ fen, pgn } = {}) => {
  const chess = createChessGame();

  if (pgn) {
    chess.loadPgn(pgn);
    return chess;
  }

  if (fen) {
    chess.load(fen);
  }

  return chess;
};

const getColorLabel = (color) => COLOR_LABELS[color] || "white";

const getDefaultPromotion = (move) => {
  const isPawnMove = move.piece === "p";
  const reachesBackRank = ["1", "8"].includes(move.to?.[1]);

  return isPawnMove && reachesBackRank ? DEFAULT_PROMOTION : undefined;
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

const getDrawStatus = (chess) => {
  if (chess.isStalemate()) {
    return createStatus("stalemate", "Stalemate.", {
      outcomeLabel: "Stalemate",
      drawReason: "stalemate"
    });
  }

  if (chess.isThreefoldRepetition()) {
    return createStatus("draw-repetition", "Draw by repetition.", {
      outcomeLabel: "Draw by repetition",
      drawReason: "repetition"
    });
  }

  if (chess.isInsufficientMaterial()) {
    return createStatus("draw-insufficient-material", "Draw by insufficient material.", {
      outcomeLabel: "Draw by insufficient material",
      drawReason: "insufficient-material"
    });
  }

  if (chess.isDrawByFiftyMoves()) {
    return createStatus("draw-fifty-move", "Draw by fifty-move rule.", {
      outcomeLabel: "Draw by fifty-move rule",
      drawReason: "fifty-move-rule"
    });
  }

  if (chess.isDraw()) {
    return createStatus("draw", "Draw.", {
      outcomeLabel: "Draw",
      drawReason: "generic-draw"
    });
  }

  return null;
};

const getGameStatus = (chess) => {
  if (chess.isCheckmate()) {
    return createStatus(
      "checkmate",
      `Checkmate. ${chess.turn() === "w" ? "Black" : "White"} wins.`,
      {
        outcomeLabel: "Checkmate"
      }
    );
  }

  const drawStatus = getDrawStatus(chess);

  if (drawStatus) {
    return drawStatus;
  }

  if (chess.isCheck()) {
    return createStatus(
      "check",
      `${chess.turn() === "w" ? "White" : "Black"} to move - Check.`
    );
  }

  return createStatus("active", `${chess.turn() === "w" ? "White" : "Black"} to move.`);
};

const serializeGame = (chess) => ({
  fen: chess.fen(),
  pgn: chess.pgn(),
  turn: getColorLabel(chess.turn()),
  isGameOver: chess.isGameOver(),
  isCheck: chess.isCheck(),
  legalMoves: getLegalMovesMap(chess),
  board: getBoardSquares(chess),
  moveList: getMoveList(chess),
  lastMove: getLastMove(chess),
  status: getGameStatus(chess)
});

const getChessServiceStatus = () => "playable-rules-enabled";

module.exports = {
  applyMove,
  createChessGame,
  getChessServiceStatus,
  getMaterialBalance,
  restoreChessGame,
  serializeGame
};
