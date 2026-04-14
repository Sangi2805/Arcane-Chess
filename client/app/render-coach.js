import {
  DEFAULT_COACH_EXPLANATION,
  THINKING_COACH_EXPLANATION,
  WIZARD_STATE_CLASSNAMES,
  WIZARD_STATE_LABELS,
  WIZARD_STATE_VISUALS
} from "./constants.js";
import { runtimeState, state } from "./state.js";
import * as dom from "./dom.js";

let renderCoachDeps = {
  getArcaneBoard3D: () => null,
  getDrawClaimState: () => null
};

export const configureRenderCoachDependencies = (deps = {}) => {
  renderCoachDeps = {
    ...renderCoachDeps,
    ...deps
  };
};

export const clearWizardReactionDelayTimer = () => {
  if (!runtimeState.wizardReactionDelayTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.wizardReactionDelayTimeoutId);
  runtimeState.wizardReactionDelayTimeoutId = null;
};

export const clearWizardStateResetTimer = () => {
  if (!runtimeState.wizardStateResetTimeoutId) {
    return;
  }

  window.clearTimeout(runtimeState.wizardStateResetTimeoutId);
  runtimeState.wizardStateResetTimeoutId = null;
};

export const clearWizardStateTimers = () => {
  clearWizardReactionDelayTimer();
  clearWizardStateResetTimer();
};

export const scheduleWizardIdleReset = (delayMs = 2000) => {
  clearWizardStateResetTimer();
  runtimeState.wizardStateResetTimeoutId = window.setTimeout(() => {
    setWizardIdleState();
    runtimeState.wizardStateResetTimeoutId = null;
  }, delayMs);
};

export const scheduleWizardReactionState = (
  nextState,
  {
    delayMs = 900,
    holdMs = 2000,
    force = false
  } = {}
) => {
  if (!WIZARD_STATE_VISUALS[nextState]) {
    return;
  }

  clearWizardStateTimers();
  const effectiveDelay = runtimeState.currentWizardState === "st-think" ? delayMs : 0;

  runtimeState.wizardReactionDelayTimeoutId = window.setTimeout(() => {
    runtimeState.wizardReactionDelayTimeoutId = null;
    setWizardState(nextState, {
      force
    });
    if (holdMs > 0 && nextState !== "st-win") {
      scheduleWizardIdleReset(holdMs);
    }
  }, effectiveDelay);
};

export const setWizardThinkingState = ({ preserveTimers = false } = {}) => {
  if (!preserveTimers) {
    clearWizardStateTimers();
  }

  if (runtimeState.currentWizardState !== "st-think") {
    setWizardState("st-think", {
      force: true
    });
  }
};

export const setWizardIdleState = () => {
  clearWizardStateTimers();
  setWizardState("st-idle", {
    force: true
  });
};

export const syncCoachAvatarMode = () => {
  if (!dom.coachPanel) {
    return;
  }

  const showWizard = state.view === "game";
  dom.coachPanel.classList.add("coach-avatar-relocated");
  dom.coachPanel.classList.remove("coach-avatar-3d");
  if (dom.coachAvatarImage) {
    dom.coachAvatarImage.setAttribute("aria-hidden", "true");
  }
  if (dom.coachWizardSvg) {
    dom.coachWizardSvg.setAttribute("aria-hidden", showWizard ? "false" : "true");
  }
  dom.wizardSide?.setAttribute("aria-hidden", showWizard ? "false" : "true");
};

export const setWizardState = (nextState) => {
  if (!dom.coachWizardSvg || !WIZARD_STATE_VISUALS[nextState]) {
    return;
  }

  WIZARD_STATE_CLASSNAMES.forEach((stateClass) => {
    dom.coachWizardSvg.classList.remove(stateClass);
  });
  dom.coachWizardSvg.classList.add(nextState);
  runtimeState.currentWizardState = nextState;
  dom.wizardSide?.setAttribute("data-state", nextState);
  if (dom.wizardStateLabel) {
    dom.wizardStateLabel.textContent = WIZARD_STATE_LABELS[nextState] || "IDLE";
  }

  const visual = WIZARD_STATE_VISUALS[nextState];
  dom.coachWizardMouth?.setAttribute("d", visual.mouth);
  dom.coachWizardBrowLeft?.setAttribute("d", visual.browLeft);
  dom.coachWizardBrowRight?.setAttribute("d", visual.browRight);
  dom.coachWizardIrisLeft?.setAttribute("fill", visual.iris);
  dom.coachWizardIrisRight?.setAttribute("fill", visual.iris);
  dom.coachWizardIrisLeft?.setAttribute("cx", String(visual.irisLeft.cx));
  dom.coachWizardIrisLeft?.setAttribute("cy", String(visual.irisLeft.cy));
  dom.coachWizardIrisLeft?.setAttribute("r", String(visual.irisLeft.r));
  dom.coachWizardIrisRight?.setAttribute("cx", String(visual.irisRight.cx));
  dom.coachWizardIrisRight?.setAttribute("cy", String(visual.irisRight.cy));
  dom.coachWizardIrisRight?.setAttribute("r", String(visual.irisRight.r));
  dom.coachWizardOrb?.setAttribute("fill", visual.orb);
  dom.coachWizardOrb?.setAttribute("stroke", visual.orbStroke);

  if (nextState === "st-win") {
    renderCoachDeps.getArcaneBoard3D()?.triggerSpectatorCelebration?.();
  }
};

export const createCoachState = (overrides = {}) => ({
  source: "system",
  classification: null,
  tone: "neutral",
  message: "Preparing the board.",
  explanation: DEFAULT_COACH_EXPLANATION,
  bestMove: null,
  whyLines: [],
  whyExpanded: false,
  motionState: "idle",
  motionSettleTo: null,
  motionDurationMs: 0,
  motionPulseId: null,
  outcome: "neutral",
  animate: false,
  ...overrides
});

export const getNextCoachMotionPulseId = () => {
  runtimeState.coachMotionSequence += 1;
  return runtimeState.coachMotionSequence;
};

export const createTransientCoachMotion = (
  motionState,
  motionSettleTo = "idle",
  motionDurationMs = 1600,
  overrides = {}
) => ({
  motionState,
  motionSettleTo,
  motionDurationMs,
  motionPulseId: getNextCoachMotionPulseId(),
  outcome: "neutral",
  ...overrides
});

export const createPersistentCoachMotion = (motionState, overrides = {}) => ({
  motionState,
  motionSettleTo: null,
  motionDurationMs: 0,
  motionPulseId: null,
  outcome: "neutral",
  ...overrides
});

export const getIdleCoachState = () =>
  createCoachState({
    message: "Welcome back. The board awaits.",
    explanation: "Start a duel and I will read each move as it lands.",
    ...createPersistentCoachMotion("idle")
  });

export const getWelcomeCoachState = (context = "new-game") => {
  if (context === "resume") {
    return createCoachState({
      message: "The duel resumes. Read the tension carefully.",
      explanation: "The board remembers every threat. Move with intent.",
      animate: true,
      ...createTransientCoachMotion("welcome", "idle", 1850)
    });
  }

  if (context === "load-active") {
    return createCoachState({
      message: "Your opponent is ready. Let us begin.",
      explanation: "Make your first move. I will read the position.",
      ...createTransientCoachMotion("welcome", "idle", 1700)
    });
  }

  return createCoachState({
    message: "A new duel begins. Choose wisely.",
    explanation: "I will speak when the balance shifts.",
    animate: true,
    ...createTransientCoachMotion("welcome", "idle", 1900)
  });
};

export const getThinkingCoachState = (message = "Reading the position...") =>
  createCoachState({
    source: "system",
    classification: null,
    tone: "thinking",
    message,
    explanation: THINKING_COACH_EXPLANATION,
    bestMove: null,
    animate: false,
    ...createPersistentCoachMotion("thinking")
  });

export const getDrawCoachState = (gameState, outcome) => {
  switch (gameState.status.code) {
    case "stalemate":
      return createCoachState({
        source: "system",
        message: "The board is locked. Stalemate.",
        explanation: "No legal move remained, yet no king stood in check.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-repetition":
      return createCoachState({
        source: "system",
        message: "The pattern repeated until the duel cooled.",
        explanation: "Draw by repetition. A fresh plan was needed to break the loop.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-fivefold-repetition":
      return createCoachState({
        source: "system",
        message: "The same pattern echoed until the duel was forced still.",
        explanation: "Draw by fivefold repetition. The position repeated beyond recovery.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-insufficient-material":
      return createCoachState({
        source: "system",
        message: "Neither side held enough force to finish.",
        explanation: "Draw by insufficient material. Mate was no longer possible.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-fifty-move":
      return createCoachState({
        source: "system",
        message: "The struggle faded without a break.",
        explanation: "Draw by fifty-move rule. No pawn break or capture came in time.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-seventy-five-move":
      return createCoachState({
        source: "system",
        message: "The duel exhausted itself beyond recall.",
        explanation: "Draw by seventy-five-move rule. The board reached a forced dead calm.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-agreed":
      return createCoachState({
        source: "system",
        message: "Both sides set the blades down. Draw agreed.",
        explanation: "The duel ends by mutual consent. Begin another when ready.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    case "draw-timeout-insufficient-material":
      return createCoachState({
        source: "system",
        message: "The flag fell, but no mating force remained.",
        explanation:
          "Draw by timeout versus insufficient material. The finish could no longer be forced.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
    default:
      return createCoachState({
        source: "system",
        message: "A measured draw. Neither side broke the balance.",
        explanation: "Study the pattern and begin again when you wish.",
        ...createPersistentCoachMotion("draw-special", {
          outcome
        })
      });
  }
};

export const getGameOverCoachState = (gameState) => {
  const playerWon =
    (gameState.result === "white-win" && gameState.settings.playerColor === "white") ||
    (gameState.result === "black-win" && gameState.settings.playerColor === "black");
  const outcome = playerWon ? "win" : gameState.result === "draw" ? "draw" : "loss";

  if (gameState.status.code === "resignation") {
    return createCoachState({
      message: playerWon ? "The enemy yields. The duel is yours." : "The duel ends in resignation.",
      explanation: playerWon
        ? "A clean finish. Begin another when ready."
        : "Reset your line and return when ready.",
      ...createPersistentCoachMotion("game-over", {
        outcome
      })
    });
  }

  if (gameState.status.code === "timeout") {
    return createCoachState({
      message: playerWon ? "Their flag fell. The duel is yours." : "Your clock fell before the finish.",
      explanation: playerWon
        ? "Time pressure finished the battle. Begin another when ready."
        : "The position may have held, but the clock did not. Reset and return sharper.",
      ...createPersistentCoachMotion("game-over", {
        outcome
      })
    });
  }

  if (gameState.result === "draw") {
    return getDrawCoachState(gameState, outcome);
  }

  if (playerWon) {
    return createCoachState({
      message: "Victory. Your final attack held.",
      explanation: "The board is yours. Begin another duel when ready.",
      ...createPersistentCoachMotion("game-over", {
        outcome
      })
    });
  }

  return createCoachState({
    message: "Defeat this time. The lesson remains.",
    explanation: "Study the final pattern, then set the pieces again.",
    ...createPersistentCoachMotion("game-over", {
      outcome
    })
  });
};

export const getCoachLead = (classification) => {
  const knownClassifications = new Set([
    "blunder",
    "miss",
    "mistake",
    "inaccuracy",
    "good",
    "excellent",
    "best",
    "great",
    "brilliant"
  ]);

  if (knownClassifications.has(classification)) {
    return classification;
  }

  return "Arcane Coach is watching the board.";
};

export const getCoachTone = (classification) => {
  if (["blunder", "miss"].includes(classification)) {
    return "blunder";
  }

  if (["mistake", "inaccuracy"].includes(classification)) {
    return "inaccuracy";
  }

  if (["good", "excellent", "best", "great", "brilliant"].includes(classification)) {
    return "good";
  }

  return "neutral";
};

export const getReactionMotionState = (coachFeedback = {}) => {
  if (coachFeedback.motionState) {
    return coachFeedback.motionState;
  }

  if (["good", "excellent", "best", "great", "brilliant"].includes(coachFeedback.classification)) {
    return "good";
  }

  if (["mistake", "inaccuracy"].includes(coachFeedback.classification)) {
    return "inaccuracy";
  }

  if (["blunder", "miss"].includes(coachFeedback.classification)) {
    return "blunder";
  }

  return "idle";
};

export const buildCoachFeedbackState = (coachFeedback = {}) => {
  const source = coachFeedback.source || "system";
  const isOpponentFeedback = source === "engine" || source === "opponent";
  const motionState = getReactionMotionState(coachFeedback);
  const motionDurationMs = coachFeedback.motionDurationMs || 1650;
  const normalizedClassification =
    typeof coachFeedback.classification === "string"
      ? coachFeedback.classification.trim().toLowerCase()
      : "";
  const ratingMessage = normalizedClassification && !isOpponentFeedback
    ? `Your move was rated ${normalizedClassification}.`
    : null;
  const threatSummary =
    typeof coachFeedback.threatSummary === "string" ? coachFeedback.threatSummary.trim() : "";
  const advisoryMessage =
    threatSummary ||
    (typeof coachFeedback.message === "string" ? coachFeedback.message.trim() : "") ||
    "Your opponent is applying pressure. Choose a concrete defensive plan.";
  const whyLines = Array.isArray(coachFeedback.whyLines)
    ? coachFeedback.whyLines
        .map((line = {}) => ({
          rank: Number(line.rank) || null,
          eval: typeof line.eval === "number" ? line.eval : null,
          san: Array.isArray(line.san)
            ? line.san.filter((move) => typeof move === "string" && move.trim().length > 0)
            : []
        }))
        .filter((line) => line.san.length > 0)
    : [];

  return createCoachState({
    source,
    classification: coachFeedback.classification || null,
    tone:
      coachFeedback.tone ||
      (isOpponentFeedback ? "warning" : getCoachTone(coachFeedback.classification)),
    message:
      ratingMessage ||
      (isOpponentFeedback
        ? advisoryMessage
        : coachFeedback.message || getCoachLead(coachFeedback.classification)),
    explanation:
      coachFeedback.explanation ||
      (isOpponentFeedback
        ? "Advisory mode: read the threat and choose your response."
        : DEFAULT_COACH_EXPLANATION),
    bestMove: coachFeedback.bestMove || null,
    whyLines,
    whyExpanded: false,
    animate: coachFeedback.animate !== false,
    ...(motionState === "idle"
      ? createPersistentCoachMotion("idle")
      : createTransientCoachMotion(motionState, "idle", motionDurationMs))
  });
};

export const getDefaultCoachState = (gameState, context = "default") => {
  if (!gameState?.hasStarted) {
    return getIdleCoachState();
  }

  if (gameState.isGameOver) {
    return getGameOverCoachState(gameState);
  }

  if (context === "new-game" || context === "resume" || context === "load-active") {
    return getWelcomeCoachState(context);
  }

  const drawClaim = renderCoachDeps.getDrawClaimState(gameState);

  if (drawClaim?.available) {
    return createCoachState({
      message: drawClaim.message,
      explanation:
        gameState.turn === gameState.settings.engineColor
          ? "Claim the draw now, or continue play to allow the engine reply."
          : "You may claim the draw before choosing a different continuation.",
      ...createPersistentCoachMotion("draw-special", {
        outcome: "draw"
      })
    });
  }

  if (gameState.status?.code === "check") {
    return createCoachState({
      message: gameState.status.message,
      explanation: "Your king is threatened. Resolve the check immediately.",
      ...createPersistentCoachMotion("warning")
    });
  }

  if (gameState.turn === gameState.settings.engineColor) {
    return getThinkingCoachState("The enemy studies your last move...");
  }

  return createCoachState({
    message: gameState.status?.message || "Your move.",
    explanation: "Choose a move that improves your position.",
    ...createPersistentCoachMotion("idle")
  });
};

export const animateCoachMessage = () => {
  if (!dom.coachBubbleCopy) {
    return;
  }

  if (runtimeState.coachMessageAnimationTimeoutId) {
    window.clearTimeout(runtimeState.coachMessageAnimationTimeoutId);
  }

  dom.coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  void dom.coachBubbleCopy.offsetWidth;
  dom.coachBubbleCopy.classList.add("coach-bubble-copy-update");

  if (dom.coachPanel) {
    if (runtimeState.coachSpeakingAnimationTimeoutId) {
      window.clearTimeout(runtimeState.coachSpeakingAnimationTimeoutId);
    }

    dom.coachPanel.classList.remove("coach-panel-speaking");
    void dom.coachPanel.offsetWidth;
    dom.coachPanel.classList.add("coach-panel-speaking");

    runtimeState.coachSpeakingAnimationTimeoutId = window.setTimeout(() => {
      dom.coachPanel.classList.remove("coach-panel-speaking");
    }, 360);
  }

  runtimeState.coachMessageAnimationTimeoutId = window.setTimeout(() => {
    dom.coachBubbleCopy.classList.remove("coach-bubble-copy-update");
  }, 180);
};

export const scheduleCoachMotionReset = (coachState) => {
  if (runtimeState.coachMotionAnimationTimeoutId) {
    window.clearTimeout(runtimeState.coachMotionAnimationTimeoutId);
    runtimeState.coachMotionAnimationTimeoutId = null;
  }

  if (!coachState.motionPulseId || !coachState.motionDurationMs) {
    runtimeState.lastRenderedCoachMotionPulseId = coachState.motionPulseId || null;
    return;
  }

  const motionPulseId = coachState.motionPulseId;
  const settleTo = coachState.motionSettleTo || "idle";
  const nextOutcome = settleTo === "game-over" ? coachState.outcome : "neutral";

  runtimeState.coachMotionAnimationTimeoutId = window.setTimeout(() => {
    if (state.coach.motionPulseId !== motionPulseId) {
      return;
    }

    state.coach = createCoachState({
      ...state.coach,
      ...createPersistentCoachMotion(settleTo, {
        outcome: nextOutcome
      })
    });
    renderCoachPanel();
  }, coachState.motionDurationMs);

  runtimeState.lastRenderedCoachMotionPulseId = motionPulseId;
};

export const renderCoachPanel = () => {
  if (!dom.coachPanel) {
    return;
  }

  const coachState = state.coach || createCoachState();
  const coachSignature = JSON.stringify({
    motionState: coachState.motionState,
    tone: coachState.tone,
    classification: coachState.classification,
    message: coachState.message,
    explanation: coachState.explanation,
    bestMove: coachState.bestMove,
    whyExpanded: coachState.whyExpanded,
    whyLines: coachState.whyLines
  });
  const motionPulseChanged = coachState.motionPulseId !== runtimeState.lastRenderedCoachMotionPulseId;

  dom.coachPanel.dataset.tone = coachState.tone || "neutral";
  dom.coachPanel.dataset.motionState = coachState.motionState || "idle";
  dom.coachPanel.dataset.outcome = coachState.outcome || "neutral";

  dom.feedbackText.textContent = coachState.message;
  dom.feedbackText.title = coachState.message || "";
  dom.feedbackExplanation.textContent = coachState.explanation || DEFAULT_COACH_EXPLANATION;
  dom.feedbackExplanation.title = coachState.explanation || DEFAULT_COACH_EXPLANATION;

  const showClassificationBadge =
    Boolean(coachState.classification) &&
    !["engine", "opponent"].includes(coachState.source || "");

  if (showClassificationBadge) {
    dom.feedbackBadge.textContent = coachState.classification;
    dom.feedbackBadge.className = `feedback-badge feedback-badge-${coachState.tone}`;
  } else {
    dom.feedbackBadge.textContent = "";
    dom.feedbackBadge.className = "feedback-badge hidden";
  }

  if (coachState.bestMove) {
    dom.feedbackSuggestion.textContent = `Better move: ${coachState.bestMove}`;
    dom.feedbackSuggestion.title = `Better move: ${coachState.bestMove}`;
    dom.feedbackSuggestion.classList.remove("hidden");
  } else {
    dom.feedbackSuggestion.textContent = "";
    dom.feedbackSuggestion.title = "";
    dom.feedbackSuggestion.classList.add("hidden");
  }

  const hasWhyLines = Array.isArray(coachState.whyLines) && coachState.whyLines.length > 0;

  if (dom.feedbackWhyToggle) {
    dom.feedbackWhyToggle.classList.toggle("hidden", !hasWhyLines);
    dom.feedbackWhyToggle.disabled = !hasWhyLines;
    dom.feedbackWhyToggle.textContent = coachState.whyExpanded ? "Hide Why" : "Why?";
    dom.feedbackWhyToggle.setAttribute("aria-expanded", coachState.whyExpanded ? "true" : "false");
  }

  if (dom.feedbackWhyLines) {
    dom.feedbackWhyLines.replaceChildren();
    dom.feedbackWhyLines.classList.toggle("hidden", !hasWhyLines || !coachState.whyExpanded);

    if (hasWhyLines && coachState.whyExpanded) {
      coachState.whyLines.forEach((line, index) => {
        const lineElement = document.createElement("p");
        lineElement.className = "coach-why-line";

        const rank = Number(line.rank) || index + 1;
        const evalText = typeof line.eval === "number" ? ` (${line.eval >= 0 ? "+" : ""}${line.eval})` : "";
        lineElement.textContent = `Line ${rank}${evalText}: ${line.san.join(" ")}`;
        dom.feedbackWhyLines.appendChild(lineElement);
      });
    }
  }

  dom.feedbackThinking?.classList.toggle("hidden", coachState.motionState !== "thinking");

  dom.coachFooter?.classList.toggle(
    "coach-footer-empty",
    !coachState.classification && !coachState.bestMove && !hasWhyLines
  );

  if (
    coachState.animate &&
    coachState.motionState !== "thinking" &&
    coachSignature !== runtimeState.lastRenderedCoachSignature
  ) {
    animateCoachMessage();
  }

  if (motionPulseChanged || coachState.motionPulseId === null) {
    scheduleCoachMotionReset(coachState);
  }

  runtimeState.lastRenderedCoachSignature = coachSignature;
  state.coach.animate = false;
};

export const setCoachMessage = (message, explanation = DEFAULT_COACH_EXPLANATION) => {
  state.coach = createCoachState({
    ...state.coach,
    classification: null,
    tone: "neutral",
    message,
    explanation,
    bestMove: null,
    whyLines: [],
    whyExpanded: false,
    animate: false,
    ...createPersistentCoachMotion("idle")
  });
  renderCoachPanel();
};
