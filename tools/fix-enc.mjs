import fs from "node:fs";
const dec = new TextDecoder("windows-1252");
const rev = new Map(); for (let b = 0; b < 256; b++) rev.set(dec.decode(Uint8Array.of(b)), b);
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "");
  const bytes = []; let ok = true;
  for (const ch of s) { if (rev.has(ch)) bytes.push(rev.get(ch)); else { ok = false; break; } }
  if (!ok) { fs.writeFileSync(f, s); console.log("sem mojibake (só BOM removido):", f); continue; }
  fs.writeFileSync(f, Buffer.from(bytes).toString("utf8")); console.log("reparado:", f);
}
