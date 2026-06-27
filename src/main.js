import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3001";
const app = document.querySelector("#app");

let state = null;
let message = "Start a run to enter the board.";
let hintLevel = 0;

const challengeChoices = {
  5: ["prepared", "string paste", "manual quoting"],
  11: ["parameters", "comments", "table names"],
  15: ["concatenation", "indexing", "transactions"],
  19: ["least privilege", "maximum grants", "shared admin"]
};

function sessionId() {
  return localStorage.getItem("board-adventure-session");
}

function setSessionId(value) {
  localStorage.setItem("board-adventure-session", value);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (sessionId()) headers["x-session-id"] = sessionId();
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

async function startGame(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = await api("/api/session/start", {
    method: "POST",
    body: JSON.stringify({ name: form.get("name") })
  });
  setSessionId(data.sessionId);
  state = data;
  message = `Welcome, ${data.player.name}.`;
  render();
}

async function loadState() {
  if (!sessionId()) {
    render();
    return;
  }

  try {
    state = await api("/api/game/state");
    message = "Session restored.";
  } catch {
    localStorage.removeItem("board-adventure-session");
  }
  render();
}

async function rollDice() {
  const data = await api("/api/game/roll", { method: "POST", body: "{}" });
  state = data;
  message = `Rolled ${data.player.lastRoll}. Landed on ${data.currentTile.title}.`;
  render();
}

async function resolveCurrentEvent(answer = "") {
  const data = await api("/api/game/event", {
    method: "POST",
    body: JSON.stringify({ answer })
  });
  state = data.state;
  message = data.message;
  render();
}

async function checkGate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = form.get("code");
  const data = await api("/api/gate/check", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  state = data.state;
  message = data.message;
  render();
}

function render() {
  app.innerHTML = `
    <main class="shell">
      <section class="topbar">
        <div>
          <p class="eyebrow">Mystery board adventure</p>
          <h1>Board Adventure</h1>
        </div>
        ${state ? playerBadge() : ""}
      </section>
      ${state ? gameView() : startView()}
    </main>
  `;

  const startForm = document.querySelector("[data-start-form]");
  if (startForm) startForm.addEventListener("submit", startGame);

  const rollButton = document.querySelector("[data-roll]");
  if (rollButton) rollButton.addEventListener("click", rollDice);

  const eventButton = document.querySelector("[data-event]");
  if (eventButton) eventButton.addEventListener("click", () => resolveCurrentEvent());

  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => resolveCurrentEvent(button.dataset.answer));
  });

  const gateForm = document.querySelector("[data-gate-form]");
  if (gateForm) gateForm.addEventListener("submit", checkGate);

  const hintButton = document.querySelector("[data-hint]");
  if (hintButton) {
    hintButton.addEventListener("click", () => {
      hintLevel = Math.min(3, hintLevel + 1);
      render();
    });
  }

  const resetButton = document.querySelector("[data-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      localStorage.removeItem("board-adventure-session");
      state = null;
      message = "Start a fresh run.";
      render();
    });
  }
}

function startView() {
  return `
    <section class="hero-layout">
      <div class="poster" aria-hidden="true">
        <div class="poster-shade"></div>
        <div class="poster-label">
          <span>Roll</span>
          <strong>Explore</strong>
          <span>Unlock</span>
        </div>
      </div>
      <div class="start-dock">
        <form class="panel start-panel" data-start-form>
          <h2>Enter the board</h2>
          <p>Follow the strange route, collect notes, and open the final gate.</p>
          <label>
            Adventurer name
            <input name="name" maxlength="24" placeholder="Adventurer" autocomplete="off" />
          </label>
          <button type="submit">Start run</button>
        </form>
      </div>
    </section>
  `;
}

function gameView() {
  return `
    <section class="game-layout">
      <div class="board-panel">
        <div class="board-art" aria-hidden="true"></div>
        <div class="board">${state.board.map(tileCell).join("")}</div>
      </div>
      <aside class="side">
        ${flagPanel()}
        <section class="panel status-panel">
          <h2>${state.player.finished ? "Finish Reached" : state.currentTile.title}</h2>
          <p>${message}</p>
          <p class="tile-description">${state.currentTile.description}</p>
          <div class="actions">
            <button type="button" data-roll ${state.player.finished ? "disabled" : ""}>Roll dice</button>
            ${eventControls()}
          </div>
        </section>
        ${gatePanel()}
        ${journalPanel()}
      </aside>
    </section>
  `;
}

function flagPanel() {
  if (!state?.player?.flag) return "";
  return `
    <section class="flag-panel" aria-live="polite">
      <span>Flag unlocked</span>
      <strong>${escapeHtml(state.player.flag)}</strong>
    </section>
  `;
}

function playerBadge() {
  return `
    <div class="player-badge">
      <span>${escapeHtml(state.player.name)}</span>
      <strong>Tile ${state.player.position}</strong>
      <button type="button" data-reset>New run</button>
    </div>
  `;
}

function tileCell(tile) {
  const current = tile.boardIndex === state.player.position;
  return `
    <div class="tile tile-${tile.kind} ${current ? "current" : ""}">
      <span class="tile-number">${tile.boardIndex}</span>
      <strong>${tile.title}</strong>
    </div>
  `;
}

function eventControls() {
  if (state.challenge) {
    const choices = challengeChoices[state.challenge.tileIndex] || [];
    return `
      <div class="challenge">
        <p>${state.challenge.prompt}</p>
        <div class="choice-row">
          ${choices.map((choice) => `<button type="button" data-answer="${choice}">${choice}</button>`).join("")}
        </div>
      </div>
    `;
  }

  return `<button type="button" data-event ${state.player.finished ? "disabled" : ""}>Resolve tile</button>`;
}

function gatePanel() {
  const hints = [
    "The normal route gives the exact final pass through lore notes.",
    "The gate compares your text with a database row.",
    "The gate is sensitive to quotes and comments.",
    "A clever phrase can make the gate accept a row it was not meant to reveal."
  ];

  return `
    <section class="panel gate-panel">
      <h2>Terminal Gate</h2>
      <form data-gate-form>
        <label>
          Final pass
          <input name="code" placeholder="Enter a pass phrase" autocomplete="off" />
        </label>
        <button type="submit">Check gate</button>
      </form>
      <button class="secondary" type="button" data-hint>Reveal hint</button>
      <p class="hint">${hints[hintLevel]}</p>
    </section>
  `;
}

function journalPanel() {
  const inventory = state.player.inventory.length
    ? state.player.inventory.map((item) => `<li>${item}</li>`).join("")
    : "<li>No items yet.</li>";
  const notes = state.player.notes.length
    ? state.player.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")
    : "<li>No notes yet.</li>";

  return `
    <section class="panel journal-panel">
      <h2>Journal</h2>
      <h3>Inventory</h3>
      <ul>${inventory}</ul>
      <h3>Notes</h3>
      <ul>${notes}</ul>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadState();
