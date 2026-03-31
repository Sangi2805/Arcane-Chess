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

const statusSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const lastMoveSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    san: String,
    color: String,
    piece: String,
    captured: {
      type: String,
      default: null
    },
    promotion: {
      type: String,
      default: null
    }
  },
  {
    _id: false
  }
);

const savedGameSchema = new mongoose.Schema(
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
    fen: {
      type: String,
      required: true
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
    status: {
      type: statusSchema,
      required: true
    },
    lastMove: {
      type: lastMoveSchema,
      default: null
    },
    isResumable: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

savedGameSchema.index({ guestId: 1, isResumable: 1, updatedAt: -1 });

module.exports =
  mongoose.models.SavedGame || mongoose.model("SavedGame", savedGameSchema);
