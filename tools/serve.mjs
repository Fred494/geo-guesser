// Servidor local muito simples para testar: node serve.mjs [porta]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const root = path.resolve(import.meta.dirname, "..", "docs");
const port = Number(process.argv[2]) || 8080;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`\nSite em http://localhost:${port}/host.html`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list) if (i.family === "IPv4" && !i.internal) console.log(`Na rede local (telemóveis): http://${i.address}:${port}/host.html`);
});
