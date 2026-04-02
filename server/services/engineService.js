const path = require("path");
const { spawn } = require("child_process");

const DIFFICULTY_PRESETS = {
  // Keep the spread wide so each mode feels materially different in actual play.
  easy: {
    label: "Easy",
    skillLevel: 1,
    depth: 3,
    moveTime: 120,
    drawOffer: {
      minHalfMoves: 14,
      maxMaterialGap: 3
    }
  },
  intermediate: {
    label: "Intermediate",
    skillLevel: 6,
    depth: 7,
    moveTime: 350,
    drawOffer: {
      minHalfMoves: 20,
      maxMaterialGap: 2
    }
  },
  hard: {
    label: "Hard",
    skillLevel: 12,
    depth: 11,
    moveTime: 900,
    drawOffer: {
      minHalfMoves: 28,
      maxMaterialGap: 1
    }
  },
  grandmaster: {
    label: "Grand Master",
    skillLevel: 20,
    depth: 16,
    moveTime: 1800,
    drawOffer: {
      minHalfMoves: 36,
      maxMaterialGap: 1
    }
  }
};

const DEFAULT_THREADS = 1;
const DEFAULT_HASH = 16;

const createMoveFromUci = (uciMove) => {
  if (!uciMove || uciMove === "(none)" || uciMove.length < 4) {
    return null;
  }

  return {
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove.slice(4, 5) || undefined
  };
};

const parseAnalysisLine = (line) => {
  if (!line.startsWith("info ")) {
    return null;
  }

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  const mateMatch = line.match(/\bscore mate (-?\d+)/);

  if (!cpMatch && !mateMatch) {
    return null;
  }

  const pvMatch = line.match(/\bpv (.+)$/);

  return {
    score: cpMatch
      ? {
          type: "cp",
          value: Number(cpMatch[1])
        }
      : {
          type: "mate",
          value: Number(mateMatch[1])
        },
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/).filter(Boolean) : []
  };
};

class EngineService {
  constructor() {
    this.engine = null;
    this.buffer = "";
    this.listeners = [];
    this.lineObservers = [];
    this.queue = Promise.resolve();
    this.readyPromise = null;
    this.enginePath = path.resolve(
      __dirname,
      "..",
      "node_modules",
      "stockfish",
      "bin",
      "stockfish.js"
    );
  }

  getDifficultyPreset(level = "easy") {
    return DIFFICULTY_PRESETS[level] || DIFFICULTY_PRESETS.easy;
  }

  async getBestMove({ fen, difficulty }) {
    const preset = this.getDifficultyPreset(difficulty);
    const nextTask = this.queue
      .catch(() => undefined)
      .then(() =>
        this.runPositionAnalysis({
          fen,
          depth: preset.depth,
          moveTime: preset.moveTime,
          skillLevel: preset.skillLevel
        })
      );

    this.queue = nextTask;

    const analysis = await nextTask;

    if (!analysis.bestMove) {
      return null;
    }

    return {
      ...analysis.bestMove,
      difficulty: preset
    };
  }

  async getPositionAnalysis({
    fen,
    depth = 8,
    moveTime = 150,
    skillLevel = 20,
    searchMoves = []
  }) {
    const nextTask = this.queue
      .catch(() => undefined)
      .then(() =>
        this.runPositionAnalysis({
          fen,
          depth,
          moveTime,
          skillLevel,
          searchMoves
        })
      );

    this.queue = nextTask;

    return nextTask;
  }

  async runPositionAnalysis({
    fen,
    depth,
    moveTime,
    skillLevel,
    searchMoves = []
  }) {
    await this.ensureReady();
    this.configureEngine({ skillLevel });
    this.send("ucinewgame");
    this.send("isready");
    await this.waitForLine((line) => line === "readyok", 15000);

    let latestInfo = null;
    const observer = (line) => {
      const parsed = parseAnalysisLine(line);

      if (parsed) {
        latestInfo = parsed;
      }
    };

    this.lineObservers.push(observer);
    this.send(`position fen ${fen}`);
    this.send(
      [
        "go",
        ...(searchMoves.length ? ["searchmoves", ...searchMoves] : []),
        "depth",
        String(depth),
        "movetime",
        String(moveTime)
      ].join(" ")
    );

    try {
      const bestMoveLine = await this.waitForLine(
        (line) => line.startsWith("bestmove "),
        20000
      );
      const bestMoveUci = bestMoveLine.split(" ")[1];

      return {
        bestMoveUci,
        bestMove: createMoveFromUci(bestMoveUci),
        score: latestInfo?.score || null,
        pv: latestInfo?.pv || []
      };
    } finally {
      this.removeLineObserver(observer);
    }
  }

  configureEngine({ skillLevel }) {
    this.send(`setoption name Skill Level value ${skillLevel}`);
    this.send(`setoption name Threads value ${DEFAULT_THREADS}`);
    this.send(`setoption name Hash value ${DEFAULT_HASH}`);
  }

  removeLineObserver(observer) {
    this.lineObservers = this.lineObservers.filter(
      (candidate) => candidate !== observer
    );
  }

  async ensureReady() {
    if (this.engine && !this.engine.killed && !this.readyPromise) {
      return;
    }

    if (!this.readyPromise) {
      this.readyPromise = this.spawnEngine().finally(() => {
        this.readyPromise = null;
      });
    }

    await this.readyPromise;
  }

  spawnEngine() {
    return new Promise((resolve, reject) => {
      const engine = spawn(process.execPath, [this.enginePath], {
        cwd: path.dirname(this.enginePath),
        stdio: ["pipe", "pipe", "pipe"]
      });

      this.engine = engine;
      this.buffer = "";
      this.listeners = [];
      this.lineObservers = [];

      engine.stdout.on("data", (chunk) => this.consumeOutput(chunk.toString()));
      engine.stderr.on("data", (chunk) => this.consumeOutput(chunk.toString()));
      engine.on("error", reject);
      engine.on("exit", () => {
        this.engine = null;
      });

      this.send("uci");
      this.waitForLine((line) => line === "uciok", 15000)
        .then(async () => {
          this.send("isready");
          await this.waitForLine((line) => line === "readyok", 15000);
          resolve();
        })
        .catch(reject);
    });
  }

  consumeOutput(output) {
    this.buffer += output;

    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || "";

    lines
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        this.lineObservers.forEach((observer) => {
          try {
            observer(line);
          } catch (error) {
            // Ignore observer errors so the primary engine flow stays alive.
          }
        });

        this.listeners = this.listeners.filter((listener) => {
          if (!listener.predicate(line)) {
            return true;
          }

          clearTimeout(listener.timeoutId);
          listener.resolve(line);
          return false;
        });
      });
  }

  waitForLine(predicate, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.listeners = this.listeners.filter(
          (listener) => listener.resolve !== resolve
        );
        reject(new Error("Stockfish did not respond in time."));
      }, timeout);

      this.listeners.push({
        predicate,
        resolve,
        timeoutId
      });
    });
  }

  send(command) {
    if (!this.engine || this.engine.killed) {
      throw new Error("Stockfish engine is not running.");
    }

    this.engine.stdin.write(`${command}\n`);
  }
}

const engineService = new EngineService();
engineService.ensureReady().catch((error) => {
  console.warn("Stockfish engine warm-up skipped:", error.message);
});

module.exports = {
  engineService,
  EngineService,
  DIFFICULTY_PRESETS
};
