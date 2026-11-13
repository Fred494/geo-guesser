// Acrescenta uma foto a uma secção: otimiza-a para docs/img/ e regista a pergunta no docs/questions.json.
//
// Escolha múltipla (lisboa, portugal, mundo):
//   node add-photo.mjs lisboa "C:\caminho\foto.jpg" "Resposta certa" "Errada 1" "Errada 2" "Errada 3"
// Hard-core:
//   node add-photo.mjs hardcore "C:\caminho\foto.jpg" "Resposta" "outra resposta aceite" "e outra"
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [secId, file, answer, ...rest] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, "..", "docs");
const qFile = path.join(root, "questions.json");
if (!secId || !file || !answer) { console.log('Uso: node add-photo.mjs <secao> "<ficheiro>" "<resposta certa>" [erradas ou aceites...]'); process.exit(1); }
if (!fs.existsSync(file)) { console.log("Não encontro o ficheiro:", file); process.exit(1); }

const Q = JSON.parse(fs.readFileSync(qFile, "utf8"));
const sec = Q.sections.find((s) => s.id === secId.toLowerCase());
if (!sec) { console.log("Secção desconhecida. Usa uma destas:", Q.sections.map((s) => s.id).join(", ")); process.exit(1); }
if (sec.type === "mc" && rest.length !== 3) { console.log("Nas secções de escolha múltipla indica exatamente 3 respostas erradas."); process.exit(1); }

const nums = sec.questions.map((q) => Number((q.id.match(/(\d+)$/) || [])[1] || 0));
const n = Math.max(0, ...nums) + 1;
const id = `${sec.id}-${String(n).padStart(2, "0")}`;
await sharp(file).rotate().resize({ width: 2500, height: 2500, fit: "inside", withoutEnlargement: true })
  .flatten({ background: "#fff" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(root, "img", id + ".jpg"));
const q = { id, image: id + ".jpg", answer };
if (sec.type === "mc") q.wrong = rest; else q.accepted = rest;
sec.questions.push(q);
fs.writeFileSync(qFile, JSON.stringify(Q, null, 2));
console.log(`OK: ${id} acrescentada à secção ${sec.name} (agora com ${sec.questions.length} perguntas).`);
