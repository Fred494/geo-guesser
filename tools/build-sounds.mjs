// Lê os ficheiros de áudio em docs/sounds/ e gera docs/sounds/sounds.json (a lista que os telemóveis mostram).
// O nome que aparece é o nome do ficheiro (sem extensão; "_" e "-" viram espaços).
// Uso: node build-sounds.mjs
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "..", "docs", "sounds");
fs.mkdirSync(dir, { recursive: true });
const list = fs.readdirSync(dir)
  .filter((f) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, "pt"))
  .map((f) => ({ file: f, name: path.parse(f).name.replace(/[_-]+/g, " ").trim() }));
fs.writeFileSync(path.join(dir, "sounds.json"), JSON.stringify(list, null, 2));
console.log(`${list.length} sons registados:`, list.map((s) => s.name).join(", ") || "(nenhum)");
