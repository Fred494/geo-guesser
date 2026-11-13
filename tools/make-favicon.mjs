// Gera os ícones do site (favicon) a partir do logótipo. Uso: node make-favicon.mjs "<logo>" [left top lado]
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
const [src, l = 430, t = 80, s = 660] = process.argv.slice(2);
const out = path.resolve(import.meta.dirname, "..", "docs");
const base = sharp(src).extract({ left: +l, top: +t, width: +s, height: +s }).flatten({ background: "#ffffff" });
const png = (n) => base.clone().resize(n, n).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync(path.join(out, "icon-512.png"), await png(512));
fs.writeFileSync(path.join(out, "icon-192.png"), await png(192));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), await png(180));
fs.writeFileSync(path.join(out, "favicon-32.png"), await png(32));
// favicon.ico com uma imagem PNG de 48x48 lá dentro
const p48 = await png(48);
const hdr = Buffer.alloc(22);
hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
hdr[6] = 48; hdr[7] = 48; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12);
hdr.writeUInt32LE(p48.length, 14); hdr.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(out, "favicon.ico"), Buffer.concat([hdr, p48]));
console.log("Ícones criados em docs/");
