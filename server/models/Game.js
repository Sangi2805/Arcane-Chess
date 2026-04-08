const mongoose = require("mongoose");
const { Schema } = mongoose;

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const clockSnapshotSchema = new Schema(
  {
    whiteMsLeft: {
      type: Number,
      min: 0,
      default: null
    },
    blackMsLeft: {
      type: Number,
      min: 0,
      default: null
    },
    runningSide: {
      type: String,
      enum: ["white", "black", null],
      default: null
    },
    lastUpdatedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const moveHistoryEntrySchema = new Schema(
  {
    moveNumber: {
      type: Number,
      required: true,
      min: 1
    },
    side: {
      type: String,
      enum: ["white", "black"],
      required: true
    },
    san: {
      type: String,
      required: true,
      trim: true
    },
    uci: {
      type: String,
      required: true,
      trim: true
    },
    fenAfter: {
      type: String,
      required: true
    },
    playedAt: {
      type: Date,
      required: true
    },
    clockAfter: {
      type: clockSnapshotSchema,
      default: null
    }
  },
  {
    _id: false
  }
);

const gameSchema = new Schema(
  {
    mode: {
      type: String,
      enum: ["bot", "multiplayer"],
      required: true,
      default: "multiplayer"
    },
    status: {
      type: String,
      enum: ["waiting", "active", "finished", "abandoned", "timeout", "draw", "resigned"],
      required: true,
      default: "waiting",
      index: true
    },
    whitePlayerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    blackPlayerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    timeControl: {
      type: Schema.Types.Mixed,
      default: null
    },
    clockState: {
      type: clockSnapshotSchema,
      default: null
    },
    currentFen: {
      type: String,
      required: true,
      default: INITIAL_FEN
    },
    moveHistory: {
      type: [moveHistoryEntrySchema],
      default: []
    },
    result: {
      type: String,
      default: null,
      trim: true
    },
    winner: {
      type: String,
      enum: ["white", "black", null],
      default: null
    },
    finishReason: {
      type: String,
      default: null,
      trim: true
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameSchema.index({ updatedAt: -1 });
gameSchema.index({ status: 1, updatedAt: -1 });
gameSchema.index({ whitePlayerId: 1, updatedAt: -1 });
gameSchema.index({ blackPlayerId: 1, updatedAt: -1 });

module.exports = mongoose.models.Game || mongoose.model("Game", gameSchema);
