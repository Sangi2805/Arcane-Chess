const mongoose = require("mongoose");

let mongoStatus = "disconnected";
let listenersRegistered = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    mongoStatus = "missing-config";
    throw new Error("MONGO_URI is not configured.");
  }

  registerMongoListeners();

  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      mongoStatus = "connected";
      console.log("MongoDB connected");
      return;
    } catch (error) {
      lastError = error;
      mongoStatus = "error";
      console.error(`MongoDB connection attempt ${attempt} failed:`, error);

      if (attempt === 1) {
        await delay(3000);
      }
    }
  }

  throw lastError;
};

const getMongoStatus = () => mongoStatus;
const isMongoAvailable = () => mongoose.connection.readyState === 1;

module.exports = {
  connectToMongo,
  getMongoStatus,
  isMongoAvailable
};
