// Núcleo do anfitrião: sala, ligações PeerJS, jogadores, placar geral, lobby e persistência.
// Cada mini jogo regista-se em window.Games.<id> = (host, perguntas) => instância.
(function () {
  const KEY = "ggHostState_v1";
  const app = document.getElementById("app");
  const H = (window.Host = {
    code: null, players: {}, nextId: 1, phase: "lobby", gameId: null, inst: null,
    conns: {}, pending: new Set(), peer: null, soundOn: true, Q: null, sounds: [],
  });

  // ---------- utilitários ----------
  H.playerList = () => Object.values(H.players);
  H.total = (p) => Object.values(p.byGame || {}).reduce((a, b) => a + b, 0);
  H.ranking = () => H.playerList().map((p, i) => ({ p, i })).sort((a, b) => H.total(b.p) - H.total(a.p) || a.i - b.i).map((x) => x.p);
  H.rankOf = (p) => H.ranking().findIndex((x) => x.id === p.id) + 1;
  H.render = (html) => { app.innerHTML = html; };
  H.$ = (sel) => app.querySelector(sel);
  H.toast = (msg) => {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.remove("hidden"); t.style.opacity = 1;
    clearTimeout(H._tt); H._tt = setTimeout(() => { t.style.opacity = 0; }, 3000);
  };
  H.floatEmoji = (emoji) => {
    const f = document.createElement("div");
    f.className = "floater"; f.textContent = emoji;
    f.style.left = 20 + Math.random() * 60 + "%";
    document.getElementById("floaters").appendChild(f);
    setTimeout(() => f.remove(), 3300);
  };

  // ---------- sons ----------
  let ac = null;
  function beep(freq, dur, type = "sine", vol = 0.06, when = 0) {
    if (!H.soundOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + when;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  H.sfx = {
    tick: () => beep(1000, 0.04, "square", 0.015),
    lock: () => { beep(660, 0.08, "sine", 0.08); beep(990, 0.12, "sine", 0.08, 0.08); },
    reveal: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, "triangle", 0.08, i * 0.11)),
    end: () => beep(220, 0.35, "sawtooth", 0.04),
  };
  // Som que cada jogador escolheu para quando bloqueia (docs/sounds/); sem som escolhido, toca o "bip" normal.
  H.lockSound = (p) => {
    const s = H.sounds.find((x) => x.file === p.sound);
    if (!s) return H.sfx.lock();
    if (!H.soundOn) return;
    try {
      const a = new Audio("sounds/" + encodeURIComponent(s.file));
      a.volume = 0.9;
      a.play().catch(() => H.sfx.lock());
      setTimeout(() => a.pause(), 3500); // no máximo 3,5 s
    } catch (e) { H.sfx.lock(); }
  };

  // ---------- persistência ----------
  H.save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        code: H.code, nextId: H.nextId, phase: H.phase, gameId: H.gameId,
        players: H.playerList().map((p) => ({ ...p, connected: false })),
        game: H.inst ? H.inst.serialize() : null,
      }));
    } catch (e) {}
  };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }

  // ---------- ligação aos telemóveis ----------
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const taken = () => ({ emojis: H.playerList().map((p) => p.emoji) });

  H.send = (pid, msg) => { const c = H.conns[pid]; if (c && c.open) { try { c.send(msg); } catch (e) {} } };
  H.sendView = (p) => {
    const view = H.inst ? H.inst.viewFor(p) : { v: "lobbywait" };
    H.send(p.id, { t: "view", view, me: { score: H.total(p), rank: H.rankOf(p) } });
  };
  H.broadcastViews = () => H.playerList().forEach(H.sendView);
  const broadcastTaken = () => {
    const m = { t: "taken", ...taken() };
    H.pending.forEach((c) => c.open && c.send(m));
  };

  function onConn(conn) {
    conn.on("open", () => { H.pending.add(conn); conn.send({ t: "hello", ...taken() }); });
    conn.on("data", (m) => onData(conn, m));
    const gone = () => {
      H.pending.delete(conn);
      const p = H.players[conn._pid];
      if (p && H.conns[p.id] === conn) { delete H.conns[p.id]; p.connected = false; afterPlayersChanged(); }
    };
    conn.on("close", gone); conn.on("error", gone);
  }

  function afterPlayersChanged() {
    if (H.phase === "lobby") renderLobby();
    else if (H.inst && H.inst.onPlayersChanged) H.inst.onPlayersChanged();
    H.save();
  }

  function onData(conn, m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "join") return join(conn, m);
    if (m.t === "ping") return conn.send({ t: "pong" });
    const p = H.players[conn._pid];
    if (p && H.inst) H.inst.onMessage(p, m);
  }

  function join(conn, m) {
    const err = (msg) => conn.send({ t: "err", msg });
    const name = String(m.name || "").trim().slice(0, 16);
    if (!name) return err("Escreve um nome.");
    let p = H.playerList().find((x) => norm(x.name) === norm(name));
    if (p) {
      if (!(p.token === m.token || !p.connected)) return err("Esse nome já está a ser usado por outro jogador.");
      p.token = m.token; // volta a entrar com o mesmo nome
      const old = H.conns[p.id];
      if (old && old !== conn) { old._pid = null; try { old.close(); } catch (e) {} }
    } else {
      if (!EMOJIS.includes(m.emoji)) return err("Escolhe um emoji. (Se já estavas a jogar, escreve exatamente o mesmo nome de antes.)");
      if (H.playerList().some((x) => x.emoji === m.emoji)) return err("Esse emoji já foi escolhido por outro jogador.");
      const used = H.playerList().map((x) => x.color);
      const color = PALETTE.find((c) => !used.includes(c)) || PALETTE[H.playerList().length % PALETTE.length];
      const snd = H.sounds.find((x) => x.file === m.sound);
      p = { id: "p" + H.nextId++, name, color, emoji: m.emoji, token: m.token, sound: snd ? snd.file : null, byGame: {}, connected: true };
      H.players[p.id] = p;
    }
    p.connected = true; conn._pid = p.id; H.conns[p.id] = conn; H.pending.delete(conn);
    conn.send({ t: "welcome", player: { name: p.name, color: p.color, emoji: p.emoji } });
    H.sendView(p);
    broadcastTaken();
    afterPlayersChanged();
  }

  // ---------- sala (PeerJS) ----------
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

  function openPeer(attempt = 0) {
    if (H.peer) { try { H.peer.destroy(); } catch (e) {} }
    const peer = (H.peer = new Peer(PEER_PREFIX + H.code, { debug: 1 }));
    peer.on("open", () => { H.online = true; if (!H.started) { H.started = true; startAfterOnline(); } else if (H.phase === "lobby") renderLobby(); });
    peer.on("connection", onConn);
    peer.on("disconnected", () => { H.online = false; setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    peer.on("error", (e) => {
      if (e.type === "unavailable-id") {
        if (attempt < 8) setTimeout(() => openPeer(attempt + 1), 2500); // ainda registado de antes do refresh
        else { H.code = newCode(); openPeer(0); }
      } else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) {
        H.toast("Sem ligação ao servidor de sinalização. A tentar de novo…");
        setTimeout(() => openPeer(attempt), 3000);
      } else console.warn("Peer error", e);
    });
  }

  function startAfterOnline() {
    const saved = H.savedState;
    if (saved && saved.phase === "game" && Games[saved.gameId]) {
      H.phase = "game"; H.gameId = saved.gameId;
      H.inst = Games[saved.gameId](H, H.Q);
      H.inst.restore(saved.game);
      H.toast("Partida retomada.");
    } else renderLobby();
  }

  // ---------- lobby ----------
  function joinUrl() {
    const base = location.href.replace(/host\.html.*$/, "").replace(/[#?].*$/, "");
    return `${base}play.html?room=${H.code}`;
  }
  function renderLobby() {
    const url = joinUrl();
    let qr = "";
    try { const q = qrcode(0, "M"); q.addData(url); q.make(); qr = q.createSvgTag({ scalable: true, margin: 0 }); } catch (e) {}
    const list = H.playerList();
    const ids = Object.keys(Games);
    H.render(`
      <div class="lobby">
        <div class="joinbox">
          <h2>Entra com o telemóvel</h2>
          <div class="qr">${qr}</div>
          <div class="code">${H.code}</div>
          <div class="url">${esc(url)}</div>
          ${H.online ? "" : '<div class="err">⚠ sem ligação ao servidor…</div>'}
        </div>
        <div class="lobby-right">
          <h1 class="title">Jogadores <span class="muted">(${list.length})</span></h1>
          <div class="players">
            ${list.map((p) => `<div class="pchip ${p.connected ? "" : "off"}" style="--c:${p.color}"><span class="em">${p.emoji}</span><span class="n">${esc(p.name)}</span>${H.total(p) ? `<span class="muted">${H.total(p)}</span>` : ""}</div>`).join("") || '<p class="muted">À espera dos primeiros jogadores…</p>'}
          </div>
          <div class="lobby-actions">
            ${ids.map((id) => `<button class="btn big" data-act="start" data-game="${id}" ${list.length ? "" : "disabled"}>▶ Começar ${esc(id === "geoguesser" ? "GeoGuesser" : id)}</button>`).join("")}
            <button class="btn ghost" data-act="reset">Nova noite</button>
          </div>
        </div>
      </div>`);
  }

  H.startGame = (id) => {
    H.phase = "game"; H.gameId = id;
    H.inst = Games[id](H, H.Q);
    H.inst.start();
  };
  H.exitToLobby = () => {
    if (H.inst && H.inst.stop) H.inst.stop();
    H.inst = null; H.phase = "lobby"; H.gameId = null;
    H.broadcastViews(); renderLobby(); H.save();
  };

  function resetAll() {
    if (!confirm("Apagar todos os jogadores e pontos e criar uma sala nova?")) return;
    if (H.inst && H.inst.stop) H.inst.stop();
    H.playerList().forEach((p) => { const c = H.conns[p.id]; if (c) try { c.close(); } catch (e) {} });
    H.players = {}; H.conns = {}; H.nextId = 1; H.inst = null; H.phase = "lobby"; H.code = newCode();
    H.save(); openPeer(0); renderLobby();
  }

  // ---------- arranque ----------
  H.init = async () => {
    try { H.Q = await (await fetch("questions.json", { cache: "no-cache" })).json(); }
    catch (e) { app.innerHTML = '<div class="secintro"><h1>⚠</h1><p>Não consegui ler o questions.json</p></div>'; return; }
    try {
      H.sounds = await (await fetch("sounds/sounds.json", { cache: "no-cache" })).json();
      H.sounds.forEach((s) => fetch("sounds/" + encodeURIComponent(s.file)).catch(() => {})); // pré-carrega
    } catch (e) { H.sounds = []; }
    const saved = (H.savedState = load());
    if (saved) {
      H.code = saved.code; H.nextId = saved.nextId || 1;
      (saved.players || []).forEach((p) => (H.players[p.id] = p));
    } else H.code = newCode();
    if (typeof Peer === "undefined") { app.innerHTML = '<div class="secintro"><h1>⚠</h1><p>Sem internet: não consegui carregar o PeerJS.</p></div>'; return; }
    renderLobby();
    openPeer(0);

    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act;
      if (act === "start") H.startGame(b.dataset.game);
      else if (act === "reset") resetAll();
      else if (H.inst && H.inst.onAction) H.inst.onAction(act, b);
    });
    document.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && H.inst && H.inst.onAction && !/INPUT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); H.inst.onAction("next"); }
    });
    const snd = document.getElementById("bSound");
    snd.onclick = () => { H.soundOn = !H.soundOn; snd.textContent = H.soundOn ? "🔊" : "🔇"; };
    document.getElementById("bFull").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); };
    document.getElementById("bMenu").onclick = () => { if (H.phase === "game" && confirm("Sair do jogo e voltar ao lobby? Os pontos ficam guardados.")) H.exitToLobby(); };
  };
})();
