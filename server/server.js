const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const apiRouter = require("./api");
const { attachRequestAuth } = require("./auth/sessionAuth");
const { connectToMongo, getMongoStatus } = require("./db/mongo");
const { attachRealtimeHub } = require("./realtime/socketHub");

require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${PORT}`;
const clientPath = path.resolve(__dirname, "..", "client");
const modelsPath = path.resolve(__dirname, "..", "models");
const threeBuildPath = path.resolve(__dirname, "node_modules", "three", "build");

app.set("trust proxy", 1);

app.use(
  cors({
    origin: clientOrigin,
    credentials: true
  })
);
app.use(express.json());
console.log("STATIC CLIENT PATH =", clientPath);
app.get("/", (req, res) => {
  const indexPath = path.resolve(__dirname, "..", "client", "index.html");
  console.log("FORCED ROOT SERVE:", indexPath);
  res.sendFile(indexPath);
});
app.use(express.static(clientPath, { etag: false, lastModified: false }));
app.use("/models", express.static(modelsPath));
app.use("/vendor/three", express.static(threeBuildPath));

app.use("/api", attachRequestAuth, apiRouter);

app.get("*", (request, response) => {
  const indexPath = path.resolve(__dirname, "..", "client", "index.html");
  console.log("SERVING INDEX FROM:", indexPath);
  response.sendFile(indexPath);
});

const startServer = async () => {
  try {
    await connectToMongo();
  } catch (error) {
    console.error("MongoDB connection failed after retry:", error);
  }

  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  attachRealtimeHub(io);
  console.log("Socket.IO initialized");

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Arcane Chess server listening on http://0.0.0.0:${PORT} (db: ${getMongoStatus()})`
    );
  });
};

startServer();
