// Mini jogo 1: GeoGuesser (lado do anfitrião).
Games.geoguesser = function (host, Q) {
  const S = Q.settings;
  let g = null, timer = null, lastSec = -1;

  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sec = () => Q.sections[g.secIdx];
  const question = () => sec().questions[g.orders[sec().id][g.qIdx]];
  const isText = () => sec().type === "text";
  const opts = (q) => [q.answer, ...q.wrong];
  const players = () => host.playerList();
  const addScore = (p, n) => { p.byGame.geoguesser = (p.byGame.geoguesser || 0) + n; };
  const totals = () => Object.fromEntries(players().map((p) => [p.id, host.total(p)]));
  const preload = (q) => { if (q) new Image().src = "img/" + q.image; };

  function newGame() {
    g = { secIdx: 0, qIdx: 0, orders: {}, phase: "secIntro", qStart: 0, answers: {}, optOrder: [0, 1, 2, 3], roundPts: {}, prevScores: null, rankFrom: null };
    Q.sections.forEach((s) => (g.orders[s.id] = shuffle(s.questions.map((_, i) => i))));
    players().forEach((p) => (p.byGame.geoguesser = 0));
  }

  const api = {
    start() { newGame(); preloadSection(); showIntro(); },
    stop() { clearInterval(timer); },
    serialize() { return g; },
    restore(saved) {
      g = saved;
      if (g.phase === "question") { g.answers = {}; g.roundPts = {}; startQuestion(); } // recomeça a pergunta
      else render();
      host.broadcastViews();
    },
    onPlayersChanged() { if (g.phase === "question") renderQuestionMeta(); else if (["reveal", "intro", "secIntro"].includes(g.phase)) render(); },
    onAction(act, el) {
      if (act === "next") return next();
      if (act === "toggle" && g.phase === "reveal" && isText()) return toggle(el.dataset.pid);
    },
    onMessage(p, m) { if (m.t === "answer") onAnswer(p, m); },
    viewFor(p) {
      if (!g) return { v: "wait", msg: "A preparar…" };
      const a = g.answers[p.id];
      switch (g.phase) {
        case "question": return isText() ? { v: "text", locked: a ? a.text : null } : { v: "mc", locked: a ? a.choice : null };
        case "reveal": return { v: "result", answered: !!a, correct: !!(a && effective(a)), pts: g.roundPts[p.id] || 0 };
        case "secIntro": return { v: "wait", emoji: "🗺️", msg: `A seguir: ${sec().name}` };
        case "ranking": return { v: "wait", emoji: "🏆", msg: "Vê o ranking no ecrã grande" };
        case "final": return { v: "final" };
      }
      return { v: "wait", msg: "…" };
    },
  };

  const effective = (a) => (isText() ? (a.override ?? a.auto) : a.correct);

  function preloadSection() { sec().questions.forEach(preload); }

  // ---------- fluxo ----------
  function showIntro() {
    g.phase = "secIntro"; g.qIdx = 0; clearInterval(timer);
    preloadSection(); render(); host.broadcastViews(); host.save();
  }
  function startQuestion() {
    g.phase = "question"; g.qStart = Date.now(); g.answers = {}; g.roundPts = {}; lastSec = -1;
    if (!isText()) g.optOrder = shuffle([0, 1, 2, 3]);
    const list = g.orders[sec().id];
    preload(sec().questions[list[g.qIdx + 1]]);
    render(); host.broadcastViews(); host.save();
    clearInterval(timer); timer = setInterval(tick, 40);
  }
  function next() {
    if (g.phase === "secIntro") startQuestion();
    else if (g.phase === "question") endRound();
    else if (g.phase === "reveal") {
      if (g.qIdx + 1 < sec().questions.length) { g.qIdx++; startQuestion(); }
      else if (g.secIdx + 1 >= Q.sections.length) showFinal();
      else showRanking();
    } else if (g.phase === "ranking") { g.secIdx++; showIntro(); }
    else if (g.phase === "final") host.exitToLobby();
  }

  // ---------- tempo e zoom ----------
  const total = () => (isText() ? S.textLevelSeconds * S.textLevels : S.mcZoomSeconds + S.mcExtraSeconds);
  const levelAt = (t) => Math.min(S.textLevels, Math.floor(t / S.textLevelSeconds) + 1);
  // Pontos descem em linha reta de max a min e ficam em min nos últimos "tail" segundos.
  function linearPts(t, descend, max, min) {
    return t >= descend ? min : Math.round(max - (max - min) * (Math.max(0, t) / descend));
  }
  const mcPoints = (t) => linearPts(t, S.mcZoomSeconds, S.mcMaxPoints, S.mcMinPoints);
  const textPoints = (t) => linearPts(t, total() - S.textTailSeconds, S.textMaxPoints, S.textMinPoints);
  function scaleAt(t) {
    if (isText()) return S.textZoomLevels[levelAt(t) - 1];
    const u = Math.min(1, t / S.mcZoomSeconds), e = 1 - Math.pow(1 - u, 1.5); // abranda no fim
    return Math.pow(S.mcStartZoom, 1 - e);
  }
  function tick() {
    if (g.phase !== "question") return clearInterval(timer);
    const t = (Date.now() - g.qStart) / 1000, T = total();
    const img = document.getElementById("qimg");
    if (img) img.style.transform = `scale(${scaleAt(t)})`;
    const fill = document.getElementById("tfill");
    if (fill) { fill.style.width = Math.max(0, 100 - (t / T) * 100) + "%"; fill.classList.toggle("extra", !isText() && t > S.mcZoomSeconds); }
    const pot = document.getElementById("pot");
    if (pot) pot.textContent = (isText() ? textPoints(t) : mcPoints(t)) + " pts";
    if (isText()) {
      document.querySelectorAll(".lv").forEach((el, i) => { el.classList.toggle("on", i + 1 === levelAt(t)); el.classList.toggle("past", i + 1 < levelAt(t)); });
    }
    const s = Math.floor(t);
    if (s !== lastSec) { lastSec = s; host.sfx.tick(); }
    if (t >= T) endRound();
  }

  // ---------- respostas ----------
  function onAnswer(p, m) {
    if (g.phase !== "question" || g.answers[p.id]) return;
    const t = (Date.now() - g.qStart) / 1000;
    if (isText()) {
      const text = String(m.text || "").trim().slice(0, 60);
      if (!text) return;
      const q = question();
      g.answers[p.id] = { text, t, level: levelAt(t), auto: matchesAnswer(text, q.answer, q.accepted || []), override: null };
    } else {
      const c = Number(m.choice);
      if (!(c >= 0 && c < 4)) return;
      g.answers[p.id] = { choice: c, t, correct: g.optOrder[c] === 0, pts: mcPoints(t) };
    }
    host.lockSound(p); host.floatEmoji(p.emoji);
    host.sendView(p); host.save(); renderQuestionMeta();
    const online = players().filter((x) => x.connected);
    if (online.length && online.every((x) => g.answers[x.id])) setTimeout(endRound, 700);
  }

  function recalc(p) {
    const a = g.answers[p.id];
    let pts = 0;
    if (a && effective(a)) pts = isText() ? textPoints(a.t) : a.pts;
    addScore(p, pts - (g.roundPts[p.id] || 0));
    g.roundPts[p.id] = pts;
  }
  function endRound() {
    if (g.phase !== "question") return;
    clearInterval(timer);
    g.phase = "reveal";
    players().forEach(recalc);
    host.sfx.reveal();
    render(); host.broadcastViews(); host.save();
  }
  function toggle(pid) {
    const p = host.players[pid], a = g.answers[pid];
    if (!p || !a) return;
    a.override = !effective(a);
    recalc(p); host.sendView(p); host.save(); render();
  }

  // ---------- ecrãs ----------
  const secChip = () => `<span class="chip">${esc(sec().name)}</span><span>Pergunta ${g.qIdx + 1}/${sec().questions.length}</span>`;
  function rankRows(withGain) {
    return host.ranking().map((p, i) => `<div class="rrow" style="--c:${p.color}"><span class="pos">${i + 1}</span><span class="em">${p.emoji}</span><span class="nm">${esc(p.name)}</span>${withGain ? `<span class="gain">${g.roundPts[p.id] ? "+" + g.roundPts[p.id] : ""}</span>` : ""}<span class="sc">${host.total(p)}</span></div>`).join("");
  }

  function render() {
    if (g.phase === "secIntro") return renderIntro();
    if (g.phase === "question") return renderQuestion();
    if (g.phase === "reveal") return renderReveal();
    if (g.phase === "ranking") return showRanking(true);
    if (g.phase === "final") return showFinal(true);
  }

  function renderIntro() {
    const s = sec();
    host.render(`<div class="secintro">
      <p>Secção ${g.secIdx + 1} de ${Q.sections.length}</p>
      <h1>${esc(s.name)}</h1>
      <p>${s.type === "text" ? "Escreve o que está na imagem. 5 níveis de zoom, 5 segundos cada." : "Escolha múltipla. O zoom vai diminuindo durante " + S.mcZoomSeconds + " segundos."} · ${s.questions.length} imagens</p>
      <div><button class="btn big" data-act="next">Começar ▶</button></div></div>`);
  }

  // Se uma imagem falhar, tenta de novo uma vez e, se continuar a falhar, mostra o endereço que falhou.
  window.ggImgErr = (img) => {
    if (!img.dataset.retry) { img.dataset.retry = 1; img.src = img.getAttribute("src").split("?")[0] + "?r=" + Date.now(); return; }
    const w = img.parentElement;
    if (!w.querySelector(".imgerr")) w.insertAdjacentHTML("beforeend", `<div class="imgerr" style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:1rem">⚠ Não consegui carregar a imagem<br><small>${esc(img.src)}</small></div>`);
  };

  function renderQuestion() {
    const q = question();
    const optHtml = isText() ? "" : `<div class="opts">${g.optOrder.map((oi, i) => `<div class="opt" style="--c:${OPTION_COLORS[i]}"><span class="l">${OPTION_LETTERS[i]}</span>${esc(opts(q)[oi])}</div>`).join("")}</div>`;
    const lv = isText() ? `<div class="levels">${Array.from({ length: S.textLevels }, (_, i) => `<div class="lv">Nível ${i + 1}</div>`).join("")}</div>` : "";
    host.render(`<div class="stage">
      <div class="qhead">${secChip()}<span class="grow"></span><span class="answered" id="meta"></span><span class="pot" id="pot"></span></div>
      <div class="imgwrap"><img id="qimg" src="img/${q.image}" onerror="ggImgErr(this)" style="transform:scale(${scaleAt(0)})"></div>
      <div class="timer"><div class="fill" id="tfill"></div></div>
      ${lv}${optHtml}
      <div class="foot"><button class="btn ghost" data-act="next">Terminar ronda</button></div></div>`);
    renderQuestionMeta();
    tick();
  }
  function renderQuestionMeta() {
    const el = document.getElementById("meta"); if (!el) return;
    const on = players().filter((p) => p.connected);
    el.textContent = `${on.filter((p) => g.answers[p.id]).length}/${on.length} responderam`;
  }

  function renderReveal() {
    const q = question();
    const imgCol = `<div class="imgcol">
      <div class="imgwrap"><img src="img/${q.image}" onerror="ggImgErr(this)"><div class="banner">✔ ${esc(q.answer)}</div></div>`;
    let body;
    if (isText()) {
      const rows = players().map((p) => {
        const a = g.answers[p.id];
        if (!a) return `<div class="rrow arow" style="--c:${p.color}"><span class="em">${p.emoji}</span><span class="nm">${esc(p.name)}</span><span class="txt muted">— sem resposta</span></div>`;
        const ok = effective(a);
        return `<div class="rrow arow ${ok ? "ok" : "no"}" style="--c:${p.color}" data-act="toggle" data-pid="${p.id}"><span class="em">${p.emoji}</span><span class="nm">${esc(p.name)}</span><span class="txt">${esc(a.text)}</span><span class="lvl">N${a.level}</span><span class="gain">${g.roundPts[p.id] ? "+" + g.roundPts[p.id] : ""}</span><span class="mark">${ok ? "✔" : "✘"}</span></div>`;
      }).join("");
      body = imgCol + `</div><div class="side"><h3 style="color:var(--accent)">⚖ Júri: toca numa resposta para a aceitar ✔ ou recusar ✘</h3>${rows}<h3>Ranking</h3>${rankRows(false)}</div>`;
    } else {
      const o = opts(q);
      const optHtml = g.optOrder.map((oi, i) => {
        const voters = players().filter((p) => g.answers[p.id] && g.answers[p.id].choice === i).map((p) => p.emoji).join("");
        return `<div class="opt ${oi === 0 ? "right" : "dim"}" style="--c:${OPTION_COLORS[i]}"><span class="l">${OPTION_LETTERS[i]}</span>${esc(o[oi])}<span class="voters">${voters}</span></div>`;
      }).join("");
      body = imgCol + `<div class="opts">${optHtml}</div></div><div class="side"><h3>Ranking</h3>${rankRows(true)}</div>`;
    }
    host.render(`<div class="stage"><div class="qhead">${secChip()}</div><div class="main two">${body}</div>
      <div class="foot"><button class="btn big" data-act="next">Próxima ▶</button></div></div>`);
  }

  // ---------- ranking animado entre secções ----------
  function showRanking(replay) {
    g.phase = "ranking";
    if (!replay) { g.rankFrom = g.prevScores || {}; g.prevScores = totals(); }
    const from = g.rankFrom || {};
    const order = (sc) => players().map((p, i) => ({ p, i })).sort((a, b) => (sc(b.p) - sc(a.p)) || a.i - b.i).map((x) => x.p.id);
    const oldOrder = order((p) => from[p.id] || 0), newOrder = order((p) => host.total(p));
    const RH = Math.min(72, Math.floor((window.innerHeight - 260) / Math.max(1, players().length)));
    const rows = players().map((p) => `<div class="rrow" id="r_${p.id}" data-pid="${p.id}" style="--c:${p.color};--rh:${RH - 8}px;transform:translateY(${oldOrder.indexOf(p.id) * RH}px)">
      <span class="pos">${oldOrder.indexOf(p.id) + 1}</span><span class="em">${p.emoji}</span><span class="nm">${esc(p.name)}</span><span class="mv"></span><span class="sc">${from[p.id] || 0}</span></div>`).join("");
    host.render(`<div class="stage"><div class="qhead"><span class="chip">Ranking</span><span>Depois de ${esc(sec().name)}</span></div>
      <div class="rank-wrap"><div class="rank-list" style="height:${RH * players().length}px">${rows}</div></div>
      <div class="foot"><button class="btn big" data-act="next">Próxima secção ▶</button></div></div>`);
    host.broadcastViews(); host.save();
    setTimeout(() => {
      if (g.phase !== "ranking") return;
      host.sfx.reveal();
      players().forEach((p) => {
        const row = document.getElementById("r_" + p.id); if (!row) return;
        const ni = newOrder.indexOf(p.id), oi = oldOrder.indexOf(p.id);
        row.style.transform = `translateY(${ni * RH}px)`;
        row.querySelector(".pos").textContent = ni + 1;
        const mv = row.querySelector(".mv");
        if (ni < oi) { mv.className = "mv up"; mv.textContent = "▲" + (oi - ni); } else if (ni > oi) { mv.className = "mv down"; mv.textContent = "▼" + (ni - oi); }
        const a = from[p.id] || 0, b = host.total(p), t0 = performance.now(), sc = row.querySelector(".sc");
        const step = (now) => { const k = Math.min(1, (now - t0) / 1400); sc.textContent = Math.round(a + (b - a) * k); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }, 1500);
  }

  function showFinal() {
    g.phase = "final"; clearInterval(timer);
    const r = host.ranking();
    const pod = (p, i) => p ? `<div class="pod p${i + 1}" style="--c:${p.color}"><div class="em">${p.emoji}</div><div class="nm">${esc(p.name)}</div><div class="sc">${host.total(p)} pts</div><div class="bar">${i + 1}</div></div>` : "";
    host.render(`<div class="stage"><div class="qhead"><span class="chip">GeoGuesser</span><span>Resultado final</span></div>
      <div class="podium">${[pod(r[1], 1), pod(r[0], 0), pod(r[2], 2)].join("")}</div>
      <div class="rest">${r.slice(3).map((p, i) => `<div class="rrow" style="--c:${p.color}"><span class="pos">${i + 4}</span><span class="em">${p.emoji}</span><span class="nm">${esc(p.name)}</span><span class="sc">${host.total(p)}</span></div>`).join("")}</div>
      <div class="foot"><button class="btn big" data-act="next">Voltar ao lobby</button></div></div>`);
    host.sfx.reveal(); host.broadcastViews(); host.save();
  }

  return api;
};
