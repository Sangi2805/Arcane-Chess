const { randomUUID } = require("crypto");

const {
  applyMove,
  createChessGame,
  getMaterialBalance,
  restoreChessGame,
  serializeGame
} = require("../services/chessService");
const { DIFFICULTY_PRESETS, engineService } = require("../services/engineService");
const {
  PersistenceUnavailableError,
  getSavedGameRecord,
  recordCompletedGame,
  saveGameSnapshot
} = require("../services/persistenceService");
const {
  createClockState,
  getClockStateView,
  hydrateClockState,
  isTimedTimeControl,
  normalizeTimeControl,
  pauseClockState,
  resumeClockState,
  switchClockTurn
} = require("../services/clockService");
const {
  evaluateEngineMove,
  evaluateMove
} = require("../services/evaluationService");
const { getMongoStatus, isMongoAvailable } = require("../db/mongo");

const HINT_ANALYSIS_SETTINGS = {
  depth: 6,
  moveTime: 120,
  skillLevel: 20,
  multipv: 3
};
const HINT_PLY_LIMIT = 6;

const buildUciMove = ({ from, to, promotion } = {}) =>
  `${from || ""}${to || ""}${promotion || ""}`;

const DEFAULT_SETTINGS = {
  difficulty: "easy",
  playerColor: "white",
  timeControl: normalizeTimeControl()
};

const activeGames = new Map();
const DEFAULT_GUEST_ID = "guest_local_fallback";
const IN_PROGRESS_STATUS = {
  code: "in-progress",
  message: "In progress"
};
const NOT_STARTED_STATUS = {
  code: "not-started",
  message: "Not started"
};

const normalizeSettings = (settings = {}) => ({
  difficulty: settings.difficulty || DEFAULT_SETTINGS.difficulty,
  playerColor: settings.playerColor === "black" ? "black" : "white",
  timeControl: normalizeTimeControl(settings.timeControl)
});

const normalizeActor = (actor = {}) => {
  if (actor.type === "user" && actor.userId) {
    const userId = String(actor.userId);

    return {
      type: "user",
      actorId: userId,
      userId,
      guestId: null,
      key: `user:${userId}`
    };
  }

  const guestId = actor.guestId || actor.actorId || DEFAULT_GUEST_ID;

  return {
    type: "guest",
    actorId: guestId,
    userId: null,
    guestId,
    key: `guest:${guestId}`
  };
};

const getEngineColor = (game) =>
  game.settings.playerColor === "white" ? "black" : "white";

const getPersistencePayload = () => ({
  available: isMongoAvailable(),
  status: getMongoStatus()
});

const formatColor = (color) =>
  color ? `${color.charAt(0).toUpperCase()}${color.slice(1)}` : "Unknown";

const getResignationOutcome = (color) => ({
  result: color === "white" ? "black-win" : "white-win",
  status: {
    code: "resignation",
    message: `${formatColor(color)} resigned`,
    outcomeLabel: "Resignation"
  },
  resultLabel: "Resignation",
  drawReason: null
});

const hasTimeoutWinningMaterial = (chess, color) => {
  const pieceCounts = {
    pawns: 0,
    rooks: 0,
    queens: 0,
    bishops: 0,
    knights: 0
  };

  chess.board().forEach((rank) => {
    rank.forEach((piece) => {
      if (
        !piece ||
        (color === "white" ? piece.color !== "w" : piece.color !== "b") ||
        piece.type === "k"
      ) {
        return;
      }

      switch (piece.type) {
        case "p":
          pieceCounts.pawns += 1;
          break;
        case "r":
          pieceCounts.rooks += 1;
          break;
        case "q":
          pieceCounts.queens += 1;
          break;
        case "b":
          pieceCounts.bishops += 1;
          break;
        case "n":
          pieceCounts.knights += 1;
          break;
        default:
          break;
      }
    });
  });

  if (pieceCounts.pawns || pieceCounts.rooks || pieceCounts.queens) {
    return true;
  }

  if (pieceCounts.bishops >= 2) {
    return true;
  }

  if (pieceCounts.bishops >= 1 && pieceCounts.knights >= 1) {
    return true;
  }

  if (pieceCounts.knights >= 3) {
    return true;
  }

  return false;
};

const getTimeoutOutcome = (game, expiredColor) => {
  const winnerColor = expiredColor === "white" ? "black" : "white";

  if (!hasTimeoutWinningMaterial(game.chess, winnerColor)) {
    return {
      result: "draw",
      status: {
        code: "draw-timeout-insufficient-material",
        message: `${formatColor(expiredColor)} flagged, but ${formatColor(
          winnerColor
        )} lacked mating material.`,
        outcomeLabel: "Draw by timeout vs insufficient material",
        drawReason: "timeout-insufficient-material"
      },
      resultLabel: "Draw by timeout vs insufficient material",
      drawReason: "timeout-insufficient-material"
    };
  }

  return {
    result: winnerColor === "white" ? "white-win" : "black-win",
    status: {
      code: "timeout",
      message: `${formatColor(expiredColor)} lost on time`,
      outcomeLabel: "Timeout"
    },
    resultLabel: "Timeout",
    drawReason: null
  };
};

const getClaimDrawOutcome = (drawClaim = {}) => {
  const primaryReason = drawClaim.reasons?.[0];

  if (!drawClaim.available || !primaryReason) {
    throw new Error("No draw claim is currently available.");
  }

  return {
    result: "draw",
    status: {
      code: primaryReason.statusCode,
      message: `${primaryReason.outcomeLabel}.`,
      outcomeLabel: primaryReason.outcomeLabel,
      drawReason: primaryReason.code
    },
    resultLabel: primaryReason.outcomeLabel,
    drawReason: primaryReason.code
  };
};

const getBoardOutcome = (snapshot) => {
  if (snapshot.status.code === "checkmate") {
    return {
      result: snapshot.turn === "white" ? "black-win" : "white-win",
      status: snapshot.status,
      resultLabel: snapshot.status.outcomeLabel || "Checkmate",
      drawReason: null
    };
  }

  if (snapshot.status.code === "check") {
    return {
      result: "in-progress",
      status: snapshot.status,
      resultLabel: null,
      drawReason: null
    };
  }

  if (snapshot.isGameOver) {
    return {
      result: "draw",
      status: snapshot.status,
      resultLabel: snapshot.status.outcomeLabel || "Draw",
      drawReason: snapshot.status.drawReason || null
    };
  }

  return {
    result: "in-progress",
    status: IN_PROGRESS_STATUS,
    resultLabel: null,
    drawReason: null
  };
};

const getLiveSnapshot = (game) => serializeGame(game.chess);

const syncGameClockState = (game, now = Date.now()) => {
  if (
    !game?.hasStarted ||
    game.manualOutcome ||
    !isTimedTimeControl(game.settings?.timeControl) ||
    !game.clockState
  ) {
    return false;
  }

  const clockView = getClockStateView(game.clockState, now);

  if (!clockView?.enabled) {
    game.clockState = null;
    return false;
  }

  if (!clockView.isExpired) {
    return false;
  }

  game.clockState = pauseClockState(game.clockState, now);
  game.manualOutcome = getTimeoutOutcome(game, clockView.expiredColor);
  touchGame(game);

  return true;
};

const isGameFinished = (game) => Boolean(game.manualOutcome) || getLiveSnapshot(game).isGameOver;

const getResolvedGameState = (game, snapshot) => {
  if (game.manualOutcome) {
    return {
      ...game.manualOutcome,
      isGameOver: true,
      legalMoves: {},
      turn: null
    };
  }

  if (!game.hasStarted) {
    return {
      result: "not-started",
      status: NOT_STARTED_STATUS,
      isGameOver: false,
      legalMoves: {},
      turn: null,
      resultLabel: null,
      drawReason: null
    };
  }

  const boardOutcome = getBoardOutcome(snapshot);
  return {
    ...boardOutcome,
    isGameOver: snapshot.isGameOver,
    legalMoves: snapshot.isGameOver ? {} : snapshot.legalMoves,
    turn: snapshot.isGameOver ? null : snapshot.turn
  };
};

const buildSerializableState = (game, extras = {}) => {
  const now = extras.now || Date.now();
  const snapshot = serializeGame(game.chess);
  const resolvedState = getResolvedGameState(game, snapshot);
  const shouldPauseClock =
    resolvedState.isGameOver || resolvedState.result === "not-started";
  const clockState = shouldPauseClock
    ? getClockStateView(pauseClockState(game.clockState, now), now)
    : getClockStateView(game.clockState, now);

  return {
    id: game.id,
    actorType: game.actor.type,
    guestId: game.guestId,
    userId: game.userId,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    hasStarted: game.hasStarted,
    result: resolvedState.result,
    settings: {
      ...game.settings,
      engineColor: getEngineColor(game)
    },
    persistence: getPersistencePayload(),
    ...snapshot,
    timeControl: game.settings.timeControl || null,
    clockState: clockState || null,
    turn: resolvedState.turn,
    legalMoves: resolvedState.legalMoves,
    isGameOver: resolvedState.isGameOver,
    status: resolvedState.status,
    resultLabel: resolvedState.resultLabel || null,
    drawReason: resolvedState.drawReason || null,
    coachFeedback: null,
    ...extras
  };
};

const createGame = ({
  actor,
  settings = {},
  snapshot = null,
  hasStarted = false
} = {}) => {
  const normalizedActor = normalizeActor(actor);
  const normalizedSettings = normalizeSettings(settings);
  const chess = snapshot
    ? restoreChessGame({ fen: snapshot.fen, pgn: snapshot.pgn })
    : createChessGame();
  const now = new Date().toISOString();
  const activeColor = serializeGame(chess).turn;
  const clockState = hasStarted
    ? hydrateClockState(
        snapshot?.clockState,
        normalizedSettings.timeControl,
        activeColor
      )
    : null;

  const game = {
    id: snapshot?.gameId || randomUUID(),
    actor: normalizedActor,
    guestId: normalizedActor.guestId,
    userId: normalizedActor.userId,
    chess,
    settings: normalizedSettings,
    createdAt: snapshot?.createdAt || now,
    updatedAt: snapshot?.updatedAt || now,
    historyRecorded: snapshot?.historyRecorded || false,
    hasStarted,
    clockState,
    manualOutcome: null,
    pendingCoachReview: null,
    pendingEngineTurn: null,
    resolvedEngineTurn: null,
    lastHint: null
  };

  activeGames.set(game.actor.key, game);

  return game;
};

const ensureGame = (actor) => {
  const normalizedActor = normalizeActor(actor);

  return (
    activeGames.get(normalizedActor.key) ||
    createGame({
      actor: normalizedActor
    })
  );
};

const getTurn = (game) => serializeGame(game.chess).turn;

const touchGame = (game) => {
  game.updatedAt = new Date().toISOString();
};

const clearPendingAsyncState = (game) => {
  game.pendingCoachReview = null;
  game.pendingEngineTurn = null;
  game.resolvedEngineTurn = null;
};

const createIdleGame = ({ actor, settings = {} } = {}) =>
  createGame({
    actor,
    settings,
    hasStarted: false
  });

const clearActiveGame = async (actor, { settings = null } = {}) => {
  const normalizedActor = normalizeActor(actor);
  const currentGame = activeGames.get(normalizedActor.key);

  if (currentGame && isGameFinished(currentGame)) {
    await persistCompletedGameIfNeeded(currentGame);
  }

  if (currentGame) {
    activeGames.delete(normalizedActor.key);
  }

  const nextSettings = normalizeSettings(settings || currentGame?.settings || DEFAULT_SETTINGS);
  const game = createIdleGame({
    actor: normalizedActor,
    settings: nextSettings
  });

  return buildSerializableState(game);
};

const getSerializableState = (actor) => {
  const game = ensureGame(actor);
  syncGameClockState(game);

  return buildSerializableState(game);
};

const getLiveSerializableState = async (actor) => {
  const game = ensureGame(actor);
  const timedOut = syncGameClockState(game);

  if (timedOut || (game.hasStarted && isGameFinished(game))) {
    await persistCompletedGameIfNeeded(game);
  }

  const gameState = buildSerializableState(game);

  if (
    game.hasStarted &&
    gameState.isGameOver &&
    game.historyRecorded &&
    !game.pendingCoachReview &&
    !game.pendingEngineTurn
  ) {
    activeGames.delete(game.actor.key);
  }

  return gameState;
};

const discardActiveGame = async (actor, { persistCompleted = true } = {}) => {
  const normalizedActor = normalizeActor(actor);
  const currentGame = activeGames.get(normalizedActor.key);

  if (!currentGame) {
    return false;
  }

  if (persistCompleted && isGameFinished(currentGame)) {
    await persistCompletedGameIfNeeded(currentGame);
  }

  activeGames.delete(normalizedActor.key);
  return true;
};

const persistCompletedGameIfNeeded = async (game) => {
  if (!game.hasStarted || !isGameFinished(game) || game.historyRecorded) {
    return;
  }

  if (game.clockState) {
    game.clockState = pauseClockState(game.clockState);
  }

  try {
    await recordCompletedGame({
      actor: game.actor,
      gameId: game.id,
      settings: {
        ...game.settings,
        engineColor: getEngineColor(game)
      },
      snapshot: buildSerializableState(game)
    });
    game.historyRecorded = true;
  } catch (error) {
    if (error instanceof PersistenceUnavailableError) {
      return;
    }

    throw error;
  }
};

const createNewGame = async ({ actor, settings = {} } = {}) => {
  const game = createGame({
    actor,
    settings,
    hasStarted: true
  });

  if (game.settings.playerColor === "black") {
    await performEngineMove(game.actor, {
      includeCoachFeedback: false
    });
  }

  return getSerializableState(game.actor);
};

const resetGame = async (actor) => clearActiveGame(actor);

const makePlayerMove = async ({ actor, from, to, promotion }) => {
  const game = ensureGame(actor);
  const playerColor = game.settings.playerColor;

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  if (getTurn(game) !== game.settings.playerColor) {
    throw new Error("It is not the player's turn.");
  }

  const beforeFen = game.chess.fen();
  const move = applyMove(game.chess, { from, to, promotion });

  if (!move) {
    throw new Error("Illegal move.");
  }

  const moveTimestamp = Date.now();
  const playedMoveUci = buildUciMove({
    from: move.from,
    to: move.to,
    promotion: move.promotion || undefined
  });
  const hintedMoveMatches =
    Boolean(game.lastHint) &&
    game.lastHint.fen === beforeFen &&
    game.lastHint.playerColor === game.settings.playerColor &&
    game.lastHint.uci === playedMoveUci;

  game.lastHint = null;

  if (game.clockState) {
    game.clockState = switchClockTurn(
      game.clockState,
      playerColor,
      getTurn(game),
      moveTimestamp
    );
  }

  touchGame(game);
  clearPendingAsyncState(game);

  const liveSnapshot = getLiveSnapshot(game);
  if (liveSnapshot.isGameOver && game.clockState) {
    game.clockState = pauseClockState(game.clockState, moveTimestamp);
  }
  const moveToken = randomUUID();
  const gameContinues = !liveSnapshot.isGameOver;
  const shouldPauseForDrawClaim =
    liveSnapshot.ruleState?.drawClaim?.available &&
    liveSnapshot.turn === getEngineColor(game);
  const shouldQueueEngine =
    gameContinues &&
    !shouldPauseForDrawClaim &&
    liveSnapshot.turn === getEngineColor(game);

  if (shouldPauseForDrawClaim && game.clockState) {
    game.clockState = pauseClockState(game.clockState, moveTimestamp);
  }

  if (gameContinues) {
    game.pendingCoachReview = {
      moveToken,
      beforeFen,
      afterFen: game.chess.fen(),
      playerColor: game.settings.playerColor,
      moveColor: move.color === "w" ? "white" : "black",
      hintedMoveMatches,
      playedMove: {
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
        san: move.san
      },
      promise: null
    };
    game.pendingCoachReview.promise = evaluateMove(game.pendingCoachReview).catch(
      (error) => {
        console.warn("Arcane Coach evaluation skipped:", error.message);
        return null;
      }
    );
  }

  if (shouldQueueEngine) {
    const pendingEngineTurn = {
      moveToken,
      promise: null
    };

    game.pendingEngineTurn = pendingEngineTurn;
    pendingEngineTurn.promise = performEngineMove(game.actor)
      .then((gameState) => {
        if (game.pendingEngineTurn === pendingEngineTurn) {
          game.resolvedEngineTurn = {
            moveToken,
            game: gameState,
            error: null
          };
          game.pendingEngineTurn = null;
        }

        return gameState;
      })
      .catch((error) => {
        if (game.pendingEngineTurn === pendingEngineTurn) {
          game.resolvedEngineTurn = {
            moveToken,
            game: null,
            error
          };
          game.pendingEngineTurn = null;
        }

        throw error;
      });
  } else {
    await persistCompletedGameIfNeeded(game);
  }

  return {
    game: buildSerializableState(game),
    moveToken,
    pending: {
      coach: Boolean(game.pendingCoachReview),
      engine: shouldQueueEngine
    }
  };
};

const createHintSummary = ({ score }) => {
  if (!score) {
    return "This line improves your activity and keeps your position coordinated.";
  }

  if (score.type === "mate") {
    if (score.value > 0) {
      return `This line points to a forced mate in ${Math.abs(score.value)}.`;
    }

    return "This line is the best defensive resource to avoid a mating net.";
  }

  const cp = Number(score.value || 0);

  if (cp >= 140) {
    return "This sequence wins material or creates a decisive tactical advantage.";
  }

  if (cp >= 60) {
    return "This sequence builds pressure and improves your initiative.";
  }

  if (cp <= -120) {
    return "This is a defensive save that reduces immediate tactical danger.";
  }

  if (cp <= -40) {
    return "This line helps stabilize your position and limit your opponent's threats.";
  }

  return "This continuation keeps the position balanced while improving your piece coordination.";
};

const buildHintLineFromAnalysis = ({ fen, analysis }) => {
  const chess = restoreChessGame({ fen });
  const pv = (analysis?.pvLines?.[0]?.pv || analysis?.pv || []).slice(0, HINT_PLY_LIMIT);
  const san = [];

  pv.forEach((uciMove) => {
    if (!uciMove || uciMove.length < 4) {
      return;
    }

    const move = applyMove(chess, {
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove.slice(4, 5) || undefined
    });

    if (move?.san) {
      san.push(move.san);
    }
  });

  return san;
};

const getPositionHint = async (actor) => {
  const game = ensureGame(actor);

  if (!game.hasStarted) {
    throw new Error("Start a new game before requesting a hint.");
  }

  if (isGameFinished(game)) {
    throw new Error("Hints are unavailable after the game is over.");
  }

  if (getTurn(game) !== game.settings.playerColor) {
    throw new Error("Hints are only available on your turn.");
  }

  const fen = game.chess.fen();
  const analysis = await engineService.getPositionAnalysis({
    fen,
    ...HINT_ANALYSIS_SETTINGS
  });

  if (!analysis?.bestMove) {
    throw new Error("No hint line is available for this position.");
  }

  const suggestedMove = applyMove(restoreChessGame({ fen }), analysis.bestMove);
  const hintUci = buildUciMove({
    from: analysis.bestMove.from,
    to: analysis.bestMove.to,
    promotion: analysis.bestMove.promotion || undefined
  });
  const continuation = buildHintLineFromAnalysis({
    fen,
    analysis
  });

  game.lastHint = {
    fen,
    playerColor: game.settings.playerColor,
    uci: hintUci,
    issuedAt: Date.now()
  };

  return {
    hint: {
      bestMove: {
        from: analysis.bestMove.from,
        to: analysis.bestMove.to,
        promotion: analysis.bestMove.promotion || null,
        san: suggestedMove?.san || null
      },
      continuation,
      fen,
      summary: createHintSummary({ score: analysis.pvLines?.[0]?.score || analysis.score })
    }
  };
};

const performEngineMove = async (
  actor,
  { includeCoachFeedback = true } = {}
) => {
  const game = ensureGame(actor);
  const activePendingEngineTurn = game.pendingEngineTurn;

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    return getSerializableState(game.actor);
  }

  if (isGameFinished(game)) {
    await persistCompletedGameIfNeeded(game);
    return getSerializableState(game.actor);
  }

  if (getTurn(game) !== getEngineColor(game)) {
    return getSerializableState(game.actor);
  }

  if (game.clockState && !game.clockState.runningSince) {
    game.clockState = resumeClockState(game.clockState);
  }

  const beforeFen = game.chess.fen();
  const preset = engineService.getDifficultyPreset(game.settings.difficulty);
  const engineAnalysis = await engineService.getPositionAnalysis({
    fen: beforeFen,
    depth: preset.depth,
    moveTime: preset.moveTime,
    skillLevel: preset.skillLevel
  });
  const bestMove = engineAnalysis.bestMove
    ? {
        ...engineAnalysis.bestMove,
        difficulty: preset
      }
    : null;

  if (!bestMove) {
    if (!activePendingEngineTurn) {
      game.pendingEngineTurn = null;
    }

    return getSerializableState(game.actor);
  }

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
    return getSerializableState(game.actor);
  }

  const move = applyMove(game.chess, bestMove);

  if (!move) {
    throw new Error("Engine returned an invalid move.");
  }

  const moveTimestamp = Date.now();

  if (game.clockState) {
    game.clockState = switchClockTurn(
      game.clockState,
      getEngineColor(game),
      getTurn(game),
      moveTimestamp
    );
  }

  touchGame(game);

  if (!activePendingEngineTurn) {
    game.pendingEngineTurn = null;
  }

  const liveSnapshot = getLiveSnapshot(game);
  if (liveSnapshot.isGameOver && game.clockState) {
    game.clockState = pauseClockState(game.clockState, moveTimestamp);
  }
  await persistCompletedGameIfNeeded(game);

  let coachFeedback = null;

  if (includeCoachFeedback && !liveSnapshot.isGameOver) {
    coachFeedback = await evaluateEngineMove({
      beforeFen,
      afterFen: game.chess.fen(),
      playerColor: game.settings.playerColor,
      playedMove: {
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
        san: move.san,
        captured: move.captured || null,
        isCheck: /[+#]/.test(move.san || "")
      },
      beforeAnalysis: engineAnalysis
    }).catch((error) => {
      console.warn("Arcane Coach engine commentary skipped:", error.message);
      return null;
    });

    if (coachFeedback) {
      coachFeedback.playedMove = {
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined,
        san: move.san
      };
    }
  }

  return buildSerializableState(game, {
    coachFeedback
  });
};

const resolveCoachFeedback = async ({ actor, moveToken }) => {
  const game = ensureGame(actor);
  const review = game.pendingCoachReview;

  if (!review || review.moveToken !== moveToken) {
    return {
      stale: true,
      moveToken,
      coachFeedback: null
    };
  }

  const coachFeedback = await review.promise;

  return {
    stale: game.pendingCoachReview !== review,
    moveToken,
    coachFeedback: game.pendingCoachReview === review ? coachFeedback : null
  };
};

const resolvePendingEngineMove = async ({ actor, moveToken }) => {
  const game = ensureGame(actor);

  if (game.pendingEngineTurn?.moveToken === moveToken) {
    const gameState = await game.pendingEngineTurn.promise;

    return {
      stale: false,
      moveToken,
      game: gameState
    };
  }

  if (game.resolvedEngineTurn?.moveToken === moveToken) {
    const resolvedTurn = game.resolvedEngineTurn;
    game.resolvedEngineTurn = null;

    if (resolvedTurn.error) {
      throw resolvedTurn.error;
    }

    return {
      stale: false,
      moveToken,
      game: resolvedTurn.game
    };
  }

  if (!game.pendingEngineTurn || game.pendingEngineTurn.moveToken !== moveToken) {
    return {
      stale: true,
      moveToken,
      game: getSerializableState(game.actor)
    };
  }
};

const resignGame = async (actor) => {
  const game = ensureGame(actor);

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  clearPendingAsyncState(game);
  if (game.clockState) {
    game.clockState = pauseClockState(game.clockState);
  }
  game.manualOutcome = getResignationOutcome(game.settings.playerColor);
  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return getSerializableState(game.actor);
};

// Phase 3 draw handling stays intentionally simple: the engine only accepts
// offers once the game is calm and materially close, with stricter thresholds
// on higher difficulties.
const shouldAcceptDrawOffer = (game) => {
  const preset =
    DIFFICULTY_PRESETS[game.settings.difficulty] || DIFFICULTY_PRESETS.easy;
  const halfMoveCount = game.chess.history().length;
  const materialGap = Math.abs(getMaterialBalance(game.chess));

  if (game.chess.isCheck()) {
    return false;
  }

  return (
    halfMoveCount >= preset.drawOffer.minHalfMoves &&
    materialGap <= preset.drawOffer.maxMaterialGap
  );
};

const offerDraw = async (actor) => {
  const game = ensureGame(actor);

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  if (!shouldAcceptDrawOffer(game)) {
    return {
      accepted: false,
      message: "Draw offer declined. Play continues.",
      game: getSerializableState(game.actor)
    };
  }

  clearPendingAsyncState(game);
  if (game.clockState) {
    game.clockState = pauseClockState(game.clockState);
  }
  game.manualOutcome = {
    result: "draw",
    resultLabel: "Draw agreed",
    drawReason: "agreed",
    status: {
      code: "draw-agreed",
      message: "Draw agreed.",
      outcomeLabel: "Draw agreed",
      drawReason: "agreed"
    }
  };
  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return {
    accepted: true,
    message: "Draw offer accepted.",
    game: getSerializableState(game.actor)
  };
};

const claimDraw = async (actor) => {
  const game = ensureGame(actor);

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game first.");
  }

  if (isGameFinished(game)) {
    throw new Error("The game is already over. Start a new game.");
  }

  const snapshot = getLiveSnapshot(game);
  const drawClaim = snapshot.ruleState?.drawClaim;

  if (!drawClaim?.available) {
    throw new Error("No draw claim is currently available in this position.");
  }

  clearPendingAsyncState(game);
  if (game.clockState) {
    game.clockState = pauseClockState(game.clockState);
  }
  game.manualOutcome = getClaimDrawOutcome(drawClaim);
  touchGame(game);
  await persistCompletedGameIfNeeded(game);

  return getSerializableState(game.actor);
};

const saveCurrentGame = async (actor) => {
  const game = ensureGame(actor);

  if (syncGameClockState(game)) {
    await persistCompletedGameIfNeeded(game);
  }

  if (!game.hasStarted) {
    throw new Error("Start a new game or resume a saved game before saving.");
  }

  if (isGameFinished(game)) {
    throw new Error(
      "Completed games are saved to history automatically. Start a new game to continue."
    );
  }

  const snapshot = buildSerializableState(game);
  snapshot.clockState = pauseClockState(game.clockState);
  const savedGame = await saveGameSnapshot({
    actor: game.actor,
    gameId: game.id,
    settings: {
      ...game.settings,
      engineColor: getEngineColor(game)
    },
    snapshot
  });

  return savedGame;
};

const resumeSavedGame = async ({ actor, gameId }) => {
  const normalizedActor = normalizeActor(actor);
  const savedGame = await getSavedGameRecord(normalizedActor, gameId);

  if (!savedGame) {
    throw new Error("Saved game not found for this account.");
  }

  if (!savedGame.isResumable) {
    throw new Error("This saved game is no longer resumable.");
  }

  const game = createGame({
    actor: normalizedActor,
    settings: {
      difficulty: savedGame.difficulty,
      playerColor: savedGame.playerColor,
      timeControl: savedGame.timeControl || null
    },
    snapshot: {
      gameId: savedGame.gameId,
      fen: savedGame.fen,
      pgn: savedGame.pgn,
      createdAt: savedGame.createdAt.toISOString(),
      updatedAt: savedGame.updatedAt.toISOString(),
      clockState: savedGame.clockState || null
    },
    hasStarted: true
  });

  if (game.clockState) {
    game.clockState = resumeClockState(game.clockState);
  }

  touchGame(game);

  return getSerializableState(game.actor);
};

const transferActiveGame = ({ fromActor, toActor }) => {
  const sourceActor = normalizeActor(fromActor);
  const targetActor = normalizeActor(toActor);

  if (!sourceActor.key || !targetActor.key || sourceActor.key === targetActor.key) {
    return null;
  }

  const activeGame = activeGames.get(sourceActor.key);

  if (!activeGame) {
    return null;
  }

  activeGames.delete(sourceActor.key);
  activeGame.actor = targetActor;
  activeGame.guestId = targetActor.guestId;
  activeGame.userId = targetActor.userId;
  activeGames.set(targetActor.key, activeGame);

  return buildSerializableState(activeGame);
};

module.exports = {
  createNewGame,
  getSerializableState,
  getLiveSerializableState,
  getPositionHint,
  makePlayerMove,
  offerDraw,
  performEngineMove,
  claimDraw,
  resolveCoachFeedback,
  resolvePendingEngineMove,
  resetGame,
  resignGame,
  saveCurrentGame,
  resumeSavedGame,
  transferActiveGame,
  discardActiveGame
};
