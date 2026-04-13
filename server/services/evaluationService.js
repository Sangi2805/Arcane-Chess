const { Chess } = require("chess.js");
const { applyMove } = require("./chessService");
const { EngineService } = require("./engineService");

const ANALYSIS_SETTINGS = {
  depth: 7,
  moveTime: 95,
  skillLevel: 20
};

const WHY_ANALYSIS_SETTINGS = {
  depth: 6,
  moveTime: 120,
  skillLevel: 20,
  multipv: 3
};

const MAX_WHY_LINES = 3;
const WHY_PLY_LIMIT = 6;

const RATING_THRESHOLDS = [
  { maxDelta: -2.5, classification: "blunder", tone: "blunder", motionState: "blunder" },
  { maxDelta: -1.5, classification: "miss", tone: "blunder", motionState: "blunder" },
  { maxDelta: -0.8, classification: "mistake", tone: "inaccuracy", motionState: "inaccuracy" },
  { maxDelta: -0.25, classification: "inaccuracy", tone: "inaccuracy", motionState: "inaccuracy" },
  { maxDelta: 0.25, classification: "good", tone: "good", motionState: "good" },
  { maxDelta: 0.8, classification: "excellent", tone: "good", motionState: "good" },
  { maxDelta: 1.5, classification: "best", tone: "good", motionState: "good" },
  { maxDelta: 2.5, classification: "great", tone: "good", motionState: "good" },
  { maxDelta: Number.POSITIVE_INFINITY, classification: "brilliant", tone: "good", motionState: "good" }
];

const MATE_PAWN_EQUIVALENT = 100;

const cloneChessFromFen = (fen) => {
  const chess = new Chess();
  chess.load(fen);
  return chess;
};

const analysisEngine = new EngineService();
analysisEngine.ensureReady().catch((error) => {
  console.warn("Arcane Coach analysis engine warm-up skipped:", error.message);
});

const roundScore = (value) => Math.round(value * 100) / 100;

const getTurnFromFen = (fen) => (fen.split(" ")[1] === "b" ? "black" : "white");

const normalizeScoreForPerspective = (score, fen, perspectiveColor) => {
  if (!score) {
    return null;
  }

  const baseScore =
    score.type === "mate"
      ? Math.sign(score.value || 1) * MATE_PAWN_EQUIVALENT
      : score.value / 100;

  return getTurnFromFen(fen) === perspectiveColor ? baseScore : -baseScore;
};

const buildUciMove = (move = {}) => `${move.from || ""}${move.to || ""}${move.promotion || ""}`;

const createMoveFromUci = (uciMove = "") => {
  if (!uciMove || uciMove.length < 4) {
    return null;
  }

  return {
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove.slice(4, 5) || undefined
  };
};

const formatSuggestedMove = ({ beforeFen, bestMove }) => {
  if (!bestMove) {
    return null;
  }

  const chess = cloneChessFromFen(beforeFen);
  const move = applyMove(chess, bestMove);

  return move?.san || buildUciMove(bestMove) || null;
};

const normalizeLineScore = (score, perspectiveColor, fen) =>
  normalizeScoreForPerspective(score, fen, perspectiveColor);

const classifyByDelta = (delta) => {
  const match =
    RATING_THRESHOLDS.find((entry) => delta <= entry.maxDelta) ||
    RATING_THRESHOLDS[RATING_THRESHOLDS.length - 1];

  return {
    classification: match.classification,
    tone: match.tone,
    motionState: match.motionState,
    message: match.classification
  };
};

const promoteBestMoveClassification = ({ classification, delta, bestMoveMatches }) => {
  if (!bestMoveMatches) {
    return classification;
  }

  if (delta >= 2) {
    return "brilliant";
  }

  if (delta >= 1) {
    return "great";
  }

  if (["blunder", "miss", "mistake", "inaccuracy", "good", "excellent"].includes(classification)) {
    return "best";
  }

  return classification;
};

const normalizeHintMatchedClassification = (classification) => {
  if (["brilliant", "great", "best"].includes(classification)) {
    return classification;
  }

  return "best";
};

const buildWhyLineSanSequence = ({ beforeFen, uciPv = [] }) => {
  if (!beforeFen || !uciPv.length) {
    return [];
  }

  const chess = cloneChessFromFen(beforeFen);
  const sanMoves = [];

  for (const uciMove of uciPv.slice(0, WHY_PLY_LIMIT)) {
    const move = applyMove(chess, createMoveFromUci(uciMove));

    if (!move?.san) {
      break;
    }

    sanMoves.push(move.san);
  }

  return sanMoves;
};

const buildWhyLines = ({ beforeFen, perspectiveColor, analysis }) => {
  const lines = Array.isArray(analysis?.pvLines)
    ? analysis.pvLines
    : analysis?.pv?.length
      ? [{ multipv: 1, score: analysis.score, pv: analysis.pv }]
      : [];

  return lines
    .slice(0, MAX_WHY_LINES)
    .map((line, index) => {
      const sanSequence = buildWhyLineSanSequence({
        beforeFen,
        uciPv: line.pv || []
      });

      const evalScore = normalizeLineScore(line.score, perspectiveColor, beforeFen);

      if (!sanSequence.length) {
        return null;
      }

      return {
        rank: index + 1,
        san: sanSequence,
        eval: evalScore === null ? null : roundScore(evalScore)
      };
    })
    .filter(Boolean);
};

const buildExplanation = ({ classification }) =>
  `Rated as ${classification}. Use Why? to view principal continuations.`;

const formatColorLabel = (color) =>
  color === "black" ? "Black" : color === "white" ? "White" : "Opponent";

const getAdvisoryPresentation = ({ evalDelta = 0, playedMove = {} }) => {
  const isCheck = Boolean(playedMove.isCheck || /[+#]/.test(playedMove.san || ""));
  const isCapture = Boolean(playedMove.captured || (playedMove.san || "").includes("x"));

  if (isCheck || evalDelta <= -1.4) {
    return {
      tone: "warning",
      motionState: "engine-danger"
    };
  }

  if (isCapture || evalDelta <= -0.35) {
    return {
      tone: "warning",
      motionState: "engine-warning"
    };
  }

  return {
    tone: "thinking",
    motionState: "thinking"
  };
};

const analyzeOpponentIntent = ({ playedMove = {}, opponentColor, evalDelta = 0 }) => {
  const actor = formatColorLabel(opponentColor);
  const targetSquare = typeof playedMove.to === "string" ? playedMove.to : "";
  const centerSquares = new Set(["d4", "d5", "e4", "e5"]);
  const isCenterIncursion = centerSquares.has(targetSquare);
  const isCheck = Boolean(playedMove.isCheck || /[+#]/.test(playedMove.san || ""));
  const isCapture = Boolean(playedMove.captured || (playedMove.san || "").includes("x"));

  if (isCheck && isCapture) {
    return `${actor} combines a capture with check. Stabilize king safety before counterplay.`;
  }

  if (isCheck) {
    return `${actor} just gave check. Address the immediate threat before improving your position.`;
  }

  if (isCapture) {
    return `Watch out, ${actor} just initiated a capture.`;
  }

  if (evalDelta <= -1.5) {
    return `${actor} is pressing hard. Look for a precise defensive resource.`;
  }

  if (evalDelta <= -0.6) {
    return isCenterIncursion
      ? `${actor} is applying pressure to the center.`
      : `${actor} is increasing pressure. Watch tactical threats around your king and center.`;
  }

  if (evalDelta >= 0.9) {
    return `${actor}'s move loses the advantage. Look for a counter-attack.`;
  }

  if (evalDelta >= 0.35) {
    return `${actor} eased the pressure. You may have a small initiative window.`;
  }

  return `${actor} is improving piece activity. Keep development coordinated and watch central tension.`;
};

const getAnalysisForPosition = async (fen) =>
  analysisEngine.getPositionAnalysis({
    fen,
    ...ANALYSIS_SETTINGS
  });

const getWhyAnalysisForPosition = async (fen) =>
  analysisEngine.getPositionAnalysis({
    fen,
    ...WHY_ANALYSIS_SETTINGS
  });

const analyzePositionShift = async ({
  beforeFen,
  afterFen,
  perspectiveColor,
  beforeAnalysis = null,
  afterAnalysis = null
}) => {
  const [resolvedBeforeAnalysis, resolvedAfterAnalysis] = await Promise.all([
    beforeAnalysis || getAnalysisForPosition(beforeFen),
    afterAnalysis || getAnalysisForPosition(afterFen)
  ]);

  const beforeScore = normalizeScoreForPerspective(
    resolvedBeforeAnalysis.score,
    beforeFen,
    perspectiveColor
  );
  const afterScore = normalizeScoreForPerspective(
    resolvedAfterAnalysis.score,
    afterFen,
    perspectiveColor
  );

  if (beforeScore === null || afterScore === null) {
    return null;
  }

  return {
    beforeAnalysis: resolvedBeforeAnalysis,
    afterAnalysis: resolvedAfterAnalysis,
    beforeScore,
    afterScore,
    evalSwing: roundScore(beforeScore - afterScore)
  };
};

const evaluateMove = async ({
  beforeFen,
  afterFen,
  playerColor,
  moveColor = playerColor,
  playedMove,
  hintedMoveMatches = false
}) => {
  const [transition, whyAnalysis] = await Promise.all([
    analyzePositionShift({
      beforeFen,
      afterFen,
      perspectiveColor: playerColor
    }),
    getWhyAnalysisForPosition(beforeFen).catch(() => null)
  ]);

  if (!transition) {
    return null;
  }

  const delta = roundScore(transition.afterScore - transition.beforeScore);

  if (moveColor !== playerColor) {
    const threatSummary = analyzeOpponentIntent({
      playedMove,
      opponentColor: moveColor,
      evalDelta: delta
    });
    const advisory = getAdvisoryPresentation({
      evalDelta: delta,
      playedMove
    });

    return {
      source: "opponent",
      classification: null,
      tone: advisory.tone,
      motionState: advisory.motionState,
      threatSummary,
      message: threatSummary,
      explanation: "Advisory mode: read the threat and choose a concrete defensive or counter-attacking plan.",
      bestMove: null,
      whyLines: [],
      beforeFen,
      evalBefore: roundScore(transition.beforeScore),
      evalAfter: roundScore(transition.afterScore),
      evalDrop: roundScore(Math.max(0, transition.beforeScore - transition.afterScore)),
      evalDelta: delta
    };
  }

  const baseClassification = classifyByDelta(delta);
  const suggestedMove = formatSuggestedMove({
    beforeFen,
    bestMove: transition.beforeAnalysis.bestMove
  });
  const playedMoveSan = playedMove?.san || buildUciMove(playedMove);
  const computedBestMoveMatches =
    Boolean(suggestedMove) && suggestedMove === playedMoveSan;
  const bestMoveMatches = Boolean(hintedMoveMatches) || computedBestMoveMatches;
  let classification = promoteBestMoveClassification({
    classification: baseClassification.classification,
    delta,
    bestMoveMatches
  });

  if (hintedMoveMatches) {
    classification = normalizeHintMatchedClassification(classification);
  }
  const whyLines = buildWhyLines({
    beforeFen,
    perspectiveColor: playerColor,
    analysis: whyAnalysis || transition.beforeAnalysis
  });

  return {
    source: "player",
    classification,
    tone: baseClassification.tone,
    motionState: baseClassification.motionState,
    message: classification,
    explanation: buildExplanation({
      classification,
      bestMoveMatches
    }),
    bestMove: bestMoveMatches ? null : suggestedMove,
    whyLines,
    beforeFen,
    evalBefore: roundScore(transition.beforeScore),
    evalAfter: roundScore(transition.afterScore),
    evalDrop: roundScore(Math.max(0, transition.beforeScore - transition.afterScore)),
    evalDelta: delta
  };
};

const evaluateEngineMove = async ({
  beforeFen,
  afterFen,
  playerColor,
  playedMove,
  beforeAnalysis = null
}) => {
  const transition = await analyzePositionShift({
    beforeFen,
    afterFen,
    perspectiveColor: playerColor,
    beforeAnalysis
  });

  if (!transition) {
    return null;
  }

  const delta = roundScore(transition.afterScore - transition.beforeScore);
  const moveColor = getTurnFromFen(beforeFen);
  const threatSummary = analyzeOpponentIntent({
    playedMove,
    opponentColor: moveColor,
    evalDelta: delta
  });
  const advisory = getAdvisoryPresentation({
    evalDelta: delta,
    playedMove
  });

  return {
    source: "engine",
    classification: null,
    tone: advisory.tone,
    motionState: advisory.motionState,
    threatSummary,
    message: threatSummary,
    explanation: "Advisory mode: evaluate the threat before committing your next move.",
    whyLines: [],
    bestMove: null,
    beforeFen,
    evalBefore: roundScore(transition.beforeScore),
    evalAfter: roundScore(transition.afterScore),
    evalSwing: roundScore(Math.max(0, transition.beforeScore - transition.afterScore)),
    evalDelta: delta
  };
};

module.exports = {
  evaluateEngineMove,
  evaluateMove
};
