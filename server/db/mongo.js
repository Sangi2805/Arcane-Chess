const mongoose = require("mongoose");

let mongoStatus = "disconnected";
let listenersRegistered = false;

const registerMongoListeners = () => {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    mongoStatus = "connected";
  });

  mongoose.connection.on("error", () => {
    mongoStatus = "error";
  });

  mongoose.connection.on("disconnected", () => {
    mongoStatus = "disconnected";
  });
};

const connectToMongo = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    mongoStatus = "missing-config";
    throw new Error("MONGODB_URI is not configured.");
  }

  registerMongoListeners();

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000
  });
};

const getMongoStatus = () => mongoStatus;
const isMongoAvailable = () => mongoose.connection.readyState === 1;

module.exports = {
  connectToMongo,
  getMongoStatus,
  isMongoAvailable
};
