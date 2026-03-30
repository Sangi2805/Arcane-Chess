const path = require("path");
const { spawn } = require("child_process");

const DIFFICULTY_PRESETS = {
  easy: {
    label: "Easy",
    skillLevel: 4,
    depth: 6,
    moveTime: 250
  },
  intermediate: {
    label: "Intermediate",
    skillLevel: 8,
    depth: 10,
    moveTime: 500
  },
  hard: {
    label: "Hard",
    skillLevel: 14,
    depth: 14,
    moveTime: 900
  },
  grandmaster: {
    label: "Grand Master",
    skillLevel: 20,
    depth: 18,
    moveTime: 1500
  }
};

class EngineService {
  constructor() {
    this.engine = null;
    this.buffer = "";
    this.listeners = [];
    this.queue = Promise.resolve();
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
    const nextTask = this.queue
      .catch(() => undefined)
      .then(() => this.runBestMoveSearch({ fen, difficulty }));

    this.queue = nextTask;

    return nextTask;
  }

  async runBestMoveSearch({ fen, difficulty }) {
    await this.ensureReady();

    const preset = this.getDifficultyPreset(difficulty);

    this.send(`setoption name Skill Level value ${preset.skillLevel}`);
    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 16");
    this.send("ucinewgame");
    this.send("isready");
    await this.waitForLine((line) => line === "readyok", 15000);

    this.send(`position fen ${fen}`);
    this.send(`go depth ${preset.depth} movetime ${preset.moveTime}`);

    const bestMoveLine = await this.waitForLine(
      (line) => line.startsWith("bestmove "),
      20000
    );
    const bestMove = bestMoveLine.split(" ")[1];

    if (!bestMove || bestMove === "(none)") {
      return null;
    }

    return {
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove.slice(4, 5) || undefined,
      difficulty: preset
    };
  }

  async ensureReady() {
    if (this.engine && !this.engine.killed) {
      return;
    }

    await this.spawnEngine();
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

module.exports = {
  engineService,
  DIFFICULTY_PRESETS
};
