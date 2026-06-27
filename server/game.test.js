import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createGameService } from "./game.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      inventory_json TEXT NOT NULL DEFAULT '[]',
      notes_json TEXT NOT NULL DEFAULT '[]',
      finished INTEGER NOT NULL DEFAULT 0,
      last_roll INTEGER NOT NULL DEFAULT 0,
      final_pass INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE tiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      board_index INTEGER NOT NULL UNIQUE
    );
    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE gate_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      reward TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE lore_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tile_index INTEGER NOT NULL UNIQUE,
      note TEXT NOT NULL
    );
  `);

  const insertTile = db.prepare(
    "INSERT INTO tiles (kind, title, description, board_index) VALUES (?, ?, ?, ?)"
  );
  for (let index = 0; index < 24; index += 1) {
    insertTile.run(index >= 22 ? "finish" : "start", `Tile ${index}`, "Test tile", index);
  }
  db.prepare("INSERT INTO gate_codes (code, reward, active) VALUES (?, ?, 1)").run(
    "ASTRAL-7331",
    "final_pass"
  );
  return db;
}

test("normal gate code grants final pass", () => {
  const game = createGameService(makeDb());
  const session = game.startSession("Tester");

  const result = game.checkGate(session.sessionId, "ASTRAL-7331");

  assert.equal(result.ok, true);
  assert.equal(result.state.player.finalPass, true);
  assert.equal(result.flag, "FLAG{HIDDEN_GATE_OPENED}");
  assert.equal(result.state.player.flag, "FLAG{HIDDEN_GATE_OPENED}");
});

test("hidden gate can be bypassed with a crafted phrase", () => {
  const game = createGameService(makeDb());
  const session = game.startSession("Tester");

  const result = game.checkGate(session.sessionId, "' OR 1=1 --");

  assert.equal(result.ok, true);
  assert.equal(result.state.player.finalPass, true);
  assert.equal(result.flag, "FLAG{HIDDEN_GATE_OPENED}");
  assert.equal(result.state.player.flag, "FLAG{HIDDEN_GATE_OPENED}");
});

test("hidden gate accepts a union-crafted final pass row", () => {
  const game = createGameService(makeDb());
  const session = game.startSession("Tester");

  const result = game.checkGate(session.sessionId, "' UNION SELECT 'made-up-code', 'final_pass' --");

  assert.equal(result.ok, true);
  assert.equal(result.state.player.finalPass, true);
  assert.equal(result.flag, "FLAG{HIDDEN_GATE_OPENED}");
  assert.equal(result.state.player.flag, "FLAG{HIDDEN_GATE_OPENED}");
});

test("finish tile gives a fallback note so the normal route remains playable", () => {
  const db = makeDb();
  const game = createGameService(db);
  const session = game.startSession("Tester");
  db.prepare("UPDATE players SET position = 23 WHERE session_id = ?").run(session.sessionId);

  const result = game.resolveEvent(session.sessionId);

  assert.match(result.message, /fallback note/);
  assert.ok(
    result.state.player.notes.includes("Finish terminal fallback: the normal final pass is ASTRAL-7331.")
  );
});
