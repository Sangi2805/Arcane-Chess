const mongoose = require("mongoose");
const { Schema } = mongoose;

const matchmakingQueueSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    desiredTimeControl: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false
    },
    versionKey: false
  }
);

matchmakingQueueSchema.index({ createdAt: 1 });
matchmakingQueueSchema.index({ "desiredTimeControl.id": 1, createdAt: 1 });

module.exports =
  mongoose.models.MatchmakingQueue ||
  mongoose.model("MatchmakingQueue", matchmakingQueueSchema);
