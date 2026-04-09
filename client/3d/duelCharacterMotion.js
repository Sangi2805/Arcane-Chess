const DANGER_STATUS_CODES = new Set(["check", "checkmate"]);

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const getOpposingSide = (side) => (side === "white" ? "black" : "white");

const getSquareFileBias = (square = "d4") => {
  if (typeof square !== "string" || square.length < 2) {
    return 0;
  }

  const fileIndex = square.charCodeAt(0) - 97;
  return clampValue((fileIndex - 3.5) / 3.5, -1, 1);
};

const createReactionFrame = (values = {}) => ({
  duration: values.duration ?? 0.9,
  anchorLift: values.anchorLift ?? 0,
  anchorSide: values.anchorSide ?? 0,
  turn: values.turn ?? 0,
  lean: values.lean ?? 0,
  roll: values.roll ?? 0,
  bodyLift: values.bodyLift ?? 0,
  chestTurn: values.chestTurn ?? 0,
  chestRoll: values.chestRoll ?? 0,
  chestAdvance: values.chestAdvance ?? 0,
  headTurn: values.headTurn ?? 0,
  headPitch: values.headPitch ?? 0,
  headRoll: values.headRoll ?? 0,
  leftArmLift: values.leftArmLift ?? 0,
  leftArmSwing: values.leftArmSwing ?? 0,
  rightArmLift: values.rightArmLift ?? 0,
  rightArmSwing: values.rightArmSwing ?? 0,
  staffLift: values.staffLift ?? 0,
  staffTwist: values.staffTwist ?? 0,
  cloakSweep: values.cloakSweep ?? 0,
  aura: values.aura ?? 0
});

const ZERO_REACTION = createReactionFrame();

const createPresenceState = (side, phase = 0) => ({
  side,
  phase,
  reaction: null
});

const createDuelPresenceStates = (playerSlots = {}) => ({
  white: createPresenceState("white", playerSlots.white?.phase ?? 0),
  black: createPresenceState("black", playerSlots.black?.phase ?? Math.PI * 0.82)
});

const resetDuelPresenceStates = (states = {}) => {
  Object.values(states).forEach((state) => {
    if (!state) {
      return;
    }

    state.reaction = null;
  });
};

const isDangerStatus = (statusCode, isCheck = false) =>
  Boolean(isCheck) || DANGER_STATUS_CODES.has(statusCode);

const buildDuelReactionEvent = ({
  lastMove,
  statusCode = "active",
  isCheck = false
} = {}) => {
  if (!lastMove?.color) {
    return null;
  }

  const moverSide = lastMove.color;
  const opposingSide = getOpposingSide(moverSide);
  const fileBias = getSquareFileBias(lastMove.to);
  const moverBias = fileBias * (moverSide === "white" ? -1 : 1);
  const opposingBias = fileBias * (opposingSide === "white" ? -1 : 1);
  const capture = Boolean(lastMove.captured);
  const danger = isDangerStatus(statusCode, isCheck);
  const checkmate = statusCode === "checkmate";

  let moverReaction = createReactionFrame({
    duration: 0.86,
    anchorLift: 0.025,
    turn: moverBias * 0.02,
    lean: 0.055,
    roll: -moverBias * 0.015,
    bodyLift: 0.02,
    chestTurn: moverBias * 0.065,
    chestAdvance: 0.045,
    headTurn: moverBias * 0.14,
    headPitch: -0.05,
    leftArmLift: -0.02,
    leftArmSwing: -moverBias * 0.035,
    rightArmLift: -0.05,
    rightArmSwing: moverBias * 0.05,
    staffLift: 0.075,
    staffTwist: moverBias * 0.045,
    cloakSweep: 0.06,
    aura: 0.2
  });

  let opposingReaction = createReactionFrame({
    duration: 0.78,
    anchorLift: 0.012,
    turn: opposingBias * 0.012,
    lean: -0.018,
    roll: opposingBias * 0.008,
    chestTurn: opposingBias * 0.05,
    chestAdvance: 0.02,
    headTurn: opposingBias * 0.12,
    headPitch: -0.02,
    leftArmLift: 0.01,
    leftArmSwing: opposingBias * 0.02,
    rightArmLift: 0.02,
    rightArmSwing: -opposingBias * 0.02,
    staffLift: 0.028,
    staffTwist: opposingBias * 0.02,
    cloakSweep: 0.04,
    aura: 0.1
  });

  let eventKind = "move";
  let intensity = 0.52;
  let emphasisSide = moverSide;
  let threatenedSide = null;

  if (capture) {
    moverReaction = createReactionFrame({
      ...moverReaction,
      duration: 0.96,
      anchorLift: 0.038,
      lean: 0.075,
      roll: -moverBias * 0.02,
      bodyLift: 0.03,
      chestTurn: moverBias * 0.085,
      chestAdvance: 0.06,
      headTurn: moverBias * 0.16,
      headPitch: -0.06,
      rightArmLift: -0.075,
      rightArmSwing: moverBias * 0.07,
      staffLift: 0.1,
      staffTwist: moverBias * 0.06,
      cloakSweep: 0.085,
      aura: 0.26
    });
    opposingReaction = createReactionFrame({
      ...opposingReaction,
      duration: 0.9,
      anchorLift: 0.018,
      anchorSide: opposingBias * -0.035,
      lean: -0.042,
      roll: opposingBias * 0.02,
      bodyLift: 0.018,
      chestTurn: opposingBias * 0.065,
      chestAdvance: -0.03,
      headTurn: opposingBias * 0.14,
      headPitch: 0.015,
      leftArmLift: 0.028,
      rightArmLift: 0.04,
      staffLift: 0.052,
      cloakSweep: 0.06,
      aura: 0.16
    });
    eventKind = "capture";
    intensity = 0.74;
  }

  if (danger) {
    moverReaction = createReactionFrame({
      duration: checkmate ? 1.28 : 1.08,
      anchorLift: checkmate ? 0.05 : 0.04,
      anchorSide: moverBias * 0.018,
      turn: moverBias * 0.022,
      lean: checkmate ? 0.084 : 0.072,
      roll: -moverBias * 0.026,
      bodyLift: 0.034,
      chestTurn: moverBias * 0.1,
      chestAdvance: 0.065,
      headTurn: moverBias * 0.18,
      headPitch: -0.07,
      leftArmLift: -0.04,
      leftArmSwing: -moverBias * 0.04,
      rightArmLift: -0.09,
      rightArmSwing: moverBias * 0.08,
      staffLift: 0.115,
      staffTwist: moverBias * 0.08,
      cloakSweep: 0.095,
      aura: checkmate ? 0.34 : 0.3
    });
    opposingReaction = createReactionFrame({
      duration: checkmate ? 1.36 : 1.14,
      anchorLift: checkmate ? 0.034 : 0.026,
      anchorSide: opposingBias * -0.05,
      turn: opposingBias * 0.018,
      lean: checkmate ? -0.09 : -0.07,
      roll: opposingBias * 0.03,
      bodyLift: 0.026,
      chestTurn: opposingBias * 0.08,
      chestRoll: opposingBias * 0.02,
      chestAdvance: -0.055,
      headTurn: opposingBias * 0.16,
      headPitch: checkmate ? 0.06 : 0.04,
      headRoll: opposingBias * 0.02,
      leftArmLift: 0.05,
      leftArmSwing: opposingBias * 0.03,
      rightArmLift: 0.07,
      rightArmSwing: -opposingBias * 0.05,
      staffLift: 0.075,
      staffTwist: opposingBias * 0.05,
      cloakSweep: 0.08,
      aura: checkmate ? 0.32 : 0.28
    });
    eventKind = checkmate ? "checkmate" : "check";
    intensity = checkmate ? 1.02 : 0.92;
    emphasisSide = opposingSide;
    threatenedSide = opposingSide;
  }

  return {
    key: `${lastMove.from}:${lastMove.to}:${lastMove.san || ""}:${eventKind}`,
    kind: eventKind,
    moverSide,
    opposingSide,
    capture,
    danger,
    intensity,
    threatenedSide,
    squareBias: fileBias,
    camera: {
      emphasisSide,
      threatenedSide,
      capture,
      danger,
      intensity,
      squareBias: fileBias
    },
    slotReactions: {
      [moverSide]: moverReaction,
      [opposingSide]: opposingReaction
    }
  };
};

const queueDuelReaction = (states = {}, event, elapsed = 0) => {
  if (!event?.slotReactions) {
    return;
  }

  Object.entries(event.slotReactions).forEach(([side, frame]) => {
    if (!states[side]) {
      states[side] = createPresenceState(side, side === "white" ? 0 : Math.PI * 0.82);
    }

    states[side].reaction = {
      ...frame,
      startTime: elapsed
    };
  });
};

const getReactionWeight = (progress) => {
  const pulse = Math.sin(progress * Math.PI);
  const accent = 0.9 + Math.sin(progress * Math.PI * 2 + 0.35) * 0.1;
  return pulse * accent;
};

const scaleReactionFrame = (frame, weight) => ({
  anchorLift: frame.anchorLift * weight,
  anchorSide: frame.anchorSide * weight,
  turn: frame.turn * weight,
  lean: frame.lean * weight,
  roll: frame.roll * weight,
  bodyLift: frame.bodyLift * weight,
  chestTurn: frame.chestTurn * weight,
  chestRoll: frame.chestRoll * weight,
  chestAdvance: frame.chestAdvance * weight,
  headTurn: frame.headTurn * weight,
  headPitch: frame.headPitch * weight,
  headRoll: frame.headRoll * weight,
  leftArmLift: frame.leftArmLift * weight,
  leftArmSwing: frame.leftArmSwing * weight,
  rightArmLift: frame.rightArmLift * weight,
  rightArmSwing: frame.rightArmSwing * weight,
  staffLift: frame.staffLift * weight,
  staffTwist: frame.staffTwist * weight,
  cloakSweep: frame.cloakSweep * weight,
  aura: frame.aura * weight
});

const resolveReaction = (state, elapsed) => {
  if (!state?.reaction) {
    return ZERO_REACTION;
  }

  const duration = Math.max(state.reaction.duration || 0.9, 0.01);
  const progress = clampValue((elapsed - state.reaction.startTime) / duration, 0, 1);

  if (progress >= 1) {
    state.reaction = null;
    return ZERO_REACTION;
  }

  return scaleReactionFrame(state.reaction, getReactionWeight(progress));
};

const setGlowOpacity = (object, multiplier = 1) => {
  object?.traverse?.((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.userData.baseOpacity ??= material.opacity ?? 1;
      material.opacity = material.userData.baseOpacity * multiplier;
    });
  });
};

const setEmissiveIntensity = (mesh, multiplier = 1) => {
  if (!mesh?.material) {
    return;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    material.userData.baseEmissiveIntensity ??= material.emissiveIntensity ?? 0;
    material.emissiveIntensity = material.userData.baseEmissiveIntensity * multiplier;
  });
};

const updatePresenceSlot = (slot, state, elapsed) => {
  if (!slot || !state) {
    return;
  }

  const phase = state.phase ?? 0;
  const breath = Math.sin(elapsed * 0.82 + phase);
  const sway = Math.sin(elapsed * 0.44 + phase * 0.73);
  const gaze = Math.sin(elapsed * 0.36 + phase * 0.58);
  const handWave = Math.sin(elapsed * 0.94 + phase + 0.25);
  const reaction = resolveReaction(state, elapsed);

  slot.characterAnchor.position.y =
    (slot.baseAnchorY ?? 0.24) + breath * 0.044 + sway * 0.006 + reaction.anchorLift;
  slot.characterAnchor.position.x = reaction.anchorSide;
  slot.characterAnchor.rotation.y = slot.baseRotationY + gaze * 0.025 + reaction.turn;

  slot.motionRoot.position.y = breath * 0.02 + reaction.bodyLift * 0.34;

  slot.bodyRoot.rotation.x = breath * 0.012 + reaction.lean;
  slot.bodyRoot.rotation.z = sway * 0.014 + reaction.roll;

  slot.torsoPivot.position.z = reaction.chestAdvance;
  slot.torsoPivot.rotation.y = gaze * 0.05 + reaction.chestTurn;
  slot.torsoPivot.rotation.z = sway * 0.018 + reaction.chestRoll;

  slot.headPivot.rotation.y = gaze * 0.085 + reaction.headTurn;
  slot.headPivot.rotation.x = Math.sin(elapsed * 0.56 + phase + 0.35) * 0.032 + reaction.headPitch;
  slot.headPivot.rotation.z = Math.sin(elapsed * 0.38 + phase) * 0.018 + reaction.headRoll;

  slot.leftArmPivot.rotation.x = -0.16 + breath * 0.03 + reaction.leftArmLift;
  slot.leftArmPivot.rotation.z = -0.28 + sway * 0.04 + reaction.leftArmSwing;
  slot.rightArmPivot.rotation.x = -0.2 + breath * 0.04 + reaction.rightArmLift;
  slot.rightArmPivot.rotation.z = 0.22 - sway * 0.038 + reaction.rightArmSwing;

  slot.staffPivot.rotation.x = 0.12 + Math.sin(elapsed * 0.42 + phase) * 0.028 + reaction.staffLift;
  slot.staffPivot.rotation.y = gaze * 0.03 + reaction.headTurn * 0.2;
  slot.staffPivot.rotation.z = -0.04 + Math.sin(elapsed * 0.27 + phase) * 0.02 + reaction.staffTwist;

  slot.cloakFront.rotation.x = -0.08 + breath * 0.026 + reaction.cloakSweep;
  slot.cloakBack.rotation.x = 0.08 + sway * 0.022 - reaction.cloakSweep * 0.42;

  slot.orbitSigil.rotation.y = elapsed * 0.36 + phase;
  slot.orbitSigil.rotation.z = sway * 0.14 + reaction.turn * 0.25;
  slot.crownGlow.rotation.y = elapsed * 0.54 + phase;

  slot.haloDisc.material.opacity = 0.08 + breath * 0.012 + reaction.aura * 0.1;
  slot.haloDisc.scale.setScalar(1 + breath * 0.024 + reaction.aura * 0.08);
  slot.sigilRing.material.opacity = 0.18 + handWave * 0.024 + reaction.aura * 0.1;
  slot.sigilRing.rotation.y = elapsed * 0.28 + phase;
  slot.sigilRing.scale.setScalar(0.96 + breath * 0.02 + reaction.aura * 0.06);
  slot.beam.material.opacity = 0.1 + sway * 0.012 + reaction.aura * 0.12;
  slot.beam.scale.set(
    1 + breath * 0.026 + reaction.aura * 0.05,
    1 + breath * 0.04 + reaction.aura * 0.08,
    1 + breath * 0.026 + reaction.aura * 0.05
  );

  slot.backHalo.material.opacity = 0.12 + gaze * 0.016 + reaction.aura * 0.16;
  slot.backHalo.scale.setScalar(1 + breath * 0.022 + reaction.aura * 0.1);
  slot.chestSigil.material.opacity = 0.18 + handWave * 0.03 + reaction.aura * 0.18;
  slot.hemGlow.material.opacity = 0.08 + breath * 0.01 + reaction.aura * 0.12;
  slot.staffCrystal.rotation.y = elapsed * 0.7 + phase;
  slot.staffCrystal.rotation.z = sway * 0.16 + reaction.staffTwist * 0.6;
  setEmissiveIntensity(slot.staffCrystal, 1 + reaction.aura * 1.1 + Math.max(0, breath) * 0.12);
  setGlowOpacity(slot.staffCrystalGlow, 0.9 + reaction.aura * 0.9);
  setGlowOpacity(slot.leftHandGlow, 0.85 + reaction.aura * 0.3);
  setGlowOpacity(slot.rightHandGlow, 0.88 + reaction.aura * 0.45);
};

const updateDuelPresenceSlots = (playerSlots = {}, states = {}, elapsed = 0) => {
  Object.entries(playerSlots).forEach(([side, slot]) => {
    if (!states[side]) {
      states[side] = createPresenceState(side, slot.phase ?? 0);
    }

    updatePresenceSlot(slot, states[side], elapsed);
  });
};

export {
  buildDuelReactionEvent,
  createDuelPresenceStates,
  getOpposingSide,
  queueDuelReaction,
  resetDuelPresenceStates,
  updateDuelPresenceSlots
};
