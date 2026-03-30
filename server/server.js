const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const apiRouter = require("./api");
const { connectToMongo, getMongoStatus } = require("./db/mongo");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const port = Number(process.env.PORT) || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${port}`;
const clientPath = path.resolve(__dirname, "..", "client");

app.use(
  cors({
    origin: clientOrigin
  })
);
app.use(express.json());
app.use(express.static(clientPath));

app.use("/api", apiRouter);

app.get("*", (request, response) => {
  response.sendFile(path.join(clientPath, "index.html"));
});

const startServer = async () => {
  try {
    await connectToMongo();
  } catch (error) {
    console.warn("MongoDB connection skipped:", error.message);
  }

  app.listen(port, () => {
    console.log(
      `Arcane Chess server listening on http://localhost:${port} (db: ${getMongoStatus()})`
    );
  });
};

startServer();

