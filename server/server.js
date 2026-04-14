const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

const apiRouter = require("./api");
const { attachRequestAuth } = require("./auth/sessionAuth");
const { connectToMongo, getMongoStatus } = require("./db/mongo");
const { attachRealtimeHub } = require("./realtime/socketHub");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const httpServer = require("http").createServer(app);
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";
const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${port}`;
const clientPath = path.resolve(__dirname, "..", "client");
const modelsPath = path.resolve(__dirname, "..", "models");
const threeBuildPath = path.resolve(__dirname, "node_modules", "three", "build");

const validateProductionConfig = () => {
  if (!isProduction) {
    return;
  }

  const missingVariables = [];

  if (!process.env.MONGODB_URI) {
    missingVariables.push("MONGODB_URI");
  }

  if (!process.env.CLIENT_ORIGIN) {
    missingVariables.push("CLIENT_ORIGIN");
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missingVariables.join(
        ", "
      )}`
    );
  }
};

app.set("trust proxy", 1);

app.use(
  cors({
    origin: clientOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(express.static(clientPath));
app.use("/models", express.static(modelsPath));
app.use("/vendor/three", express.static(threeBuildPath));

app.use("/api", attachRequestAuth, apiRouter);

app.get("*", (request, response) => {
  response.sendFile(path.join(clientPath, "index.html"));
});

const startServer = async () => {
  try {
    validateProductionConfig();
    await connectToMongo();
  } catch (error) {
    console.warn("MongoDB connection skipped:", error.message);
  }

  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  attachRealtimeHub(io);
  console.log("Socket.IO initialized");

  httpServer.listen(port, host, () => {
    console.log(
      `Arcane Chess server listening on http://${host}:${port} (db: ${getMongoStatus()})`
    );
  });
};

startServer();
