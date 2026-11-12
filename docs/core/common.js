// Coisas partilhadas entre o ecrã do anfitrião e o ecrã dos jogadores.
window.PEER_PREFIX = "gg-party-";
window.PEERJS_URL = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";

// Paleta com bom contraste (12 cores)
window.PALETTE = [
  "#e6194b", "#3cb44b", "#4f7cff", "#f58231", "#b05cf0", "#22c7e8",
  "#f032e6", "#bfef45", "#ffe119", "#c08a52", "#2fb5a5", "#ff9ec4",
];

window.EMOJIS = ["😀","😎","🤩","🥳","😈","🤠","🤖","👻","👽","🦄","🐶","🐱","🐼","🦊","🐸","🐵",
  "🦁","🐯","🐨","🐷","🐙","🦖","🐢","🦉","🐧","🦆","🐝","🦋","🌵","🍕","🍔","🍟",
  "🍩","🍉","🍌","🌮","⚽","🏀","🎸","🚀","⚡","🔥","💎","👑","🍀","🌈","☀️","🌙"];

// Cores e letras das opções A-D (iguais no ecrã grande e no telemóvel)
window.OPTION_COLORS = ["#e5484d", "#3e63dd", "#e5a400", "#30a46c"];
window.OPTION_LETTERS = ["A", "B", "C", "D"];

window.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

window.textColorFor = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#111" : "#fff";
};

// ---------- Validação de respostas escritas ----------
function norm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[-‐‑–_]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
const ARTICLES = /^(o|a|os|as|um|uma|the|an)\s+/;
function variants(s) {
  const n = norm(s);
  const v = new Set([n.replace(/ /g, "")]);
  const noArt = n.replace(ARTICLES, "");
  if (noArt) v.add(noArt.replace(/ /g, ""));
  return [...v];
}
// Ignora maiúsculas, acentos, espaços e hífenes; tolera 1 erro (palavras curtas) ou 2 (longas).
window.matchesAnswer = (input, answer, accepted = []) => {
  const given = variants(input).filter(Boolean);
  if (!given.length) return false;
  for (const cand of [answer, ...accepted]) {
    const c = norm(cand).replace(/ /g, "");
    if (!c) continue;
    const tol = c.length <= 3 ? 0 : c.length <= 6 ? 1 : 2;
    for (const g of given) if (lev(g, c) <= tol) return true;
  }
  return false;
};
