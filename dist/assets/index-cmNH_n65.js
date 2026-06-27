(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const c of r.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&s(c)}).observe(document,{childList:!0,subtree:!0});function o(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(a){if(a.ep)return;a.ep=!0;const r=o(a);fetch(a.href,r)}})();const h="http://127.0.0.1:3001",g=document.querySelector("#app");let t=null,l="Start a run to enter the board.",u=0;const y={5:["prepared","string paste","manual quoting"],11:["parameters","comments","table names"],15:["concatenation","indexing","transactions"],19:["least privilege","maximum grants","shared admin"]};function p(){return localStorage.getItem("board-adventure-session")}function v(e){localStorage.setItem("board-adventure-session",e)}async function d(e,n={}){const o={"Content-Type":"application/json",...n.headers||{}};p()&&(o["x-session-id"]=p());const s=await fetch(`${h}${e}`,{...n,headers:o}),a=await s.json();if(!s.ok)throw new Error(a.message||"Request failed.");return a}async function b(e){e.preventDefault();const n=new FormData(e.currentTarget),o=await d("/api/session/start",{method:"POST",body:JSON.stringify({name:n.get("name")})});v(o.sessionId),t=o,l=`Welcome, ${o.player.name}.`,i()}async function $(){if(!p()){i();return}try{t=await d("/api/game/state"),l="Session restored."}catch{localStorage.removeItem("board-adventure-session")}i()}async function S(){const e=await d("/api/game/roll",{method:"POST",body:"{}"});t=e,l=`Rolled ${e.player.lastRoll}. Landed on ${e.currentTile.title}.`,i()}async function f(e=""){const n=await d("/api/game/event",{method:"POST",body:JSON.stringify({answer:e})});t=n.state,l=n.message,i()}async function w(e){e.preventDefault();const o=new FormData(e.currentTarget).get("code"),s=await d("/api/gate/check",{method:"POST",body:JSON.stringify({code:o})});t=s.state,l=s.message,i()}function i(){g.innerHTML=`
    <main class="shell">
      <section class="topbar">
        <div>
          <p class="eyebrow">Mystery board adventure</p>
          <h1>Board Adventure</h1>
        </div>
        ${t?q():""}
      </section>
      ${t?E():T()}
    </main>
  `;const e=document.querySelector("[data-start-form]");e&&e.addEventListener("submit",b);const n=document.querySelector("[data-roll]");n&&n.addEventListener("click",S);const o=document.querySelector("[data-event]");o&&o.addEventListener("click",()=>f()),document.querySelectorAll("[data-answer]").forEach(c=>{c.addEventListener("click",()=>f(c.dataset.answer))});const s=document.querySelector("[data-gate-form]");s&&s.addEventListener("submit",w);const a=document.querySelector("[data-hint]");a&&a.addEventListener("click",()=>{u=Math.min(3,u+1),i()});const r=document.querySelector("[data-reset]");r&&r.addEventListener("click",()=>{localStorage.removeItem("board-adventure-session"),t=null,l="Start a fresh run.",i()})}function T(){return`
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
  `}function E(){return`
    <section class="game-layout">
      <div class="board-panel">
        <div class="board-art" aria-hidden="true"></div>
        <div class="board">${t.board.map(A).join("")}</div>
      </div>
      <aside class="side">
        ${L()}
        <section class="panel status-panel">
          <h2>${t.player.finished?"Finish Reached":t.currentTile.title}</h2>
          <p>${l}</p>
          <p class="tile-description">${t.currentTile.description}</p>
          <div class="actions">
            <button type="button" data-roll ${t.player.finished?"disabled":""}>Roll dice</button>
            ${I()}
          </div>
        </section>
        ${O()}
        ${P()}
      </aside>
    </section>
  `}function L(){var e;return(e=t==null?void 0:t.player)!=null&&e.flag?`
    <section class="flag-panel" aria-live="polite">
      <span>Flag unlocked</span>
      <strong>${m(t.player.flag)}</strong>
    </section>
  `:""}function q(){return`
    <div class="player-badge">
      <span>${m(t.player.name)}</span>
      <strong>Tile ${t.player.position}</strong>
      <button type="button" data-reset>New run</button>
    </div>
  `}function A(e){const n=e.boardIndex===t.player.position;return`
    <div class="tile tile-${e.kind} ${n?"current":""}">
      <span class="tile-number">${e.boardIndex}</span>
      <strong>${e.title}</strong>
    </div>
  `}function I(){if(t.challenge){const e=y[t.challenge.tileIndex]||[];return`
      <div class="challenge">
        <p>${t.challenge.prompt}</p>
        <div class="choice-row">
          ${e.map(n=>`<button type="button" data-answer="${n}">${n}</button>`).join("")}
        </div>
      </div>
    `}return`<button type="button" data-event ${t.player.finished?"disabled":""}>Resolve tile</button>`}function O(){return`
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
      <p class="hint">${["The normal route gives the exact final pass through lore notes.","The gate compares your text with a database row.","The gate is sensitive to quotes and comments.","A clever phrase can make the gate accept a row it was not meant to reveal."][u]}</p>
    </section>
  `}function P(){const e=t.player.inventory.length?t.player.inventory.map(o=>`<li>${o}</li>`).join(""):"<li>No items yet.</li>",n=t.player.notes.length?t.player.notes.map(o=>`<li>${m(o)}</li>`).join(""):"<li>No notes yet.</li>";return`
    <section class="panel journal-panel">
      <h2>Journal</h2>
      <h3>Inventory</h3>
      <ul>${e}</ul>
      <h3>Notes</h3>
      <ul>${n}</ul>
    </section>
  `}function m(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}$();
