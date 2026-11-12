// Mini jogo 1: GeoGuesser (lado do jogador): botões A-D e caixa de texto.
(function () {
  PlayerViews.mc = (v, P) => {
    const d = document.createElement("div");
    d.style.cssText = "display:flex;flex-direction:column;gap:.8rem;flex:1";
    d.innerHTML = `<p class="muted" style="text-align:center">${v.locked !== null ? "🔒 Resposta bloqueada" : "Escolhe a resposta"}</p><div class="mcgrid"></div>`;
    const grid = d.querySelector(".mcgrid");
    OPTION_LETTERS.forEach((L, i) => {
      const b = document.createElement("button");
      b.className = "mcbtn" + (v.locked === i ? " chosen" : ""); b.style.setProperty("--c", OPTION_COLORS[i]);
      b.textContent = L; b.disabled = v.locked !== null;
      b.onclick = () => {
        if (!P.send({ t: "answer", choice: i })) return;
        navigator.vibrate && navigator.vibrate(30);
        document.getElementById("pmain").replaceChildren(PlayerViews.mc({ ...v, locked: i }, P));
      };
      grid.appendChild(b);
    });
    return d;
  };

  PlayerViews.text = (v, P) => {
    const d = document.createElement("div");
    d.className = "center";
    if (v.locked !== null) { d.innerHTML = `<div class="big">🔒</div><h2>Enviado</h2><p>“${esc(v.locked)}”</p><p>Espera pela revelação.</p>`; return d; }
    d.innerHTML = `<h2>O que está na imagem?</h2>
      <input class="field" id="t" maxlength="60" placeholder="Escreve aqui" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
      <button class="btn big" id="s">Enviar</button><p>Só tens um palpite. Quanto mais cedo, mais pontos!</p>`;
    const send = () => {
      const t = d.querySelector("#t").value.trim(); if (!t) return;
      if (!P.send({ t: "answer", text: t })) return;
      navigator.vibrate && navigator.vibrate(30);
      document.getElementById("pmain").replaceChildren(PlayerViews.text({ ...v, locked: t }, P));
    };
    d.querySelector("#s").onclick = send; d.querySelector("#t").onkeydown = (e) => e.key === "Enter" && send();
    return d;
  };
})();
