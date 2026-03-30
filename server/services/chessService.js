const { Chess } = require("chess.js");

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const COLOR_LABELS = {
  w: "white",
  b: "black"
};

const DEFAULT_PROMOTION = "q";

const createChessGame = (fen) => new Chess(fen);

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

const getGameStatus = (chess) => {
  if (chess.isCheckmate()) {
    return {
      code: "checkmate",
      message: `Checkmate. ${
        chess.turn() === "w" ? "Black" : "White"
      } wins.`
    };
  }

  if (chess.isStalemate()) {
    return {
      code: "draw",
      message: "Draw by stalemate."
    };
  }

  if (chess.isThreefoldRepetition()) {
    return {
      code: "draw",
      message: "Draw by threefold repetition."
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      code: "draw",
      message: "Draw by insufficient material."
    };
  }

  if (chess.isDraw()) {
    return {
      code: "draw",
      message: "Draw."
    };
  }

  if (chess.isCheck()) {
    return {
      code: "check",
      message: `${chess.turn() === "w" ? "White" : "Black"} to move - Check.`
    };
  }

  return {
    code: "active",
    message: `${chess.turn() === "w" ? "White" : "Black"} to move.`
  };
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
  serializeGame
};
