import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, databasePath } from "./db.js";
import { createGameService } from "./game.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);
const db = openDatabase();
const game = createGameService(db);
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, databasePath, mode: "local board adventure" });
});

app.post("/api/session/start", (req, res, next) => {
  try {
    res.json(game.startSession(req.body?.name));
  } catch (error) {
    next(error);
  }
});

app.get("/api/game/state", (req, res, next) => {
  try {
    res.json(game.getState(readSession(req)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/game/roll", (req, res, next) => {
  try {
    res.json(game.roll(readSession(req)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/game/event", (req, res, next) => {
  try {
    res.json(game.resolveEvent(readSession(req), req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/gate/check", (req, res, next) => {
  try {
    res.json(game.checkGate(readSession(req), req.body?.code));
  } catch (error) {
    next(error);
  }
});

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    message: status === 500 ? "Server error." : error.message
  });
});

app.listen(port, () => {
  console.log(`Board Adventure API running on http://127.0.0.1:${port}`);
});

function readSession(req) {
  const sessionId = req.header("x-session-id") || req.body?.sessionId || req.query?.sessionId;
  if (!sessionId) {
    const error = new Error("Missing session id.");
    error.status = 401;
    throw error;
  }
  return sessionId;
}
