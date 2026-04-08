const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40
    },
    passwordHash: {
      type: String,
      required: true
    },
    passwordSalt: {
      type: String,
      required: true
    },
    guest: {
      type: Boolean,
      default: false,
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
