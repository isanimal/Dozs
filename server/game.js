import crypto from "node:crypto";

const itemByTile = new Map([
  [1, "compass"],
  [4, "lucky-die"],
  [7, "lantern"],
  [10, "pink-card"],
  [14, "bridge-kit"],
  [18, "hourglass"],
  [21, "victory-token"]
]);

const challengeAnswers = new Map([
  [5, "prepared"],
  [11, "parameters"],
  [15, "concatenation"],
  [19, "least privilege"]
]);

const FINAL_FLAG = "FLAG{HIDDEN_GATE_OPENED}";

export function createGameService(db) {
  function startSession(name) {
    const cleanName = String(name || "Adventurer").trim().slice(0, 24) || "Adventurer";
    const sessionId = crypto.randomUUID();
    db.prepare("INSERT INTO players (session_id, name) VALUES (?, ?)").run(sessionId, cleanName);
    return getState(sessionId);
  }

  function getPlayer(sessionId) {
    return db.prepare("SELECT * FROM players WHERE session_id = ?").get(sessionId);
  }

  function requirePlayer(sessionId) {
    const player = getPlayer(sessionId);
    if (!player) {
      const error = new Error("Session not found.");
      error.status = 404;
      throw error;
    }
    return player;
  }

  function getState(sessionId) {
    const player = requirePlayer(sessionId);
    const tiles = db
      .prepare("SELECT kind, title, description, board_index AS boardIndex FROM tiles ORDER BY board_index")
      .all();
    const currentTile = tiles.find((tile) => tile.boardIndex === player.position) || tiles[0];
    return {
      sessionId,
      player: serializePlayer(player),
      board: tiles,
      currentTile,
      challenge: getChallengeForTile(player.position)
    };
  }

  function roll(sessionId) {
    const player = requirePlayer(sessionId);
    if (player.finished) return getState(sessionId);

    const rollValue = crypto.randomInt(1, 7);
    const nextPosition = Math.min(23, player.position + rollValue);
    db.prepare("UPDATE players SET position = ?, last_roll = ? WHERE session_id = ?").run(
      nextPosition,
      rollValue,
      sessionId
    );
    return getState(sessionId);
  }

  function resolveEvent(sessionId, payload = {}) {
    const player = requirePlayer(sessionId);
    if (player.finished) return { message: "You already crossed the finish.", state: getState(sessionId) };

    const tile = db.prepare("SELECT * FROM tiles WHERE board_index = ?").get(player.position);
    if (!tile) return { message: "The path is quiet.", state: getState(sessionId) };

    if (tile.kind === "item") {
      return gainItem(sessionId, player, player.position);
    }

    if (tile.kind === "clue") {
      return gainLore(sessionId, player, player.position);
    }

    if (tile.kind === "trap") {
      const nextPosition = Math.max(0, player.position - 2);
      db.prepare("UPDATE players SET position = ? WHERE session_id = ?").run(nextPosition, sessionId);
      return { message: `${tile.title} pushed you back two spaces.`, state: getState(sessionId) };
    }

    if (tile.kind === "challenge") {
      return solveChallenge(sessionId, player, player.position, payload.answer);
    }

    if (tile.kind === "finish") {
      if (player.final_pass) {
        db.prepare("UPDATE players SET finished = 1 WHERE session_id = ?").run(sessionId);
        return { message: "The gate opens. You reached the finish.", state: getState(sessionId) };
      }
      const notes = parseJson(player.notes_json);
      const finishNote = "Finish terminal fallback: the normal final pass is ASTRAL-7331.";
      if (!notes.includes(finishNote)) {
        notes.push(finishNote);
        db.prepare("UPDATE players SET notes_json = ? WHERE session_id = ?").run(
          JSON.stringify(notes),
          sessionId
        );
      }
      return {
        message: "The Terminal Gate needs a final pass. A fallback note was added so the normal route stays playable.",
        state: getState(sessionId)
      };
    }

    return { message: "Nothing happens here.", state: getState(sessionId) };
  }

  function gainItem(sessionId, player, tileIndex) {
    const slug = itemByTile.get(tileIndex);
    if (!slug) return { message: "No item is hidden here.", state: getState(sessionId) };

    const inventory = parseJson(player.inventory_json);
    if (!inventory.includes(slug)) inventory.push(slug);
    db.prepare("UPDATE players SET inventory_json = ? WHERE session_id = ?").run(
      JSON.stringify(inventory),
      sessionId
    );
    const item = db.prepare("SELECT name FROM items WHERE slug = ?").get(slug);
    return { message: `Collected ${item?.name || slug}.`, state: getState(sessionId) };
  }

  function gainLore(sessionId, player, tileIndex) {
    const lore = db.prepare("SELECT note FROM lore_notes WHERE tile_index = ?").get(tileIndex);
    if (!lore) return { message: "No note is hidden here.", state: getState(sessionId) };

    const notes = parseJson(player.notes_json);
    if (!notes.includes(lore.note)) notes.push(lore.note);
    db.prepare("UPDATE players SET notes_json = ? WHERE session_id = ?").run(
      JSON.stringify(notes),
      sessionId
    );
    return { message: "A lore note was added to your journal.", state: getState(sessionId) };
  }

  function solveChallenge(sessionId, player, tileIndex, answer) {
    const expected = challengeAnswers.get(tileIndex);
    const cleanAnswer = String(answer || "").trim().toLowerCase();
    if (!expected) return { message: "This terminal is offline.", state: getState(sessionId) };

    if (cleanAnswer === expected) {
      const notes = parseJson(player.notes_json);
      const note = `Challenge ${tileIndex} cleared: ${expected}.`;
      if (!notes.includes(note)) notes.push(note);
      db.prepare("UPDATE players SET notes_json = ? WHERE session_id = ?").run(
        JSON.stringify(notes),
        sessionId
      );
      return { message: "Challenge cleared.", state: getState(sessionId) };
    }

    return { message: "The terminal rejects that answer.", state: getState(sessionId) };
  }

  function checkGate(sessionId, inputCode) {
    const player = requirePlayer(sessionId);
    const code = String(inputCode || "").slice(0, 160);
    const gate = checkGateCode(code);

    if (!gate) {
      return {
        ok: false,
        message: "Gate locked. The query returned no active final pass.",
        state: getState(sessionId)
      };
    }

    if (gate.reward === "final_pass") {
      db.prepare("UPDATE players SET final_pass = 1, finished = CASE WHEN position >= 22 THEN 1 ELSE finished END WHERE session_id = ?").run(
        sessionId
      );
      return {
        ok: true,
        flag: FINAL_FLAG,
        message: player.position >= 22
          ? "The hidden gate returned a final pass and opened the finish."
          : "The hidden gate returned a final pass. Reach the Terminal Gate to finish.",
        state: getState(sessionId)
      };
    }

    return {
      ok: false,
      message: "The gate returned a row, but not the final pass reward.",
      state: getState(sessionId)
    };
  }

  function checkGateCode(inputCode) {
    /*
      INTENTIONAL LOCAL CHALLENGE FLAW.
      This is the only unsafe gate in the project. It deliberately builds a
      raw query from player input so the final gate has a hidden alternate path.
    */
    const query = `SELECT code, reward FROM gate_codes WHERE active = 1 AND code = '${inputCode}' LIMIT 1`;
    return db.prepare(query).get();
  }

  function getChallengeForTile(position) {
    if (!challengeAnswers.has(position)) return null;
    const prompts = {
      5: "Which query style separates SQL from values?",
      11: "What should user values become before they enter SQL?",
      15: "Which pattern makes this gate risky?",
      19: "Which database permission principle reduces blast radius?"
    };
    return { prompt: prompts[position], tileIndex: position };
  }

  return {
    startSession,
    getState,
    roll,
    resolveEvent,
    checkGate
  };
}

function serializePlayer(player) {
  return {
    name: player.name,
    position: player.position,
    inventory: parseJson(player.inventory_json),
    notes: parseJson(player.notes_json),
    finished: Boolean(player.finished),
    lastRoll: player.last_roll,
    finalPass: Boolean(player.final_pass),
    flag: player.final_pass ? FINAL_FLAG : null
  };
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
