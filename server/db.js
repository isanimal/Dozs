import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "board-adventure.sqlite");

const boardTiles = [
  ["start", "Camp", "The journey starts at the canvas tent.", 0],
  ["item", "Supply Crate", "Gain a compass for safer travel.", 1],
  ["clue", "Oracle Flower", "The first gate mark is ASTRAL.", 2],
  ["trap", "Mud Slide", "Slip backward while crossing the bright path.", 3],
  ["item", "Dice Shrine", "Gain a lucky die token.", 4],
  ["challenge", "Riddle Bridge", "Answer a tiny database riddle.", 5],
  ["clue", "Moth Library", "The separator in the final pass is a dash.", 6],
  ["item", "Lantern Grove", "Gain a lantern for the tunnel.", 7],
  ["trap", "Tentacle Lake", "A wave pushes you back.", 8],
  ["clue", "Cow Abduction", "The second gate mark starts with 7.", 9],
  ["item", "Card Dealer", "Gain a pink access card.", 10],
  ["challenge", "Clock Hollow", "Pick the statement that keeps data safe.", 11],
  ["trap", "Burrow Hand", "Lose one step escaping the burrow.", 12],
  ["clue", "Crystal Dice", "The final three digits are 331.", 13],
  ["item", "Bridge Kit", "Gain a bridge kit.", 14],
  ["challenge", "UFO Terminal", "Spot the risky query pattern.", 15],
  ["clue", "Finish Banner", "Put the clue parts together before the finish.", 16],
  ["trap", "Monster Mouth", "Dodge the snapping path.", 17],
  ["item", "Hourglass", "Gain an hourglass charm.", 18],
  ["challenge", "Query Gate", "A final quiz checks your route.", 19],
  ["clue", "Map Corner", "The complete normal code is ASTRAL-7331.", 20],
  ["item", "Victory Token", "Gain the final token.", 21],
  ["finish", "Terminal Gate", "Enter the final pass or study the hidden gate.", 22],
  ["finish", "Finish", "The checkered marker is close.", 23]
];

const loreNotes = [
  [2, "The first gate mark is ASTRAL."],
  [6, "The pass uses a dash between word and number."],
  [9, "The numeric half starts with 7."],
  [13, "The last three digits are 331."],
  [16, "A code gate compares text from your input against rows in the database."],
  [20, "Normal route: ASTRAL-7331."]
];

export function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
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

    CREATE TABLE IF NOT EXISTS tiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      board_index INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gate_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      reward TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lore_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tile_index INTEGER NOT NULL UNIQUE,
      note TEXT NOT NULL
    );
  `);
}

function seed(db) {
  const tileCount = db.prepare("SELECT COUNT(*) AS count FROM tiles").get().count;
  if (tileCount === 0) {
    const insertTile = db.prepare(
      "INSERT INTO tiles (kind, title, description, board_index) VALUES (?, ?, ?, ?)"
    );
    const insertMany = db.transaction((tiles) => {
      for (const tile of tiles) insertTile.run(tile);
    });
    insertMany(boardTiles);
  }
  db.prepare("UPDATE tiles SET description = ? WHERE board_index = ?").run(
    "Enter the final pass or study the hidden gate.",
    22
  );

  const itemCount = db.prepare("SELECT COUNT(*) AS count FROM items").get().count;
  if (itemCount === 0) {
    const insertItem = db.prepare(
      "INSERT INTO items (slug, name, description) VALUES (?, ?, ?)"
    );
    const items = [
      ["compass", "Compass", "Keeps the route steady."],
      ["lucky-die", "Lucky Die", "A souvenir from the shrine."],
      ["lantern", "Lantern", "Useful in the tunnel."],
      ["pink-card", "Pink Card", "A bright access card."],
      ["bridge-kit", "Bridge Kit", "Repairs broken path pieces."],
      ["hourglass", "Hourglass", "Marks the final approach."],
      ["victory-token", "Victory Token", "Proof that the board was crossed."]
    ];
    const insertMany = db.transaction((rows) => {
      for (const item of rows) insertItem.run(item);
    });
    insertMany(items);
  }

  const gateCount = db.prepare("SELECT COUNT(*) AS count FROM gate_codes").get().count;
  if (gateCount === 0) {
    db.prepare("INSERT INTO gate_codes (code, reward, active) VALUES (?, ?, 1)").run(
      "ASTRAL-7331",
      "final_pass"
    );
  }

  const loreCount = db.prepare("SELECT COUNT(*) AS count FROM lore_notes").get().count;
  if (loreCount === 0) {
    const insertLore = db.prepare("INSERT INTO lore_notes (tile_index, note) VALUES (?, ?)");
    const insertMany = db.transaction((rows) => {
      for (const note of rows) insertLore.run(note);
    });
    insertMany(loreNotes);
  }
}

export const databasePath = dbPath;
