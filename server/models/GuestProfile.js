const mongoose = require("mongoose");

const guestProfileSchema = new mongoose.Schema(
  {
    guestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports =
  mongoose.models.GuestProfile ||
  mongoose.model("GuestProfile", guestProfileSchema);
