const { applyMove, restoreChessGame } = require("./chessService");
const { EngineService } = require("./engineService");

const ANALYSIS_SETTINGS = {
  depth: 7,
  moveTime: 95,
  skillLevel: 20
};

const GOOD_MOVE_THRESHOLD = 0.5;
const BLUNDER_THRESHOLD = 1.1;
const ENGINE_PRESSURE_THRESHOLD = 0.45;
const ENGINE_THREAT_THRESHOLD = 1.15;
const ENGINE_PRESSURE_SCORE = -0.6;
const ENGINE_THREAT_SCORE = -2;
const MATE_PAWN_EQUIVALENT = 100;

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

const formatSuggestedMove = ({ beforeFen, bestMove }) => {
  if (!bestMove) {
    return null;
  }

  const chess = restoreChessGame({ fen: beforeFen });
  const move = applyMove(chess, bestMove);

  return move?.san || buildUciMove(bestMove) || null;
};

const classifyMove = (evalDrop) => {
  if (evalDrop > BLUNDER_THRESHOLD) {
    return {
      classification: "Blunder",
      tone: "blunder",
      motionState: "blunder",
      message: "That is a major slip."
    };
  }

  if (evalDrop >= GOOD_MOVE_THRESHOLD) {
    return {
      classification: "Inaccuracy",
      tone: "inaccuracy",
      motionState: "inaccuracy",
      message: "A little drift from the cleanest line."
    };
  }

  return {
    classification: "Good Move",
    tone: "good",
    motionState: "good",
    message: "That keeps your plan intact."
  };
};

const buildExplanation = ({
  classification,
  bestMoveMatches,
  afterScore
}) => {
  if (classification === "Good Move") {
    if (bestMoveMatches) {
      return "Best move. You found the cleanest line.";
    }

    if (afterScore >= 1.5) {
      return "Strong move. Your edge stays intact.";
    }

    return "Solid move. Your position holds.";
  }

  if (classification === "Inaccuracy") {
    return "A slight drift. The engine sees a cleaner line.";
  }

  return "A serious mistake. Material or initiative may be lost.";
};

const classifyEngineReply = ({ evalSwing, afterScore }) => {
  if (evalSwing > ENGINE_THREAT_THRESHOLD || afterScore <= ENGINE_THREAT_SCORE) {
    return {
      classification: "Engine Threat",
      tone: "engine-danger",
      motionState: "engine-danger",
      message: "Strong reply. You may need to defend.",
      explanation: "It found immediate pressure."
    };
  }

  if (evalSwing >= ENGINE_PRESSURE_THRESHOLD || afterScore <= ENGINE_PRESSURE_SCORE) {
    return {
      classification: "Engine Pressure",
      tone: "engine-warning",
      motionState: "engine-warning",
      message: "The engine improved its position.",
      explanation: "A precise reply. Be ready to absorb pressure."
    };
  }

  return {
    classification: "Engine Reply",
    tone: "engine",
    motionState: "engine-strong",
    message:
      afterScore >= 0.9
        ? "Strong reply. Your edge still holds."
        : "The engine defended well.",
    explanation:
      afterScore >= 0.9
        ? "It defended well, but chances remain."
        : "Its continuation is precise. Stay alert."
  };
};

const getAnalysisForPosition = async (fen) =>
  analysisEngine.getPositionAnalysis({
    fen,
    ...ANALYSIS_SETTINGS
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
  playedMove
}) => {
  const transition = await analyzePositionShift({
    beforeFen,
    afterFen,
    perspectiveColor: playerColor
  });

  if (!transition) {
    return null;
  }

  const evalDrop = Math.max(0, transition.evalSwing);
  const { classification, tone, motionState, message } = classifyMove(evalDrop);
  const suggestedMove = formatSuggestedMove({
    beforeFen,
    bestMove: transition.beforeAnalysis.bestMove
  });
  const playedMoveSan = playedMove?.san || buildUciMove(playedMove);
  const bestMoveMatches =
    Boolean(suggestedMove) && suggestedMove === playedMoveSan;

  return {
    source: "player",
    classification,
    tone,
    motionState,
    message,
    explanation: buildExplanation({
      classification,
      bestMoveMatches,
      afterScore: transition.afterScore
    }),
    bestMove:
      classification === "Good Move" || bestMoveMatches ? null : suggestedMove,
    evalBefore: roundScore(transition.beforeScore),
    evalAfter: roundScore(transition.afterScore),
    evalDrop
  };
};

const evaluateEngineMove = async ({
  beforeFen,
  afterFen,
  playerColor,
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

  const evalSwing = Math.max(0, transition.evalSwing);
  const commentary = classifyEngineReply({
    evalSwing,
    afterScore: transition.afterScore
  });

  return {
    source: "engine",
    ...commentary,
    bestMove: null,
    evalBefore: roundScore(transition.beforeScore),
    evalAfter: roundScore(transition.afterScore),
    evalSwing
  };
};

module.exports = {
  evaluateEngineMove,
  evaluateMove
};
