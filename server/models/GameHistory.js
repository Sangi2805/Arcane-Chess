const mongoose = require("mongoose");
const { Schema } = mongoose;

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
    ownerType: {
      type: String,
      enum: ["guest", "user"],
      required: true,
      index: true
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    guestId: {
      type: String,
      default: null,
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
    resultLabel: {
      type: String,
      default: null,
      trim: true
    },
    drawReason: {
      type: String,
      default: null,
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
    timeControl: {
      type: Schema.Types.Mixed,
      default: null
    },
    clockState: {
      type: Schema.Types.Mixed,
      default: null
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

gameHistorySchema.index({ ownerType: 1, ownerId: 1, completedAt: -1 });

module.exports =
  mongoose.models.GameHistory ||
  mongoose.model("GameHistory", gameHistorySchema);
