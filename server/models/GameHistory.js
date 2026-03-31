const mongoose = require("mongoose");

const moveEntrySchema = new mongoose.Schema(
  {
    turn: {
      type: Number,
      required: true
    },
    white: {
      type: String,
      default: null
    },
    black: {
      type: String,
      default: null
    }
  },
  {
    _id: false
  }
);

const gameHistorySchema = new mongoose.Schema(
  {
    guestId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    result: {
      type: String,
      required: true,
      trim: true
    },
    statusCode: {
      type: String,
      required: true,
      trim: true
    },
    statusMessage: {
      type: String,
      required: true,
      trim: true
    },
    pgn: {
      type: String,
      default: ""
    },
    moveList: {
      type: [moveEntrySchema],
      default: []
    },
    playerColor: {
      type: String,
      enum: ["white", "black"],
      required: true
    },
    engineColor: {
      type: String,
      enum: ["white", "black"],
      required: true
    },
    difficulty: {
      type: String,
      required: true,
      trim: true
    },
    completedAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gameHistorySchema.index({ guestId: 1, completedAt: -1 });

module.exports =
  mongoose.models.GameHistory ||
  mongoose.model("GameHistory", gameHistorySchema);
