const assert = require("assert");

const {
  createClockState,
  getClockStateView,
  normalizeTimeControl,
  pauseClockState,
  resumeClockState,
  switchClockTurn
} = require("../services/clockService");

const BASE_TIME = Date.parse("2026-01-01T12:00:00.000Z");

const runClockHarness = () => {
  const untimed = normalizeTimeControl();
  assert.equal(untimed.id, "untimed");
  assert.equal(untimed.enabled, false);

  const rapid = normalizeTimeControl("rapid-15-10");
  assert.equal(rapid.baseMs, 900000);
  assert.equal(rapid.incrementMs, 10000);

  const initialClock = createClockState("blitz-5", "white", BASE_TIME);
  const fiveSecondsLater = getClockStateView(initialClock, BASE_TIME + 5000);
  assert.equal(fiveSecondsLater.whiteMs, 295000);
  assert.equal(fiveSecondsLater.blackMs, 300000);
  assert.equal(fiveSecondsLater.activeColor, "white");

  const switchedClock = switchClockTurn(
    initialClock,
    "white",
    "black",
    BASE_TIME + 5000
  );
  const afterSwitch = getClockStateView(switchedClock, BASE_TIME + 5000);
  assert.equal(afterSwitch.whiteMs, 295000);
  assert.equal(afterSwitch.blackMs, 300000);
  assert.equal(afterSwitch.activeColor, "black");
  assert.equal(afterSwitch.isRunning, true);

  const incrementClock = createClockState("rapid-15-10", "white", BASE_TIME);
  const incrementSwitched = switchClockTurn(
    incrementClock,
    "white",
    "black",
    BASE_TIME + 8000
  );
  const incrementView = getClockStateView(incrementSwitched, BASE_TIME + 8000);
  assert.equal(incrementView.whiteMs, 902000);
  assert.equal(incrementView.blackMs, 900000);

  const pausedClock = pauseClockState(incrementSwitched, BASE_TIME + 12000);
  const pausedView = getClockStateView(pausedClock, BASE_TIME + 22000);
  assert.equal(pausedView.blackMs, 896000);
  assert.equal(pausedView.isRunning, false);

  const resumedClock = resumeClockState(pausedClock, BASE_TIME + 22000);
  const resumedView = getClockStateView(resumedClock, BASE_TIME + 26000);
  assert.equal(resumedView.blackMs, 892000);
  assert.equal(resumedView.isRunning, true);

  console.log("Clock harness passed.");
};

runClockHarness();
