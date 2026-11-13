// Ecrã do jogador (telemóvel): entra na sala, mostra o que o anfitrião mandar.
window.PlayerViews = {};
window.Player = (function () {
  const KEY = "ggPlayer_v1", TKEY = "ggToken";
  const main = () => document.getElementById("pmain");
  const P = { me: null, conn: null, peer: null, connected: false, joined: false, taken: [], lastPong: 0, sounds: [] };
  const params = new URLSearchParams(location.search);
  const room = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const token = (() => { try { let t = sessionStorage.getItem(TKEY); if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(TKEY, t); } return t; } catch (e) { return "t" + Math.random(); } })();
  const loadIdent = () => { try { const i = JSON.parse(sessionStorage.getItem(KEY)); return i && i.room === room ? i : null; } catch (e) { return null; } };
  const saveIdent = (i) => { try { sessionStorage.setItem(KEY, JSON.stringify(i)); } catch (e) {} };
  let ident = null, lastViewKey = null;

  P.send = (m) => { if (P.conn && P.conn.open) { try { P.conn.send(m); return true; } catch (e) {} } return false; };
  const dataOpen = () => !!(P.conn && P.conn.open);

  // ---------- ligação ----------
  function connect() {
    if (P.peer) { try { P.peer.destroy(); } catch (e) {} }
    P.connected = false;
    const peer = (P.peer = new Peer({ debug: 0 }));
    peer.on("open", () => {
      const conn = (P.conn = peer.connect(PEER_PREFIX + room, { serialization: "json", reliable: true }));
      conn.on("open", () => { P.connected = true; P.lastPong = Date.now(); setConn(true); });
      conn.on("data", onData);
      conn.on("close", lost); conn.on("error", lost);
    });
    // IMPORTANTE: o servidor de sinalização pode cair sem a ligação ao portátil cair.
    // Nesse caso só se volta a ligar o sinalizador; NÃO se refaz a ligação (isso apagava o que estavas a escrever).
    peer.on("disconnected", () => { setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
    peer.on("error", (e) => {
      if (e.type === "peer-unavailable") setConn(false, "Sala não encontrada. À procura…");
      if (!dataOpen()) lost();
    });
  }
  let retry = null;
  function lost() {
    P.connected = false; setConn(false);
    clearTimeout(retry); retry = setTimeout(() => { if (!dataOpen()) connect(); }, 2500);
  }
  function setConn(ok, msg) {
    const c = document.getElementById("conn");
    if (ok) return c.classList.add("hidden");
    c.textContent = msg || (P.joined ? "A reconectar…" : "A ligar à sala…"); c.classList.remove("hidden");
  }
  setInterval(() => {
    if (dataOpen()) {
      P.send({ t: "ping" });
      if (Date.now() - P.lastPong > 20000) { try { P.conn.close(); } catch (e) {} lost(); }
    }
  }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !dataOpen()) { clearTimeout(retry); connect(); } });

  // ---------- mensagens ----------
  function onData(m) {
    if (m.t === "pong") P.lastPong = Date.now();
    else if (m.t === "hello" || m.t === "taken") {
      P.taken = m.emojis || [];
      if (m.t === "hello" && ident) send_join(ident.name, ident.emoji, ident.sound);
      else if (!P.joined) { if (m.t === "hello") renderJoin(); else refreshEmojis(); }
    } else if (m.t === "err") {
      if (!P.joined) { ident = null; renderJoin(m.msg); }
    } else if (m.t === "welcome") {
      P.joined = true; P.me = m.player;
      ident = { room, name: m.player.name, emoji: m.player.emoji, sound: m.player.sound };
      saveIdent(ident);
      const h = document.getElementById("phead");
      h.classList.remove("hidden"); h.style.setProperty("--hc", m.player.color); h.style.setProperty("--ht", textColorFor(m.player.color));
      h.querySelector(".em").textContent = m.player.emoji; h.querySelector(".nm").textContent = m.player.name;
    } else if (m.t === "view") {
      if (m.me) document.querySelector("#phead .sc").textContent = `${m.me.score} pts · ${m.me.rank}º`;
      renderView(m.view);
    }
  }
  function send_join(name, emoji, sound) { P.send({ t: "join", name, emoji, sound, token }); }

  // ---------- ecrãs ----------
  // Só volta a desenhar se o ecrã mudou de facto, para nunca apagar o que o jogador está a escrever.
  function renderView(v) {
    const key = JSON.stringify(v);
    if (key === lastViewKey && main().firstChild) return;
    lastViewKey = key;
    const r = PlayerViews[v.v] || PlayerViews.wait;
    main().replaceChildren(r(v, P));
  }
  const mk = (html) => { const d = document.createElement("div"); d.className = "center"; d.innerHTML = html; return d; };
  PlayerViews.lobbywait = () => mk(`<div class="big">${esc(P.me.emoji)}</div><h2>Estás dentro, ${esc(P.me.name)}!</h2><p>Espera que o anfitrião comece o jogo.</p>`);
  PlayerViews.wait = (v) => mk(`<div class="big">${v.emoji || "👀"}</div><h2>${esc(v.msg || "Olha para o ecrã grande")}</h2>`);
  PlayerViews.result = (v) => mk(!v.answered ? `<div class="resbig">⏱️</div><h2>Sem resposta</h2><p>Olha para o ecrã grande.</p>`
    : v.correct ? `<div class="resbig">✅</div><h2>Certo!</h2><div class="pts">+${v.pts}</div>` : `<div class="resbig">❌</div><h2>Errado</h2><div class="pts">+0</div>`);
  PlayerViews.final = () => mk(`<div class="big">🏁</div><h2>Fim do jogo!</h2><p>Vê o pódio no ecrã grande.</p>`);

  function renderRoomEntry() {
    lastViewKey = null;
    const d = mk(`<h2>Código da sala</h2><input class="field" id="rc" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase"><button class="btn big" id="go">Entrar</button>`);
    main().replaceChildren(d);
    const go = () => { const c = d.querySelector("#rc").value.trim().toUpperCase(); if (c) location.search = "?room=" + encodeURIComponent(c); };
    d.querySelector("#go").onclick = go; d.querySelector("#rc").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  let chosen = null, chosenSound = null, previewAudio = null;
  function renderJoin(error) {
    // Se o formulário já está no ecrã, não o refazer (mantém o nome que já escreveste).
    if (document.getElementById("nm")) { document.getElementById("er").textContent = error || ""; refreshEmojis(); return; }
    lastViewKey = null;
    const d = mk(`<h2>Sala ${esc(room)}</h2>
      <input class="field" id="nm" maxlength="16" placeholder="O teu nome" autocomplete="off" autocorrect="off">
      <p>Escolhe o teu emoji</p>
      <div class="egrid" id="eg">${EMOJIS.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>
      <div id="sw" class="hidden" style="width:100%"><p>Som quando bloqueias uma resposta</p><div class="slist" id="sl"></div></div>
      <div class="err" id="er">${esc(error || "")}</div>
      <button class="btn big" id="go">Entrar</button>`);
    main().replaceChildren(d);
    d.querySelector("#eg").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; chosen = b.dataset.e; refreshEmojis(); };
    const go = () => {
      const name = d.querySelector("#nm").value.trim();
      if (!name) return (d.querySelector("#er").textContent = "Escreve um nome.");
      send_join(name, chosen, chosenSound);
    };
    d.querySelector("#go").onclick = go; d.querySelector("#nm").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    refreshEmojis(); renderSounds();
  }
  function refreshEmojis() {
    document.querySelectorAll("#eg button").forEach((b) => {
      b.disabled = P.taken.includes(b.dataset.e) && b.dataset.e !== chosen;
      b.classList.toggle("sel", b.dataset.e === chosen);
    });
  }
  function renderSounds() {
    const box = document.getElementById("sl"); if (!box || !P.sounds.length) return;
    document.getElementById("sw").classList.remove("hidden");
    box.innerHTML = P.sounds.map((s) => `<button type="button" data-s="${esc(s.file)}" class="${s.file === chosenSound ? "sel" : ""}">🔊 ${esc(s.name)}</button>`).join("");
    box.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      chosenSound = b.dataset.s;
      box.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
      try { if (previewAudio) previewAudio.pause(); previewAudio = new Audio("sounds/" + encodeURIComponent(chosenSound)); previewAudio.play(); setTimeout(() => previewAudio && previewAudio.pause(), 3500); } catch (er) {}
    };
  }

  P.init = () => {
    if (!room) return renderRoomEntry();
    ident = loadIdent();
    main().appendChild(mk(`<div class="big">📡</div><h2>A ligar à sala ${esc(room)}…</h2>`));
    fetch("sounds/sounds.json").then((r) => r.json()).then((l) => { P.sounds = l; renderSounds(); }).catch(() => {});
    connect();
  };
  return P;
})();
