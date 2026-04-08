const assert = require("node:assert/strict");

const {
  applyMove,
  createChessGame,
  restoreChessGame,
  serializeGame
} = require("../services/chessService");

const formatSnapshotSummary = (snapshot) =>
  [
    `status=${snapshot.status.code}`,
    `gameOver=${snapshot.isGameOver}`,
    `drawClaim=${snapshot.ruleState?.drawClaim?.available ? snapshot.ruleState.drawClaim.primaryReasonCode : "none"}`,
    `repetition=${snapshot.ruleState?.repetitionCount ?? "-"}`,
    `halfMoves=${snapshot.ruleState?.halfMoveClock ?? "-"}`
  ].join(" | ");

const expectFenCase = ({
  label,
  fen,
  statusCode,
  isGameOver,
  drawReason = undefined,
  drawClaimAvailable = undefined,
  drawClaimReason = undefined
}) => {
  const snapshot = serializeGame(restoreChessGame({ fen }));

  assert.equal(
    snapshot.status.code,
    statusCode,
    `${label}: expected status ${statusCode}, received ${formatSnapshotSummary(snapshot)}`
  );
  assert.equal(
    snapshot.isGameOver,
    isGameOver,
    `${label}: expected isGameOver=${isGameOver}, received ${formatSnapshotSummary(snapshot)}`
  );

  if (drawReason !== undefined) {
    assert.equal(
      snapshot.status.drawReason || null,
      drawReason,
      `${label}: expected drawReason=${drawReason}, received ${formatSnapshotSummary(snapshot)}`
    );
  }

  if (drawClaimAvailable !== undefined) {
    assert.equal(
      snapshot.ruleState?.drawClaim?.available || false,
      drawClaimAvailable,
      `${label}: expected drawClaim.available=${drawClaimAvailable}, received ${formatSnapshotSummary(snapshot)}`
    );
  }

  if (drawClaimReason !== undefined) {
    assert.equal(
      snapshot.ruleState?.drawClaim?.primaryReasonCode || null,
      drawClaimReason,
      `${label}: expected drawClaim.primaryReasonCode=${drawClaimReason}, received ${formatSnapshotSummary(snapshot)}`
    );
  }

  console.log(`PASS ${label}: ${formatSnapshotSummary(snapshot)}`);
};

const expectMoveSequenceCase = ({
  label,
  moves,
  statusCode,
  isGameOver,
  drawClaimAvailable = undefined,
  drawClaimReason = undefined
}) => {
  const chess = createChessGame();

  moves.forEach((move, index) => {
    const appliedMove = applyMove(chess, move);
    assert.ok(
      appliedMove,
      `${label}: move ${index + 1} failed to apply (${JSON.stringify(move)})`
    );
  });

  const snapshot = serializeGame(chess);

  assert.equal(
    snapshot.status.code,
    statusCode,
    `${label}: expected status ${statusCode}, received ${formatSnapshotSummary(snapshot)}`
  );
  assert.equal(
    snapshot.isGameOver,
    isGameOver,
    `${label}: expected isGameOver=${isGameOver}, received ${formatSnapshotSummary(snapshot)}`
  );

  if (drawClaimAvailable !== undefined) {
    assert.equal(
      snapshot.ruleState?.drawClaim?.available || false,
      drawClaimAvailable,
      `${label}: expected drawClaim.available=${drawClaimAvailable}, received ${formatSnapshotSummary(snapshot)}`
    );
  }

  if (drawClaimReason !== undefined) {
    assert.equal(
      snapshot.ruleState?.drawClaim?.primaryReasonCode || null,
      drawClaimReason,
      `${label}: expected drawClaim.primaryReasonCode=${drawClaimReason}, received ${formatSnapshotSummary(snapshot)}`
    );
  }

  console.log(`PASS ${label}: ${formatSnapshotSummary(snapshot)}`);
};

const expectPromotionCase = () => {
  const chess = restoreChessGame({
    fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
  });
  const move = applyMove(chess, {
    from: "a7",
    to: "a8",
    promotion: "q"
  });
  const snapshot = serializeGame(chess);
  const promotedPiece = snapshot.board.find((entry) => entry.square === "a8")?.piece;

  assert.ok(move, "promotion: expected move to apply");
  assert.equal(move.promotion, "q", "promotion: expected explicit queen promotion");
  assert.equal(promotedPiece?.type, "q", "promotion: expected a queen on a8");

  console.log(`PASS promotion: ${formatSnapshotSummary(snapshot)}`);
};

const repetitionCycle = [
  { from: "g1", to: "f3" },
  { from: "g8", to: "f6" },
  { from: "f3", to: "g1" },
  { from: "f6", to: "g8" }
];

const repeatCycle = (times) =>
  Array.from({ length: times }, () => repetitionCycle).flat();

const run = () => {
  expectFenCase({
    label: "K vs K",
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    statusCode: "draw-insufficient-material",
    isGameOver: true,
    drawReason: "insufficient-material"
  });

  expectFenCase({
    label: "K+B vs K",
    fen: "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1",
    statusCode: "draw-insufficient-material",
    isGameOver: true,
    drawReason: "insufficient-material"
  });

  expectFenCase({
    label: "K+N vs K",
    fen: "4k3/8/8/8/8/8/8/2N1K3 w - - 0 1",
    statusCode: "draw-insufficient-material",
    isGameOver: true,
    drawReason: "insufficient-material"
  });

  expectFenCase({
    label: "Stalemate",
    fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
    statusCode: "stalemate",
    isGameOver: true,
    drawReason: "stalemate"
  });

  expectMoveSequenceCase({
    label: "Threefold repetition claim",
    moves: repeatCycle(2),
    statusCode: "active",
    isGameOver: false,
    drawClaimAvailable: true,
    drawClaimReason: "repetition"
  });

  expectMoveSequenceCase({
    label: "Fivefold repetition",
    moves: repeatCycle(4),
    statusCode: "draw-fivefold-repetition",
    isGameOver: true,
    drawClaimAvailable: false
  });

  expectFenCase({
    label: "Fifty-move claim",
    fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 100 1",
    statusCode: "active",
    isGameOver: false,
    drawClaimAvailable: true,
    drawClaimReason: "fifty-move-rule"
  });

  expectFenCase({
    label: "Seventy-five-move automatic draw",
    fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 150 1",
    statusCode: "draw-seventy-five-move",
    isGameOver: true,
    drawReason: "seventy-five-move-rule",
    drawClaimAvailable: false
  });

  expectFenCase({
    label: "Checkmate",
    fen: "rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    statusCode: "checkmate",
    isGameOver: true
  });

  expectPromotionCase();

  console.log("All Arcane Chess rule harness checks passed.");
};

try {
  run();
} catch (error) {
  console.error("Rule harness failed.");
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
